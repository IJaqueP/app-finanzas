/* GastónGastín – núcleo: formatos, base de datos local y cálculos */
(function (G) {
  'use strict';
  const GG = (G.GG = G.GG || {});

  /* ---------- Formatos chilenos ---------- */
  const miles = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fmtCLP = (n) => {
    n = Math.round(+n || 0);
    return (n < 0 ? '−$' : '$') + miles(String(Math.abs(n)));
  };
  const fmtNum = (n, d = 2) => {
    if (n == null || !isFinite(n)) return '';
    const neg = n < 0;
    let s = String(Math.round(Math.abs(n) * 10 ** d) / 10 ** d);
    let [i, f] = s.split('.');
    return (neg ? '−' : '') + miles(i) + (f ? ',' + f : '');
  };
  const fmtPct = (x, d = 0) => (isFinite(x) ? fmtNum(x * 100, d) + '%' : '—');
  const parseMoney = (s) => {
    if (typeof s === 'number') return s;
    const neg = /^\s*[-−]/.test(String(s || ''));
    const d = String(s || '').replace(/[^\d]/g, '');
    return d ? (neg ? -1 : 1) * parseInt(d, 10) : 0;
  };
  const parseDec = (s) => {
    if (typeof s === 'number') return s;
    s = String(s || '').trim().replace(/\s/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const v = parseFloat(s);
    return isFinite(v) ? v : 0;
  };

  /* ---------- Fechas ---------- */
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => isoDate(new Date());
  const fmtDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  const mkOf = (iso) => (iso || '').slice(0, 7);
  const addMonths = (mk, n) => {
    let y = +mk.slice(0, 4), m = +mk.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return `${y}-${pad(m + 1)}`;
  };
  const monthDiff = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  const lastDay = (mk) => {
    const y = +mk.slice(0, 4), m = +mk.slice(5, 7);
    return `${mk}-${pad(new Date(y, m, 0).getDate())}`;
  };
  const mkLabel = (mk) => {
    const m = MESES[+mk.slice(5, 7) - 1];
    return m[0].toUpperCase() + m.slice(1) + ' ' + mk.slice(0, 4);
  };
  const mkShort = (mk) => MESES_C[+mk.slice(5, 7) - 1] + ' ' + mk.slice(2, 4);
  const monthsBack = (mk, n) => Array.from({ length: n }, (_, i) => addMonths(mk, i - n + 1));
  const minusMonthsISO = (iso, n) => {
    const d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1 - n, +iso.slice(8, 10));
    return isoDate(d);
  };
  const weekOfMonth = (iso) => Math.min(5, Math.ceil(+iso.slice(8, 10) / 7));

  /* ---------- Texto y unidades ---------- */
  const norm = (s) =>
    String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const UNITS = {
    g: { base: 'kg', f: 0.001 },
    kg: { base: 'kg', f: 1 },
    ml: { base: 'l', f: 0.001 },
    l: { base: 'l', f: 1 },
    un: { base: 'un', f: 1 },
  };
  const UNIT_ALIAS = { k: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', gr: 'g', grs: 'g', gramos: 'g', lt: 'l', lts: 'l', litro: 'l', litros: 'l', cc: 'ml', u: 'un', unidad: 'un', unidades: 'un', und: 'un' };
  const normUnit = (u) => {
    const x = norm(u).replace(/\./g, '');
    return UNITS[x] ? x : UNIT_ALIAS[x] || '';
  };
  const prodKey = (c) =>
    [norm(c.producto), norm(c.marca), String(+parseDec(c.contenido) || 0), normUnit(c.unidad)].join('|');

  const lev = (a, b) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 3) return 9;
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const t = dp[j];
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = t;
      }
    }
    return dp[b.length];
  };

  /* ---------- Configuración por defecto ---------- */
  const DEFAULT_CONFIG = () => ({
    id: 'config',
    nombres: { ivan: 'Iván', pollo: 'Pollo' },
    pctIvan: 0.5,
    tipos: [
      { nombre: 'Esencial', presupuesto: 0 },
      { nombre: 'Salud', presupuesto: 0 },
      { nombre: 'Mascota', presupuesto: 0 },
      { nombre: 'Hormiga', presupuesto: 0 },
      { nombre: 'Plataforma', presupuesto: 0 },
      { nombre: 'Transporte', presupuesto: 0 },
    ],
    categorias: [
      ['Carnes', 1], ['Pescados y mariscos', 1], ['Embutidos y fiambres', 1], ['Lácteos y Huevos', 1],
      ['Pastas', 1], ['Legumbres', 1], ['Frutas', 1], ['Verduras', 1], ['Panadería y repostería', 1],
      ['Despensa seca', 1], ['Desayuno', 1], ['Café, té e infusiones', 1], ['Congelados', 1],
      ['Bebidas sin alcohol', 1], ['Snacks y dulces', 1], ['Alcohol', 1], ['Tabaco', 0], ['Mascota', 1],
      ['Limpieza del Hogar', 1], ['Limpieza Personal', 1], ['Farmacia y botiquín', 0], ['Hogar y otros', 0],
    ].map(([nombre, d]) => ({ nombre, despensa: !!d })),
    etiquetas: ['Alcohol', 'Comida de apps', 'Cigarros', 'Otros gustos'],
    medios: ['Efectivo', 'Débito', 'Crédito'],
    cupo: 0,
    umbralAmarillo: 0.7,
    umbralRojo: 0.95,
    respaldoDias: 7,
  });

  /* ---------- IndexedDB ---------- */
  const STORES = ['compras', 'servicios', 'ingresos', 'cuotas', 'tarjeta', 'movs', 'inv', 'lista', 'kv'];
  let _db = null;
  const db = {
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open('gastongastin', 1);
        r.onupgradeneeded = () => {
          STORES.forEach((s) => {
            if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
          });
        };
        r.onsuccess = () => res((_db = r.result));
        r.onerror = () => rej(r.error);
      });
    },
    tx(store, mode, fn) {
      return new Promise((res, rej) => {
        const t = _db.transaction(store, mode);
        const st = t.objectStore(store);
        const out = fn(st);
        t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
        t.onerror = () => rej(t.error);
      });
    },
    all(store) {
      return this.tx(store, 'readonly', (s) => s.getAll());
    },
    put(store, obj) {
      return this.tx(store, 'readwrite', (s) => s.put(obj));
    },
    putMany(store, arr) {
      return this.tx(store, 'readwrite', (s) => arr.forEach((o) => s.put(o)));
    },
    del(store, id) {
      return this.tx(store, 'readwrite', (s) => s.delete(id));
    },
    clear(store) {
      return this.tx(store, 'readwrite', (s) => s.clear());
    },
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- Reparto ---------- */
  const isComplete = (c) =>
    !!(c.fecha && String(c.producto || '').trim() && String(c.lugar || '').trim() && +c.cantidad > 0 && +c.contenido > 0 && UNITS[normUnit(c.unidad)] && +c.precio > 0);
  const splitCompra = (c, cfg) => {
    const p = +c.precio || 0;
    if (c.ambito === 'personal') return { ivan: p, pollo: 0 };
    return { ivan: p * cfg.pctIvan, pollo: p * (1 - cfg.pctIvan) };
  };
  const quienCompra = (c) => (c.ambito === 'personal' ? 'ivan' : c.quien || 'ivan');
  const splitServicio = (s, cfg) => {
    const m = +s.monto || 0;
    if (s.divide) return { ivan: m * cfg.pctIvan, pollo: m * (1 - cfg.pctIvan) };
    return s.quien === 'pollo' ? { ivan: 0, pollo: m } : { ivan: m, pollo: 0 };
  };
  const unitPrice = (c) => (+c.precio || 0) / (+c.cantidad || 1);
  const basePrice = (c) => {
    const u = UNITS[normUnit(c.unidad)];
    const q = (+c.cantidad || 0) * (+c.contenido || 0) * (u ? u.f : 1);
    return q > 0 ? (+c.precio || 0) / q : 0;
  };

  /* ---------- Cuotas ---------- */
  const cuotaPlan = (q) => {
    const N = Math.max(1, parseInt(q.ncuotas, 10) || 1);
    const T = +q.total || 0;
    const m0 = mkOf(q.fecha);
    const items = [];
    for (let k = 1; k <= N; k++) {
      const mk = addMonths(m0, k - 1);
      items.push({ k, mk, fecha: lastDay(mk), monto: Math.round((T * k) / N) - Math.round((T * (k - 1)) / N) });
    }
    return { N, T, valor: T / N, items, primera: items[0].fecha, ultima: items[N - 1].fecha };
  };
  const cuotaEstado = (q, mk) => {
    const p = cuotaPlan(q);
    const pagadas = p.items.filter((i) => i.mk <= mk);
    const pagado = pagadas.reduce((a, i) => a + i.monto, 0);
    const delMes = p.items.find((i) => i.mk === mk) || null;
    return {
      ...p,
      imputadas: pagadas.length,
      saldo: p.T - pagado,
      delMes,
      futuras: p.T - pagado,
      estado: p.items[p.N - 1].mk < mk ? 'Terminada' : pagadas.length === 0 ? 'Por iniciar' : 'Vigente',
    };
  };
  const splitCuota = (q, monto, cfg) =>
    q.ambito === 'personal' ? { ivan: monto, pollo: 0 } : { ivan: monto * cfg.pctIvan, pollo: monto * (1 - cfg.pctIvan) };

  /* ---------- Resumen mensual ---------- */
  function monthSummary(S, mk) {
    const cfg = S.cfg;
    const r = {
      mk, ingresos: 0, gastoTotal: 0, ivan: 0, pollo: 0,
      servicios: 0, casa: 0, personal: 0, cuotas: 0,
      byTipo: {}, byEtiqueta: {}, compartidoTotal: 0, personalTotalIvan: 0,
      cuadre: { pagIvan: 0, pagPollo: 0, parteIvan: 0, partePollo: 0 },
      facturado: 0, nRegistros: 0, pendientes: 0,
    };
    const addTipo = (tipo, sp, total) => {
      const k = tipo || 'Sin tipo';
      const t = (r.byTipo[k] = r.byTipo[k] || { ivan: 0, total: 0 });
      t.ivan += sp.ivan;
      t.total += total;
    };
    const addEtq = (e, sp) => {
      if (!e) return;
      r.byEtiqueta[e] = (r.byEtiqueta[e] || 0) + sp.ivan;
    };
    for (const i of S.ingresos) if (mkOf(i.fecha) === mk) { r.ingresos += +i.monto || 0; r.nRegistros++; }
    for (const s of S.servicios) {
      if (mkOf(s.fecha) !== mk) continue;
      const m = +s.monto || 0, sp = splitServicio(s, cfg);
      r.nRegistros++;
      r.servicios += m; r.gastoTotal += m; r.ivan += sp.ivan; r.pollo += sp.pollo;
      addTipo(s.tipo, sp, m); addEtq(s.etiqueta, sp);
      if (s.estado === 'Pendiente') r.pendientes++;
      if (s.divide) {
        r.compartidoTotal += m;
        if (s.quien === 'pollo') r.cuadre.pagPollo += m; else r.cuadre.pagIvan += m;
        r.cuadre.parteIvan += sp.ivan; r.cuadre.partePollo += sp.pollo;
      } else if (s.quien !== 'pollo') r.personalTotalIvan += m;
      if (s.medio === 'Crédito' && s.quien !== 'pollo') r.facturado += m;
    }
    for (const c of S.compras) {
      if (mkOf(c.fecha) !== mk) continue;
      const p = +c.precio || 0, sp = splitCompra(c, cfg);
      r.nRegistros++;
      r.gastoTotal += p; r.ivan += sp.ivan; r.pollo += sp.pollo;
      if (c.ambito === 'personal') { r.personal += p; r.personalTotalIvan += p; } else {
        r.casa += p; r.compartidoTotal += p;
        if (quienCompra(c) === 'pollo') r.cuadre.pagPollo += p; else r.cuadre.pagIvan += p;
        r.cuadre.parteIvan += sp.ivan; r.cuadre.partePollo += sp.pollo;
      }
      addTipo(c.tipo, sp, p); addEtq(c.etiqueta, sp);
      if (c.medio === 'Crédito' && quienCompra(c) === 'ivan') r.facturado += p;
    }
    let futuras = 0;
    r.cuotasMes = [];
    for (const q of S.cuotas) {
      const e = cuotaEstado(q, mk);
      if (q.quien !== 'pollo') futuras += e.futuras;
      if (!e.delMes) continue;
      const m = e.delMes.monto, sp = splitCuota(q, m, cfg);
      r.nRegistros++;
      r.cuotasMes.push({ q, e });
      r.cuotas += m; r.gastoTotal += m; r.ivan += sp.ivan; r.pollo += sp.pollo;
      addTipo(q.tipo, sp, m); addEtq(q.etiqueta, sp);
      if (q.ambito === 'personal') r.personalTotalIvan += m; else {
        r.compartidoTotal += m;
        if (q.quien === 'pollo') r.cuadre.pagPollo += m; else r.cuadre.pagIvan += m;
        r.cuadre.parteIvan += sp.ivan; r.cuadre.partePollo += sp.pollo;
      }
      if (q.quien !== 'pollo') r.facturado += m;
    }
    r.ahorro = r.ingresos - r.ivan;
    r.pctAhorro = r.ingresos > 0 ? r.ahorro / r.ingresos : NaN;
    r.control = Math.round(r.gastoTotal - r.ivan - r.pollo);
    const c = r.cuadre;
    c.polloDebe = Math.max(0, c.pagIvan - c.parteIvan);
    c.ivanDebe = Math.max(0, c.pagPollo - c.partePollo);
    const tj = S.tarjeta.find((t) => t.id === mk) || { pago: 0, saldoAnt: 0 };
    r.tarjeta = {
      facturado: r.facturado, pago: +tj.pago || 0, saldoAnt: +tj.saldoAnt || 0,
      futuras,
    };
    r.tarjeta.porPagar = r.tarjeta.facturado - r.tarjeta.pago + r.tarjeta.saldoAnt;
    r.tarjeta.disponible = (+cfg.cupo || 0) - r.tarjeta.porPagar - futuras;
    // presupuesto
    r.presupuesto = cfg.tipos.map((t) => {
      const g = (r.byTipo[t.nombre] || { ivan: 0 }).ivan;
      const pres = +t.presupuesto || 0;
      return { tipo: t.nombre, presupuesto: pres, gastado: g, pct: pres > 0 ? g / pres : NaN, sem: semaforo(cfg, pres, g) };
    });
    Object.keys(r.byTipo).forEach((k) => {
      if (!cfg.tipos.some((t) => t.nombre === k))
        r.presupuesto.push({ tipo: k, presupuesto: 0, gastado: r.byTipo[k].ivan, pct: NaN, sem: 'none' });
    });
    r.presupuestoTotal = r.presupuesto.reduce((a, p) => a + p.presupuesto, 0);
    r.gastadoTotal = r.presupuesto.reduce((a, p) => a + p.gastado, 0);
    r.controlPresupuesto = Math.round(r.gastadoTotal - r.ivan);
    return r;
  }
  const semaforo = (cfg, pres, g) => {
    if (!(pres > 0)) return 'none';
    const p = g / pres;
    if (p >= cfg.umbralRojo) return 'red';
    if (p >= cfg.umbralAmarillo) return 'yellow';
    return 'green';
  };

  /* ---------- Tabla Maestra ---------- */
  function masterTable(compras, ref = today()) {
    const cutoff = minusMonthsISO(ref, 12);
    const groups = new Map();
    for (const c of compras) {
      if (!isComplete(c)) continue;
      const k = prodKey(c);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    }
    const out = [];
    for (const [key, arr] of groups) {
      arr.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.creado || 0) - (b.creado || 0)));
      const last = arr[arr.length - 1];
      const win = arr.filter((c) => c.fecha >= cutoff && c.fecha <= ref);
      const row = {
        key, producto: last.producto, marca: last.marca || '', contenido: +last.contenido, unidad: normUnit(last.unidad),
        categoria: last.categoria || '', unidadBase: UNITS[normUnit(last.unidad)].base,
        ultimoLugar: last.lugar, ultimaFecha: last.fecha, ultimo: unitPrice(last), ultimoBase: basePrice(last),
        n12: win.length, nTotal: arr.length, compras: arr, last,
        prom: null, promBase: null, barato: null, caro: null,
        gasto12: win.reduce((a, c) => a + (+c.precio || 0), 0),
      };
      if (win.length) {
        row.prom = win.reduce((a, c) => a + unitPrice(c), 0) / win.length;
        row.promBase = win.reduce((a, c) => a + basePrice(c), 0) / win.length;
        let lo = win[0], hi = win[0];
        for (const c of win) {
          if (unitPrice(c) < unitPrice(lo)) lo = c;
          if (unitPrice(c) > unitPrice(hi)) hi = c;
        }
        row.barato = { lugar: lo.lugar, precio: unitPrice(lo) };
        row.caro = { lugar: hi.lugar, precio: unitPrice(hi) };
      }
      out.push(row);
    }
    out.sort((a, b) => norm(a.producto).localeCompare(norm(b.producto)));
    return out;
  }

  /* ---------- Estacionalidad ---------- */
  function seasonality(row) {
    const cs = row.compras;
    if (cs.length < 3) return null;
    const avg = cs.reduce((a, c) => a + basePrice(c), 0) / cs.length;
    const first = cs[0].fecha, last = cs[cs.length - 1].fecha;
    const spanDays = (new Date(last) - new Date(first)) / 864e5;
    const res = { avg };
    if (spanDays >= 365) {
      const m = Array.from({ length: 12 }, () => []);
      cs.forEach((c) => m[+c.fecha.slice(5, 7) - 1].push(basePrice(c)));
      res.meses = m.map((a, i) => (a.length ? { i, idx: a.reduce((x, y) => x + y, 0) / a.length / avg, n: a.length } : null));
      const valid = res.meses.filter(Boolean);
      if (valid.length >= 3) {
        res.mejorMes = valid.reduce((a, b) => (b.idx < a.idx ? b : a));
        res.peorMes = valid.reduce((a, b) => (b.idx > a.idx ? b : a));
      }
    }
    const w = Array.from({ length: 5 }, () => []);
    cs.forEach((c) => w[weekOfMonth(c.fecha) - 1].push(basePrice(c)));
    const wv = w.map((a, i) => (a.length ? { i, idx: a.reduce((x, y) => x + y, 0) / a.length / avg, n: a.length } : null));
    if (wv.filter(Boolean).length >= 2 && cs.length >= 4) {
      res.semanas = wv;
      const valid = wv.filter(Boolean);
      res.mejorSemana = valid.reduce((a, b) => (b.idx < a.idx ? b : a));
      res.peorSemana = valid.reduce((a, b) => (b.idx > a.idx ? b : a));
    }
    return res.meses || res.semanas ? res : null;
  }

  /* ---------- Proyección ---------- */
  function projection(series, ahead = 6) {
    // series: [{mk, ingresos, gasto}] ordenada, solo meses con datos desde el primero
    const n = series.length;
    if (n === 0) return null;
    const proj = (key) => {
      const vals = series.map((s) => s[key]);
      const last3 = vals.slice(-3);
      const base = last3.reduce((a, b) => a + b, 0) / last3.length;
      const pts = vals.slice(-12);
      let slope = 0;
      if (pts.length >= 3) {
        const m = pts.length, xs = pts.map((_, i) => i);
        const mx = (m - 1) / 2, my = pts.reduce((a, b) => a + b, 0) / m;
        let num = 0, den = 0;
        xs.forEach((x, i) => { num += (x - mx) * (pts[i] - my); den += (x - mx) ** 2; });
        slope = den ? num / den : 0;
      }
      const seasonal = n > 12;
      const centerOffset = (last3.length - 1) / 2;
      return Array.from({ length: ahead }, (_, i) => {
        let v = base + slope * (i + 1 + centerOffset);
        if (seasonal) {
          const idxSame = n - 12 + i; // mismo mes del año anterior
          const ref = vals.slice(Math.max(0, n - 12), n);
          const mean = ref.reduce((a, b) => a + b, 0) / ref.length;
          if (idxSame >= 0 && idxSame < n && mean > 0) v *= vals[idxSame] / mean;
        }
        return Math.max(0, v);
      });
    };
    const lastMk = series[n - 1].mk;
    const mks = Array.from({ length: ahead }, (_, i) => addMonths(lastMk, i + 1));
    const ing = proj('ingresos'), gas = proj('gasto');
    let supuesto = `Promedio de los últimos ${Math.min(3, n)} ${n === 1 ? 'mes' : 'meses'}`;
    if (n >= 3) supuesto += ', más la tendencia lineal de ' + Math.min(12, n) + ' meses';
    supuesto += n > 12 ? ', con ajuste estacional (mismo mes del año anterior).' : '. El ajuste estacional se activa con más de 12 meses de datos.';
    return { mks, ingresos: ing, gasto: gas, ahorro: ing.map((v, i) => v - gas[i]), supuesto };
  }

  /* ---------- Inventario ---------- */
  function inventory(S, master) {
    const desp = new Set(S.cfg.categorias.filter((c) => c.despensa).map((c) => c.nombre));
    const map = new Map();
    for (const row of master) {
      if (!desp.has(row.categoria)) continue;
      const stockIn = row.compras.reduce((a, c) => a + (+c.cantidad || 0), 0);
      map.set(row.key, { row, entradas: stockIn, salidas: 0, ajustes: 0 });
    }
    for (const m of S.movs) {
      const it = map.get(m.key);
      if (!it) continue;
      if (m.tipo === 'ajuste') it.ajustes += +m.cantidad || 0;
      else it.salidas += +m.cantidad || 0;
    }
    const invCfg = new Map(S.inv.map((i) => [i.id, i]));
    const out = [];
    for (const [key, it] of map) {
      const conf = invCfg.get(key) || {};
      if (conf.oculto) continue;
      const stock = Math.round((it.entradas - it.salidas + it.ajustes) * 1000) / 1000;
      const min = +conf.min || 0;
      out.push({ key, row: it.row, stock, min, bajo: min > 0 && stock <= min, unidadConteo: countUnit(it.row) });
    }
    return out;
  }
  const countUnit = (row) => (row.contenido === 1 && row.unidad === 'kg' ? 'kg' : 'un');

  /* ---------- Lectura de toda la base ---------- */
  async function loadAll() {
    await db.open();
    const S = {};
    for (const s of STORES) S[s] = await db.all(s);
    const kv = Object.fromEntries(S.kv.map((x) => [x.id, x]));
    S.cfg = Object.assign(DEFAULT_CONFIG(), kv.config || {});
    S.meta = kv.meta || { id: 'meta' };
    S.pin = kv.pin || null;
    return S;
  }

  Object.assign(GG, {
    fmtCLP, fmtNum, fmtPct, parseMoney, parseDec, MESES, MESES_C, isoDate, today, fmtDate, mkOf, addMonths,
    monthDiff, lastDay, mkLabel, mkShort, monthsBack, minusMonthsISO, weekOfMonth, norm, UNITS, normUnit, prodKey, lev,
    DEFAULT_CONFIG, db, STORES, uid, isComplete, splitCompra, splitServicio, splitCuota, quienCompra, unitPrice, basePrice,
    cuotaPlan, cuotaEstado, monthSummary, semaforo, masterTable, seasonality, projection, inventory, countUnit, loadAll,
  });
  if (typeof module !== 'undefined') module.exports = GG;
})(typeof window !== 'undefined' ? window : globalThis);
