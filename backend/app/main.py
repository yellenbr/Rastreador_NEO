"""API do Sentinela — serve o modelo de risco de NEOs.

Fluxo: NASA NeoWs (aproximações da semana) → features → modelo XGBoost
(treinado offline em backend/train/train.py) → score de risco + explicação
SHAP por asteroide → frontend.

Config: variável de ambiente NASA_API_KEY (arquivo .env na raiz do backend).
Sem chave, usa DEMO_KEY (30 req/h) — as respostas do NeoWs são cacheadas em
disco para não estourar o limite durante o desenvolvimento.
"""

from __future__ import annotations

import json
import os
import re
from datetime import date, timedelta
from pathlib import Path

import httpx
import joblib
import numpy as np
import pandas as pd
import shap
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

NASA_API_KEY = os.getenv("NASA_API_KEY", "DEMO_KEY")
NEOWS_FEED = "https://api.nasa.gov/neo/rest/v1/feed"
CACHE_DIR = BASE_DIR / "data" / "neows_cache"
KM_PER_LD = 384_400.0

# ---------- artefatos carregados na inicialização ----------
ARTIFACT = joblib.load(BASE_DIR / "app" / "model.joblib")
MODEL = ARTIFACT["model"]
FEATURES: list[str] = ARTIFACT["features"]
EXPLAINER = shap.TreeExplainer(MODEL)
FALLBACK = ARTIFACT["shap_background_mean"]  # mediana/média p/ features ausentes

# Catálogo local SBDB para enriquecer o NeoWs com elementos orbitais.
_sbdb = pd.read_csv(BASE_DIR / "data" / "neo_objects.csv")
_sbdb["des"] = _sbdb["pdes"].astype(str).str.strip()
SBDB = _sbdb.set_index("des")[["e", "i", "q", "diameter", "albedo"]].apply(
    pd.to_numeric, errors="coerce"
)

app = FastAPI(title="Sentinela NEO Risk API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

FEATURE_LABELS = {
    "dist_ld": "Distância mínima (DL)",
    "v_rel": "Velocidade relativa (km/s)",
    "h_mag": "Magnitude absoluta (H)",
    "diameter_km": "Diâmetro (km)",
    "ecc": "Excentricidade orbital",
    "inc": "Inclinação orbital (°)",
    "q_au": "Periélio (AU)",
}


def designation_from_name(name: str) -> str:
    """'(2026 MQ2)' → '2026 MQ2' · '388945 (2008 TZ3)' → '2008 TZ3'."""
    m = re.search(r"\(([^)]+)\)", name)
    return (m.group(1) if m else name).strip()


def fetch_feed(start: date) -> dict:
    """Busca o feed NeoWs de 7 dias, com cache em disco (protege o DEMO_KEY)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"feed_{start.isoformat()}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    end = start + timedelta(days=6)
    try:
        with httpx.Client(timeout=60) as client:
            r = client.get(NEOWS_FEED, params={
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "api_key": NASA_API_KEY,
            })
            r.raise_for_status()
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        detail = ("Limite do DEMO_KEY atingido — configure NASA_API_KEY no backend/.env"
                  if code == 429 else f"NeoWs retornou {code}")
        raise HTTPException(status_code=502, detail=detail) from e
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Falha ao acessar o NeoWs: {e}") from e

    payload = r.json()
    cache_file.write_text(json.dumps(payload), encoding="utf-8")
    return payload


def build_features(neo: dict, approach: dict) -> tuple[dict, list[str]]:
    """Extrai as features do modelo de um objeto NeoWs + sua aproximação."""
    des = designation_from_name(neo.get("name", ""))
    est = neo.get("estimated_diameter", {}).get("kilometers", {})
    d_min, d_max = est.get("estimated_diameter_min"), est.get("estimated_diameter_max")

    row, imputed = {}, []
    row["dist_ld"] = float(approach["miss_distance"]["lunar"])
    row["v_rel"] = float(approach["relative_velocity"]["kilometers_per_second"])
    row["h_mag"] = float(neo["absolute_magnitude_h"])
    row["diameter_km"] = (d_min + d_max) / 2 if d_min and d_max else FALLBACK["diameter_km"]

    orb = SBDB.loc[des] if des in SBDB.index else None
    for feat, col in (("ecc", "e"), ("inc", "i"), ("q_au", "q")):
        val = float(orb[col]) if orb is not None and pd.notna(orb[col]) else None
        if val is None:
            val = FALLBACK[feat]
            imputed.append(feat)
        row[feat] = val
    return row, imputed


def score_batch(rows: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    X = pd.DataFrame(rows, columns=FEATURES)
    probs = MODEL.predict_proba(X)[:, 1]
    shap_values = EXPLAINER.shap_values(X)
    return probs, shap_values


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_loaded": True}


@app.get("/model/info")
def model_info() -> dict:
    return {
        "features": FEATURES,
        "feature_labels": FEATURE_LABELS,
        "metrics": ARTIFACT["metrics"],
        "shap_global": ARTIFACT["shap_global"],
        "trained_on": ARTIFACT["trained_on"],
    }


@app.get("/neos/week")
def neos_week(start: date = Query(default=None)) -> dict:
    """Asteroides dos próximos 7 dias com score de risco e explicação SHAP."""
    start = start or date.today()
    feed = fetch_feed(start)

    items, rows = [], []
    for day, neos in sorted(feed.get("near_earth_objects", {}).items()):
        for neo in neos:
            approaches = neo.get("close_approach_data") or []
            if not approaches:
                continue
            ap = approaches[0]
            row, imputed = build_features(neo, ap)
            rows.append(row)
            items.append({
                "id": neo["id"],
                "name": neo["name"],
                "designation": designation_from_name(neo["name"]),
                "date": day,
                "epoch_ms": ap["epoch_date_close_approach"],
                "size_m": round(row["diameter_km"] * 1000, 1),
                "h_mag": row["h_mag"],
                "vel_kms": round(row["v_rel"], 1),
                "dist_ld": round(row["dist_ld"], 2),
                "dist_km": round(row["dist_ld"] * KM_PER_LD),
                "nasa_hazardous": bool(neo["is_potentially_hazardous_asteroid"]),
                "imputed_features": imputed,
            })

    if not items:
        return {"start": start.isoformat(), "count": 0, "items": []}

    probs, shap_values = score_batch(rows)
    for item, row, p, sv in zip(items, rows, probs, shap_values):
        contribs = sorted(
            ({"feature": f, "label": FEATURE_LABELS[f],
              "value": round(row[f], 3), "shap": round(float(s), 4)}
             for f, s in zip(FEATURES, sv)),
            key=lambda c: -abs(c["shap"]),
        )
        item["risk_score"] = round(float(p), 4)
        item["model_hazardous"] = bool(p >= 0.5)
        item["agrees_with_nasa"] = item["model_hazardous"] == item["nasa_hazardous"]
        item["shap"] = contribs

    items.sort(key=lambda i: -i["risk_score"])
    return {
        "start": start.isoformat(),
        "count": len(items),
        "model_metrics": {
            "roc_auc": round(ARTIFACT["metrics"]["roc_auc_mean"], 4),
            "pr_auc": round(ARTIFACT["metrics"]["pr_auc_mean"], 4),
        },
        "items": items,
    }
