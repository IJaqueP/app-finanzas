/* GastónGastín – interfaz */
(function () {
  'use strict';
  const GG = window.GG;
  const C = GG.charts;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $clp = GG.fmtCLP;

  let S = null;
  const UI = { tab: 'resumen', mk: GG.mkOf(GG.today()), gseg: 'compras', dseg: 'inv', more: null, q: '', amb: 'todo', mq: '', msort: 'nombre' };
  let cache = {};
  const invalidate = () => (cache = {});
  const summary = (mk) => cache['s' + mk] || (cache['s' + mk] = GG.monthSummary(S, mk));
  const master = () => cache.m || (cache.m = GG.masterTable(S.compras));
  const masterMap = () => cache.mm || (cache.mm = new Map(master().map((r) => [r.key, r])));
  const inv = () => cache.inv || (cache.inv = GG.inventory(S, master()));
  const N = () => S.cfg.nombres;

  /* ---------- Persistencia ---------- */
  async function save(store, obj) {
    if (!obj.id) obj.id = GG.uid();
    if (!obj.creado) obj.creado = Date.now();
    obj.mod = Date.now();
    await GG.db.put(store, obj);
    const arr = S[store], i = arr.findIndex((x) => x.id === obj.id);
    if (i >= 0) arr[i] = obj; else arr.push(obj);
    invalidate();
  }
  async function remove(store, id) {
    await GG.db.del(store, id);
    S[store] = S[store].filter((x) => x.id !== id);
    invalidate();
  }
  const saveCfg = async () => { await GG.db.put('kv', S.cfg); invalidate(); };
  const saveMeta = () => GG.db.put('kv', S.meta);

  /* ---------- Utilidades UI ---------- */
  function toast(msg, ms = 2200) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), ms);
    if (navigator.vibrate) navigator.vibrate(12);
  }
  let zTop = 50;
  function openSheet({ title, body, onMount, onClose }) {
    const bd = document.createElement('div'); bd.className = 'backdrop'; bd.style.zIndex = ++zTop;
    const sh = document.createElement('div'); sh.className = 'sheet'; sh.style.zIndex = ++zTop;
    sh.innerHTML = `<div class="grab"><i></i></div><div class="sh-head"><button type="button" data-close>Cerrar</button><h2>${esc(title)}</h2><span style="width:52px"></span></div><div class="sh-body">${body}</div>`;
    document.body.append(bd, sh);
    requestAnimationFrame(() => { bd.classList.add('show'); sh.classList.add('show'); });
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      bd.classList.remove('show'); sh.classList.remove('show');
      sh.style.transform = '';
      setTimeout(() => { bd.remove(); sh.remove(); }, 320);
      onClose && onClose();
    };
    bd.addEventListener('click', close);
    $('[data-close]', sh).addEventListener('click', close);
    // arrastrar para cerrar
    let y0 = null, dy = 0;
    const handles = [$('.grab', sh), $('.sh-head', sh)];
    handles.forEach((h) => {
      h.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; sh.style.transition = 'none'; h.setPointerCapture(e.pointerId); });
      h.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; });
      const end = () => { if (y0 == null) return; y0 = null; sh.style.transition = ''; if (dy > 110) close(); else sh.style.transform = ''; };
      h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    });
    const api = { el: sh, body: $('.sh-body', sh), close };
    onMount && onMount(api);
    return api;
  }
  function confirmSheet(msg, okLabel = 'Eliminar', danger = true) {
    return new Promise((res) => {
      let done = false;
      const sh = openSheet({
        title: 'Confirmar',
        body: `<p style="margin:6px 4px 14px">${msg}</p><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button><button class="btn ghost" data-no>Cancelar</button>`,
        onClose: () => !done && res(false),
      });
      $('[data-ok]', sh.el).onclick = () => { done = true; res(true); sh.close(); };
      $('[data-no]', sh.el).onclick = () => sh.close();
    });
  }
  const mascota = (w = 108) => `<img src="mascota.svg" alt="" width="${w}">`;
  const empty = (title, text) => `<div class="empty">${mascota()}<b>${esc(title)}</b>${esc(text)}</div>`;
  const semLabel = { green: 'En orden', yellow: 'Cuidado', red: 'Excedido', none: 'Sin presupuesto' };
  const CAT_ICO = [['carne', '🥩'], ['pescad', '🐟'], ['embutid', '🥓'], ['lacte', '🥛'], ['pasta', '🍝'], ['legumbr', '🫘'], ['fruta', '🍎'], ['verdura', '🥬'], ['panader', '🥖'], ['despensa', '🫙'], ['desayuno', '🥣'], ['cafe', '☕'], ['congelad', '🧊'], ['bebida', '🥤'], ['snack', '🍫'], ['alcohol', '🍷'], ['tabaco', '🚬'], ['mascota', '🐾'], ['limpieza del hogar', '🧽'], ['limpieza personal', '🧴'], ['farmacia', '💊'], ['hogar', '🏠']];
  const catIco = (c) => { const n = GG.norm(c); const f = CAT_ICO.find(([k]) => n.includes(k)); return f ? f[1] : '🛒'; };
  const TIPO_ICO = { Esencial: '🏠', Salud: '🩺', Mascota: '🐾', Hormiga: '🐜', Plataforma: '📺', Transporte: '🚌' };
  const prodName = (r) => `${r.producto}${r.marca ? ' ' + r.marca : ''}`;
  const prodFmt = (r) => `${GG.fmtNum(r.contenido, 3)} ${r.unidad}`;
  const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  /* ---------- Íconos de la barra ---------- */
  const ICO = {
    resumen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></svg>',
    gastos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    despensa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16l-1.5 11h-13z"/><path d="M8 9l3-6M16 9l-3-6"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    mas: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  };
  const TABS = [['resumen', 'Resumen'], ['gastos', 'Gastos'], ['despensa', 'Despensa'], ['dashboard', 'Dashboard'], ['mas', 'Más']];
  const MORE = {
    maestra: ['Tabla Maestra', '📒', 'Precios de cada producto: último, promedio, más barato y más caro'],
    proyeccion: ['Proyección y estacionalidad', '🔮', 'Ahorro futuro y cuándo conviene comprar'],
    hormigas: ['Hormigas, suscripciones y mascota', '🐜', 'Cuánto ahorrarías eliminando gustos y plataformas'],
    unir: ['Unir productos', '🔗', 'Corrige duplicados como «Leche» y «Lecha»'],
    ajustes: ['Ajustes', '⚙️', 'Personas, presupuestos, categorías, cupo, PIN'],
    respaldo: ['Respaldo y exportación', '💾', 'Excel, respaldo para restaurar y recordatorio'],
    ayuda: ['Instalación y ayuda', '📱', 'Cómo usarla en el iPhone sin perder datos'],
  };

  /* ---------- Render principal ---------- */
  function render() {
    const showMonth = ['resumen', 'gastos', 'dashboard'].includes(UI.tab) || (UI.tab === 'mas' && UI.more === 'hormigas');
    const title = UI.tab === 'mas' && UI.more ? MORE[UI.more][0] : TABS.find((t) => t[0] === UI.tab)[1];
    $('#top').innerHTML = `<div class="top-row">${UI.tab === 'mas' && UI.more ? `<button data-act="back" class="blue" style="font-size:17px;font-weight:600">‹ Más</button>` : `<h1>${esc(title)}</h1>`}${showMonth ? `<div class="monthnav"><button class="arrow" data-act="mprev" aria-label="Mes anterior">‹</button><button class="mlabel" data-act="mpick">${GG.mkLabel(UI.mk)}</button><button class="arrow" data-act="mnext" aria-label="Mes siguiente">›</button></div>` : ''}</div>${UI.tab === 'mas' && UI.more ? `<h1 style="margin-top:6px;font-size:26px">${esc(title)}</h1>` : ''}`;
    const v = $('#view');
    const fn = { resumen: vResumen, gastos: vGastos, despensa: vDespensa, dashboard: vDashboard, mas: vMas }[UI.tab];
    v.innerHTML = fn();
    if (UI.tab === 'mas' && UI.more && PAGES_MOUNT[UI.more] && $('#page', v)) PAGES_MOUNT[UI.more]($('#page', v));
    if (UI.tab === 'gastos') mountGastosSearch(v);
    if (UI.tab === 'despensa') mountDespensa(v);
    const bajos = inv().filter((i) => i.bajo).length;
    $('#tabbar').innerHTML = TABS.map(([k, l]) => `<button data-act="tab" data-v="${k}" class="${UI.tab === k ? 'on' : ''}" aria-label="${l}">${ICO[k]}<span>${l}</span>${k === 'despensa' && bajos ? `<em class="badge">${bajos}</em>` : ''}</button>`).join('');
    $('#fab').classList.toggle('hidden', !['resumen', 'gastos', 'despensa'].includes(UI.tab));
  }

  /* ---------- Resumen ---------- */
  function vResumen() {
    const r = summary(UI.mk), cfg = S.cfg;
    let h = '';
    if (!isStandalone()) h += `<div class="alert blue"><span class="a-ico">📱</span><div><b>Instálala en tu iPhone.</b> En Safari toca Compartir y luego «Añadir a pantalla de inicio». Usa siempre el ícono instalado: en iOS los datos de Safari y los de la app instalada se guardan por separado.</div></div>`;
    h += alertsHTML(r, true);
    if (!r.nRegistros) {
      h += `<div class="card">${empty('Nada registrado en ' + GG.mkLabel(UI.mk).toLowerCase(), 'Toca el botón + para anotar tu primera compra, servicio o ingreso del mes.')}</div>`;
    }
    const spent = r.ingresos > 0 ? Math.min(1, r.ivan / r.ingresos) : r.ivan > 0 ? 1 : 0;
    const C2 = 2 * Math.PI * 56;
    const ringColor = r.ingresos <= 0 ? 'var(--gray)' : spent >= cfg.umbralRojo ? 'var(--red)' : spent >= cfg.umbralAmarillo ? 'var(--yellow)' : 'var(--pink)';
    h += `<div class="card hero"><div class="ring"><svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="56" fill="none" stroke="var(--card-2)" stroke-width="14"/><circle cx="66" cy="66" r="56" fill="none" style="stroke:${ringColor}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C2 * spent} ${C2}"/></svg><div class="in"><b>${GG.fmtPct(r.pctAhorro)}</b><small>de ahorro</small></div></div><div><div class="lbl">Ahorro del mes</div><div class="big ${r.ahorro < 0 ? 'neg' : ''}">${$clp(r.ahorro)}</div><div class="lbl" style="margin-top:6px">Ingresos ${$clp(r.ingresos)}<br>Tu parte ${$clp(r.ivan)}</div></div></div>`;
    h += `<div class="grid2"><div class="stat"><small>Gasto total registrado</small><span class="amt">${$clp(r.gastoTotal)}</span></div><div class="stat"><small>Responsabilidad de ${esc(N().ivan)}</small><span class="amt">${$clp(r.ivan)}</span></div><div class="stat"><small>Responsabilidad de ${esc(N().pollo)}</small><span class="amt">${$clp(r.pollo)}</span></div><div class="stat"><small>Ingresos</small><span class="amt">${$clp(r.ingresos)}</span></div></div>`;
    h += presupuestoCard(r);
    h += cuadreCard(r);
    h += tarjetaCard(r);
    return h;
  }
  function alertsHTML(r, withActions) {
    let h = '';
    const days = S.meta.lastBackup ? Math.floor((Date.now() - S.meta.lastBackup) / 864e5) : null;
    const hasData = S.compras.length + S.servicios.length + S.ingresos.length + S.cuotas.length > 0;
    if (hasData && (days === null || days >= (+S.cfg.respaldoDias || 7)))
      h += `<div class="alert yellow"><span class="a-ico">💾</span><div>${days === null ? 'Aún no haces tu primer respaldo.' : `Han pasado ${days} días desde tu último respaldo.`} Si borras la app o los datos del sitio, se pierde todo.${withActions ? '<br><button data-act="backup-json">Respaldar ahora</button>' : ''}</div></div>`;
    if (!S.pin && !S.meta.pinOmitido && withActions)
      h += `<div class="alert pink"><span class="a-ico">🔒</span><div>Protege tus finanzas con un PIN de 4 a 6 dígitos.<br><button data-act="pin-set">Crear PIN</button> · <button data-act="pin-skip">Ahora no</button></div></div>`;
    if (r.control !== 0) h += `<div class="alert red"><span class="a-ico">⚠️</span><div>El cuadre de auditoría no da $0 (diferencia ${$clp(r.control)}). Revisa el Dashboard.</div></div>`;
    const bajos = inv().filter((i) => i.bajo);
    if (bajos.length) h += `<div class="alert red"><span class="a-ico">🧺</span><div><b>Se acaba:</b> ${bajos.slice(0, 4).map((b) => esc(b.row.producto)).join(', ')}${bajos.length > 4 ? ` y ${bajos.length - 4} más` : ''}.${withActions ? '<br><button data-act="go-lista">Ver lista de compras</button>' : ''}</div></div>`;
    if (r.pendientes) h += `<div class="alert blue"><span class="a-ico">🧾</span><div>${r.pendientes} ${r.pendientes === 1 ? 'servicio pendiente' : 'servicios pendientes'} de pago este mes.</div></div>`;
    return h;
  }
  function histAvgTipo(tipo) {
    const ms = GG.monthsBack(GG.addMonths(UI.mk, -1), 12).filter((m) => summary(m).nRegistros > 0);
    if (!ms.length) return null;
    return ms.reduce((a, m) => a + ((summary(m).byTipo[tipo] || {}).ivan || 0), 0) / ms.length;
  }
  function presupuestoCard(r) {
    let h = `<div class="card"><h2>Presupuesto vs real <button class="link" data-act="more" data-v="ajustes">Editar</button></h2>`;
    const rows = r.presupuesto.filter((p) => p.presupuesto > 0 || p.gastado > 0);
    if (!rows.length) h += `<p class="muted small">Define presupuestos por tipo de gasto en Ajustes para ver tus semáforos.</p>`;
    for (const p of rows) {
      const avg = histAvgTipo(p.tipo);
      const semAvg = avg ? GG.semaforo(S.cfg, avg, p.gastado) : 'none';
      h += `<div class="budget"><div class="b-top"><span class="sem ${p.sem}" title="${semLabel[p.sem]}"></span><span>${esc(p.tipo)}</span><b>${$clp(p.gastado)}</b></div><div class="bar"><div class="${p.sem}" style="width:${p.presupuesto > 0 ? Math.min(100, p.pct * 100) : 0}%"></div></div><div class="b-sub"><span>${p.presupuesto > 0 ? `${GG.fmtPct(p.pct)} de ${$clp(p.presupuesto)}` : 'Sin presupuesto'}</span><span>${avg ? `<span class="sem ${semAvg}"></span> ${GG.fmtPct(p.gastado / avg)} de tu promedio ${$clp(avg)}` : ''}</span></div></div>`;
    }
    const tp = r.presupuestoTotal, semT = GG.semaforo(S.cfg, tp, r.gastadoTotal);
    h += `<div class="budget"><div class="b-top"><span class="sem ${semT}"></span><b style="margin-left:0">Total</b><b>${$clp(r.gastadoTotal)}</b></div><div class="b-sub"><span>${tp > 0 ? `${GG.fmtPct(r.gastadoTotal / tp)} de ${$clp(tp)}` : 'Sin presupuesto total'}</span><span>${r.controlPresupuesto === 0 ? '✓ cuadra con tu responsabilidad' : '⚠️ no cuadra: ' + $clp(r.controlPresupuesto)}</span></div></div></div>`;
    return h;
  }
  function cuadreCard(r) {
    const c = r.cuadre, n = N();
    const msg = c.polloDebe > 0.5 ? `<b>${esc(n.pollo)}</b> debe pagarte <span class="amt pinkc">${$clp(c.polloDebe)}</span>` : c.ivanDebe > 0.5 ? `Le debes a <b>${esc(n.pollo)}</b> <span class="amt neg">${$clp(c.ivanDebe)}</span>` : 'Están a mano este mes 🤝';
    return `<div class="card"><h2>Cuadre ${esc(n.ivan)}–${esc(n.pollo)}</h2><p style="margin:0 0 8px;font-size:17px">${msg}</p><div class="kv"><span>Pagado por ${esc(n.ivan)} (compartido)</span><b>${$clp(c.pagIvan)}</b></div><div class="kv"><span>Pagado por ${esc(n.pollo)} (compartido)</span><b>${$clp(c.pagPollo)}</b></div><div class="kv"><span>Parte de ${esc(n.ivan)}</span><b>${$clp(c.parteIvan)}</b></div><div class="kv"><span>Parte de ${esc(n.pollo)}</span><b>${$clp(c.partePollo)}</b></div><p class="muted small" style="margin:8px 0 0">Incluye compras de la casa, servicios que se dividen y cuotas de la casa. Lo personal no entra.</p></div>`;
  }
  function tarjetaCard(r) {
    const t = r.tarjeta, cupo = +S.cfg.cupo || 0;
    let h = `<div class="card"><h2>Tarjeta de crédito <button class="link" data-act="tarjeta-edit">Pago del mes</button></h2>`;
    if (cupo > 0) h += C.meter([{ label: 'Por pagar', value: Math.max(0, t.porPagar), color: 'var(--red)' }, { label: 'Cuotas futuras', value: t.futuras, color: 'var(--pink)' }, { label: 'Disponible', value: Math.max(0, t.disponible), color: 'var(--blue)' }], cupo);
    h += `<div class="kv"><span>Facturado del mes</span><b>${$clp(t.facturado)}</b></div><div class="kv"><span>Pago realizado</span><b>${$clp(t.pago)}</b></div><div class="kv"><span>Saldo impago mes anterior</span><b>${$clp(t.saldoAnt)}</b></div><div class="kv"><span>Por pagar al cierre</span><b>${$clp(t.porPagar)}</b></div><div class="kv"><span>Cuotas futuras pendientes</span><b>${$clp(t.futuras)}</b></div><div class="kv"><span>Cupo disponible</span><b class="${t.disponible < 0 ? 'neg' : 'blue'}">${cupo > 0 ? $clp(t.disponible) : '<button class="blue" data-act="more" data-v="ajustes">Definir cupo</button>'}</b></div></div>`;
    return h;
  }

  /* ---------- Gastos ---------- */
  function vGastos() {
    const segs = [['compras', 'Compras'], ['servicios', 'Servicios'], ['ingresos', 'Ingresos'], ['cuotas', 'Cuotas']];
    let h = `<div class="seg">${segs.map(([k, l]) => `<button data-act="gseg" data-v="${k}" class="${UI.gseg === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const r = summary(UI.mk);
    if (UI.gseg === 'compras') {
      h += `<div class="search"><span>🔎</span><input id="gq" type="search" placeholder="Buscar producto, marca o lugar" value="${esc(UI.q)}" autocomplete="off"></div>`;
      h += `<div class="seg small">${[['todo', 'Todo'], ['casa', 'Casa'], ['personal', 'Personal']].map(([k, l]) => `<button data-act="amb" data-v="${k}" class="${UI.amb === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      h += `<div class="grid2" style="margin-top:8px"><div class="stat"><small>Compras de la casa</small><span class="amt">${$clp(r.casa)}</span></div><div class="stat"><small>Compras personales</small><span class="amt">${$clp(r.personal)}</span></div></div><div id="glist">${comprasList()}</div>`;
    } else if (UI.gseg === 'servicios') {
      h += `<div class="grid2" style="margin-top:8px"><div class="stat"><small>Servicios del mes</small><span class="amt">${$clp(r.servicios)}</span></div><button class="stat" style="text-align:left" data-act="copy-prev"><small>¿Se repiten?</small><b class="blue">Copiar del mes anterior</b></button></div>`;
      const list = S.servicios.filter((s) => GG.mkOf(s.fecha) === UI.mk).sort((a, b) => b.fecha.localeCompare(a.fecha));
      h += list.length ? `<div class="list">${list.map((s) => rowHTML('servicios', s.id, TIPO_ICO[s.tipo] || '🧾', 'blue', s.concepto, `${GG.fmtDate(s.fecha)} · ${s.tipo || ''} · ${s.medio || ''} · ${s.divide ? 'se divide' : 'pagó ' + (s.quien === 'pollo' ? N().pollo : N().ivan)}`, $clp(s.monto), `<button class="pill ${s.estado === 'Pendiente' ? 'red' : 'blue'}" data-act="toggle-estado" data-id="${s.id}">${s.estado || 'Pagado'}</button>`)).join('')}</div>` : empty('Sin servicios este mes', 'Arriendo, gastos comunes, agua, internet y suscripciones van aquí.');
    } else if (UI.gseg === 'ingresos') {
      const list = S.ingresos.filter((s) => GG.mkOf(s.fecha) === UI.mk).sort((a, b) => b.fecha.localeCompare(a.fecha));
      h += `<div class="stat" style="margin-top:8px"><small>Ingresos del mes</small><span class="amt">${$clp(r.ingresos)}</span></div>`;
      h += list.length ? `<div class="list">${list.map((s) => rowHTML('ingresos', s.id, '💰', 'green', s.concepto, GG.fmtDate(s.fecha), $clp(s.monto), '')).join('')}</div>` : empty('Sin ingresos este mes', 'Registra tu sueldo para calcular el ahorro.');
    } else {
      const list = S.cuotas.map((q) => ({ q, e: GG.cuotaEstado(q, UI.mk) })).sort((a, b) => (a.e.estado === b.e.estado ? b.q.fecha.localeCompare(a.q.fecha) : a.e.estado === 'Vigente' ? -1 : 1));
      h += `<div class="grid2" style="margin-top:8px"><div class="stat"><small>Cuotas de este mes</small><span class="amt">${$clp(r.cuotas)}</span></div><div class="stat"><small>Saldo futuro</small><span class="amt">${$clp(r.tarjeta.futuras)}</span></div></div>`;
      h += list.length ? `<div class="list">${list.map(({ q, e }) => rowHTML('cuotas', q.id, '💳', e.delMes ? 'red' : '', q.descripcion, e.delMes ? `Cuota ${e.delMes.k} de ${e.N} este mes: ${$clp(e.delMes.monto)}` : `${e.N} cuotas de ${$clp(e.valor)} · compra ${GG.fmtDate(q.fecha)}`, $clp(e.saldo), `<span class="pill ${e.estado === 'Vigente' ? 'pink' : e.estado === 'Terminada' ? 'gray' : 'blue'}">${e.estado}</span>`)).join('')}</div><p class="muted small">El monto a la derecha es el saldo pendiente al cierre de ${GG.mkLabel(UI.mk).toLowerCase()}.</p>` : empty('Sin compras en cuotas', 'Las compras con crédito en varias cuotas se registran una sola vez aquí.');
    }
    return h;
  }
  function comprasList() {
    const q = GG.norm(UI.q);
    let list = S.compras.filter((c) => GG.mkOf(c.fecha) === UI.mk && (UI.amb === 'todo' || c.ambito === UI.amb));
    if (q) list = list.filter((c) => GG.norm(`${c.producto} ${c.marca} ${c.lugar} ${c.categoria}`).includes(q));
    if (!list.length) return q ? `<p class="muted" style="text-align:center;margin:30px 0">Nada coincide con «${esc(UI.q)}».</p>` : empty('Sin compras este mes', 'Toca + para registrar una compra. En la feria usa la compra rápida.');
    list.sort((a, b) => (a.fecha === b.fecha ? (b.creado || 0) - (a.creado || 0) : b.fecha.localeCompare(a.fecha)));
    const byDay = {};
    list.forEach((c) => (byDay[c.fecha] = byDay[c.fecha] || []).push(c));
    return Object.entries(byDay).map(([d, arr]) => `<div class="day"><span>${GG.fmtDate(d)}</span><span>${$clp(arr.reduce((a, c) => a + (+c.precio || 0), 0))}</span></div><div class="list">${arr.map((c) => rowHTML('compras', c.id, catIco(c.categoria), c.ambito === 'personal' ? 'blue' : '', `${c.producto}${c.marca ? ' ' + c.marca : ''}`, `${c.lugar || 'sin lugar'} · ${GG.fmtNum(c.cantidad, 3)} × ${GG.fmtNum(c.contenido, 3)} ${GG.normUnit(c.unidad) || c.unidad || ''}${c.etiqueta ? ' · ' + c.etiqueta : ''}`, c.precio ? $clp(c.precio) : '—', GG.isComplete(c) ? `<span class="pill ${c.ambito === 'personal' ? 'blue' : 'pink'}">${c.ambito === 'personal' ? 'Personal' : 'Casa'}</span>` : `<span class="pill red">Incompleta</span>`)).join('')}</div>`).join('');
  }
  function rowHTML(store, id, ico, icoCls, t, s, amt, extra) {
    return `<div class="row-wrap"><button class="row-del" data-act="del" data-store="${store}" data-id="${id}">Eliminar</button><div class="row" data-swipe data-edit="${store}" data-id="${id}" role="button" tabindex="0"><span class="ico ${icoCls}">${ico}</span><span class="mid"><div class="t">${esc(t)}</div><div class="s">${esc(s)}</div></span><span class="r"><div class="amt">${amt}</div>${extra || ''}</span></div></div>`;
  }
  function mountGastosSearch(v) {
    const i = $('#gq', v);
    if (i) i.addEventListener('input', () => { UI.q = i.value; $('#glist').innerHTML = comprasList(); });
  }

  /* ---------- Swipe para eliminar ---------- */
  let sw = null;
  document.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('[data-swipe]');
    $$('.row.open').forEach((r) => { if (r !== row) { r.classList.remove('open'); r.style.transform = ''; } });
    if (!row || e.target.closest('[data-act]')) return;
    sw = { row, x: e.clientX, y: e.clientY, dx: 0, base: row.classList.contains('open') ? -92 : 0, active: false, moved: false };
  });
  document.addEventListener('pointermove', (e) => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.active) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { sw.active = true; sw.row.style.transition = 'none'; }
      else if (Math.abs(dy) > 8) { sw = null; return; }
    }
    if (sw.active) { sw.moved = true; sw.dx = Math.min(0, Math.max(-120, sw.base + dx)); sw.row.style.transform = `translateX(${sw.dx}px)`; }
  });
  document.addEventListener('pointerup', () => {
    if (!sw) return;
    const s = sw;
    if (s.active) {
      s.row.style.transition = '';
      const open = s.dx < -50;
      s.row.classList.toggle('open', open);
      s.row.style.transform = open ? 'translateX(-92px)' : '';
      s.row._swiped = true;
      setTimeout(() => (s.row._swiped = false), 50);
    }
    sw = null;
  });

  /* ---------- Formularios: piezas ---------- */
  const fIn = (name, label, value, o = {}) => `<div class="field ${o.cls || ''}" data-f="${name}"><label for="f-${name}">${esc(label)}</label><input id="f-${name}" name="${name}" value="${esc(value ?? '')}" ${o.type ? `type="${o.type}"` : ''} ${o.im ? `inputmode="${o.im}"` : ''} placeholder="${esc(o.ph || '')}" autocomplete="off" ${o.money ? 'data-money' : ''} ${o.cap === false ? 'autocapitalize="off"' : 'autocapitalize="sentences"'}></div>`;
  const fSel = (name, label, opts, value, o = {}) => `<div class="field" data-f="${name}"><label for="f-${name}">${esc(label)}</label><select id="f-${name}" name="${name}">${o.blank ? `<option value="">${esc(o.blank)}</option>` : ''}${opts.map((x) => `<option ${x === value ? 'selected' : ''}>${esc(x)}</option>`).join('')}${value && !opts.includes(value) ? `<option selected>${esc(value)}</option>` : ''}</select></div>`;
  const fSeg = (name, label, opts, value) => `<div style="margin:10px 2px 2px"><label class="muted small" style="font-weight:600">${esc(label)}</label><div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${v === value ? 'on' : ''}">${esc(l)}</button>`).join('')}</div></div>`;
  const fSwitch = (name, label, on) => `<div class="field toggle"><span>${esc(label)}</span><button type="button" class="switch ${on ? 'on' : ''}" data-switch="${name}" role="switch" aria-checked="${!!on}"></button></div>`;
  function bindForm(root, f, onChange) {
    root.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.name) return;
      if (t.hasAttribute('data-money')) {
        const n = GG.parseMoney(t.value);
        t.value = t.value.trim() === '' ? '' : GG.fmtNum(n, 0);
      }
      f[t.name] = t.value;
      onChange && onChange(t.name);
    });
    root.addEventListener('change', (e) => { const t = e.target; if (t.name && t.tagName === 'SELECT') { f[t.name] = t.value; onChange && onChange(t.name); } });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-seg] button');
      if (b) { const seg = b.parentElement; $$('button', seg).forEach((x) => x.classList.toggle('on', x === b)); f[seg.dataset.seg] = b.dataset.v; onChange && onChange(seg.dataset.seg); return; }
      const s = e.target.closest('[data-switch]');
      if (s) { s.classList.toggle('on'); f[s.dataset.switch] = s.classList.contains('on'); s.setAttribute('aria-checked', f[s.dataset.switch]); onChange && onChange(s.dataset.switch); }
    });
  }
  const setVal = (root, name, v) => {
    const i = $(`[name="${name}"]`, root);
    if (i) i.value = i.hasAttribute('data-money') ? (v ? GG.fmtNum(+v, 0) : '') : v ?? '';
    const seg = $(`[data-seg="${name}"]`, root);
    if (seg) $$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  };
  const fieldErr = (root, name, on) => { const x = $(`[data-f="${name}"]`, root); if (x) x.classList.toggle('err', on); };

  /* ---------- Sugerencias (autocompletado) ---------- */
  function allProducts() {
    if (cache.ap) return cache.ap;
    const names = new Map(), lugares = new Map(), marcas = new Map();
    for (const c of S.compras) {
      const n = GG.norm(c.producto);
      if (n) { const x = names.get(n) || { name: c.producto, n: 0, last: '' }; x.n++; if ((c.fecha || '') >= x.last) { x.last = c.fecha || ''; x.name = c.producto; } names.set(n, x); }
      const l = GG.norm(c.lugar); if (l) { const x = lugares.get(l) || { name: c.lugar, n: 0 }; x.n++; lugares.set(l, x); }
      const m = GG.norm(c.marca); if (m) { const x = marcas.get(m) || { name: c.marca, n: 0 }; x.n++; marcas.set(m, x); }
    }
    return (cache.ap = { names, lugares, marcas });
  }
  function suggest(map, q, exclude = true) {
    const n = GG.norm(q);
    const arr = [...map.values()];
    if (!n) return arr.sort((a, b) => b.n - a.n).slice(0, 6);
    const starts = arr.filter((x) => GG.norm(x.name).startsWith(n));
    const inc = arr.filter((x) => !GG.norm(x.name).startsWith(n) && GG.norm(x.name).includes(n));
    return [...starts.sort((a, b) => b.n - a.n), ...inc.sort((a, b) => b.n - a.n)].filter((x) => !exclude || GG.norm(x.name) !== n).slice(0, 6);
  }
  function fuzzy(map, q) {
    const n = GG.norm(q);
    if (n.length < 4 || map.has(n)) return null;
    let best = null, bd = 3;
    for (const [k, x] of map) { const d = GG.lev(n, k); if (d > 0 && d < bd) { bd = d; best = x; } }
    return best;
  }
  const lastCompraByKey = (key) => {
    let last = null;
    for (const c of S.compras) if (GG.prodKey(c) === key && (!last || c.fecha > last.fecha || (c.fecha === last.fecha && (c.creado || 0) > (last.creado || 0)))) last = c;
    return last;
  };
  const lastCompra = () => S.compras.reduce((a, c) => (!a || (c.creado || 0) > (a.creado || 0) ? c : a), null);

  /* ---------- Formulario de compra ---------- */
  function compraForm(rec, o = {}) {
    const isNew = !rec;
    const last = lastCompra();
    const f = rec ? { ...rec } : {
      ambito: (last && last.ambito) || 'casa', fecha: GG.today(), producto: '', marca: '', lugar: (last && last.lugar) || '',
      tipo: 'Esencial', categoria: '', cantidad: '1', contenido: '1', unidad: 'un', precio: '', medio: (last && last.medio) || 'Débito', quien: 'ivan', etiqueta: '',
    };
    if (o.prefillKey) { const lc = lastCompraByKey(o.prefillKey); if (lc) Object.assign(f, pickVariant(lc), { cantidad: '1', precio: '' }); }
    if (o.prefillText) f.producto = o.prefillText;
    f.cantidad = String(f.cantidad ?? '').replace('.', ',');
    f.contenido = String(f.contenido ?? '').replace('.', ',');
    f.unidad = GG.normUnit(f.unidad) || 'un';
    let detalles = !o.quick;
    const cats = S.cfg.categorias.map((c) => c.nombre);
    const body = `
      ${fSeg('ambito', 'Gasto de', [['casa', 'La casa (compartido)'], ['personal', 'Personal']], f.ambito)}
      ${fIn('producto', 'Producto', f.producto, { ph: 'Ej: Leche' })}
      <div class="chips" id="sg-producto"></div><div class="chips" id="sg-var"></div>
      ${fIn('lugar', 'Lugar de compra', f.lugar, { ph: 'Ej: Feria, Lider, Jumbo' })}
      <div class="chips" id="sg-lugar"></div>
      <div class="fields-2">${fIn('cantidad', 'Cantidad', f.cantidad, { im: 'decimal' })}${fIn('precio', 'Precio pagado', f.precio ? GG.fmtNum(+f.precio, 0) : '', { im: 'numeric', money: 1, ph: '$0' })}</div>
      <div class="calc" id="calc"></div>
      <div id="consulta"></div>
      <button type="button" class="details-toggle" id="det-t">${detalles ? 'Ocultar detalles' : 'Más detalles (marca, formato, tipo, pago…)'}</button>
      <div id="det" class="${detalles ? '' : 'hidden'}">
        ${fIn('fecha', 'Fecha', f.fecha, { type: 'date' })}
        ${fIn('marca', 'Marca (opcional)', f.marca, { ph: 'Ej: Colún' })}
        <div class="chips" id="sg-marca"></div>
        <div class="fields-2">${fIn('contenido', 'Contenido de cada uno', f.contenido, { im: 'decimal' })}<div></div></div>
        ${fSeg('unidad', 'Unidad', [['g', 'g'], ['kg', 'kg'], ['ml', 'ml'], ['l', 'l'], ['un', 'un']], f.unidad)}
        <p class="muted small" style="margin:2px 4px">A granel (feria): contenido 1 kg y la cantidad son los kilos comprados.</p>
        <div class="fields-2">${fSel('tipo', 'Tipo de gasto', S.cfg.tipos.map((t) => t.nombre), f.tipo)}${fSel('categoria', 'Categoría', cats, f.categoria, { blank: 'Elegir…' })}</div>
        ${fSeg('medio', 'Medio de pago', S.cfg.medios.map((m) => [m, m]), f.medio)}
        <div id="quien-w">${fSeg('quien', 'Quién pagó', [['ivan', N().ivan], ['pollo', N().pollo]], f.quien)}</div>
        ${fSel('etiqueta', 'Etiqueta (opcional)', S.cfg.etiquetas, f.etiqueta, { blank: 'Sin etiqueta' })}
      </div>
      <button class="btn primary" id="save">${isNew ? 'Guardar compra' : 'Guardar cambios'}</button>
      ${isNew ? '<button class="btn ghost" id="save-more">Guardar y anotar otra</button>' : '<button class="btn danger" id="del">Eliminar compra</button>'}`;
    openSheet({
      title: isNew ? (o.quick ? 'Compra rápida' : 'Nueva compra') : 'Editar compra', body,
      onMount: ({ el, body: b, close }) => {
        const ap = allProducts();
        const refresh = (changed) => {
          $('#quien-w', b).classList.toggle('hidden', f.ambito === 'personal');
          // sugerencias de producto
          if (!changed || changed === 'producto') {
            const sg = suggest(ap.names, f.producto);
            const fz = fuzzy(ap.names, f.producto);
            $('#sg-producto', b).innerHTML = (fz ? `<button type="button" class="chip hint" data-pick-prod="${esc(fz.name)}">¿Quisiste decir <b>${esc(fz.name)}</b>?</button>` : '') + (GG.norm(f.producto) && document.activeElement === $('[name=producto]', b) ? sg.map((x) => `<button type="button" class="chip" data-pick-prod="${esc(x.name)}">${esc(x.name)}</button>`).join('') : '');
            const vars = master().filter((r) => GG.norm(r.producto) === GG.norm(f.producto));
            $('#sg-var', b).innerHTML = vars.length > 0 ? vars.map((r) => `<button type="button" class="chip ${r.key === GG.prodKey(f) ? 'on' : ''}" data-pick-var="${esc(r.key)}">${esc(r.marca || 'Sin marca')} <small>${prodFmt(r)} · ${$clp(r.ultimo)}</small></button>`).join('') : '';
          }
          if (!changed || changed === 'lugar') {
            const sg = document.activeElement === $('[name=lugar]', b) ? suggest(ap.lugares, f.lugar) : [];
            $('#sg-lugar', b).innerHTML = sg.map((x) => `<button type="button" class="chip" data-pick="lugar" data-val="${esc(x.name)}">${esc(x.name)}</button>`).join('');
          }
          if (!changed || changed === 'marca') {
            const sg = document.activeElement === $('[name=marca]', b) ? suggest(ap.marcas, f.marca) : [];
            $('#sg-marca', b).innerHTML = sg.map((x) => `<button type="button" class="chip" data-pick="marca" data-val="${esc(x.name)}">${esc(x.name)}</button>`).join('');
          }
          // cálculo y consulta
          const c = norm();
          const up = c.precio && c.cantidad ? GG.unitPrice(c) : 0, bp = GG.basePrice(c);
          const ub = (GG.UNITS[c.unidad] || {}).base || '';
          let calc = up ? `<span>Unitario <b>${$clp(up)}</b></span>` : '';
          if (bp) calc += `<span>Por ${ub} <b>${$clp(bp)}</b></span>`;
          if (c.ambito === 'casa' && c.precio) { const sp = GG.splitCompra(c, S.cfg); calc += `<span>${esc(N().ivan)} <b>${$clp(sp.ivan)}</b></span><span>${esc(N().pollo)} <b>${$clp(sp.pollo)}</b></span>`; }
          $('#calc', b).innerHTML = calc;
          const row = masterMap().get(GG.prodKey(c));
          let cons = '';
          if (row) {
            let cmp = '';
            if (up && row.prom) { const d = up / row.prom - 1; cmp = Math.abs(d) < 0.005 ? 'Igual a tu promedio.' : d < 0 ? `🎉 ${GG.fmtPct(-d)} más barato que tu promedio.` : `👀 ${GG.fmtPct(d)} más caro que tu promedio.`; }
            cons = `<div class="infobox"><div class="ib-title">📒 Antes de comprar: ${esc(prodName(row))} ${prodFmt(row)}</div><div class="ib-grid"><div><small>Último precio</small><b>${$clp(row.ultimo)}</b> <small>${esc(row.ultimoLugar)}, ${GG.fmtDate(row.ultimaFecha)}</small></div><div><small>Promedio 12 meses</small><b>${row.prom ? $clp(row.prom) : '—'}</b> <small>${row.n12} ${row.n12 === 1 ? 'compra' : 'compras'}</small></div><div><small>Más barato</small><b class="pos">${row.barato ? $clp(row.barato.precio) : '—'}</b> <small>${esc(row.barato ? row.barato.lugar : '')}</small></div><div><small>Más caro</small><b class="neg">${row.caro ? $clp(row.caro.precio) : '—'}</b> <small>${esc(row.caro ? row.caro.lugar : '')}</small></div></div>${cmp ? `<div style="margin-top:8px;font-weight:600">${cmp}</div>` : ''}</div>`;
          } else if (GG.norm(f.producto)) {
            cons = `<p class="muted small" style="margin:6px 4px">Producto nuevo con este formato: desde ahora la Tabla Maestra lo recordará.</p>`;
          }
          $('#consulta', b).innerHTML = cons;
        };
        const norm = () => ({ ...f, producto: (f.producto || '').trim(), marca: (f.marca || '').trim(), lugar: (f.lugar || '').trim(), cantidad: GG.parseDec(f.cantidad), contenido: GG.parseDec(f.contenido), unidad: GG.normUnit(f.unidad), precio: GG.parseMoney(f.precio), quien: f.ambito === 'personal' ? 'ivan' : f.quien });
        bindForm(b, f, refresh);
        b.addEventListener('focusin', (e) => e.target.name && refresh(e.target.name));
        const applyVariant = (key) => {
          const lc = lastCompraByKey(key);
          if (!lc) return;
          const v = pickVariant(lc);
          Object.assign(f, v);
          Object.entries(v).forEach(([k, val]) => setVal(b, k, val));
          if (!isNew) return;
        };
        b.addEventListener('click', (e) => {
          const p = e.target.closest('[data-pick-prod]');
          if (p) {
            f.producto = p.dataset.pickProd; setVal(b, 'producto', f.producto);
            const vars = master().filter((r) => GG.norm(r.producto) === GG.norm(f.producto));
            if (vars.length === 1) applyVariant(vars[0].key);
            else if (vars.length > 1) applyVariant(vars.reduce((a, r) => (r.ultimaFecha > a.ultimaFecha ? r : a)).key);
            refresh(); $('[name=lugar]', b).focus(); return;
          }
          const v = e.target.closest('[data-pick-var]');
          if (v) { applyVariant(v.dataset.pickVar); refresh(); return; }
          const pk = e.target.closest('[data-pick]');
          if (pk) { f[pk.dataset.pick] = pk.dataset.val; setVal(b, pk.dataset.pick, pk.dataset.val); refresh(); }
        });
        $('#det-t', b).onclick = () => { detalles = !detalles; $('#det', b).classList.toggle('hidden', !detalles); $('#det-t', b).textContent = detalles ? 'Ocultar detalles' : 'Más detalles (marca, formato, tipo, pago…)'; };
        refresh();
        const doSave = async (again) => {
          const c = norm();
          fieldErr(b, 'producto', !c.producto); fieldErr(b, 'lugar', !c.lugar);
          if (!c.producto || !c.lugar) { toast('Falta ' + (!c.producto ? 'el producto' : 'el lugar de compra')); return; }
          if (!c.categoria && !detalles) { detalles = true; $('#det', b).classList.remove('hidden'); fieldErr(b, 'categoria', true); toast('Elige la categoría del producto'); return; }
          if (!c.unidad) { toast('Elige la unidad'); return; }
          const row = masterMap().get(GG.prodKey(c));
          const out = { ...(rec || {}), ...c };
          await save('compras', out);
          if (o.onSaved) o.onSaved(out);
          let msg = isNew ? 'Compra guardada' : 'Cambios guardados';
          if (!GG.isComplete(out)) msg += ' (incompleta: no entra a la Tabla Maestra)';
          else if (row && row.prom && GG.unitPrice(out) < row.prom * 0.995) msg = '🎉 ¡Bajo tu promedio! Compra guardada';
          toast(msg);
          render();
          if (again) {
            Object.assign(f, { producto: '', marca: '', cantidad: '1', precio: '', contenido: '1', unidad: 'un', categoria: '', etiqueta: '' });
            ['producto', 'marca', 'cantidad', 'precio', 'contenido', 'unidad', 'categoria', 'etiqueta'].forEach((k) => setVal(b, k, f[k]));
            refresh(); $('[name=producto]', b).focus();
          } else close();
        };
        $('#save', b).onclick = () => doSave(false);
        if ($('#save-more', b)) $('#save-more', b).onclick = () => doSave(true);
        if ($('#del', b)) $('#del', b).onclick = async () => { if (await confirmSheet('¿Eliminar esta compra? También sale de la Tabla Maestra y del inventario.')) { await remove('compras', rec.id); toast('Compra eliminada'); render(); close(); } };
        if (isNew && !o.prefillKey && !o.prefillText) setTimeout(() => $('[name=producto]', b).focus(), 350);
      },
    });
  }
  const pickVariant = (lc) => ({
    producto: lc.producto, marca: lc.marca || '', contenido: String(lc.contenido).replace('.', ','), unidad: GG.normUnit(lc.unidad),
    tipo: lc.tipo, categoria: lc.categoria, ambito: lc.ambito, medio: lc.medio, quien: lc.quien || 'ivan', etiqueta: lc.etiqueta || '',
  });

  /* ---------- Servicios, ingresos y cuotas ---------- */
  function servicioForm(rec) {
    const isNew = !rec;
    const f = rec ? { ...rec } : { fecha: GG.today(), concepto: '', tipo: 'Esencial', monto: '', medio: 'Débito', quien: 'ivan', divide: true, estado: 'Pagado', etiqueta: '' };
    const conceptos = new Map();
    S.servicios.forEach((s) => { const n = GG.norm(s.concepto); const x = conceptos.get(n); if (!x || s.fecha > x.rec.fecha) conceptos.set(n, { name: s.concepto, n: 1, rec: s }); });
    openSheet({
      title: isNew ? 'Servicio o gasto fijo' : 'Editar servicio',
      body: `${fIn('concepto', 'Concepto', f.concepto, { ph: 'Ej: Arriendo, Gastos comunes, Netflix' })}<div class="chips" id="sg-c"></div>
        ${fIn('monto', 'Monto', f.monto ? GG.fmtNum(+f.monto, 0) : '', { im: 'numeric', money: 1, cls: 'big', ph: '$0' })}
        ${fIn('fecha', 'Fecha de pago', f.fecha, { type: 'date' })}
        ${fSel('tipo', 'Tipo de gasto', S.cfg.tipos.map((t) => t.nombre), f.tipo)}
        ${fSeg('medio', 'Medio de pago', S.cfg.medios.map((m) => [m, m]), f.medio)}
        ${fSeg('quien', 'Quién pagó', [['ivan', N().ivan], ['pollo', N().pollo]], f.quien)}
        ${fSwitch('divide', '¿Se divide entre los dos?', f.divide)}
        ${fSeg('estado', 'Estado', [['Pagado', 'Pagado'], ['Pendiente', 'Pendiente']], f.estado)}
        ${fSel('etiqueta', 'Etiqueta (opcional)', S.cfg.etiquetas, f.etiqueta, { blank: 'Sin etiqueta' })}
        <div class="calc" id="calc"></div>
        <button class="btn primary" id="save">${isNew ? 'Guardar servicio' : 'Guardar cambios'}</button>${isNew ? '' : '<button class="btn danger" id="del">Eliminar</button>'}`,
      onMount: ({ body: b, close }) => {
        const refresh = (ch) => {
          if (!ch || ch === 'concepto') {
            const sg = document.activeElement === $('[name=concepto]', b) ? suggest(conceptos, f.concepto) : [];
            $('#sg-c', b).innerHTML = sg.map((x) => `<button type="button" class="chip" data-c="${esc(GG.norm(x.name))}">${esc(x.name)} <small>${$clp(x.rec.monto)}</small></button>`).join('');
          }
          const sp = GG.splitServicio({ ...f, monto: GG.parseMoney(f.monto) }, S.cfg);
          $('#calc', b).innerHTML = `<span>${esc(N().ivan)} <b>${$clp(sp.ivan)}</b></span><span>${esc(N().pollo)} <b>${$clp(sp.pollo)}</b></span>`;
        };
        bindForm(b, f, refresh);
        b.addEventListener('focusin', (e) => e.target.name === 'concepto' && refresh('concepto'));
        b.addEventListener('click', (e) => {
          const c = e.target.closest('[data-c]');
          if (!c) return;
          const r = conceptos.get(c.dataset.c).rec;
          Object.assign(f, { concepto: r.concepto, tipo: r.tipo, monto: String(r.monto), medio: r.medio, quien: r.quien, divide: r.divide, etiqueta: r.etiqueta || '' });
          ['concepto', 'tipo', 'monto', 'medio', 'quien', 'etiqueta'].forEach((k) => setVal(b, k, f[k]));
          const s = $('[data-switch=divide]', b); s.classList.toggle('on', !!f.divide);
          refresh();
        });
        refresh();
        $('#save', b).onclick = async () => {
          const m = GG.parseMoney(f.monto);
          fieldErr(b, 'concepto', !f.concepto.trim()); fieldErr(b, 'monto', !m);
          if (!f.concepto.trim() || !m) { toast(!f.concepto.trim() ? 'Falta el concepto' : 'Falta el monto'); return; }
          await save('servicios', { ...(rec || {}), ...f, concepto: f.concepto.trim(), monto: m, divide: !!f.divide });
          toast(isNew ? 'Servicio guardado' : 'Cambios guardados'); render(); close();
        };
        if ($('#del', b)) $('#del', b).onclick = async () => { if (await confirmSheet('¿Eliminar este servicio?')) { await remove('servicios', rec.id); toast('Servicio eliminado'); render(); close(); } };
      },
    });
  }
  function ingresoForm(rec) {
    const isNew = !rec;
    const f = rec ? { ...rec } : { fecha: GG.today(), concepto: 'Sueldo', monto: '' };
    const conceptos = [...new Set(['Sueldo', ...S.ingresos.map((i) => i.concepto)])].slice(0, 8);
    openSheet({
      title: isNew ? 'Ingreso' : 'Editar ingreso',
      body: `${fIn('monto', 'Monto', f.monto ? GG.fmtNum(+f.monto, 0) : '', { im: 'numeric', money: 1, cls: 'big', ph: '$0' })}${fIn('concepto', 'Concepto', f.concepto)}<div class="chips">${conceptos.map((c) => `<button type="button" class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>${fIn('fecha', 'Fecha', f.fecha, { type: 'date' })}<button class="btn primary" id="save">${isNew ? 'Guardar ingreso' : 'Guardar cambios'}</button>${isNew ? '' : '<button class="btn danger" id="del">Eliminar</button>'}`,
      onMount: ({ body: b, close }) => {
        bindForm(b, f);
        b.addEventListener('click', (e) => { const c = e.target.closest('[data-c]'); if (c) { f.concepto = c.dataset.c; setVal(b, 'concepto', f.concepto); } });
        $('#save', b).onclick = async () => {
          const m = GG.parseMoney(f.monto);
          if (!m) { fieldErr(b, 'monto', true); toast('Falta el monto'); return; }
          await save('ingresos', { ...(rec || {}), ...f, concepto: (f.concepto || 'Ingreso').trim(), monto: m });
          toast(isNew ? 'Ingreso guardado' : 'Cambios guardados'); render(); close();
        };
        if ($('#del', b)) $('#del', b).onclick = async () => { if (await confirmSheet('¿Eliminar este ingreso?')) { await remove('ingresos', rec.id); toast('Ingreso eliminado'); render(); close(); } };
        if (isNew) setTimeout(() => $('[name=monto]', b).focus(), 350);
      },
    });
  }
  function cuotaForm(rec) {
    const isNew = !rec;
    const f = rec ? { ...rec, ncuotas: String(rec.ncuotas) } : { fecha: GG.today(), descripcion: '', ambito: 'personal', tipo: 'Esencial', quien: 'ivan', total: '', ncuotas: '3', etiqueta: '' };
    openSheet({
      title: isNew ? 'Compra en cuotas' : 'Editar compra en cuotas',
      body: `<p class="muted small" style="margin:0 4px">Sin interés y a precio contado. La primera cuota se paga el último día del mes de la compra.</p>
        ${fIn('descripcion', 'Descripción', f.descripcion, { ph: 'Ej: Notebook' })}
        <div class="fields-2">${fIn('total', 'Monto total', f.total ? GG.fmtNum(+f.total, 0) : '', { im: 'numeric', money: 1, ph: '$0' })}${fIn('ncuotas', 'N° de cuotas', f.ncuotas, { im: 'numeric' })}</div>
        ${fIn('fecha', 'Fecha de compra', f.fecha, { type: 'date' })}
        ${fSeg('ambito', 'Ámbito', [['casa', 'Casa'], ['personal', 'Personal']], f.ambito)}
        ${fSel('tipo', 'Tipo de gasto', S.cfg.tipos.map((t) => t.nombre), f.tipo)}
        ${fSeg('quien', 'Quién pagó', [['ivan', N().ivan], ['pollo', N().pollo]], f.quien)}
        ${fSel('etiqueta', 'Etiqueta (opcional)', S.cfg.etiquetas, f.etiqueta, { blank: 'Sin etiqueta' })}
        <div id="plan"></div>
        <button class="btn primary" id="save">${isNew ? 'Guardar cuotas' : 'Guardar cambios'}</button>${isNew ? '' : '<button class="btn danger" id="del">Eliminar</button>'}`,
      onMount: ({ body: b, close }) => {
        const refresh = () => {
          const q = { ...f, total: GG.parseMoney(f.total), ncuotas: parseInt(f.ncuotas, 10) || 1 };
          if (!q.total || !q.fecha) { $('#plan', b).innerHTML = ''; return; }
          const p = GG.cuotaPlan(q);
          $('#plan', b).innerHTML = `<div class="infobox"><div class="ib-title">💳 ${p.N} cuotas de ${$clp(p.valor)}</div><div class="ib-grid"><div><small>Primera cuota</small><b>${GG.fmtDate(p.primera)}</b></div><div><small>Última cuota</small><b>${GG.fmtDate(p.ultima)}</b></div></div></div>`;
        };
        bindForm(b, f, refresh); refresh();
        $('#save', b).onclick = async () => {
          const t = GG.parseMoney(f.total), n = parseInt(f.ncuotas, 10);
          if (!f.descripcion.trim() || !t || !(n >= 1)) { toast('Completa descripción, monto y cuotas'); return; }
          await save('cuotas', { ...(rec || {}), ...f, descripcion: f.descripcion.trim(), total: t, ncuotas: n });
          toast(isNew ? 'Cuotas guardadas' : 'Cambios guardados'); render(); close();
        };
        if ($('#del', b)) $('#del', b).onclick = async () => { if (await confirmSheet('¿Eliminar esta compra en cuotas y todas sus cuotas?')) { await remove('cuotas', rec.id); toast('Cuotas eliminadas'); render(); close(); } };
      },
    });
  }
  function addMenu() {
    if (UI.tab === 'despensa') {
      const sh = openSheet({ title: 'Despensa', body: `<div class="list menu">${[['buy', '🛒', 'Registrar compra', 'Suma al inventario'], ['item', '📝', 'Agregar a la lista de compras', 'Algo que falta comprar']].map(([k, i, t, s]) => `<button class="row" data-k="${k}"><span class="ico">${i}</span><span class="mid"><div class="t">${t}</div><div class="s">${s}</div></span><span class="chev">›</span></button>`).join('')}</div>` });
      sh.body.addEventListener('click', (e) => { const r = e.target.closest('[data-k]'); if (!r) return; sh.close(); r.dataset.k === 'buy' ? compraForm(null, { quick: true }) : listaItemForm(); });
      return;
    }
    const opts = [['quick', '⚡️', 'Compra rápida', 'Para la feria: producto, lugar, cantidad y precio'], ['compra', '🛒', 'Compra completa', 'Con marca, formato, tipo y medio de pago'], ['servicio', '🧾', 'Servicio o gasto fijo', 'Arriendo, gastos comunes, agua, suscripciones'], ['ingreso', '💰', 'Ingreso', 'Sueldo u otros'], ['cuota', '💳', 'Compra en cuotas', 'Crédito en varias cuotas sin interés']];
    const sh = openSheet({ title: '¿Qué quieres registrar?', body: `<div class="list menu">${opts.map(([k, i, t, s]) => `<button class="row" data-k="${k}"><span class="ico">${i}</span><span class="mid"><div class="t">${t}</div><div class="s">${s}</div></span><span class="chev">›</span></button>`).join('')}</div>` });
    sh.body.addEventListener('click', (e) => {
      const r = e.target.closest('[data-k]'); if (!r) return;
      sh.close();
      ({ quick: () => compraForm(null, { quick: true }), compra: () => compraForm(null), servicio: () => servicioForm(), ingreso: () => ingresoForm(), cuota: () => cuotaForm() })[r.dataset.k]();
    });
  }

  /* ---------- Despensa ---------- */
  function vDespensa() {
    const items = inv(), bajos = items.filter((i) => i.bajo), lista = listaItems();
    let h = `<div class="seg"><button data-act="dseg" data-v="inv" class="${UI.dseg === 'inv' ? 'on' : ''}">Inventario</button><button data-act="dseg" data-v="lista" class="${UI.dseg === 'lista' ? 'on' : ''}">Lista de compras${lista.length ? ` (${lista.length})` : ''}</button></div>`;
    if (UI.dseg === 'inv') {
      if (!items.length) return h + empty('Tu despensa está vacía', 'Cada compra completa de alimentos o limpieza suma stock aquí. Luego descuentas lo que vas usando.');
      if (bajos.length) h += `<div class="alert red"><span class="a-ico">🧺</span><div><b>Se acaba:</b> ${bajos.length} ${bajos.length === 1 ? 'producto' : 'productos'} en o bajo el mínimo.</div></div>`;
      h += `<div class="search"><span>🔎</span><input id="dq" type="search" placeholder="Buscar en la despensa" autocomplete="off"></div><div id="dlist">${invList('')}</div>`;
    } else {
      h += `<button class="btn ghost" data-act="lista-add">+ Agregar a la lista</button>`;
      if (!lista.length) return h + empty('Nada que comprar', 'Cuando un producto llegue a su stock mínimo aparecerá aquí solo. También puedes agregar cosas a mano.');
      for (const it of lista) {
        const row = it.key ? masterMap().get(it.key) : null;
        h += `<div class="card"><h2><span>${it.auto ? '🔴 ' : '📝 '}${esc(it.texto)}</span>${it.auto ? `<span class="pill red">Stock ${GG.fmtNum(it.stock, 2)}</span>` : ''}</h2>${row ? `<div class="infobox" style="margin-top:0"><div class="ib-grid"><div><small>Último precio</small><b>${$clp(row.ultimo)}</b> <small>${esc(row.ultimoLugar)}</small></div><div><small>Promedio 12 meses</small><b>${row.prom ? $clp(row.prom) : '—'}</b></div><div><small>Más barato</small><b class="pos">${row.barato ? $clp(row.barato.precio) : '—'}</b> <small>${esc(row.barato ? row.barato.lugar : '')}</small></div><div><small>Más caro</small><b class="neg">${row.caro ? $clp(row.caro.precio) : '—'}</b> <small>${esc(row.caro ? row.caro.lugar : '')}</small></div></div></div>` : '<p class="muted small" style="margin:0">Sin historial de precios todavía.</p>'}<div class="grid2" style="margin-top:8px"><button class="btn primary" style="margin:0;padding:11px" data-act="lista-comprado" data-key="${esc(it.key || '')}" data-id="${esc(it.id || '')}" data-txt="${esc(it.texto)}">Marcar comprado</button>${it.auto ? `<button class="btn ghost" style="margin:0;padding:11px" data-act="inv-open" data-key="${esc(it.key)}">Ajustar mínimo</button>` : `<button class="btn ghost" style="margin:0;padding:11px" data-act="lista-quitar" data-id="${esc(it.id)}">Quitar</button>`}</div></div>`;
      }
    }
    return h;
  }
  function listaItems() {
    const auto = inv().filter((i) => i.bajo).map((i) => ({ auto: true, key: i.key, texto: `${prodName(i.row)} ${prodFmt(i.row)}`, stock: i.stock }));
    const keys = new Set(auto.map((a) => a.key));
    const man = S.lista.filter((l) => !l.hecho && !(l.key && keys.has(l.key))).map((l) => ({ ...l, auto: false }));
    return [...auto, ...man];
  }
  function invList(q) {
    const n = GG.norm(q);
    const items = inv().filter((i) => !n || GG.norm(prodName(i.row)).includes(n));
    const order = S.cfg.categorias.map((c) => c.nombre);
    const groups = {};
    items.forEach((i) => (groups[i.row.categoria] = groups[i.row.categoria] || []).push(i));
    return Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((cat) => `<div class="day"><span>${catIco(cat)} ${esc(cat)}</span><span>${groups[cat].length}</span></div><div class="list">${groups[cat].sort((a, b) => (b.bajo - a.bajo) || GG.norm(a.row.producto).localeCompare(GG.norm(b.row.producto))).map((i) => `<div class="row"><span class="mid" data-act="inv-open" data-key="${esc(i.key)}" role="button"><div class="t">${esc(prodName(i.row))} <span class="tag">${prodFmt(i.row)}</span>${i.bajo ? ' <span class="pill red">Se acaba</span>' : ''}</div><div class="s">${i.min ? `Mínimo ${GG.fmtNum(i.min, 2)} · ` : 'Sin mínimo · '}último ${$clp(i.row.ultimo)} en ${esc(i.row.ultimoLugar)}</div></span><span class="stock"><button data-act="inv-minus" data-key="${esc(i.key)}" aria-label="Usé uno">−</button><span class="qty ${i.stock <= 0 ? 'neg' : ''}">${GG.fmtNum(i.stock, 2)}<br><small class="muted" style="font-weight:500">${i.unidadConteo}</small></span></span></div>`).join('')}</div>`).join('') || `<p class="muted" style="text-align:center;margin:30px">Nada coincide.</p>`;
  }
  function mountDespensa(v) {
    const i = $('#dq', v);
    if (i) i.addEventListener('input', () => ($('#dlist').innerHTML = invList(i.value)));
  }
  function invSheet(key) {
    const it = inv().find((i) => i.key === key);
    const row = masterMap().get(key);
    if (!row) return;
    const conf = S.inv.find((x) => x.id === key) || { id: key, min: 0 };
    const f = { usado: '', min: conf.min ? String(conf.min).replace('.', ',') : '', stock: it ? String(it.stock).replace('.', ',') : '0' };
    const movs = S.movs.filter((m) => m.key === key).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);
    openSheet({
      title: prodName(row),
      body: `<div class="stat" style="margin:4px 0 8px"><small>Stock actual</small><span class="amt" style="font-size:28px">${GG.fmtNum(it ? it.stock : 0, 2)} ${it ? it.unidadConteo : ''}</span></div>
        <div class="fields-2">${fIn('usado', 'Usé (cantidad)', f.usado, { im: 'decimal', ph: 'Ej: 1 o 0,5' })}<button class="btn primary" style="margin:8px 0" id="use">Descontar</button></div>
        ${fIn('min', 'Stock mínimo (alerta «se acaba»)', f.min, { im: 'decimal', ph: '0 = sin alerta' })}
        ${fIn('stock', 'Corregir stock a', f.stock, { im: 'decimal' })}
        <button class="btn ghost" id="savecfg">Guardar mínimo y stock</button>
        ${movs.length ? `<h3>Últimos consumos</h3><div class="list">${movs.map((m) => `<div class="row-wrap"><button class="row-del" data-mdel="${m.id}">Eliminar</button><div class="row" data-swipe><span class="mid"><div class="t">${m.tipo === 'ajuste' ? 'Ajuste' : 'Consumo'}</div><div class="s">${GG.fmtDate(m.fecha)}</div></span><span class="r num">${m.tipo === 'ajuste' ? (m.cantidad >= 0 ? '+' : '') : '−'}${GG.fmtNum(Math.abs(m.cantidad), 2)}</span></div></div>`).join('')}</div>` : ''}
        <button class="btn ghost" id="prod">Ver historial de precios</button>
        <button class="btn danger" id="hide">Quitar de la despensa</button>`,
      onMount: ({ body: b, close }) => {
        bindForm(b, f);
        $('#use', b).onclick = async () => {
          const q = GG.parseDec(f.usado);
          if (!(q > 0)) { toast('Indica cuánto usaste'); return; }
          await save('movs', { key, fecha: GG.today(), cantidad: q, tipo: 'consumo' });
          toast('Descontado'); render(); close();
        };
        $('#savecfg', b).onclick = async () => {
          const target = GG.parseDec(f.stock);
          await save('inv', { ...conf, id: key, min: GG.parseDec(f.min) });
          const cur = GG.inventory(S, master()).find((i) => i.key === key);
          const diff = Math.round((target - (cur ? cur.stock : 0)) * 1000) / 1000;
          if (diff) await save('movs', { key, fecha: GG.today(), cantidad: diff, tipo: 'ajuste' });
          toast('Despensa actualizada'); render(); close();
        };
        b.addEventListener('click', async (e) => { const d = e.target.closest('[data-mdel]'); if (d) { await remove('movs', d.dataset.mdel); toast('Movimiento eliminado'); render(); close(); } });
        $('#prod', b).onclick = () => productSheet(key);
        $('#hide', b).onclick = async () => { if (await confirmSheet('¿Quitar este producto de la despensa? Sus compras y precios se mantienen.', 'Quitar')) { await save('inv', { ...conf, id: key, oculto: true }); render(); close(); } };
      },
    });
  }
  function listaItemForm() {
    const f = { texto: '' };
    const ap = allProducts();
    openSheet({
      title: 'Agregar a la lista',
      body: `${fIn('texto', '¿Qué falta?', '', { ph: 'Ej: Detergente' })}<div class="chips" id="sg"></div><div id="vars" class="chips"></div><button class="btn primary" id="save">Agregar</button>`,
      onMount: ({ body: b, close }) => {
        let key = null;
        const refresh = () => {
          $('#sg', b).innerHTML = suggest(ap.names, f.texto).map((x) => `<button type="button" class="chip" data-p="${esc(x.name)}">${esc(x.name)}</button>`).join('');
          const vars = master().filter((r) => GG.norm(r.producto) === GG.norm(f.texto));
          if (vars.length && !vars.some((v) => v.key === key)) key = vars[0].key;
          if (!vars.length) key = null;
          $('#vars', b).innerHTML = vars.map((r) => `<button type="button" class="chip ${r.key === key ? 'on' : ''}" data-k="${esc(r.key)}">${esc(r.marca || 'Sin marca')} <small>${prodFmt(r)}</small></button>`).join('');
        };
        bindForm(b, f, refresh); refresh();
        b.addEventListener('click', (e) => {
          const p = e.target.closest('[data-p]'); if (p) { f.texto = p.dataset.p; setVal(b, 'texto', f.texto); key = null; refresh(); }
          const k = e.target.closest('[data-k]'); if (k) { key = k.dataset.k; refresh(); }
        });
        $('#save', b).onclick = async () => {
          if (!f.texto.trim()) { toast('Escribe qué falta'); return; }
          const row = key ? masterMap().get(key) : null;
          await save('lista', { texto: row ? `${prodName(row)} ${prodFmt(row)}` : f.texto.trim(), key, hecho: false });
          toast('Agregado a la lista'); UI.dseg = 'lista'; render(); close();
        };
        setTimeout(() => $('[name=texto]', b).focus(), 350);
      },
    });
  }

  /* ---------- Ficha de producto ---------- */
  function productSheet(key) {
    const row = masterMap().get(key);
    if (!row) { toast('Este producto aún no tiene compras completas'); return; }
    const cs = row.compras;
    const lug = {};
    cs.forEach((c) => { const x = (lug[c.lugar] = lug[c.lugar] || { s: 0, n: 0 }); x.s += GG.unitPrice(c); x.n++; });
    const lugItems = Object.entries(lug).map(([l, x]) => ({ label: l, value: x.s / x.n, sub: `${x.n} ${x.n === 1 ? 'compra' : 'compras'}` })).sort((a, b) => a.value - b.value);
    const sea = GG.seasonality(row);
    const it = inv().find((i) => i.key === key);
    openSheet({
      title: prodName(row),
      body: `<p class="muted" style="margin:0 4px 6px">${prodFmt(row)} · ${esc(row.categoria || 'Sin categoría')} · precio por ${row.unidadBase}: ${$clp(row.ultimoBase)}</p>
        <div class="infobox"><div class="ib-grid"><div><small>Último precio</small><b>${$clp(row.ultimo)}</b> <small>${esc(row.ultimoLugar)}, ${GG.fmtDate(row.ultimaFecha)}</small></div><div><small>Promedio 12 meses</small><b>${row.prom ? $clp(row.prom) : '—'}</b> <small>${row.promBase ? $clp(row.promBase) + '/' + row.unidadBase : ''}</small></div><div><small>Más barato</small><b class="pos">${row.barato ? $clp(row.barato.precio) : '—'}</b> <small>${esc(row.barato ? row.barato.lugar : '')}</small></div><div><small>Más caro</small><b class="neg">${row.caro ? $clp(row.caro.precio) : '—'}</b> <small>${esc(row.caro ? row.caro.lugar : '')}</small></div><div><small>Compras 12 meses</small><b>${row.n12}</b></div><div><small>En despensa</small><b>${it ? GG.fmtNum(it.stock, 2) + ' ' + it.unidadConteo : '—'}</b></div></div></div>
        <div class="card"><h2>Evolución del precio unitario</h2>${C.line(cs.map((c) => ({ label: GG.fmtDate(c.fecha).slice(0, 5), value: GG.unitPrice(c) })))}</div>
        <div class="card"><h2>Comparación entre lugares</h2>${C.hbars(lugItems, { color: 'var(--pink)' })}<p class="muted small" style="margin:6px 0 0">Precio unitario promedio de todo el historial.</p></div>
        <div class="card"><h2>¿Cuándo conviene comprarlo?</h2>${seasonHTML(sea)}</div>
        <div class="card"><h2>Historial (${cs.length})</h2><div class="list" style="box-shadow:none;margin:0">${cs.slice().reverse().map((c) => `<div class="row" data-edit="compras" data-id="${c.id}" role="button"><span class="mid"><div class="t">${esc(c.lugar)}</div><div class="s">${GG.fmtDate(c.fecha)} · ${GG.fmtNum(c.cantidad, 3)} un · ${c.ambito === 'personal' ? 'Personal' : 'Casa'}</div></span><span class="r"><div class="amt">${$clp(GG.unitPrice(c))}</div><small class="muted">pagado ${$clp(c.precio)}</small></span></div>`).join('')}</div></div>
        <button class="btn primary" id="buy">Registrar compra de este producto</button>`,
      onMount: ({ body: b }) => { $('#buy', b).onclick = () => compraForm(null, { prefillKey: key }); },
    });
  }
  function seasonHTML(sea) {
    if (!sea) return '<p class="muted small" style="margin:0">Aún no hay datos suficientes. Con más compras en distintas semanas (y al menos un año para los meses) verás aquí cuándo sube y baja.</p>';
    let h = '';
    if (sea.meses) {
      h += `<h3 style="margin-top:0">Por mes del año</h3>${C.hbars(sea.meses.map((m, i) => (m ? { label: GG.MESES[i], value: m.idx * sea.avg, sub: `${m.idx < 1 ? '▼' : '▲'} ${GG.fmtPct(Math.abs(m.idx - 1))} vs promedio` } : null)).filter(Boolean), { color: 'var(--blue)' })}`;
      if (sea.mejorMes) h += `<p style="margin:8px 0">Conviene en <b>${GG.MESES[sea.mejorMes.i]}</b>; evita <b>${GG.MESES[sea.peorMes.i]}</b>.</p>`;
    } else h += '<p class="muted small">Por mes del año: se necesita al menos un año de historial.</p>';
    if (sea.semanas) {
      h += `<h3>Por semana del mes</h3>${C.hbars(sea.semanas.map((w, i) => (w ? { label: `Semana ${i + 1} (días ${i * 7 + 1}–${Math.min(31, i * 7 + 7)})`, value: w.idx * sea.avg, sub: `${w.idx < 1 ? '▼' : '▲'} ${GG.fmtPct(Math.abs(w.idx - 1))} vs promedio` } : null)).filter(Boolean), { color: 'var(--pink)' })}<p style="margin:8px 0">La semana ${sea.mejorSemana.i + 1} suele ser la más barata.</p>`;
    }
    return h;
  }

  /* ---------- Dashboard ---------- */
  function vDashboard() {
    const ms = GG.monthsBack(UI.mk, 12), sums = ms.map(summary), r = summary(UI.mk);
    const labels = ms.map(GG.mkShort);
    const conDatos = sums.filter((s) => s.nRegistros);
    if (!conDatos.length) return empty('El dashboard espera tus datos', 'Apenas registres gastos e ingresos, aquí verás gráficos de los últimos 12 meses.');
    const ahorro12 = sums.reduce((a, s) => a + s.ahorro, 0), ing12 = sums.reduce((a, s) => a + s.ingresos, 0);
    let h = `<p class="muted small" style="margin:4px 4px 0">Últimos 12 meses hasta ${GG.mkLabel(UI.mk).toLowerCase()}.</p>`;
    h += `<div class="grid2" style="margin-top:8px"><div class="stat"><small>Ahorro 12 meses</small><span class="amt ${ahorro12 < 0 ? 'neg' : ''}">${$clp(ahorro12)}</span></div><div class="stat"><small>% de ahorro 12 meses</small><span class="amt">${GG.fmtPct(ing12 ? ahorro12 / ing12 : NaN, 1)}</span></div><div class="stat"><small>Gasto promedio mensual (tu parte)</small><span class="amt">${$clp(conDatos.reduce((a, s) => a + s.ivan, 0) / conDatos.length)}</span></div><div class="stat"><small>Gasto total promedio</small><span class="amt">${$clp(conDatos.reduce((a, s) => a + s.gastoTotal, 0) / conDatos.length)}</span></div></div>`;
    h += `<div class="card"><h2>Ingresos, gastos y ahorro</h2>${C.bars({ labels, bars: [{ name: 'Ingresos', color: 'var(--blue)', values: sums.map((s) => s.ingresos) }, { name: 'Tu gasto', color: 'var(--pink)', values: sums.map((s) => s.ivan) }], line: { name: 'Ahorro', color: 'var(--red)', values: sums.map((s) => s.ahorro) } })}</div>`;
    h += `<div class="card"><h2>% de ahorro por mes</h2>${C.hbars(ms.map((m, i) => ({ label: GG.mkLabel(m), value: isFinite(sums[i].pctAhorro) ? sums[i].pctAhorro : 0, color: sums[i].pctAhorro < 0 ? 'var(--red)' : 'var(--blue)' })).filter((x, i) => sums[i].ingresos > 0).reverse(), { fmt: (v) => GG.fmtPct(v, 1), max: 1 })}</div>`;
    h += `<div class="card"><h2>Tendencia del gasto total</h2>${C.bars({ labels, bars: [{ name: 'Gasto total registrado', color: 'var(--violet)', values: sums.map((s) => s.gastoTotal) }], line: { name: 'Tu parte', color: 'var(--pink)', values: sums.map((s) => s.ivan) } })}</div>`;
    const tipos = Object.entries(r.byTipo).map(([k, v], i) => ({ label: k, value: v.ivan, color: C.PALETTE[i % 8] }));
    h += `<div class="card"><h2>Tu gasto por tipo, ${GG.mkLabel(UI.mk).toLowerCase()}</h2>${C.donut(tipos, { center: GG.fmtNum(r.ivan / 1000, 0) + 'k', sub: 'tu parte' })}</div>`;
    const pr = r.presupuesto.filter((p) => p.presupuesto > 0 || p.gastado > 0);
    h += `<div class="card"><h2>Presupuesto vs real</h2>${pr.length ? C.bars({ labels: pr.map((p) => p.tipo.slice(0, 7)), bars: [{ name: 'Presupuesto', color: 'var(--blue)', values: pr.map((p) => p.presupuesto) }, { name: 'Gastado', color: 'var(--pink)', values: pr.map((p) => p.gastado) }] }) : '<p class="muted small">Sin presupuestos definidos.</p>'}</div>`;
    const casa12 = sums.reduce((a, s) => a + s.compartidoTotal, 0), pers12 = sums.reduce((a, s) => a + s.personalTotalIvan, 0);
    h += `<div class="card"><h2>Casa vs personal (12 meses)</h2>${C.meter([{ label: 'Casa (compartido)', value: casa12, color: 'var(--pink)' }, { label: 'Personal', value: pers12, color: 'var(--blue)' }])}</div>`;
    // top productos, lugares y categorías
    const from = ms[0], to = ms[11];
    const cs = S.compras.filter((c) => { const m = GG.mkOf(c.fecha); return m >= from && m <= to; });
    const agg = (fn) => { const o = {}; cs.forEach((c) => { const k = fn(c); if (k) o[k] = (o[k] || 0) + (+c.precio || 0); }); return Object.entries(o).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); };
    h += `<div class="card"><h2>Top productos por gasto</h2>${C.hbars(agg((c) => c.producto + (c.marca ? ' ' + c.marca : '')).slice(0, 8), { color: 'var(--pink)' })}</div>`;
    h += `<div class="card"><h2>Top lugares por gasto</h2>${C.hbars(agg((c) => c.lugar).slice(0, 8), { color: 'var(--blue)' })}</div>`;
    h += `<div class="card"><h2>Categorías de producto</h2>${C.hbars(agg((c) => c.categoria || 'Sin categoría').slice(0, 12), { color: 'var(--violet)' })}</div>`;
    // hormigas
    const et = {};
    sums.forEach((s) => Object.entries(s.byEtiqueta).forEach(([k, v]) => (et[k] = (et[k] || 0) + v)));
    const plat = sums.reduce((a, s) => a + ((s.byTipo.Plataforma || {}).ivan || 0), 0), horm = sums.reduce((a, s) => a + ((s.byTipo.Hormiga || {}).ivan || 0), 0);
    h += `<div class="card"><h2>Hormigas y suscripciones <button class="link" data-act="more" data-v="hormigas">Detalle</button></h2>${C.hbars([{ label: 'Tipo Plataforma', value: plat, color: 'var(--red)' }, { label: 'Tipo Hormiga', value: horm, color: 'var(--coral)' }, ...Object.entries(et).map(([label, value]) => ({ label: 'Etiqueta ' + label, value })).sort((a, b) => b.value - a.value)].filter((x) => x.value > 0), { color: 'var(--pink)' })}</div>`;
    const mas = S.cfg.tipos.find((t) => t.nombre === 'Mascota');
    h += `<div class="card"><h2>Mascota</h2>${C.bars({ labels, bars: [{ name: 'Gasto mascota', color: 'var(--coral)', values: sums.map((s) => (s.byTipo.Mascota || {}).ivan || 0) }], line: mas && +mas.presupuesto ? { name: 'Presupuesto', color: 'var(--blue)', values: ms.map(() => +mas.presupuesto) } : null })}</div>`;
    h += cuadreCard(r) + tarjetaCard(r);
    // cuotas
    const vig = S.cuotas.map((q) => ({ q, e: GG.cuotaEstado(q, UI.mk) })).filter((x) => x.e.estado !== 'Terminada');
    const cal = Array.from({ length: 12 }, (_, i) => GG.addMonths(UI.mk, i)).map((m) => ({ m, v: S.cuotas.reduce((a, q) => a + ((GG.cuotaPlan(q).items.find((it) => it.mk === m) || {}).monto || 0), 0) }));
    h += `<div class="card"><h2>Cuotas vigentes</h2>${vig.length ? vig.map(({ q, e }) => `<div class="kv"><span>${esc(q.descripcion)} <small>(${e.imputadas}/${e.N})</small></span><b>${$clp(e.saldo)}</b></div>`).join('') : '<p class="muted small">No hay cuotas vigentes.</p>'}<h3>Calendario de cuotas</h3><div class="cal">${cal.map((c) => `<div class="${c.v ? '' : 'zero'}">${GG.mkShort(c.m)}<b>${c.v ? $clp(c.v) : '—'}</b></div>`).join('')}</div></div>`;
    // semáforos y alertas
    h += `<div class="card"><h2>Semáforos y alertas</h2>${r.presupuesto.filter((p) => p.presupuesto > 0).map((p) => `<div class="kv"><span><span class="sem ${p.sem}"></span> ${esc(p.tipo)}</span><b>${GG.fmtPct(p.pct)} · ${semLabel[p.sem]}</b></div>`).join('') || '<p class="muted small">Sin presupuestos definidos.</p>'}${alertsHTML(r, false)}</div>`;
    h += auditCard(r);
    return h;
  }
  function auditCard(r) {
    const c = r.cuadre;
    const ctrlCuadre = Math.round(c.pagIvan + c.pagPollo - c.parteIvan - c.partePollo);
    const badCuotas = S.cuotas.filter((q) => GG.cuotaPlan(q).items.reduce((a, i) => a + i.monto, 0) !== Math.round(+q.total)).length;
    const completas = S.compras.filter(GG.isComplete).length, enMaestra = master().reduce((a, x) => a + x.nTotal, 0);
    const incompletas = S.compras.length - completas;
    const line = (t, v, ok) => `<div class="audit"><span>${t}</span><b class="${ok ? 'pos' : 'neg'}">${ok ? '✓ ' : '⚠️ '}${v}</b></div>`;
    return `<div class="card"><h2>Controles de auditoría</h2>
      ${line('Gasto total − responsabilidades', $clp(r.control), r.control === 0)}
      ${line('Gastado por tipo − tu responsabilidad', $clp(r.controlPresupuesto), r.controlPresupuesto === 0)}
      ${line('Pagado compartido − partes', $clp(ctrlCuadre), ctrlCuadre === 0)}
      ${line('Cuotas cuyo plan no suma el total', String(badCuotas), badCuotas === 0)}
      ${line('Compras completas vs Tabla Maestra', `${completas} = ${enMaestra}`, completas === enMaestra)}
      <div class="audit"><span>Compras incompletas (no entran a la Tabla Maestra)</span><b class="${incompletas ? 'blue' : 'pos'}">${incompletas}</b></div></div>`;
  }

  /* ---------- Más ---------- */
  function vMas() {
    if (UI.more) return `<div id="page">${PAGES[UI.more]()}</div>`;
    return `<div class="list menu" style="margin-top:12px">${Object.entries(MORE).map(([k, [t, i, s]]) => `<button class="row" data-act="more" data-v="${k}"><span class="ico">${i}</span><span class="mid"><div class="t">${t}</div><div class="s">${s}</div></span><span class="chev">›</span></button>`).join('')}</div><div class="empty" style="padding-top:20px">${mascota(84)}<b>GastónGastín</b>Tus datos viven solo en este iPhone.</div>`;
  }
  const PAGES = {}, PAGES_MOUNT = {};

  PAGES.maestra = () => {
    const rows = master();
    if (!rows.length) return empty('La Tabla Maestra se llena sola', 'Cada compra completa (con fecha, producto, lugar, cantidad, contenido, unidad y precio) alimenta esta tabla.');
    return `<div class="search"><span>🔎</span><input id="mq" type="search" placeholder="Buscar entre ${rows.length} productos" value="${esc(UI.mq)}" autocomplete="off"></div><div class="seg small">${[['nombre', 'A–Z'], ['gasto', 'Más gasto'], ['compras', 'Más compras'], ['reciente', 'Recientes']].map(([k, l]) => `<button data-act="msort" data-v="${k}" class="${UI.msort === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="mlist">${maestraList()}</div>`;
  };
  function maestraList() {
    const n = GG.norm(UI.mq);
    let rows = master().filter((r) => !n || GG.norm(`${r.producto} ${r.marca} ${r.categoria}`).includes(n));
    const s = { gasto: (a, b) => b.gasto12 - a.gasto12, compras: (a, b) => b.n12 - a.n12, reciente: (a, b) => b.ultimaFecha.localeCompare(a.ultimaFecha) }[UI.msort];
    if (s) rows = rows.slice().sort(s);
    return `<div class="list">${rows.map((r) => `<button class="row" data-act="prod" data-key="${esc(r.key)}"><span class="ico">${catIco(r.categoria)}</span><span class="mid"><div class="t">${esc(prodName(r))} <span class="tag">${prodFmt(r)}</span></div><div class="s">Prom. ${r.prom ? $clp(r.prom) : '—'} · barato ${r.barato ? $clp(r.barato.precio) + ' ' + r.barato.lugar : '—'} · caro ${r.caro ? $clp(r.caro.precio) + ' ' + r.caro.lugar : '—'}</div></span><span class="r"><div class="amt">${$clp(r.ultimo)}</div><small class="muted">${esc(r.ultimoLugar)}</small></span></button>`).join('')}</div>`;
  }
  PAGES_MOUNT.maestra = (v) => { const i = $('#mq', v); if (i) i.addEventListener('input', () => { UI.mq = i.value; $('#mlist').innerHTML = maestraList(); }); };

  PAGES.proyeccion = () => {
    const allDates = [...S.compras, ...S.servicios, ...S.ingresos].map((x) => x.fecha).concat(S.cuotas.map((q) => q.fecha)).filter(Boolean).sort();
    if (!allDates.length) return empty('Sin datos para proyectar', 'Con al menos un mes de ingresos y gastos verás tu proyección de ahorro.');
    const first = GG.mkOf(allDates[0]), lastMk = GG.mkOf(GG.today()) > UI.mk ? GG.mkOf(GG.today()) : UI.mk;
    const n = Math.max(1, GG.monthDiff(first, lastMk) + 1);
    const series = Array.from({ length: n }, (_, i) => GG.addMonths(first, i)).map((mk) => { const s = summary(mk); return { mk, ingresos: s.ingresos, gasto: s.ivan }; });
    while (series.length > 1 && series[series.length - 1].ingresos === 0 && series[series.length - 1].gasto === 0) series.pop();
    const p = GG.projection(series, 6);
    const hist = series.slice(-6);
    const labels = [...hist.map((s) => GG.mkShort(s.mk)), ...p.mks.map(GG.mkShort)];
    let h = `<div class="card"><h2>Proyección de 6 meses</h2>${C.bars({ labels, bars: [{ name: 'Ingresos', color: 'var(--blue)', values: [...hist.map((s) => s.ingresos), ...p.ingresos], dashedFrom: hist.length }, { name: 'Tu gasto', color: 'var(--pink)', values: [...hist.map((s) => s.gasto), ...p.gasto], dashedFrom: hist.length }], line: { name: 'Ahorro', color: 'var(--red)', values: [...hist.map((s) => s.ingresos - s.gasto), ...p.ahorro], dashedFrom: hist.length } })}<p class="muted small" style="margin:8px 0 0"><b>Supuesto:</b> ${esc(p.supuesto)} Las barras claras son proyección.</p></div>`;
    h += `<div class="card"><div class="scroll-x"><table class="mini"><tr><th>Mes</th><th class="r">Ingresos</th><th class="r">Gasto</th><th class="r">Ahorro</th></tr>${p.mks.map((m, i) => `<tr><td>${GG.mkLabel(m)}</td><td class="r">${$clp(p.ingresos[i])}</td><td class="r">${$clp(p.gasto[i])}</td><td class="r ${p.ahorro[i] < 0 ? 'neg' : ''}">${$clp(p.ahorro[i])}</td></tr>`).join('')}<tr><td><b>Total 6 meses</b></td><td></td><td></td><td class="r"><b>${$clp(p.ahorro.reduce((a, b) => a + b, 0))}</b></td></tr></table></div></div>`;
    const sea = master().map((r) => ({ r, s: GG.seasonality(r) })).filter((x) => x.s);
    h += `<div class="section-title">Estacionalidad de precios</div>`;
    h += sea.length ? `<div class="list">${sea.map(({ r, s }) => `<button class="row" data-act="prod" data-key="${esc(r.key)}"><span class="ico">${catIco(r.categoria)}</span><span class="mid"><div class="t">${esc(prodName(r))}</div><div class="s">${s.mejorMes ? `Mejor mes: ${GG.MESES[s.mejorMes.i]} · ` : ''}${s.mejorSemana ? `mejor semana: ${s.mejorSemana.i + 1}` : ''}</div></span><span class="chev">›</span></button>`).join('')}</div>` : `<div class="card"><p class="muted small" style="margin:0">Aparecerá cuando un producto tenga varias compras en distintas semanas del mes (y un año de historial para comparar meses).</p></div>`;
    return h;
  };

  PAGES.hormigas = () => {
    const ms = GG.monthsBack(UI.mk, 12), r = summary(UI.mk);
    // suscripciones
    const subs = new Map();
    S.servicios.filter((s) => s.tipo === 'Plataforma' && GG.mkOf(s.fecha) >= ms[0] && GG.mkOf(s.fecha) <= UI.mk).forEach((s) => {
      const k = GG.norm(s.concepto), x = subs.get(k) || { name: s.concepto, last: s, meses: new Set() };
      if (s.fecha >= x.last.fecha) { x.last = s; x.name = s.concepto; }
      x.meses.add(GG.mkOf(s.fecha)); subs.set(k, x);
    });
    const subsArr = [...subs.values()].map((x) => { const m = GG.splitServicio(x.last, S.cfg).ivan; return { ...x, mensual: m, anual: m * 12, activa: GG.mkOf(x.last.fecha) >= GG.addMonths(UI.mk, -1) }; }).sort((a, b) => b.anual - a.anual);
    const totalSubs = subsArr.filter((x) => x.activa).reduce((a, x) => a + x.anual, 0);
    let h = `<div class="card"><h2>Suscripciones y plataformas</h2>${subsArr.length ? `<p style="margin:0 0 8px">Si eliminas todas las activas ahorras <b class="pinkc">${$clp(totalSubs)}</b> al año.</p>${subsArr.map((x) => `<div class="budget"><div class="b-top"><span>📺 ${esc(x.name)}</span><b>${$clp(x.mensual)}/mes</b></div><div class="b-sub"><span>${x.activa ? `Eliminarla te ahorra ${$clp(x.anual)} al año` : 'Sin pagos recientes'}</span><span>${x.meses.size} ${x.meses.size === 1 ? 'mes pagado' : 'meses pagados'}</span></div></div>`).join('')}` : '<p class="muted small" style="margin:0">Registra tus suscripciones como servicio con tipo «Plataforma» (por ejemplo Netflix, Disney, PS Plus, DirectvGo).</p>'}</div>`;
    // etiquetas
    const ms6 = GG.monthsBack(UI.mk, 6);
    const etqs = [...new Set([...S.cfg.etiquetas, ...ms.flatMap((m) => Object.keys(summary(m).byEtiqueta))])];
    h += `<div class="card"><h2>Gustos por etiqueta</h2>${etqs.map((e) => {
      const vals = ms6.map((m) => summary(m).byEtiqueta[e] || 0), avg = vals.reduce((a, b) => a + b, 0) / 6;
      if (!vals.some(Boolean)) return `<div class="kv"><span>${esc(e)}</span><b class="muted">sin gastos</b></div>`;
      return `<div class="budget"><div class="b-top"><span>${esc(e)}</span><b>${$clp(vals[5])}</b></div>${C.bars({ labels: ms6.map(GG.mkShort), bars: [{ name: e, color: 'var(--coral)', values: vals }], height: 110, legend: false })}<div class="b-sub"><span>Promedio ${$clp(avg)}/mes</span><span>Reducir a la mitad: ${$clp((avg * 12) / 2)} al año</span></div></div>`;
    }).join('')}<p class="muted small" style="margin:8px 0 0">Asigna una etiqueta (alcohol, comida de apps, cigarros, otros gustos) al registrar cada gasto.</p></div>`;
    // hormiga y plataforma vs presupuesto, mascota
    const pres = (t) => r.presupuesto.find((p) => p.tipo === t) || { gastado: 0, presupuesto: 0, sem: 'none', pct: NaN };
    h += `<div class="card"><h2>Presupuesto de gustos y mascota</h2>${['Hormiga', 'Plataforma', 'Mascota'].map((t) => { const p = pres(t); return `<div class="budget"><div class="b-top"><span class="sem ${p.sem}"></span><span>${TIPO_ICO[t]} ${t}</span><b>${$clp(p.gastado)}</b></div><div class="bar"><div class="${p.sem}" style="width:${p.presupuesto ? Math.min(100, p.pct * 100) : 0}%"></div></div><div class="b-sub"><span>${p.presupuesto ? `${GG.fmtPct(p.pct)} de ${$clp(p.presupuesto)}` : 'Sin presupuesto'}</span><span>${semLabel[p.sem]}</span></div></div>`; }).join('')}</div>`;
    h += `<div class="card"><h2>🐾 Mascota, 12 meses</h2>${C.bars({ labels: ms.map(GG.mkShort), bars: [{ name: 'Gasto mascota', color: 'var(--coral)', values: ms.map((m) => (summary(m).byTipo.Mascota || {}).ivan || 0) }] })}</div>`;
    return h;
  };

  PAGES.unir = () => {
    const groups = new Map();
    S.compras.forEach((c) => { const k = GG.prodKey(c); const g = groups.get(k) || { key: k, c, n: 0 }; g.n++; if ((c.fecha || '') >= (g.c.fecha || '')) g.c = c; groups.set(k, g); });
    const arr = [...groups.values()].sort((a, b) => GG.norm(a.c.producto).localeCompare(GG.norm(b.c.producto)));
    const label = (g) => `${g.c.producto}${g.c.marca ? ' ' + g.c.marca : ''} ${GG.fmtNum(+g.c.contenido, 3)} ${GG.normUnit(g.c.unidad)} (${g.n})`;
    const pares = [];
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const na = GG.norm(a.c.producto), nb = GG.norm(b.c.producto);
      const d = GG.lev(na, nb);
      if (na !== nb && d <= 2 && Math.min(na.length, nb.length) >= 4) pares.push([a, b]);
      else if (na === nb && GG.lev(GG.norm(a.c.marca), GG.norm(b.c.marca)) <= 1 && GG.norm(a.c.marca) !== GG.norm(b.c.marca) && a.key.split('|').slice(2).join() === b.key.split('|').slice(2).join()) pares.push([a, b]);
      if (pares.length > 30) break;
    }
    cache.unirArr = arr;
    let h = `<p class="muted" style="margin:4px">Si escribiste mal un producto, únelo con el correcto: todas sus compras pasan al producto correcto, y la Tabla Maestra y la despensa se recalculan.</p>`;
    h += `<div class="section-title">Posibles duplicados</div>`;
    h += pares.length ? `<div class="list">${pares.map(([a, b]) => { const [keep, drop] = a.n >= b.n ? [a, b] : [b, a]; return `<div class="row"><span class="mid"><div class="t">«${esc(label(drop))}»</div><div class="s">parece «${esc(label(keep))}»</div></span><button class="pill blue" data-act="merge" data-from="${esc(drop.key)}" data-to="${esc(keep.key)}">Unir</button></div>`; }).join('')}</div>` : `<div class="card"><p class="muted small" style="margin:0">No veo duplicados evidentes. 👌</p></div>`;
    h += `<div class="section-title">Unir a mano</div><div class="card">${fSel('from', 'Producto a corregir', arr.map(label), '', { blank: 'Elegir…' })}${fSel('to', 'Producto correcto', arr.map(label), '', { blank: 'Elegir…' })}<button class="btn primary" id="merge-go">Unir productos</button></div>`;
    return h;
  };
  PAGES_MOUNT.unir = (v) => {
    const go = $('#merge-go', v);
    if (!go) return;
    go.onclick = () => {
      const fi = $('#f-from', v).selectedIndex - 1, ti = $('#f-to', v).selectedIndex - 1;
      const arr = cache.unirArr;
      if (fi < 0 || ti < 0 || fi === ti) { toast('Elige dos productos distintos'); return; }
      mergeProducts(arr[fi].key, arr[ti].key);
    };
  };
  async function mergeProducts(fromKey, toKey) {
    const target = S.compras.filter((c) => GG.prodKey(c) === toKey).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const src = S.compras.filter((c) => GG.prodKey(c) === fromKey);
    if (!target || !src.length) return;
    if (!(await confirmSheet(`Se moverán ${src.length} ${src.length === 1 ? 'compra' : 'compras'} a «${esc(target.producto)}${target.marca ? ' ' + esc(target.marca) : ''}». ¿Unir?`, 'Unir', false))) return;
    const upd = src.map((c) => ({ ...c, producto: target.producto, marca: target.marca || '', contenido: target.contenido, unidad: target.unidad, categoria: target.categoria || c.categoria, mod: Date.now() }));
    await GG.db.putMany('compras', upd);
    upd.forEach((u) => { const i = S.compras.findIndex((c) => c.id === u.id); S.compras[i] = u; });
    const mv = S.movs.filter((m) => m.key === fromKey).map((m) => ({ ...m, key: toKey }));
    if (mv.length) { await GG.db.putMany('movs', mv); mv.forEach((u) => { const i = S.movs.findIndex((c) => c.id === u.id); S.movs[i] = u; }); }
    const li = S.lista.filter((l) => l.key === fromKey).map((l) => ({ ...l, key: toKey }));
    if (li.length) { await GG.db.putMany('lista', li); li.forEach((u) => { const i = S.lista.findIndex((c) => c.id === u.id); S.lista[i] = u; }); }
    const fc = S.inv.find((x) => x.id === fromKey), tc = S.inv.find((x) => x.id === toKey);
    if (fc) { await remove('inv', fromKey); if (!tc && fc.min) await save('inv', { id: toKey, min: fc.min }); }
    invalidate(); toast('Productos unidos'); render();
  }

  PAGES.ajustes = () => {
    const c = S.cfg, n = c.nombres;
    return `<div class="section-title">Personas y reparto</div><div class="card">
      <div class="fields-2">${fIn('n-ivan', 'Tu nombre', n.ivan)}${fIn('n-pollo', 'Segunda persona', n.pollo)}</div>
      ${fIn('pct', `% de ${n.ivan} en gastos de la casa`, GG.fmtNum(c.pctIvan * 100, 2), { im: 'decimal' })}
      <p class="muted small" style="margin:4px">${esc(n.pollo)}: ${GG.fmtNum((1 - c.pctIvan) * 100, 2)}%.</p></div>
      <div class="section-title">Presupuesto mensual por tipo de gasto</div><div class="card" id="tipos">${c.tipos.map((t, i) => `<div class="fields-2">${fIn('tn-' + i, 'Tipo', t.nombre)}${fIn('tp-' + i, 'Presupuesto', t.presupuesto ? GG.fmtNum(t.presupuesto, 0) : '', { im: 'numeric', money: 1, ph: 'Sin presupuesto' })}</div>`).join('')}<button class="btn ghost" data-act="cfg-add" data-v="tipo">+ Agregar tipo</button></div>
      <div class="section-title">Categorías de producto</div><div class="card"><p class="muted small" style="margin:0 4px 6px">El interruptor indica si la categoría alimenta la despensa.</p>${c.categorias.map((k, i) => `<div style="display:flex;gap:6px;align-items:center">${fIn('cn-' + i, '', k.nombre).replace('class="field ', 'style="flex:1" class="field ')}<button type="button" class="switch ${k.despensa ? 'on' : ''}" data-cat-desp="${i}" aria-label="Alimenta despensa"></button><button class="pill gray" data-act="cat-up" data-v="${i}" aria-label="Subir">▲</button><button class="pill gray" data-act="cat-down" data-v="${i}" aria-label="Bajar">▼</button></div>`).join('')}<button class="btn ghost" data-act="cfg-add" data-v="cat">+ Agregar categoría</button></div>
      <div class="section-title">Etiquetas de gustos</div><div class="card">${c.etiquetas.map((e, i) => `<div style="display:flex;gap:6px;align-items:center">${fIn('en-' + i, '', e).replace('class="field ', 'style="flex:1" class="field ')}<button class="pill red" data-act="etq-del" data-v="${i}">Quitar</button></div>`).join('')}<button class="btn ghost" data-act="cfg-add" data-v="etq">+ Agregar etiqueta</button></div>
      <div class="section-title">Tarjeta y semáforos</div><div class="card">
      ${fIn('cupo', 'Cupo total de la tarjeta', c.cupo ? GG.fmtNum(c.cupo, 0) : '', { im: 'numeric', money: 1 })}
      <div class="fields-2">${fIn('ua', '🟡 Cuidado desde (%)', GG.fmtNum(c.umbralAmarillo * 100, 1), { im: 'decimal' })}${fIn('ur', '🔴 Excedido desde (%)', GG.fmtNum(c.umbralRojo * 100, 1), { im: 'decimal' })}</div></div>
      <div class="section-title">Seguridad y respaldo</div><div class="card">
      ${fIn('rd', 'Recordarme respaldar cada (días)', String(c.respaldoDias), { im: 'numeric' })}
      ${S.pin ? '<button class="btn ghost" data-act="pin-set">Cambiar PIN</button><button class="btn danger" data-act="pin-remove">Quitar PIN</button>' : '<button class="btn primary" data-act="pin-set">Crear PIN de bloqueo</button>'}
      <p class="muted small" style="margin:4px">Face ID no está disponible para apps web; el PIN se guarda cifrado (hash con sal).</p></div>
      <div class="section-title">Unidades</div><div class="card"><p class="muted small" style="margin:0">g y kg (base kg), ml y l (base l), un. Al escribir se aceptan K, L, mayúsculas o minúsculas.</p></div>`;
  };
  PAGES_MOUNT.ajustes = (v) => {
    const c = S.cfg;
    v.addEventListener('input', (e) => { if (e.target.hasAttribute('data-money')) { const t = e.target; t.value = t.value.trim() ? GG.fmtNum(GG.parseMoney(t.value), 0) : ''; } });
    v.addEventListener('change', async (e) => {
      const t = e.target, nm = t.name, val = t.value;
      if (!nm) return;
      const renameIn = async (field, oldV, newV, stores) => {
        if (!newV || oldV === newV) return;
        for (const st of stores) {
          const ch = S[st].filter((x) => x[field] === oldV).map((x) => ({ ...x, [field]: newV }));
          if (ch.length) { await GG.db.putMany(st, ch); ch.forEach((u) => { const i = S[st].findIndex((x) => x.id === u.id); S[st][i] = u; }); }
        }
      };
      if (nm === 'n-ivan') c.nombres.ivan = val.trim() || 'Iván';
      else if (nm === 'n-pollo') c.nombres.pollo = val.trim() || 'Pollo';
      else if (nm === 'pct') { const p = GG.parseDec(val); if (p >= 0 && p <= 100) c.pctIvan = p / 100; else toast('Debe estar entre 0 y 100'); }
      else if (nm.startsWith('tn-')) { const i = +nm.slice(3), o = c.tipos[i].nombre, nv = val.trim(); if (nv) { await renameIn('tipo', o, nv, ['compras', 'servicios', 'cuotas']); c.tipos[i].nombre = nv; } }
      else if (nm.startsWith('tp-')) c.tipos[+nm.slice(3)].presupuesto = GG.parseMoney(val);
      else if (nm.startsWith('cn-')) { const i = +nm.slice(3), o = c.categorias[i].nombre, nv = val.trim(); if (nv) { await renameIn('categoria', o, nv, ['compras']); c.categorias[i].nombre = nv; } }
      else if (nm.startsWith('en-')) { const i = +nm.slice(3), o = c.etiquetas[i], nv = val.trim(); if (nv) { await renameIn('etiqueta', o, nv, ['compras', 'servicios', 'cuotas']); c.etiquetas[i] = nv; } }
      else if (nm === 'cupo') c.cupo = GG.parseMoney(val);
      else if (nm === 'ua') c.umbralAmarillo = GG.parseDec(val) / 100;
      else if (nm === 'ur') c.umbralRojo = GG.parseDec(val) / 100;
      else if (nm === 'rd') c.respaldoDias = Math.max(1, parseInt(val, 10) || 7);
      await saveCfg(); toast('Guardado');
      if (nm === 'pct' || nm.startsWith('n-')) render();
    });
    v.addEventListener('click', async (e) => {
      const s = e.target.closest('[data-cat-desp]');
      if (s) { const i = +s.dataset.catDesp; c.categorias[i].despensa = !c.categorias[i].despensa; s.classList.toggle('on', c.categorias[i].despensa); await saveCfg(); toast('Guardado'); }
    });
  };

  PAGES.respaldo = () => {
    const last = S.meta.lastBackup ? new Date(S.meta.lastBackup) : null;
    return `<div class="card"><h2>Exportar a Excel</h2><p class="muted small" style="margin:0 0 6px">Un solo archivo .xlsx con una hoja por tabla: compras de la casa, compras personales, servicios, ingresos, cuotas, Tabla Maestra, inventario, lista de compras, pagos de tarjeta, resumen mensual y configuración.</p><button class="btn blue" data-act="export-xlsx">Exportar .xlsx</button></div>
      <div class="card"><h2>Respaldo para restaurar</h2><p class="muted small" style="margin:0 0 6px">Guarda el archivo en «Archivos» o en iCloud Drive. Con él puedes recuperar todo en otro teléfono o tras un borrado. ${last ? `Último respaldo: ${GG.fmtDate(GG.isoDate(last))}.` : 'Aún no hay respaldos.'}</p><button class="btn primary" data-act="backup-json">Crear respaldo</button><button class="btn ghost" data-act="import">Restaurar desde respaldo</button><input type="file" id="imp" accept=".json,application/json" class="hidden"></div>
      <div class="card"><h2>Almacenamiento</h2><div id="stor" class="muted small">Revisando…</div></div>
      <div class="card"><h2>Borrar todo</h2><p class="muted small" style="margin:0 0 6px">Elimina todos los datos de este iPhone. No se puede deshacer.</p><button class="btn danger" data-act="wipe">Borrar todos los datos</button></div>`;
  };
  PAGES_MOUNT.respaldo = async (v) => {
    const el = $('#stor', v);
    let txt = '';
    try {
      const p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      txt += p ? '✓ Almacenamiento persistente concedido. ' : 'iOS no confirmó almacenamiento persistente: el respaldo es tu seguro. ';
      if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); txt += `Uso: ${GG.fmtNum((e.usage || 0) / 1048576, 1)} MB.`; }
    } catch (e) { txt = 'No se pudo consultar el almacenamiento.'; }
    txt += ` Registros: ${S.compras.length} compras, ${S.servicios.length} servicios, ${S.ingresos.length} ingresos, ${S.cuotas.length} compras en cuotas.`;
    if (el) el.textContent = txt;
    const imp = $('#imp', v);
    if (imp) imp.addEventListener('change', () => imp.files[0] && importBackup(imp.files[0]));
  };

  PAGES.ayuda = () => `<div class="card help"><h2>Instalar en el iPhone</h2><ol><li>Abre el enlace de la app en <b>Safari</b> (no en Chrome).</li><li>Toca el botón <b>Compartir</b> (cuadrado con flecha hacia arriba).</li><li>Baja y toca <b>«Añadir a pantalla de inicio»</b>, luego <b>Añadir</b>.</li><li>Desde ahora abre GastónGastín solo con ese ícono del dragoncito.</li></ol></div>
    <div class="alert red"><span class="a-ico">⚠️</span><div><b>Importante:</b> en iOS, los datos que anotas en Safari y los de la app instalada se guardan en lugares distintos. Usa siempre el ícono instalado. Si borras la app o los datos del sitio, se pierde todo lo que no esté respaldado.</div></div>
    <div class="card help"><h2>Sin conexión</h2><p style="margin:0">Después de abrirla una vez con internet, funciona en la feria sin señal: registra, consulta y exporta igual.</p></div>
    <div class="card help"><h2>Cómo registrar en la feria</h2><ol><li>Toca <b>+</b> y elige <b>Compra rápida</b>.</li><li>Escribe el producto: si ya lo compraste, se completan marca, formato y categoría, y ves el último precio, el promedio y dónde está más barato.</li><li>Para productos a granel usa contenido 1 kg y en cantidad los kilos (por ejemplo 1,5).</li><li>Usa «Guardar y anotar otra» para seguir con el siguiente.</li></ol></div>
    <div class="card help"><h2>Tu primer respaldo</h2><ol><li>Ve a Más → Respaldo y exportación.</li><li>Toca <b>Crear respaldo</b> y elige «Guardar en Archivos» (idealmente en iCloud Drive).</li><li>La app te recordará respaldar cada ${S.cfg.respaldoDias} días.</li></ol></div>`;

  /* ---------- Respaldo / exportación ---------- */
  async function shareFile(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    return true;
  }
  async function backupJSON() {
    const data = { app: 'GastonGastin', version: 1, creado: new Date().toISOString(), cfg: S.cfg };
    ['compras', 'servicios', 'ingresos', 'cuotas', 'tarjeta', 'movs', 'inv', 'lista'].forEach((k) => (data[k] = S[k]));
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    if (await shareFile(blob, `gastongastin-respaldo-${GG.today()}.json`)) {
      S.meta.lastBackup = Date.now(); await saveMeta(); toast('Respaldo creado'); render();
    }
  }
  async function importBackup(file) {
    let d;
    try { d = JSON.parse(await file.text()); } catch (e) { toast('El archivo no es un respaldo válido'); return; }
    if (d.app !== 'GastonGastin') { toast('El archivo no es un respaldo de GastónGastín'); return; }
    if (!(await confirmSheet(`Se reemplazarán los datos actuales por el respaldo del ${GG.fmtDate((d.creado || '').slice(0, 10))} (${(d.compras || []).length} compras). ¿Continuar?`, 'Restaurar'))) return;
    for (const k of ['compras', 'servicios', 'ingresos', 'cuotas', 'tarjeta', 'movs', 'inv', 'lista']) { await GG.db.clear(k); if ((d[k] || []).length) await GG.db.putMany(k, d[k]); S[k] = d[k] || []; }
    S.cfg = Object.assign(GG.DEFAULT_CONFIG(), d.cfg || {}, { id: 'config' });
    await saveCfg();
    S.meta.lastBackup = Date.now(); await saveMeta();
    invalidate(); toast('Respaldo restaurado'); render();
  }
  function exportXLSX() {
    const n = N(), cfg = S.cfg, yn = (b) => (b ? 'Sí' : 'No'), who = (q) => (q === 'pollo' ? n.pollo : n.ivan);
    const compraRow = (c, casa) => {
      const sp = GG.splitCompra(c, cfg), u = GG.normUnit(c.unidad);
      const base = [GG.fmtDate(c.fecha), c.producto, c.marca || '', c.lugar, c.tipo, c.categoria, c.etiqueta || '', +c.cantidad, +c.contenido, u, +c.precio || 0, Math.round(GG.unitPrice(c)), Math.round(GG.basePrice(c)), (GG.UNITS[u] || {}).base || '', c.medio];
      return casa ? [...base, who(c.quien), Math.round(sp.ivan), Math.round(sp.pollo), yn(GG.isComplete(c))] : [...base, Math.round(sp.ivan), yn(GG.isComplete(c))];
    };
    const hC = ['Fecha', 'Producto', 'Marca', 'Lugar', 'Tipo de gasto', 'Categoría', 'Etiqueta', 'Cantidad', 'Contenido', 'Unidad', 'Precio pagado', 'Precio unitario', 'Precio por unidad base', 'Unidad base', 'Medio de pago'];
    const byDate = (a, b) => (a.fecha || '').localeCompare(b.fecha || '');
    const today = GG.mkOf(GG.today());
    const allDates = [...S.compras, ...S.servicios, ...S.ingresos, ...S.cuotas].map((x) => x.fecha).filter(Boolean).sort();
    const months = allDates.length ? Array.from({ length: GG.monthDiff(GG.mkOf(allDates[0]), GG.mkOf(allDates[allDates.length - 1]) > today ? GG.mkOf(allDates[allDates.length - 1]) : today) + 1 }, (_, i) => GG.addMonths(GG.mkOf(allDates[0]), i)) : [];
    const sheets = [
      { name: 'Compras casa', rows: [[...hC, 'Quién pagó', 'Parte ' + n.ivan, 'Parte ' + n.pollo, 'Completa'], ...S.compras.filter((c) => c.ambito !== 'personal').sort(byDate).map((c) => compraRow(c, true))] },
      { name: 'Compras personales', rows: [[...hC, 'Parte ' + n.ivan, 'Completa'], ...S.compras.filter((c) => c.ambito === 'personal').sort(byDate).map((c) => compraRow(c, false))] },
      { name: 'Servicios y gastos fijos', rows: [['Fecha de pago', 'Concepto', 'Tipo de gasto', 'Etiqueta', 'Monto', 'Medio de pago', 'Quién pagó', '¿Se divide?', 'Estado', 'Parte ' + n.ivan, 'Parte ' + n.pollo], ...S.servicios.slice().sort(byDate).map((s) => { const sp = GG.splitServicio(s, cfg); return [GG.fmtDate(s.fecha), s.concepto, s.tipo, s.etiqueta || '', +s.monto, s.medio, who(s.quien), yn(s.divide), s.estado, Math.round(sp.ivan), Math.round(sp.pollo)]; })] },
      { name: 'Ingresos', rows: [['Fecha', 'Concepto', 'Monto'], ...S.ingresos.slice().sort(byDate).map((i) => [GG.fmtDate(i.fecha), i.concepto, +i.monto])] },
      { name: 'Cuotas', rows: [['Fecha de compra', 'Descripción', 'Ámbito', 'Tipo de gasto', 'Quién pagó', 'Monto total', 'N° cuotas', 'Valor cuota', 'Primera cuota', 'Última cuota', 'Cuotas imputadas a hoy', 'Saldo pendiente', 'Estado'], ...S.cuotas.slice().sort(byDate).map((q) => { const e = GG.cuotaEstado(q, today); return [GG.fmtDate(q.fecha), q.descripcion, q.ambito === 'personal' ? 'Personal' : 'Casa', q.tipo, who(q.quien), +q.total, e.N, Math.round(e.valor), GG.fmtDate(e.primera), GG.fmtDate(e.ultima), e.imputadas, e.saldo, e.estado]; })] },
      { name: 'Tabla Maestra', rows: [['Producto', 'Marca', 'Contenido', 'Unidad', 'Categoría', 'Unidad base', 'Último lugar', 'Fecha última compra', 'Último precio', 'Último precio por unidad base', 'Promedio 12 meses', 'Promedio 12m por unidad base', 'Lugar más barato', 'Precio más barato', 'Lugar más caro', 'Precio más caro', 'N° compras 12 meses'], ...master().map((r) => [r.producto, r.marca, r.contenido, r.unidad, r.categoria, r.unidadBase, r.ultimoLugar, GG.fmtDate(r.ultimaFecha), Math.round(r.ultimo), Math.round(r.ultimoBase), r.prom ? Math.round(r.prom) : '', r.promBase ? Math.round(r.promBase) : '', r.barato ? r.barato.lugar : '', r.barato ? Math.round(r.barato.precio) : '', r.caro ? r.caro.lugar : '', r.caro ? Math.round(r.caro.precio) : '', r.n12])] },
      { name: 'Inventario', rows: [['Producto', 'Marca', 'Contenido', 'Unidad', 'Categoría', 'Stock', 'Se cuenta en', 'Stock mínimo', 'Estado'], ...inv().map((i) => [i.row.producto, i.row.marca, i.row.contenido, i.row.unidad, i.row.categoria, i.stock, i.unidadConteo, i.min, i.bajo ? 'Se acaba' : 'OK'])] },
      { name: 'Lista de compras', rows: [['Ítem', 'Origen', 'Último precio', 'Promedio 12 meses', 'Lugar más barato', 'Precio más barato', 'Lugar más caro', 'Precio más caro'], ...listaItems().map((it) => { const r = it.key ? masterMap().get(it.key) : null; return [it.texto, it.auto ? 'Bajo stock mínimo' : 'Manual', r ? Math.round(r.ultimo) : '', r && r.prom ? Math.round(r.prom) : '', r && r.barato ? r.barato.lugar : '', r && r.barato ? Math.round(r.barato.precio) : '', r && r.caro ? r.caro.lugar : '', r && r.caro ? Math.round(r.caro.precio) : '']; })] },
      { name: 'Pagos tarjeta', rows: [['Mes', 'Pago realizado', 'Saldo impago mes anterior'], ...S.tarjeta.slice().sort((a, b) => a.id.localeCompare(b.id)).map((t) => [GG.mkLabel(t.id), +t.pago || 0, +t.saldoAnt || 0])] },
      { name: 'Resumen mensual', rows: [['Mes', 'Ingresos', 'Gasto total registrado', 'Responsabilidad ' + n.ivan, 'Responsabilidad ' + n.pollo, 'Ahorro', '% ahorro', 'Control (debe ser 0)', n.pollo + ' debe a ' + n.ivan, n.ivan + ' debe a ' + n.pollo, 'Facturado crédito', 'Por pagar al cierre', 'Cuotas futuras', 'Cupo disponible'], ...months.map((m) => { const s = summary(m); return [GG.mkLabel(m), s.ingresos, Math.round(s.gastoTotal), Math.round(s.ivan), Math.round(s.pollo), Math.round(s.ahorro), isFinite(s.pctAhorro) ? Math.round(s.pctAhorro * 10000) / 100 : '', s.control, Math.round(s.cuadre.polloDebe), Math.round(s.cuadre.ivanDebe), Math.round(s.tarjeta.facturado), Math.round(s.tarjeta.porPagar), Math.round(s.tarjeta.futuras), Math.round(s.tarjeta.disponible)]; })] },
      { name: 'Configuración', rows: [['Parámetro', 'Valor', 'Detalle'], ['Persona 1', n.ivan, ''], ['Persona 2', n.pollo, ''], ['% ' + n.ivan, cfg.pctIvan * 100, ''], ['% ' + n.pollo, (1 - cfg.pctIvan) * 100, ''], ['Cupo tarjeta', +cfg.cupo || 0, ''], ['Umbral amarillo %', cfg.umbralAmarillo * 100, ''], ['Umbral rojo %', cfg.umbralRojo * 100, ''], ['Recordatorio respaldo (días)', cfg.respaldoDias, ''], ...cfg.tipos.map((t) => ['Tipo de gasto', t.nombre, 'Presupuesto ' + (t.presupuesto || 0)]), ...cfg.categorias.map((k) => ['Categoría', k.nombre, k.despensa ? 'Alimenta despensa' : '']), ...cfg.etiquetas.map((e) => ['Etiqueta', e, '']), ...cfg.medios.map((m) => ['Medio de pago', m, '']), ...Object.entries(GG.UNITS).map(([u, x]) => ['Unidad', u, `base ${x.base}, factor ${x.f}`])] },
    ];
    shareFile(GG.xlsx.build(sheets), `gastongastin-${GG.today()}.xlsx`).then((ok) => ok && toast('Excel exportado'));
  }

  /* ---------- PIN ---------- */
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashPin = async (pin, salt) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)));
  let lockEl = null, locked = false;
  function lockScreen({ mode, onDone, onCancel }) {
    if (lockEl) lockEl.remove();
    let pin = '', first = null;
    const el = (lockEl = document.createElement('div'));
    el.className = 'lock';
    const title = () => (mode === 'unlock' ? 'Ingresa tu PIN' : first ? 'Repite el PIN' : 'Crea un PIN de 4 a 6 dígitos');
    const len = mode === 'unlock' ? S.pin.len : 6;
    el.innerHTML = `${mascota(92)}<h2></h2><div class="dots"></div><p></p><div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-d="${d}">${d}</button>`).join('')}<button class="txt" data-x>${mode === 'unlock' ? 'Olvidé' : 'Cancelar'}</button><button data-d="0">0</button><button class="txt" data-b aria-label="Borrar">⌫</button></div><button class="btn ghost hidden" style="max-width:260px;margin:0" data-ok>Continuar</button>`;
    const upd = (msg = '') => {
      $('h2', el).textContent = title();
      $('.dots', el).innerHTML = Array.from({ length: mode === 'unlock' ? len : Math.max(4, pin.length) }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
      $('p', el).textContent = msg;
      $('[data-ok]', el).classList.toggle('hidden', mode === 'unlock' || pin.length < 4);
    };
    const fail = (msg) => { const d = $('.dots', el); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); pin = ''; upd(msg); if (navigator.vibrate) navigator.vibrate(80); };
    const submit = async () => {
      if (mode === 'unlock') {
        if ((await hashPin(pin, S.pin.salt)) === S.pin.hash) { el.remove(); lockEl = null; locked = false; onDone && onDone(); } else fail('PIN incorrecto');
        return;
      }
      if (!first) { first = pin; pin = ''; upd(); return; }
      if (first !== pin) { first = null; fail('No coinciden. Empecemos de nuevo.'); return; }
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      S.pin = { id: 'pin', salt, hash: await hashPin(pin, salt), len: pin.length };
      await GG.db.put('kv', S.pin);
      el.remove(); lockEl = null; toast('PIN creado'); onDone && onDone();
    };
    el.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-d]');
      if (d && pin.length < len) { pin += d.dataset.d; upd(); if (mode === 'unlock' && pin.length === len) submit(); if (mode !== 'unlock' && pin.length === 6) submit(); return; }
      if (e.target.closest('[data-b]')) { pin = pin.slice(0, -1); upd(); return; }
      if (e.target.closest('[data-ok]')) { submit(); return; }
      if (e.target.closest('[data-x]')) {
        if (mode !== 'unlock') { el.remove(); lockEl = null; onCancel && onCancel(); return; }
        $('p', el).innerHTML = 'Sin el PIN solo puedes borrar todo y restaurar un respaldo. <button style="color:#fff;text-decoration:underline" data-wipe>Borrar todo</button>';
      }
      if (e.target.closest('[data-wipe]')) {
        const w = prompt('Esto borrará TODOS los datos de este iPhone. Escribe BORRAR para confirmar.');
        if (w === 'BORRAR') await wipeAll();
      }
    });
    document.body.appendChild(el);
    upd();
  }
  async function wipeAll() {
    for (const s of GG.STORES) await GG.db.clear(s);
    location.reload();
  }
  document.addEventListener('visibilitychange', () => {
    if (!S || !S.pin) return;
    if (document.hidden) { if (!locked) { locked = true; lockScreen({ mode: 'unlock', onDone: render }); } }
  });

  /* ---------- Acciones ---------- */
  const ACT = {
    tab: (t) => { UI.tab = t.dataset.v; UI.more = null; scrollTo(0, 0); render(); },
    mprev: () => { UI.mk = GG.addMonths(UI.mk, -1); render(); },
    mnext: () => { UI.mk = GG.addMonths(UI.mk, 1); render(); },
    mpick: () => monthPicker(),
    gseg: (t) => { UI.gseg = t.dataset.v; render(); },
    dseg: (t) => { UI.dseg = t.dataset.v; render(); },
    amb: (t) => { UI.amb = t.dataset.v; render(); },
    msort: (t) => { UI.msort = t.dataset.v; $('#mlist').innerHTML = maestraList(); $$('[data-act=msort]').forEach((b) => b.classList.toggle('on', b === t)); },
    more: (t) => { UI.tab = 'mas'; UI.more = t.dataset.v; scrollTo(0, 0); render(); },
    back: () => { UI.more = null; render(); },
    del: async (t) => {
      const st = t.dataset.store, id = t.dataset.id;
      if (await confirmSheet('¿Eliminar este registro?')) { await remove(st, id); toast('Eliminado'); render(); }
    },
    'toggle-estado': async (t) => { const s = S.servicios.find((x) => x.id === t.dataset.id); s.estado = s.estado === 'Pendiente' ? 'Pagado' : 'Pendiente'; await save('servicios', s); render(); },
    'copy-prev': async () => {
      const prev = GG.addMonths(UI.mk, -1);
      const src = S.servicios.filter((s) => GG.mkOf(s.fecha) === prev);
      const ya = new Set(S.servicios.filter((s) => GG.mkOf(s.fecha) === UI.mk).map((s) => GG.norm(s.concepto)));
      const nuevos = src.filter((s) => !ya.has(GG.norm(s.concepto)));
      if (!nuevos.length) { toast(src.length ? 'Ya están todos copiados' : `No hay servicios en ${GG.mkLabel(prev).toLowerCase()}`); return; }
      if (!(await confirmSheet(`Se copiarán ${nuevos.length} servicios de ${GG.mkLabel(prev).toLowerCase()} como «Pendiente». Revisa los montos que cambian (gastos comunes, arriendo con IPC).`, 'Copiar', false))) return;
      const ld = +GG.lastDay(UI.mk).slice(8);
      for (const s of nuevos) { const { id, creado, mod, ...rest } = s; await save('servicios', { ...rest, fecha: `${UI.mk}-${String(Math.min(ld, +s.fecha.slice(8))).padStart(2, '0')}`, estado: 'Pendiente' }); }
      toast('Servicios copiados'); render();
    },
    'tarjeta-edit': () => {
      const t = S.tarjeta.find((x) => x.id === UI.mk) || { id: UI.mk, pago: 0, saldoAnt: 0 };
      const f = { pago: t.pago ? String(t.pago) : '', saldoAnt: t.saldoAnt ? String(t.saldoAnt) : '' };
      const r = summary(UI.mk);
      openSheet({
        title: 'Tarjeta, ' + GG.mkLabel(UI.mk).toLowerCase(),
        body: `<p class="muted small" style="margin:0 4px">Facturado este mes: <b>${$clp(r.tarjeta.facturado)}</b></p>${fIn('pago', 'Pago de tarjeta realizado', f.pago ? GG.fmtNum(+f.pago, 0) : '', { im: 'numeric', money: 1, ph: '$0' })}<button type="button" class="chip" id="all">Pagué todo lo facturado</button>${fIn('saldoAnt', 'Saldo impago del mes anterior', f.saldoAnt ? GG.fmtNum(+f.saldoAnt, 0) : '', { im: 'numeric', money: 1, ph: '$0' })}<button class="btn primary" id="save">Guardar</button>`,
        onMount: ({ body: b, close }) => {
          bindForm(b, f);
          $('#all', b).onclick = () => { f.pago = String(Math.round(r.tarjeta.facturado)); setVal(b, 'pago', f.pago); };
          $('#save', b).onclick = async () => { await save('tarjeta', { ...t, pago: GG.parseMoney(f.pago), saldoAnt: GG.parseMoney(f.saldoAnt) }); toast('Tarjeta actualizada'); render(); close(); };
        },
      });
    },
    prod: (t) => productSheet(t.dataset.key),
    'inv-open': (t) => invSheet(t.dataset.key),
    'inv-minus': async (t) => {
      const it = inv().find((i) => i.key === t.dataset.key);
      if (!it) return;
      if (it.unidadConteo !== 'un') { invSheet(it.key); return; }
      await save('movs', { key: it.key, fecha: GG.today(), cantidad: 1, tipo: 'consumo' });
      toast(`−1 ${it.row.producto}`); render();
    },
    'go-lista': () => { UI.tab = 'despensa'; UI.dseg = 'lista'; render(); },
    'lista-add': () => listaItemForm(),
    'lista-quitar': async (t) => { await remove('lista', t.dataset.id); render(); },
    'lista-comprado': (t) => {
      const key = t.dataset.key, id = t.dataset.id;
      compraForm(null, { prefillKey: key || null, prefillText: key ? null : t.dataset.txt, onSaved: async () => { if (id) { const l = S.lista.find((x) => x.id === id); if (l) await save('lista', { ...l, hecho: true }); render(); } } });
    },
    merge: (t) => mergeProducts(t.dataset.from, t.dataset.to),
    'cfg-add': async (t) => {
      const v = t.dataset.v;
      if (v === 'tipo') S.cfg.tipos.push({ nombre: 'Nuevo tipo', presupuesto: 0 });
      if (v === 'cat') S.cfg.categorias.push({ nombre: 'Nueva categoría', despensa: true });
      if (v === 'etq') S.cfg.etiquetas.push('Nueva etiqueta');
      await saveCfg(); render();
    },
    'cat-up': async (t) => { const i = +t.dataset.v; if (i > 0) { const a = S.cfg.categorias; [a[i - 1], a[i]] = [a[i], a[i - 1]]; await saveCfg(); render(); } },
    'cat-down': async (t) => { const i = +t.dataset.v, a = S.cfg.categorias; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; await saveCfg(); render(); } },
    'etq-del': async (t) => { const i = +t.dataset.v; if (await confirmSheet(`¿Quitar la etiqueta «${esc(S.cfg.etiquetas[i])}»? Los gastos que la tengan la conservan.`, 'Quitar')) { S.cfg.etiquetas.splice(i, 1); await saveCfg(); render(); } },
    'backup-json': () => backupJSON(),
    'export-xlsx': () => exportXLSX(),
    import: () => $('#imp').click(),
    wipe: async () => { if (await confirmSheet('Se borrarán TODOS los datos de este iPhone. ¿Hiciste un respaldo?', 'Borrar todo')) { if (prompt('Escribe BORRAR para confirmar') === 'BORRAR') wipeAll(); } },
    'pin-set': () => lockScreen({ mode: 'set', onDone: render }),
    'pin-skip': async () => { S.meta.pinOmitido = true; await saveMeta(); render(); },
    'pin-remove': async () => { if (await confirmSheet('¿Quitar el PIN de bloqueo?', 'Quitar PIN')) { await GG.db.del('kv', 'pin'); S.pin = null; toast('PIN quitado'); render(); } },
  };
  function monthPicker() {
    let y = +UI.mk.slice(0, 4);
    const sh = openSheet({ title: 'Elegir mes', body: '<div id="mp"></div>' });
    const draw = () => {
      $('#mp', sh.body).innerHTML = `<div class="monthnav" style="justify-content:space-between;margin:6px 0 14px"><button class="arrow" data-y="-1">‹</button><span class="mlabel">${y}</span><button class="arrow" data-y="1">›</button></div><div class="cal">${GG.MESES.map((m, i) => { const mk = `${y}-${String(i + 1).padStart(2, '0')}`; const s = summary(mk); return `<button data-mk="${mk}" style="padding:12px 4px;border-radius:12px;background:${mk === UI.mk ? 'var(--pink)' : 'var(--card)'};color:${mk === UI.mk ? '#fff' : 'inherit'};font-weight:600">${m.slice(0, 3)}${s.nRegistros ? ' •' : ''}</button>`; }).join('')}</div><button class="btn ghost" data-mk="${GG.mkOf(GG.today())}">Ir al mes actual</button>`;
    };
    draw();
    sh.body.addEventListener('click', (e) => {
      const yb = e.target.closest('[data-y]'); if (yb) { y += +yb.dataset.y; draw(); return; }
      const mb = e.target.closest('[data-mk]'); if (mb) { UI.mk = mb.dataset.mk; sh.close(); render(); }
    });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a && ACT[a.dataset.act]) { e.preventDefault(); ACT[a.dataset.act](a, e); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed && !ed._swiped) {
      if (ed.classList.contains('open')) { ed.classList.remove('open'); ed.style.transform = ''; return; }
      const st = ed.dataset.edit, rec = S[st].find((x) => x.id === ed.dataset.id);
      if (!rec) return;
      ({ compras: compraForm, servicios: servicioForm, ingresos: ingresoForm, cuotas: cuotaForm })[st](rec);
    }
  });

  /* ---------- Arranque ---------- */
  async function start() {
    try {
      S = await GG.loadAll();
    } catch (e) {
      document.body.innerHTML = `<div class="empty" style="padding:60px 20px"><b>No se pudo abrir la base de datos local</b>${esc(e.message || e)}. Cierra la app y vuelve a abrirla.</div>`;
      return;
    }
    if (!S.kv.find((x) => x.id === 'config')) await GG.db.put('kv', S.cfg);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    $('#fab').addEventListener('click', addMenu);
    render();
    if (S.pin) { locked = true; lockScreen({ mode: 'unlock', onDone: render }); }
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  start();
})();
