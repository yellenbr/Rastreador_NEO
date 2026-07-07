/**
 * format.js — Formatação de números e localização (pt-BR).
 *
 * Funções puras, sem estado. Isoladas para reutilização e teste.
 */
(function (NW) {
  "use strict";

  /**
   * Formata um número em pt-BR com casas decimais fixas.
   * @param {number} n valor
   * @param {number} [d=0] casas decimais
   */
  function fmt(n, d) {
    return n.toLocaleString("pt-BR", {
      minimumFractionDigits: d || 0,
      maximumFractionDigits: d || 0,
    });
  }

  /** Converte distâncias lunares (DL) em km formatados. */
  function ldToKm(ld) {
    return fmt(Math.round(ld * NW.CONFIG.KM_PER_LD)) + " km";
  }

  /** Capitaliza a primeira letra e remove o artigo inicial ("a Torre" → "Torre"). */
  function stripArticle(phrase) {
    const cap = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    return cap.replace(/^(Uma|Um|O|A) /, "");
  }

  NW.format = { fmt, ldToKm, stripArticle };
})(window.NW || (window.NW = {}));
