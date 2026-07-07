"""Baixa os dados de treino do modelo de risco de NEOs.

Fontes (ambas abertas, sem chave):
  1. CNEOS Close Approach Data (CAD): histórico de aproximações da Terra
     https://ssd-api.jpl.nasa.gov/doc/cad.html
  2. SBDB Query: parâmetros físicos/orbitais + flag PHA oficial de todos os NEOs
     https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html

Saída: backend/data/close_approaches.csv e backend/data/neo_objects.csv
"""

from __future__ import annotations

import sys
from pathlib import Path

import httpx
import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

CAD_URL = "https://ssd-api.jpl.nasa.gov/cad.api"
SBDB_URL = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"

# Janela histórica: aproximações reais já observadas/calculadas.
CAD_PARAMS = {
    "date-min": "1990-01-01",
    "date-max": "2026-07-07",
    "dist-max": "0.1",  # até 0.1 AU (~39 distâncias lunares)
    "sort": "date",
}

SBDB_PARAMS = {
    # pdes = designação primária (chave de junção com o CAD `des`)
    "fields": "pdes,full_name,neo,pha,H,diameter,albedo,e,a,q,i,om,w,moid,class",
    "sb-group": "neo",
}


def fetch_json(url: str, params: dict) -> dict:
    with httpx.Client(timeout=120) as client:
        r = client.get(url, params=params)
        r.raise_for_status()
        return r.json()


def fetch_cad() -> pd.DataFrame:
    print(f"Baixando CNEOS CAD ({CAD_PARAMS['date-min']} a {CAD_PARAMS['date-max']}, "
          f"dist <= {CAD_PARAMS['dist-max']} AU)...")
    payload = fetch_json(CAD_URL, CAD_PARAMS)
    df = pd.DataFrame(payload["data"], columns=payload["fields"])
    print(f"  {len(df):,} aproximações")
    return df


def fetch_sbdb() -> pd.DataFrame:
    print("Baixando SBDB (todos os NEOs)...")
    payload = fetch_json(SBDB_URL, SBDB_PARAMS)
    df = pd.DataFrame(payload["data"], columns=[f["name"] if isinstance(f, dict) else f
                                                for f in payload["fields"]])
    print(f"  {len(df):,} objetos")
    return df


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    cad = fetch_cad()
    cad.to_csv(DATA_DIR / "close_approaches.csv", index=False)

    sbdb = fetch_sbdb()
    sbdb.to_csv(DATA_DIR / "neo_objects.csv", index=False)

    print(f"Salvo em {DATA_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
