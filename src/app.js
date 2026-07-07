/**
 * app.js — Ponto de entrada (controller).
 *
 * Cria o store, conecta a renderização e traduz os cliques (delegação de
 * eventos) em transições de estado.
 */
(function (NW) {
  "use strict";

  function boot() {
    const root = document.getElementById("app");
    const cfg = NW.CONFIG;

    const store = NW.createStore({
      selectedId: null,
      collected: {},
      xp: cfg.XP_INITIAL,
      asteroids: NW.NEO_DATA, // dados simulados até o backend responder
      live: false,
      liveMeta: null,
    });

    // Tenta trocar para dados reais (NASA NeoWs + modelo de risco via FastAPI).
    NW.api.loadWeek().then((week) => {
      if (week) {
        store.setState({ asteroids: week.asteroids, live: true, liveMeta: week.meta, selectedId: null });
      }
    });

    // Re-renderiza a cada mudança de estado.
    store.subscribe((state) => NW.ui.render(root, state));

    // Alterna o estado "catalogado" de um asteroide e ajusta o XP.
    function toggleCollect(id) {
      store.setState((s) => {
        const collected = Object.assign({}, s.collected);
        let xp = s.xp;
        if (collected[id]) {
          delete collected[id];
          xp -= cfg.XP_PER_CATALOG;
        } else {
          collected[id] = true;
          xp += cfg.XP_PER_CATALOG;
        }
        return { collected, xp };
      });
    }

    // Delegação de eventos: um único listener para toda a árvore.
    root.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      const action = target.getAttribute("data-action");
      const id = target.getAttribute("data-id");

      switch (action) {
        case "open":
          store.setState({ selectedId: id });
          break;
        case "open-closest": {
          const data = store.get().asteroids;
          const closest = data.find((a) => a.closest) || data[0];
          store.setState({ selectedId: closest.id });
          break;
        }
        case "collect":
          e.stopPropagation(); // não abrir o detalhe ao catalogar
          toggleCollect(id);
          break;
        case "close":
          store.setState({ selectedId: null });
          break;
        case "stop":
          e.stopPropagation(); // clique dentro do modal não fecha
          break;
      }
    });

    // Fecha o detalhe com Esc.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && store.get().selectedId) {
        store.setState({ selectedId: null });
      }
    });

    // Primeira renderização.
    NW.ui.render(root, store.get());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.NW || (window.NW = {}));
