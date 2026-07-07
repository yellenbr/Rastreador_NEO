"""Treina o modelo de score de risco de NEOs.

Decisões importantes (ver README):
  - O alvo é o flag PHA oficial, mas o MOID — metade da regra da NASA
    (MOID <= 0.05 AU e H <= 22) — fica FORA das features. O modelo aprende a
    ranquear risco a partir da geometria de cada aproximação real (distância,
    velocidade) + características físicas/orbitais, produzindo um score
    contínuo por aproximação, algo que o flag binário da NASA não oferece.
  - Validação com GroupKFold por objeto: o mesmo asteroide tem dezenas de
    aproximações; K-Fold aleatório vazaria informação entre treino e teste.

Saída: backend/app/model.joblib (modelo + metadados + importâncias SHAP)
"""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import GroupKFold
from xgboost import XGBClassifier

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUT_PATH = Path(__file__).resolve().parents[1] / "app" / "model.joblib"

KM_PER_AU = 149_597_870.7
KM_PER_LD = 384_400.0
DEFAULT_ALBEDO = 0.14

FEATURES = [
    "dist_ld",       # distância mínima da aproximação (distâncias lunares)
    "v_rel",         # velocidade relativa (km/s)
    "h_mag",         # magnitude absoluta H
    "diameter_km",   # diâmetro (medido ou estimado via H)
    "ecc",           # excentricidade orbital
    "inc",           # inclinação orbital (graus)
    "q_au",          # periélio (AU)
]


def estimate_diameter_km(h: pd.Series, albedo: pd.Series) -> pd.Series:
    """D = 1329 / sqrt(albedo) * 10^(-H/5) — relação padrão H → diâmetro."""
    a = albedo.fillna(DEFAULT_ALBEDO).clip(lower=0.01)
    return 1329.0 / np.sqrt(a) * np.power(10.0, -h / 5.0)


def build_dataset() -> pd.DataFrame:
    cad = pd.read_csv(DATA_DIR / "close_approaches.csv")
    sbdb = pd.read_csv(DATA_DIR / "neo_objects.csv")

    sbdb = sbdb.rename(columns={"pdes": "des"})
    sbdb["des"] = sbdb["des"].astype(str).str.strip()
    cad["des"] = cad["des"].astype(str).str.strip()

    df = cad.merge(sbdb, on="des", how="inner", suffixes=("_cad", "_sbdb"))
    print(f"Aproximações com objeto identificado: {len(df):,}")

    num = lambda c: pd.to_numeric(df[c], errors="coerce")
    out = pd.DataFrame({
        "des": df["des"],
        "dist_ld": num("dist") * KM_PER_AU / KM_PER_LD,
        "v_rel": num("v_rel"),
        # H vem das duas fontes; prioriza SBDB e cai para o CAD
        "h_mag": num("H").fillna(num("h")),
        "ecc": num("e"),
        "inc": num("i"),
        "q_au": num("q"),
        "albedo": num("albedo"),
        "diameter_measured": num("diameter"),
        "pha": (df["pha"].astype(str).str.upper() == "Y").astype(int),
    })
    out["diameter_km"] = out["diameter_measured"].fillna(
        estimate_diameter_km(out["h_mag"], out["albedo"])
    )
    out = out.dropna(subset=["dist_ld", "v_rel", "h_mag", "diameter_km"])
    # excentricidade/inclinação/periélio raramente faltam; preenche com mediana
    for c in ("ecc", "inc", "q_au"):
        out[c] = out[c].fillna(out[c].median())
    print(f"Dataset final: {len(out):,} aproximações · "
          f"{out['des'].nunique():,} objetos · PHA: {out['pha'].mean():.1%}")
    return out


def make_model(pos_weight: float) -> XGBClassifier:
    return XGBClassifier(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.06,
        subsample=0.9,
        colsample_bytree=0.9,
        scale_pos_weight=pos_weight,  # trata o desbalanceamento de classes
        eval_metric="aucpr",
        n_jobs=-1,
        random_state=42,
    )


def cross_validate(df: pd.DataFrame) -> dict:
    X, y, groups = df[FEATURES], df["pha"], df["des"]
    pos_weight = float((y == 0).sum() / max((y == 1).sum(), 1))

    aucs, aps = [], []
    gkf = GroupKFold(n_splits=5)
    for fold, (tr, te) in enumerate(gkf.split(X, y, groups), 1):
        model = make_model(pos_weight)
        model.fit(X.iloc[tr], y.iloc[tr])
        p = model.predict_proba(X.iloc[te])[:, 1]
        auc = roc_auc_score(y.iloc[te], p)
        ap = average_precision_score(y.iloc[te], p)
        aucs.append(auc)
        aps.append(ap)
        print(f"  fold {fold}: ROC-AUC {auc:.4f} · PR-AUC {ap:.4f}")

    return {
        "cv": "GroupKFold(5) por objeto (des)",
        "roc_auc_mean": float(np.mean(aucs)),
        "roc_auc_std": float(np.std(aucs)),
        "pr_auc_mean": float(np.mean(aps)),
        "pr_auc_std": float(np.std(aps)),
        "n_rows": int(len(df)),
        "n_objects": int(df["des"].nunique()),
        "pha_rate": float(df["pha"].mean()),
        "pos_weight": pos_weight,
    }


def main() -> int:
    df = build_dataset()

    print("Validação cruzada (GroupKFold por objeto):")
    metrics = cross_validate(df)
    print(f"ROC-AUC {metrics['roc_auc_mean']:.4f} ± {metrics['roc_auc_std']:.4f} · "
          f"PR-AUC {metrics['pr_auc_mean']:.4f} ± {metrics['pr_auc_std']:.4f}")

    print("Treinando modelo final com todos os dados...")
    model = make_model(metrics["pos_weight"])
    model.fit(df[FEATURES], df["pha"])

    # Importância SHAP global (média do |valor| numa amostra) para o dashboard.
    sample = df[FEATURES].sample(min(2000, len(df)), random_state=42)
    explainer = shap.TreeExplainer(model)
    sv = explainer.shap_values(sample)
    global_importance = dict(zip(FEATURES, np.abs(sv).mean(axis=0).tolist()))
    print("Importância SHAP global:",
          {k: round(v, 3) for k, v in sorted(global_importance.items(),
                                             key=lambda kv: -kv[1])})

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "model": model,
        "features": FEATURES,
        "metrics": metrics,
        "shap_global": global_importance,
        "shap_background_mean": sample.mean().to_dict(),
        "trained_on": "CNEOS CAD 1990–2026 × SBDB (JPL)",
    }, OUT_PATH)
    print(f"Modelo salvo em {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
