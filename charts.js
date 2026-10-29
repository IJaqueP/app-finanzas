/* GastónGastín – gráficos SVG propios */
(function (G) {
  'use strict';
  const GG = (G.GG = G.GG || {});
  const PALETTE = ['var(--pink)', 'var(--blue)', 'var(--red)', 'var(--violet)', 'var(--sky)', 'var(--rose)', 'var(--navy)', 'var(--coral)'];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const short = (n) => {
    const a = Math.abs(n);
    if (a >= 1e6) return GG.fmtNum(n / 1e6, 1) + 'M';
    if (a >= 1e3) return GG.fmtNum(n / 1e3, 0) + 'k';
    return GG.fmtNum(n, 0);
  };
  const niceMax = (v) => {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    const f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  };

  /** Barras agrupadas + línea opcional. bars: [{name,color,values}], line: {name,color,values,dashedFrom} */
  function bars({ labels, bars = [], line = null, height = 190, legend = true }) {
    const W = 340, H = height, L = 34, R = 8, T = 10, B = 24;
    const all = [...bars.flatMap((b) => b.values), ...(line ? line.values : [])];
    const max = niceMax(Math.max(0, ...all));
    const min = Math.min(0, ...all);
    const range = max - min || 1;
    const y = (v) => T + (H - T - B) * (1 - (v - min) / range);
    const n = labels.length, gw = (W - L - R) / n, bw = Math.max(2, Math.min(14, (gw * 0.75) / Math.max(1, bars.length)));
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
    for (let i = 0; i <= 4; i++) {
      const v = min + (range * i) / 4, yy = y(v);
      s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="grid"/><text x="${L - 4}" y="${yy + 3}" class="axis" text-anchor="end">${short(v)}</text>`;
    }
    labels.forEach((lb, i) => {
      const cx = L + gw * i + gw / 2;
      if (n <= 6 || i % 2 === (n - 1) % 2) s += `<text x="${cx}" y="${H - 8}" class="axis" text-anchor="middle">${esc(lb)}</text>`;
      bars.forEach((b, j) => {
        const v = b.values[i] || 0;
        const x = cx - (bw * bars.length) / 2 + j * bw;
        const y0 = y(Math.max(0, v)), h = Math.abs(y(v) - y(0));
        s += `<rect x="${x + 0.5}" y="${y0}" width="${bw - 1}" height="${Math.max(0.5, h)}" rx="2" style="fill:${b.color || PALETTE[j]}" opacity="${b.dashedFrom != null && i >= b.dashedFrom ? 0.45 : 1}"><title>${esc(lb)}: ${GG.fmtCLP(v)}</title></rect>`;
      });
    });
    if (line) {
      const pts = line.values.map((v, i) => [L + gw * i + gw / 2, y(v)]);
      const df = line.dashedFrom ?? pts.length;
      const seg = (a, dash) => (a.length > 1 ? `<polyline points="${a.map((p) => p.join(',')).join(' ')}" fill="none" style="stroke:${line.color || 'var(--red)'}" stroke-width="2.5" stroke-linejoin="round" ${dash ? 'stroke-dasharray="5 4"' : ''}/>` : '');
      s += seg(pts.slice(0, df), false) + seg(pts.slice(Math.max(0, df - 1)), true);
      pts.forEach((p, i) => (s += `<circle cx="${p[0]}" cy="${p[1]}" r="2.8" style="fill:${line.color || 'var(--red)'}"><title>${esc(labels[i])}: ${GG.fmtCLP(line.values[i])}</title></circle>`));
    }
    s += '</svg>';
    if (legend) {
      const items = [...bars.map((b, j) => [b.name, b.color || PALETTE[j]]), ...(line ? [[line.name, line.color || 'var(--red)']] : [])];
      s += `<div class="legend">${items.map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}</div>`;
    }
    return s;
  }

  /** Donut: items [{label,value,color}] */
  function donut(items, { center = '', sub = '' } = {}) {
    items = items.filter((i) => i.value > 0);
    const tot = items.reduce((a, b) => a + b.value, 0);
    if (!tot) return '<p class="muted small">Sin datos para graficar.</p>';
    const R = 62, r = 40, C = 80;
    let a0 = -Math.PI / 2, s = `<div class="donut-wrap"><svg viewBox="0 0 160 160" class="donut">`;
    items.forEach((it, i) => {
      const frac = it.value / tot, a1 = a0 + frac * Math.PI * 2;
      const color = it.color || PALETTE[i % PALETTE.length];
      if (frac >= 0.9999) {
        s += `<circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" style="stroke:${color}" stroke-width="${R - r}"/>`;
      } else {
        const big = a1 - a0 > Math.PI ? 1 : 0;
        const p = (rad, a) => [C + rad * Math.cos(a), C + rad * Math.sin(a)];
        const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1), [x2, y2] = p(r, a1), [x3, y3] = p(r, a0);
        s += `<path d="M${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${big} 0 ${x3},${y3}Z" style="fill:${color}"><title>${esc(it.label)}: ${GG.fmtCLP(it.value)}</title></path>`;
      }
      a0 = a1;
    });
    s += `<text x="80" y="78" text-anchor="middle" class="donut-c">${esc(center)}</text><text x="80" y="94" text-anchor="middle" class="axis">${esc(sub)}</text></svg><ul class="donut-legend">`;
    items.forEach((it, i) => (s += `<li><i style="background:${it.color || PALETTE[i % PALETTE.length]}"></i><span>${esc(it.label)}</span><b>${GG.fmtPct(it.value / tot)}</b></li>`));
    return s + '</ul></div>';
  }

  /** Barras horizontales: items [{label, value, sub}] */
  function hbars(items, { color = 'var(--blue)', fmt = GG.fmtCLP, max = null } = {}) {
    if (!items.length) return '<p class="muted small">Sin datos todavía.</p>';
    const m = max || Math.max(...items.map((i) => i.value)) || 1;
    return `<ul class="hbars">${items
      .map((it) => `<li><div class="hb-top"><span>${esc(it.label)}</span><b>${fmt(it.value)}</b></div><div class="hb-track"><div style="width:${Math.max(1.5, (it.value / m) * 100)}%;background:${it.color || color}"></div></div>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</li>`)
      .join('')}</ul>`;
  }

  /** Línea simple de precios: points [{label, value}] */
  function line(points, { color = 'var(--pink)', fmt = GG.fmtCLP } = {}) {
    if (points.length < 2) return '<p class="muted small">Se necesita al menos dos compras para ver la evolución.</p>';
    const W = 340, H = 160, L = 40, R = 10, T = 12, B = 22;
    const vs = points.map((p) => p.value);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (hi === lo) { hi += hi * 0.1 || 1; lo -= lo * 0.1 || 1; }
    const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
    const x = (i) => L + ((W - L - R) * i) / (points.length - 1);
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart">`;
    for (let i = 0; i <= 3; i++) {
      const v = lo + ((hi - lo) * i) / 3;
      s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 4}" y="${y(v) + 3}" class="axis" text-anchor="end">${short(v)}</text>`;
    }
    const pts = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
    s += `<polyline points="${L},${H - B} ${pts} ${x(points.length - 1)},${H - B}" style="fill:${color}" opacity=".12"/>`;
    s += `<polyline points="${pts}" fill="none" style="stroke:${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    points.forEach((p, i) => {
      s += `<circle cx="${x(i)}" cy="${y(p.value)}" r="3" style="fill:${color}"><title>${esc(p.label)}: ${fmt(p.value)}</title></circle>`;
      if (i === 0 || i === points.length - 1 || points.length <= 6) s += `<text x="${x(i)}" y="${H - 6}" class="axis" text-anchor="middle">${esc(p.label)}</text>`;
    });
    return s + '</svg>';
  }

  /** Medidor horizontal con segmentos: parts [{label,value,color}] total */
  function meter(parts, total) {
    const t = total || parts.reduce((a, b) => a + b.value, 0) || 1;
    return `<div class="meter">${parts.map((p) => `<div style="width:${Math.max(0, (p.value / t) * 100)}%;background:${p.color}" title="${esc(p.label)}"></div>`).join('')}</div><div class="legend">${parts.map((p) => `<span><i style="background:${p.color}"></i>${esc(p.label)} ${GG.fmtCLP(p.value)}</span>`).join('')}</div>`;
  }

  GG.charts = { bars, donut, hbars, line, meter, PALETTE };
})(typeof window !== 'undefined' ? window : globalThis);
