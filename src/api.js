/**
 * api.js — Cliente do backend Sentinela (FastAPI).
 *
 * Busca as aproximações da semana já pontuadas pelo modelo de risco e as
 * converte para o formato interno do app. Se o backend estiver offline, o
 * app continua com os dados simulados de data.js.
 */
(function (NW) {
  "use strict";

  // Em localhost usa o backend local; em produção, o backend hospedado no Render.
  const PRODUCTION_API_BASE = "https://rastreador-neo.onrender.com";
  const isLocal = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  const API_BASE = isLocal ? "http://localhost:8000" : PRODUCTION_API_BASE;

  /* Aparência determinística por objeto (blob/cor/textura variam com o id). */
  const BLOBS = [
    "46% 54% 58% 42% / 52% 48% 60% 40%",
    "54% 46% 42% 58% / 44% 60% 40% 56%",
    "58% 42% 50% 50% / 46% 58% 42% 54%",
    "50% 50% 44% 56% / 56% 44% 52% 48%",
    "44% 56% 54% 46% / 60% 40% 56% 44%",
    "52% 48% 46% 54% / 48% 56% 44% 56%",
  ];
  const ROCK_COLORS = ["#5c4f3d", "#4a443e", "#63503a", "#43403c", "#544738", "#4d4336"];
  const FILTERS = [
    "sepia(.55) saturate(1.5) brightness(.95)",
    "sepia(.25) saturate(1.1) brightness(.9)",
    "sepia(.65) saturate(1.6) brightness(1)",
    "sepia(.15) brightness(.85)",
    "sepia(.5) saturate(1.4) brightness(.92)",
    "sepia(.4) saturate(1.2) brightness(.88)",
  ];

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  /** 'sáb · 11 jul · 03:11 UTC' a partir da data + epoch da aproximação. */
  function dateLabel(epochMs) {
    const d = new Date(epochMs);
    const wd = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
    const dm = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "").replace(" de ", " ");
    const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    return wd + " · " + dm + " · " + hm + " UTC";
  }

  /** Converte um item da API para o formato interno de asteroide. */
  function toAsteroid(item) {
    const h = hash(item.id);
    return {
      id: item.id,
      name: item.name.replace(/^\(|\)$/g, ""),
      shortName: item.designation.split(" ").pop(),
      date: dateLabel(item.epoch_ms),
      sizeM: Math.round(item.size_m),
      vel: item.vel_kms,
      ld: item.dist_ld,
      h: item.h_mag,
      haz: item.nasa_hazardous,
      angle: h % 360,
      blob: BLOBS[h % BLOBS.length],
      c2: ROCK_COLORS[h % ROCK_COLORS.length],
      texPos: (h % 80) + "% " + ((h >> 3) % 80) + "%",
      texFilter: FILTERS[(h >> 5) % FILTERS.length],
      risk: {
        score: item.risk_score,
        modelHazardous: item.model_hazardous,
        agrees: item.agrees_with_nasa,
        shap: item.shap,
      },
    };
  }

  /** Carrega a semana ao vivo; resolve null se o backend estiver fora do ar. */
  async function loadWeek() {
    try {
      const res = await fetch(API_BASE + "/neos/week");
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.items || !data.items.length) return null;

      const asteroids = data.items.map(toAsteroid);
      // marca o mais próximo (usado pelo botão "aproximação recorde")
      const closest = asteroids.reduce((a, b) => (b.ld < a.ld ? b : a));
      closest.closest = true;
      return { asteroids, meta: { start: data.start, count: data.count, metrics: data.model_metrics } };
    } catch (_e) {
      return null;
    }
  }

  NW.api = { loadWeek, API_BASE };
})(window.NW || (window.NW = {}));
