/**
 * model.js — Regras de negócio e view-models (puros).
 *
 * Transforma dados brutos + estado em objetos prontos para exibição.
 * Nenhum acesso ao DOM e nenhum manipulador de evento aqui — a UI cuida disso.
 */
(function (NW) {
  "use strict";

  const { fmt, ldToKm, stripArticle } = NW.format;

  /** Classifica o nível de ameaça de um asteroide. */
  function threat(a) {
    if (a.sizeM >= 140 || a.haz) {
      return { label: "NOTÁVEL", color: "#ff6b6b", dim: "rgba(255,107,107,.4)", bg: "rgba(255,107,107,.08)" };
    }
    if (a.sizeM >= 25) {
      return { label: "MODERADO", color: "#ffb454", dim: "rgba(255,180,84,.4)", bg: "rgba(255,180,84,.08)" };
    }
    return { label: "BAIXO", color: "#8affc1", dim: "rgba(138,255,193,.35)", bg: "rgba(138,255,193,.06)" };
  }

  /** Escolhe o objeto de referência mais próximo em escala logarítmica. */
  function bestRef(sizeM) {
    let best = NW.SIZE_REFS[0];
    let bestDist = Infinity;
    for (const r of NW.SIZE_REFS) {
      const d = Math.abs(Math.log(sizeM / r.m));
      if (d < bestDist) { bestDist = d; best = r; }
    }
    return best;
  }

  /** Frase curta de comparação de tamanho ("≈ 3 girafas"). */
  function compText(a) {
    const r = bestRef(a.sizeM);
    const n = a.sizeM / r.m;
    if (n >= 0.85 && n <= 1.2) {
      const de = r.one.startsWith("o ")
        ? "do " + r.one.slice(2)
        : r.one.startsWith("a ")
          ? "da " + r.one.slice(2)
          : "de " + r.one;
      return "do tamanho " + de;
    }
    const nf = n >= 10 ? fmt(Math.round(n)) : fmt(n, 1);
    return "≈ " + nf + " " + (n < 2 ? r.one.replace(/^(uma|um|o|a) /, "") : r.many);
  }

  /** Cor e rótulo do score de risco do modelo (0–1). */
  function riskStyle(score) {
    if (score >= 0.5) return { color: "#ff6b6b", dim: "rgba(255,107,107,.4)" };
    if (score >= 0.2) return { color: "#ffb454", dim: "rgba(255,180,84,.4)" };
    return { color: "#8affc1", dim: "rgba(138,255,193,.35)" };
  }

  /** Campos de risco do modelo (null quando rodando com dados simulados). */
  function riskVM(a) {
    if (!a.risk) return null;
    const s = riskStyle(a.risk.score);
    return {
      scoreLabel: (a.risk.score * 100).toFixed(0) + "%",
      score: a.risk.score,
      color: s.color,
      dim: s.dim,
      agrees: a.risk.agrees,
      modelHazardous: a.risk.modelHazardous,
      shap: a.risk.shap || [],
    };
  }

  /**
   * View-model de um asteroide para a lista e a régua.
   * @param {object} a dado bruto
   * @param {boolean} collected se já foi catalogado
   */
  function asteroidVM(a, collected) {
    const t = threat(a);
    return {
      risk: riskVM(a),
      id: a.id,
      name: a.name,
      shortName: a.shortName,
      isClosest: !!a.closest,
      blob: a.blob,
      c2: a.c2,
      texPos: a.texPos,
      texFilter: a.texFilter,
      dateLabel: a.date,
      sizeLabel: fmt(a.sizeM) + " m de diâmetro",
      comp: compText(a),
      velLabel: fmt(a.vel, 1) + " km/s",
      ldLabel: fmt(a.ld, 1) + " DL",
      kmLabel: ldToKm(a.ld),
      threatLabel: t.label, threatColor: t.color, threatDim: t.dim, threatBg: t.bg,
      borderColor: a.closest ? "rgba(255,180,84,.5)" : "rgba(120,180,240,.16)",
      collected,
      collectLabel: collected ? "✓ CATALOGADO" : "CATALOGAR",
      collectBg: collected ? "rgba(138,255,193,.14)" : "transparent",
      collectFg: collected ? "#8affc1" : "#4be1ff",
      collectBorder: collected ? "rgba(138,255,193,.5)" : "rgba(75,225,255,.45)",
    };
  }

  /** Barras SHAP para o modal (top contribuições, sinal = direção do risco). */
  function shapBars(risk) {
    if (!risk || !risk.shap.length) return [];
    const top = risk.shap.slice(0, 4);
    const maxAbs = Math.max(...top.map((c) => Math.abs(c.shap)));
    return top.map((c) => ({
      label: c.label,
      valueLabel: fmt(c.value, c.value < 10 ? 2 : 0),
      pct: Math.max(3, (Math.abs(c.shap) / maxAbs) * 100).toFixed(1) + "%",
      positive: c.shap > 0,
      color: c.shap > 0 ? "#ff6b6b" : "#8affc1",
      glow: c.shap > 0 ? "rgba(255,107,107,.35)" : "rgba(138,255,193,.3)",
      shapLabel: (c.shap > 0 ? "+" : "") + c.shap.toFixed(2),
    }));
  }

  /** View-model expandido para o modal de detalhe. */
  function detailVM(a, collected) {
    const v = asteroidVM(a, collected);
    const r = bestRef(a.sizeM);

    // Barras de comparação de tamanho: o próprio asteroide + duas referências.
    const bars = [
      { label: a.shortName + " · " + fmt(a.sizeM) + " m", m: a.sizeM, color: v.threatColor, glow: v.threatDim },
      { label: stripArticle(r.one) + " · " + fmt(r.m, r.m < 10 ? 1 : 0) + " m", m: r.m, color: "#4be1ff", glow: "rgba(75,225,255,.35)" },
    ];
    const alt = r.key === "onibus" ? NW.SIZE_REFS[0] : NW.SIZE_REFS[1];
    bars.push({ label: stripArticle(alt.one) + " · " + fmt(alt.m, alt.m < 10 ? 1 : 0) + " m", m: alt.m, color: "#7b93af", glow: "rgba(123,147,175,.3)" });
    const maxM = Math.max(...bars.map((b) => b.m));
    bars.forEach((b) => { b.pct = Math.max(1.5, (b.m / maxM) * 100).toFixed(1) + "%"; });

    // Mini-mapa orbital Terra → Lua → asteroide.
    // Escala dinâmica: expande em múltiplos de 16 DL até o asteroide caber.
    const scale = Math.max(NW.CONFIG.RULER_MAX_LD, Math.ceil(a.ld / 16) * 16);
    const rPct = Math.min(a.ld / scale, 0.98) * 50;
    const rad = (a.angle * Math.PI) / 180;
    const moonR = (1 / scale) * 50;
    const rings = [1, 2, 3, 4].map((k) => {
      const dl = (scale / 4) * k;
      return {
        size: (k * 25) + "%",
        label: dl + " DL",
        labelTop: (50 - k * 12.5).toFixed(1) + "%",
      };
    });

    return Object.assign(v, {
      riskBars: shapBars(v.risk),
      riskSentence: v.risk
        ? (v.risk.agrees
            ? "O modelo CONCORDA com a classificação oficial da NASA (PHA " + (a.haz ? "sim" : "não") + ")."
            : "O modelo DISCORDA da NASA: score " + v.risk.scoreLabel + " vs. flag PHA oficial \"" + (a.haz ? "sim" : "não") + "\". O flag da NASA usa MOID ≤ 0,05 AU — que o modelo não vê de propósito.")
        : null,
      glow: v.threatColor === "#ff6b6b" ? "rgba(255,107,107,.22)" : "rgba(160,140,110,.25)",
      stats: [
        { k: "DIÂMETRO EST.", v: fmt(a.sizeM) + " m" },
        { k: "VELOCIDADE", v: fmt(a.vel, 1) + " km/s" },
        { k: "DISTÂNCIA MÍN.", v: fmt(a.ld, 1) + " DL" },
        { k: "MAGNITUDE (H)", v: fmt(a.h, 1) },
        { k: "PERIGOSO (PHA)", v: a.haz ? "SIM" : "NÃO" },
        { k: "XP AO CATALOGAR", v: "+" + NW.CONFIG.XP_PER_CATALOG + " XP" },
      ],
      compSentence: a.sizeM >= 300
        ? "Um gigante: mais alto que a Torre Eiffel se estivesse de pé sobre a Terra."
        : "Se este asteroide pousasse na sua cidade, ele seria " + compText(a) + ".",
      distSentence: a.ld < 1
        ? "Passa ENTRE a Terra e a Lua — mais perto que o nosso satélite natural. Ainda assim, uma margem segura de " + ldToKm(a.ld) + "."
        : "Passa a " + fmt(a.ld, 1) + " vezes a distância Terra–Lua. Para comparação, a Lua está a 384.400 km de nós.",
      compBars: bars,
      rings,
      moonLeft: (50 + moonR * Math.cos(rad + 1.2)).toFixed(1) + "%",
      moonTop: (50 + moonR * Math.sin(rad + 1.2)).toFixed(1) + "%",
      dotLeft: (50 + rPct * Math.cos(rad)).toFixed(1) + "%",
      dotTop: (50 + rPct * Math.sin(rad)).toFixed(1) + "%",
    });
  }

  /** Valores derivados de nível superior (dashboard, XP, coleção). */
  function dashboardVM(state) {
    const cfg = NW.CONFIG;
    const data = state.asteroids || NW.NEO_DATA;
    const collectedCount = cfg.COLLECTION_BASE + Object.keys(state.collected).length;
    const hazCount = data.filter((a) => a.haz).length;
    const closest = data.reduce((a, b) => (b.ld < a.ld ? b : a), data[0]);
    // Escala da régua: 16 DL por padrão, expande em múltiplos de 16 até caber
    // pelo menos metade dos objetos (os demais viram o aviso "+N além").
    const sorted = data.map((a) => a.ld).sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const rulerScale = Math.max(cfg.RULER_MAX_LD, Math.ceil(median / 16) * 16);
    const beyondRuler = data.filter((a) => a.ld > rulerScale).length;
    return {
      rulerScale,
      live: !!state.live,
      liveMeta: state.liveMeta || null,
      hero: {
        count: data.length,
        hazCount,
        closestLd: closest ? closest.ld : null,
        closestBelowMoon: !!closest && closest.ld < 1,
        periodLabel: state.liveMeta ? "semana de " + state.liveMeta.start : "3–9 jul 2026",
      },
      beyondRuler,
      asteroids: data.map((a, i) => {
        const vm = asteroidVM(a, !!state.collected[a.id]);
        vm.tierH = 34 + (i % 3) * 26 + "px"; // altura escalonada dos marcadores na régua
        vm.onRuler = a.ld <= rulerScale;
        vm.rulerLeft = ((a.ld / rulerScale) * 100).toFixed(1) + "%";
        return vm;
      }),
      moonLeft: ((1 / rulerScale) * 100).toFixed(2) + "%",
      rulerTicks: [0, 1, 2, 3, 4].map((k) => {
        const dl = (rulerScale / 4) * k;
        return { left: k * 25 + "%", label: dl + " DL" };
      }),
      streakLabel: cfg.STREAK_WEEKS + " semanas",
      streakPips: Array.from({ length: 6 }, (_, i) => ({
        bg: i < cfg.STREAK_WEEKS ? "#ffb454" : "rgba(120,180,240,.2)",
        glow: i < cfg.STREAK_WEEKS ? "0 0 8px rgba(255,180,84,.6)" : "none",
      })),
      xpLabel: NW.format.fmt(state.xp) + " / " + NW.format.fmt(cfg.XP_MAX) + " XP",
      xpPct: Math.min(100, (state.xp / cfg.XP_MAX) * 100).toFixed(0) + "%",
      collectionLabel: collectedCount + " / " + cfg.COLLECTION_TOTAL,
      collectionPct: ((collectedCount / cfg.COLLECTION_TOTAL) * 100).toFixed(0) + "%",
    };
  }

  NW.model = { threat, bestRef, compText, asteroidVM, detailVM, dashboardVM };
})(window.NW || (window.NW = {}));
