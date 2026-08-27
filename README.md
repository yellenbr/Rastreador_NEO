# Sentinela (NEO·WATCH) — Rastreador de asteroides com modelo próprio de risco

Dashboard que mostra as passagens de asteroides próximos da Terra na semana —
**com dados reais da NASA** — e as prioriza com um **modelo próprio de score de
risco (XGBoost)**, explicado feature a feature com **SHAP** e comparado com a
classificação oficial de "potencialmente perigoso" (PHA) da NASA.

> O Sentinela começou como uma visualização de dados simulados; evoluiu para
> incluir um modelo próprio de priorização de risco, com validação contra a
> classificação oficial da NASA e análise de quais fatores orbitais mais
> contribuem para o risco.

## Por que não prever o flag da NASA e pronto?

A API NeoWs já entrega `is_potentially_hazardous_asteroid`, calculado por uma
regra determinística: **MOID ≤ 0,05 AU e H ≤ 22**. Treinar um modelo com as
mesmas variáveis seria reconstruir uma regra que já existe (vazamento de dado
disfarçado de acurácia alta). Este projeto faz diferente:

- O **MOID fica fora das features de propósito** — o modelo precisa aprender
  risco a partir da geometria de cada aproximação real (distância, velocidade)
  e das características físicas/orbitais do objeto.
- A saída é um **score contínuo por aproximação** (ranking de priorização),
  algo que o flag binário da NASA não oferece.
- O dashboard mostra **onde o modelo concorda e discorda da NASA**, com a
  explicação SHAP do porquê. Exemplo real: `452639 (2005 UY6)` tem ~1 km de
  diâmetro e recebe score alto do modelo, mas não é PHA para a NASA porque a
  órbita dele nunca chega perto o bastante (MOID grande) — exatamente a
  informação que o modelo não vê.

### Limitações conhecidas (honestidade científica)

- H (magnitude absoluta) é metade da regra PHA, então o modelo tem acesso
  parcial ao mecanismo do rótulo — o SHAP confirma que H domina a decisão.
  O valor está no ranking contínuo e na análise de discordância, não em
  "descobrir" o PHA.
- Risco real de impacto exige propagação orbital (JPL Sentry). Validar o score
  contra as probabilidades do Sentry é o próximo passo do roadmap.

## Resultados

| Métrica (validação) | Valor |
| --- | --- |
| ROC-AUC | **0,994 ± 0,001** |
| PR-AUC | **0,921 ± 0,009** |
| Validação | GroupKFold(5) **agrupado por objeto** |
| Dados | 37.845 aproximações · 25.716 objetos (CNEOS CAD 1990–2026 × SBDB) |

GroupKFold por objeto é essencial: o mesmo asteroide tem dezenas de
aproximações históricas; K-Fold aleatório vazaria informação entre treino e
teste e inflaria as métricas.

Importância SHAP global: `h_mag` ≫ `diameter_km` > `dist_ld` > `inc` > `q_au`
> `v_rel` > `ecc` — consistente com a física (tamanho domina o potencial de
dano; a geometria da aproximação modula).

## Arquitetura

```
CNEOS CAD + SBDB (histórico, JPL)          NASA NeoWs (semana atual)
        │                                          │
        ▼ (offline)                                ▼ (runtime)
backend/train/fetch_data.py            backend FastAPI  ──►  score + SHAP
backend/train/train.py ──► model.joblib ──────┘                  │
                                                                 ▼
                                             frontend Sentinela (JS puro)
                                             score IA vs. flag NASA + SHAP
```

### Backend (`backend/`)

| Arquivo | Papel |
| --- | --- |
| `train/fetch_data.py` | Baixa histórico CNEOS Close Approach + catálogo SBDB (sem chave) |
| `train/train.py` | Features, GroupKFold, XGBoost, SHAP → `app/model.joblib` |
| `app/main.py` | FastAPI: `/neos/week` (NeoWs + score + SHAP), `/model/info`, `/health` |

### Frontend (raiz + `src/`)

JS puro em camadas, sem build e sem runtime proprietário:
`data.js` (fallback simulado) · `api.js` (cliente do backend) · `format.js` ·
`model.js` (view-models puros) · `store.js` (estado observável) · `ui.js`
(render) · `app.js` (controller). Com o backend offline, o app roda com dados
simulados e sinaliza isso na tela.

## Como executar

```bash
# 1. Backend (Python 3.12+)
pip install -r backend/requirements.txt
python backend/train/fetch_data.py     # baixa os dados (~9 MB, sem chave)
python backend/train/train.py          # treina e salva model.joblib
python -m uvicorn backend.app.main:app --port 8000

# 2. Frontend: abra index.html no navegador
```

Chave da NASA (opcional, recomendado): gere gratuitamente em
https://api.nasa.gov e coloque em `backend/.env` (veja `backend/.env.example`).
Sem chave, o backend usa `DEMO_KEY` (30 req/h) com cache em disco.

## Roadmap

- [x] Score contínuo de risco por aproximação + SHAP por objeto
- [x] Comparação modelo vs. flag PHA oficial no dashboard
- [ ] Validação contra probabilidades de impacto do JPL Sentry
- [ ] Forecasting de frequência de NEOs perigosos (série temporal)

## Referências

- NASA NeoWs — https://api.nasa.gov
- CNEOS Close Approach Data API — https://ssd-api.jpl.nasa.gov/doc/cad.html
- SBDB Query API — https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html
- Definição de PHA (MOID ≤ 0,05 AU, H ≤ 22) — https://cneos.jpl.nasa.gov/about/neo_groups.html

## Licença

[MIT](LICENSE)
