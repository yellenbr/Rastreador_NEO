/**
 * ui.js — Camada de apresentação.
 *
 * Gera o HTML a partir dos view-models e conecta interações por delegação de
 * eventos. Substitui os diretivos Fable (sc-if, sc-for, {{ }}, onClick).
 */
(function (NW) {
  "use strict";

  const MOON = NW.CONFIG.MOON_TEXTURE;

  /** Escapa texto para inserção segura em HTML. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /* ---------- fragmentos ---------- */

  function headerHTML(d) {
    const pips = d.streakPips
      .map((p) => `<div class="nw-pip" style="background:${p.bg};box-shadow:${p.glow};"></div>`)
      .join("");
    return `
      <header class="nw-header">
        <div class="nw-brand">
          <div class="nw-logo"><div class="nw-logo-core"></div></div>
          <div>
            <div class="nw-title">NEO<span class="nw-accent">·</span>WATCH</div>
            <div class="nw-subtitle">Rastreador de asteroides próximos</div>
          </div>
        </div>
        <div class="nw-badges">
          <div class="nw-card nw-streak">
            <div>
              <div class="nw-mono nw-label">SEQUÊNCIA</div>
              <div class="nw-streak-value">${esc(d.streakLabel)}</div>
            </div>
            <div class="nw-pips">${pips}</div>
          </div>
          <div class="nw-card nw-level">
            <div class="nw-level-top">
              <div class="nw-mono nw-label">SENTINELA · NV 7</div>
              <div class="nw-mono nw-accent">${esc(d.xpLabel)}</div>
            </div>
            <div class="nw-bar"><div class="nw-bar-fill nw-bar-xp" style="width:${d.xpPct};"></div></div>
          </div>
        </div>
      </header>`;
  }

  function heroHTML(d) {
    const h = d.hero;
    const sourceBadge = d.live
      ? `<span class="nw-live-badge nw-live-on">● AO VIVO · NASA NeoWs + modelo XGBoost</span>`
      : `<span class="nw-live-badge">○ dados simulados · backend offline</span>`;
    const closestNote = h.closestBelowMoon
      ? `mas um deles passa <strong class="nw-warn">mais perto que a Lua</strong>.`
      : `o mais próximo passa a <strong class="nw-warn">${NW.format.fmt(h.closestLd, 1)} DL</strong> de nós.`;
    return `
      <section class="nw-hero">
        <div>
          <div class="nw-mono nw-eyebrow"><span class="nw-blink"></span>Alerta semanal · ${esc(h.periodLabel)}</div>
          <h1 class="nw-hero-title">${h.count} asteroides passam pela Terra esta semana</h1>
          <p class="nw-hero-text">${h.hazCount} ${h.hazCount === 1 ? "é classificado" : "são classificados"} como potencialmente perigosos pela NASA. Nenhum em rota de colisão — ${closestNote}</p>
          <div class="nw-hero-actions">
            <button class="nw-btn nw-btn-primary" data-action="open-closest">Ver aproximação recorde →</button>
            ${sourceBadge}
          </div>
        </div>
        <div class="nw-earth-wrap">
          <div class="nw-earth">
            <div class="nw-earth-halo"></div>
            <div class="nw-earth-globe">
              <div class="nw-earth-land"></div>
              <div class="nw-earth-clouds"></div>
              <div class="nw-earth-light"></div>
              <div class="nw-earth-terminator"></div>
              <div class="nw-earth-shade"></div>
            </div>
            <div class="nw-earth-rim"></div>
            <div class="nw-moon"><div class="nw-moon-shade"></div></div>
          </div>
        </div>
      </section>`;
  }

  function rulerHTML(d) {
    const ticks = d.rulerTicks
      .map((t) => `
        <div class="nw-tick-line" style="left:${t.left};"></div>
        <div class="nw-tick-label" style="left:${t.left};">${esc(t.label)}</div>`)
      .join("");
    const overflow = d.beyondRuler
      ? `<div class="nw-mono nw-muted nw-ruler-overflow">+${d.beyondRuler} além de 16 DL →</div>`
      : "";
    const markers = d.asteroids
      .filter((a) => a.onRuler)
      .map((a) => `
        <div class="nw-marker" data-action="open" data-id="${a.id}" style="left:${a.rulerLeft};height:${a.tierH};border-left-color:${a.threatDim};">
          <div class="nw-marker-dot" style="background:${a.threatColor};box-shadow:0 0 10px ${a.threatColor};"></div>
          <div class="nw-marker-name">${esc(a.shortName)}</div>
        </div>`)
      .join("");
    return `
      <section class="nw-card nw-ruler">
        <div class="nw-ruler-head">
          <div class="nw-mono nw-accent nw-section-title">Régua Terra → Lua</div>
          <div class="nw-mono nw-muted">1 DL = 384.400 km · escala 0–${d.rulerScale} DL</div>
        </div>
        <div class="nw-ruler-track">
          ${ticks}
          <div class="nw-ruler-baseline"></div>
          <div class="nw-ruler-earth"></div>
          <div class="nw-ruler-moon" style="left:${d.moonLeft};"></div>
          <div class="nw-ruler-moon-label" style="left:${d.moonLeft};">LUA</div>
          ${markers}
          ${overflow}
        </div>
      </section>`;
  }

  function listRowHTML(a) {
    const recorde = a.isClosest
      ? `<span class="nw-tag-recorde">RECORDE</span>`
      : "";
    return `
      <div class="nw-row" data-action="open" data-id="${a.id}" style="border-color:${a.borderColor};">
        <div class="nw-rock" style="border-radius:${a.blob};background-color:${a.c2};background-image:url('${MOON}');background-position:${a.texPos};filter:${a.texFilter};">
          <div class="nw-rock-shade"></div>
        </div>
        <div class="nw-row-name">
          <div class="nw-row-title">${esc(a.name)}${recorde}</div>
          <div class="nw-mono nw-muted nw-row-date">${esc(a.dateLabel)}</div>
        </div>
        <div class="nw-row-size">
          <div class="nw-mono nw-field-label">TAMANHO</div>
          <div class="nw-field-value">${esc(a.sizeLabel)}</div>
          <div class="nw-accent nw-field-sub">${esc(a.comp)}</div>
        </div>
        <div class="nw-row-vel">
          <div class="nw-mono nw-field-label">VELOCIDADE</div>
          <div class="nw-field-value">${esc(a.velLabel)}</div>
        </div>
        <div class="nw-row-dist">
          <div class="nw-mono nw-field-label">DISTÂNCIA</div>
          <div class="nw-field-value">${esc(a.ldLabel)}</div>
          <div class="nw-mono nw-muted nw-field-sub">${esc(a.kmLabel)}</div>
        </div>
        ${a.risk ? `
        <div class="nw-risk-chip" style="border-color:${a.risk.dim};" title="Score do modelo XGBoost${a.risk.agrees ? "" : " — discorda do flag PHA da NASA"}">
          <div class="nw-mono nw-field-label">RISCO IA</div>
          <div class="nw-risk-score" style="color:${a.risk.color};">${a.risk.scoreLabel}${a.risk.agrees ? "" : ` <span class="nw-risk-flag" title="modelo e NASA discordam">≠ NASA</span>`}</div>
        </div>` : ""}
        <div class="nw-medal" style="border-color:${a.threatDim};background:${a.threatBg};">
          <div class="nw-diamond" style="background:${a.threatColor};box-shadow:0 0 8px ${a.threatColor};"></div>
          <div class="nw-mono" style="color:${a.threatColor};">${esc(a.threatLabel)}</div>
        </div>
        <button class="nw-btn-collect" data-action="collect" data-id="${a.id}" style="background:${a.collectBg};color:${a.collectFg};border-color:${a.collectBorder};">${esc(a.collectLabel)}</button>
      </div>`;
  }

  function listHTML(d) {
    return `
      <section class="nw-list-section">
        <div class="nw-list-head">
          <h2 class="nw-h2">Passagens da semana</h2>
          <div class="nw-mono nw-muted">catalogue para ganhar +25 XP</div>
        </div>
        <div class="nw-list">${d.asteroids.map(listRowHTML).join("")}</div>
      </section>`;
  }

  function collectionHTML(d) {
    return `
      <section class="nw-stats">
        <div class="nw-card nw-stat">
          <div class="nw-mono nw-label">COLEÇÃO DE ASTEROIDES</div>
          <div class="nw-stat-big">${esc(d.collectionLabel)} <span class="nw-stat-unit">catalogados</span></div>
          <div class="nw-bar"><div class="nw-bar-fill nw-bar-collection" style="width:${d.collectionPct};"></div></div>
        </div>
        <div class="nw-card nw-stat">
          <div class="nw-mono nw-label">MELHOR SEQUÊNCIA</div>
          <div class="nw-stat-big nw-warn">11 semanas</div>
          <div class="nw-mono nw-muted nw-stat-note">volte semana que vem para manter a atual</div>
        </div>
        <div class="nw-card nw-stat">
          <div class="nw-mono nw-label">PRÓXIMA CONQUISTA</div>
          <div class="nw-stat-mid">Caçador de Gigantes</div>
          <div class="nw-mono nw-muted nw-stat-note">catalogue 2 asteroides &gt; 300 m · 1/2</div>
        </div>
      </section>`;
  }

  function modalHTML(det) {
    if (!det) return "";
    const stats = det.stats
      .map((s) => `<div class="nw-detail-stat"><div class="nw-mono nw-field-label">${esc(s.k)}</div><div class="nw-detail-stat-v">${esc(s.v)}</div></div>`)
      .join("");
    const bars = det.compBars
      .map((b) => `
        <div class="nw-cmp-row">
          <div class="nw-mono nw-cmp-label">${esc(b.label)}</div>
          <div class="nw-cmp-track"><div class="nw-cmp-fill" style="width:${b.pct};background:${b.color};box-shadow:0 0 12px ${b.glow};"></div></div>
        </div>`)
      .join("");
    const rings = det.rings
      .map((r) => `
        <div class="nw-ring" style="width:${r.size};height:${r.size};"></div>
        <div class="nw-ring-label" style="top:${r.labelTop};">${esc(r.label)}</div>`)
      .join("");
    return `
      <div class="nw-overlay" data-action="close">
        <div class="nw-modal" data-action="stop">
          <div class="nw-modal-head">
            <div>
              <div class="nw-mono nw-accent nw-modal-eyebrow">FICHA DO OBJETO · ${esc(det.dateLabel)}</div>
              <h2 class="nw-modal-title">${esc(det.name)}</h2>
            </div>
            <div class="nw-modal-actions">
              <div class="nw-medal" style="border-color:${det.threatDim};background:${det.threatBg};">
                <div class="nw-diamond" style="background:${det.threatColor};box-shadow:0 0 8px ${det.threatColor};"></div>
                <div class="nw-mono" style="color:${det.threatColor};">${esc(det.threatLabel)}</div>
              </div>
              <button class="nw-close" data-action="close">✕</button>
            </div>
          </div>

          <div class="nw-detail-grid">
            <div class="nw-detail-render">
              <div class="nw-detail-rock-wrap">
                <div class="nw-detail-glow" style="background:radial-gradient(circle, ${det.glow}, transparent 65%);"></div>
                <div class="nw-detail-rock" style="border-radius:${det.blob};background-color:${det.c2};background-image:url('${MOON}');background-position:${det.texPos};filter:${det.texFilter};">
                  <div class="nw-rock-shade"></div>
                </div>
              </div>
            </div>
            <div class="nw-detail-stats">${stats}</div>
          </div>

          ${det.risk ? `
          <div class="nw-cmp nw-risk-panel" style="border-color:${det.risk.dim};">
            <div class="nw-risk-head">
              <div>
                <div class="nw-mono nw-accent nw-section-title">SCORE DE RISCO · MODELO XGBOOST</div>
                <div class="nw-risk-big" style="color:${det.risk.color};">${det.risk.scoreLabel}</div>
              </div>
              <div class="nw-mono nw-risk-verdict ${det.risk.agrees ? "nw-risk-agree" : "nw-risk-disagree"}">${det.risk.agrees ? "✓ concorda com a NASA" : "≠ discorda da NASA"}</div>
            </div>
            <div class="nw-risk-sentence">${esc(det.riskSentence)}</div>
            <div class="nw-mono nw-field-label nw-risk-shap-title">POR QUE? · CONTRIBUIÇÕES SHAP</div>
            <div class="nw-cmp-bars">
              ${det.riskBars.map((b) => `
                <div class="nw-cmp-row">
                  <div class="nw-mono nw-cmp-label">${esc(b.label)} = ${esc(b.valueLabel)}</div>
                  <div class="nw-cmp-track">
                    <div class="nw-cmp-fill" style="width:${b.pct};background:${b.color};box-shadow:0 0 12px ${b.glow};"></div>
                    <span class="nw-mono nw-shap-val">${esc(b.shapLabel)}</span>
                  </div>
                </div>`).join("")}
            </div>
            <div class="nw-mono nw-muted nw-risk-note">vermelho aumenta o risco · verde reduz · o modelo não vê o MOID (metade da regra PHA da NASA) de propósito</div>
          </div>` : ""}

          <div class="nw-cmp">
            <div class="nw-mono nw-accent nw-section-title">COMPARAÇÃO DE TAMANHO</div>
            <div class="nw-cmp-sentence">${esc(det.compSentence)}</div>
            <div class="nw-cmp-bars">${bars}</div>
          </div>

          <div class="nw-orbit-grid">
            <div>
              <div class="nw-mono nw-accent nw-section-title">DISTÂNCIA MÍNIMA</div>
              <div class="nw-orbit-big">${esc(det.ldLabel)}</div>
              <div class="nw-mono nw-muted nw-orbit-km">${esc(det.kmLabel)}</div>
              <p class="nw-orbit-text">${esc(det.distSentence)}</p>
            </div>
            <div class="nw-orbit-map-wrap">
              <div class="nw-orbit-map">
                ${rings}
                <div class="nw-orbit-earth"></div>
                <div class="nw-orbit-moon" style="left:${det.moonLeft};top:${det.moonTop};"></div>
                <div class="nw-orbit-dot" style="left:${det.dotLeft};top:${det.dotTop};">
                  <div class="nw-orbit-ring-pulse" style="border-color:${det.threatColor};"></div>
                  <div class="nw-diamond nw-orbit-diamond" style="background:${det.threatColor};box-shadow:0 0 12px ${det.threatColor};"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="nw-modal-buttons">
            <button class="nw-btn" data-action="collect" data-id="${det.id}" style="background:${det.collectBg};color:${det.collectFg};border:1px solid ${det.collectBorder};">${esc(det.collectLabel)}</button>
            <button class="nw-btn nw-btn-ghost" data-action="close">Fechar</button>
          </div>
        </div>
      </div>`;
  }

  /** Renderiza toda a tela a partir do estado. */
  function render(root, state) {
    const d = NW.model.dashboardVM(state);
    const data = state.asteroids || NW.NEO_DATA;
    const sel = data.find((a) => a.id === state.selectedId);
    const det = sel ? NW.model.detailVM(sel, !!state.collected[sel.id]) : null;

    const footer = d.live
      ? `dados NASA NeoWs ao vivo · score de risco: modelo próprio (XGBoost, ROC-AUC ${d.liveMeta && d.liveMeta.metrics ? d.liveMeta.metrics.roc_auc : "—"}) · nenhum asteroide em rota de colisão`
      : `dados simulados no formato NASA NeoWs · inicie o backend para dados ao vivo · nenhum asteroide em rota de colisão`;
    root.innerHTML = `
      <div class="nw-container">
        ${headerHTML(d)}
        ${heroHTML(d)}
        ${rulerHTML(d)}
        ${listHTML(d)}
        ${collectionHTML(d)}
        <footer class="nw-footer nw-mono">${footer}</footer>
      </div>
      ${modalHTML(det)}`;
  }

  NW.ui = { render };
})(window.NW || (window.NW = {}));
