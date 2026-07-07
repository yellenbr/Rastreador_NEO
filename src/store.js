/**
 * store.js — Estado da aplicação com padrão observador.
 *
 * Substitui o `state`/`setState` do runtime Fable por um store mínimo e explícito.
 * `setState` aceita um objeto parcial ou uma função (prevState) => partial.
 */
(function (NW) {
  "use strict";

  function createStore(initialState) {
    let state = Object.assign({}, initialState);
    const listeners = new Set();

    return {
      get() {
        return state;
      },
      setState(patch) {
        const partial = typeof patch === "function" ? patch(state) : patch;
        state = Object.assign({}, state, partial);
        listeners.forEach((fn) => fn(state));
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
  }

  NW.createStore = createStore;
})(window.NW || (window.NW = {}));
