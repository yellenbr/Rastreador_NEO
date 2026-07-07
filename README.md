# NEO·WATCH — Rastreador de asteroides próximos

Painel que mostra as passagens de asteroides próximos da Terra na semana, com
comparação de tamanho, régua Terra → Lua, mapa orbital e uma camada de
gamificação (XP, sequência, coleção). Dados simulados no formato NASA NeoWs.

## Como executar

Abra `index.html` no navegador (basta dar dois cliques). Não há build nem
dependências — apenas as fontes do Google Fonts e as texturas de planeta são
carregadas da internet.

## Arquitetura

O projeto foi migrado do formato proprietário **Fable/DC** (que dependia do
runtime `support.js` e de diretivos `<x-dc>`, `sc-if`, `sc-for`, `{{ }}`) para
JavaScript puro, organizado em camadas com responsabilidades claras:

| Arquivo          | Responsabilidade                                                       |
| ---------------- | --------------------------------------------------------------------- |
| `index.html`     | Estrutura mínima, camadas de fundo e ponto de montagem (`#app`).      |
| `styles.css`     | Todo o estilo, com tokens de design (variáveis CSS) e classes.        |
| `src/data.js`    | Dados brutos e constantes de domínio (camada de dados pura).          |
| `src/format.js`  | Formatação de números e localização pt-BR (funções puras).           |
| `src/model.js`   | Regras de negócio e view-models (puros, sem DOM nem eventos).        |
| `src/store.js`   | Estado da aplicação com padrão observador (`subscribe`/`setState`).   |
| `src/ui.js`      | Renderização (HTML a partir dos view-models).                         |
| `src/app.js`     | Controller: conecta store, render e interações (delegação de eventos).|

### Fluxo de dados

```
dados + estado  ──►  model (view-models)  ──►  ui (HTML)  ──►  DOM
      ▲                                                          │
      └────────────  store.setState  ◄──  app (eventos)  ◄───────┘
```

Um clique é capturado por um único listener (delegação via `data-action` /
`data-id`), que chama `store.setState`; o store notifica os assinantes e a tela
é re-renderizada a partir do novo estado.

### Principais melhorias em relação ao formato Fable

- **Sem runtime proprietário** — removidos `support.js` e o `.dc.html`.
- **Separação de responsabilidades** — dados, lógica, estado, view e controller
  em módulos independentes e testáveis.
- **Estilos extraídos** — ~40 KB de estilos inline viraram classes semânticas e
  tokens de design reutilizáveis.
- **Lógica pura e testável** — `model.js` e `format.js` não tocam no DOM.
