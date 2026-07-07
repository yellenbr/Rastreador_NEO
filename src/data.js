/**
 * data.js — Dados brutos do rastreador.
 *
 * Camada de dados pura: nenhuma lógica, nenhuma formatação, nenhum estado.
 * Formato inspirado na API NASA NeoWs (dados simulados).
 */
(function (NW) {
  "use strict";

  /** Objetos de referência para comparação de tamanho (metros). */
  NW.SIZE_REFS = [
    { key: "girafa", m: 5.5, one: "uma girafa", many: "girafas" },
    { key: "onibus", m: 12, one: "um ônibus", many: "ônibus enfileirados" },
    { key: "baleia", m: 30, one: "uma baleia-azul", many: "baleias-azuis" },
    { key: "cristo", m: 38, one: "o Cristo Redentor", many: "Cristos Redentores" },
    { key: "eiffel", m: 330, one: "a Torre Eiffel", many: "Torres Eiffel" },
  ];

  /** Passagens de asteroides da semana. `sizeM` em metros, `vel` em km/s, `ld` em distâncias lunares. */
  NW.NEO_DATA = [
    { id: "mq2", name: "2026 MQ2", shortName: "MQ2", date: "sex · 3 jul · 14:32 UTC", sizeM: 18, vel: 8.4, ld: 2.1, h: 26.1, haz: false, angle: 40, blob: "46% 54% 58% 42% / 52% 48% 60% 40%", c2: "#5c4f3d", texPos: "18% 32%", texFilter: "sepia(.55) saturate(1.5) brightness(.95)" },
    { id: "tz3", name: "388945 (2008 TZ3)", shortName: "TZ3", date: "sáb · 4 jul · 03:11 UTC", sizeM: 440, vel: 12.6, ld: 11.8, h: 20.4, haz: true, angle: 130, blob: "54% 46% 42% 58% / 44% 60% 40% 56%", c2: "#4a443e", texPos: "62% 20%", texFilter: "sepia(.25) saturate(1.1) brightness(.9)" },
    { id: "nf", name: "2026 NF", shortName: "NF", date: "dom · 5 jul · 21:47 UTC", sizeM: 34, vel: 15.2, ld: 0.8, h: 24.7, haz: false, angle: 300, blob: "58% 42% 50% 50% / 46% 58% 42% 54%", c2: "#63503a", texPos: "40% 70%", texFilter: "sepia(.65) saturate(1.6) brightness(1)", closest: true },
    { id: "lk1", name: "2026 LK1", shortName: "LK1", date: "seg · 6 jul · 09:05 UTC", sizeM: 6, vel: 5.9, ld: 4.3, h: 28.9, haz: false, angle: 210, blob: "50% 50% 44% 56% / 56% 44% 52% 48%", c2: "#43403c", texPos: "75% 55%", texFilter: "sepia(.15) brightness(.85)" },
    { id: "ac3", name: "2019 AC3", shortName: "AC3", date: "ter · 7 jul · 17:58 UTC", sizeM: 95, vel: 18.7, ld: 7.6, h: 22.8, haz: false, angle: 75, blob: "44% 56% 54% 46% / 60% 40% 56% 44%", c2: "#544738", texPos: "30% 85%", texFilter: "sepia(.5) saturate(1.4) brightness(.92)" },
    { id: "mx", name: "2026 MX", shortName: "MX", date: "qua · 8 jul · 06:20 UTC", sizeM: 12, vel: 9.3, ld: 3.2, h: 27.3, haz: false, angle: 250, blob: "52% 48% 46% 54% / 48% 56% 44% 56%", c2: "#4d4336", texPos: "55% 45%", texFilter: "sepia(.4) saturate(1.2) brightness(.88)" },
    { id: "an10", name: "137108 (1999 AN10)", shortName: "AN10", date: "qui · 9 jul · 23:39 UTC", sizeM: 310, vel: 21.4, ld: 14.9, h: 17.9, haz: true, angle: 160, blob: "56% 44% 48% 52% / 42% 58% 46% 54%", c2: "#46413b", texPos: "85% 30%", texFilter: "sepia(.2) saturate(1.05) brightness(.82)" },
  ];

  /** Constantes de domínio e de gamificação. */
  NW.CONFIG = {
    KM_PER_LD: 384400,      // 1 distância lunar em km
    RULER_MAX_LD: 16,       // escala da régua Terra → Lua
    XP_MAX: 2000,
    XP_PER_CATALOG: 25,
    XP_INITIAL: 1680,
    COLLECTION_BASE: 23,    // já catalogados antes desta semana
    COLLECTION_TOTAL: 150,
    STREAK_WEEKS: 6,
    MOON_TEXTURE: "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg",
  };
})(window.NW || (window.NW = {}));
