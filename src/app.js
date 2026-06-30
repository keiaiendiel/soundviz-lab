/* Sound / Image Lab - engine.
   Consumes LAB.demos. One shared virtual-clock rAF drives the visible thumbnails
   (IntersectionObserver), the open detail view, presentation mode, and the header glyph
   field. Palette + type borrowed from tools.kindl.work. */
(function () {
  'use strict';
  var U = globalThis.LABUTIL;
  var A = globalThis.LABAUDIO || { frame: { on: false, dt: 0.016, level: 0, peak: 0, bass: 0, mid: 0, high: 0, centroid: 0.3, flux: 0, beat: 0, pitch: 0.3, flatness: 0.6, spread: 0.3, rolloff: 0.5, zcr: 0, bands: new Float32Array(32), chroma: new Float32Array(12), spectrum: new Float32Array(512), wave: new Float32Array(1024) }, on: false, sensitivity: 1, update: function () {}, enable: function () { return Promise.reject('no audio'); }, disable: function () {}, toggle: function () { return Promise.resolve(false); } };
  var demos = (globalThis.LAB && globalThis.LAB.demos) ? globalThis.LAB.demos.slice() : [];

  // ---------- themes (tools.kindl.work tokens) ----------
  // Backgrounds are pure black across the board; ink carries the palette.
  var THEMES = {
    amber: { name: 'amber', bg: '#000000', ink: '#e8a33d', dim: '#b87f2e', accent: '#e8a33d', grid: 'rgba(232,163,61,0.05)', line: 'rgba(232,163,61,0.13)', panel: 'rgba(232,163,61,0.02)', panel2: 'rgba(232,163,61,0.045)', faint: '#4a3a18' },
    // signal: white visuals, studio-blue UI (ink drives the specimens, accent drives the chrome)
    signal: { name: 'signal', bg: '#000000', ink: '#eef1ff', dim: '#8a88b8', accent: '#6f66e6', grid: 'rgba(238,241,255,0.05)', line: 'rgba(238,241,255,0.12)', panel: 'rgba(238,241,255,0.022)', panel2: 'rgba(238,241,255,0.045)', faint: '#2c2a55' },
    night: { name: 'night', bg: '#000000', ink: '#e9e7df', dim: '#8e8b9a', accent: '#e9e7df', grid: 'rgba(233,231,223,0.05)', line: 'rgba(233,231,223,0.12)', panel: 'rgba(233,231,223,0.022)', panel2: 'rgba(233,231,223,0.045)', faint: '#3a3947' },
    paper: { name: 'paper', bg: '#f4f1ea', ink: '#17150f', dim: '#5f5a4d', accent: '#362cca', grid: 'rgba(23,21,15,0.07)', line: 'rgba(23,21,15,0.16)', panel: 'rgba(23,21,15,0.022)', panel2: 'rgba(23,21,15,0.05)', faint: '#b9b3a3' }
  };
  var THEME_ORDER = ['signal', 'amber', 'night', 'paper'];
  var themeKey = 'signal';
  function theme() { var t = THEMES[themeKey]; return { bg: t.bg, ink: t.ink, dim: t.dim, accent: t.accent, grid: t.grid }; }
  function applyTheme(k) {
    themeKey = k; var t = THEMES[k]; var r = document.documentElement.style;
    ['bg', 'ink', 'dim', 'accent', 'grid', 'line', 'panel', 'panel2', 'faint'].forEach(function (key) { r.setProperty('--' + key, t[key]); });
    var b = document.getElementById('palette'); if (b) b.textContent = 'palette: ' + t.name;
  }

  // ---------- ordering ----------
  // Curated presentation sequence (specimen ids, in display order). The live pager and the
  // index grid both follow this. Anything not listed falls back to family order, then title.
  var ORDER = [
    'oscilloscope-vector-text', 'osc-waveform-scan', 'scanned-string', 'vibrating-strings', 'wave-packet',
    'rutt-etra-mesh', 'modal-plate', 'osc-xy-lissajous', 'lorenz-attractor', 'fourier-epicycles',
    'double-pendulum', 'spectral-terrain-3d', 'vector-field-arrows', 'resonance-tree', 'vanishing-geometry',
    'spectral-smear', 'spectrogram-scroll', 'slit-scan', 'reversible-spectrogram', 'reaction-diffusion',
    'schlieren-plume', 'wave-membrane', 'faraday-caustics', 'faraday-interference', 'spatial-fourier',
    'julia-fractal', 'walking-droplet', 'belousov-zhabotinsky', 'pointcloud-rotate', 'chladni-bessel',
    'chladni-nodal', 'chladni-sand', 'moire-grids', 'topographic-contour',
    'ascii-waveform', 'halftone-raster', 'error-diffusion-dither', 'fft-bars', 'waveform-ribbon',
    'curl-flow-field', 'kelvin-helmholtz', 'rayleigh-benard', 'granular-cloud', 'particle-envelope-swarm',
    'phyllotaxis-vogel', 'strange-attractor', 'soliton-kdv', 'harmonic-ladder', 'tonnetz-lattice',
    'lichtenberg-breakdown', 'magnetic-pendulum-basins', 'glyph-field', 'feedback-trails',
    'ferrofluid-spikes', 'gradient-bloom-field'
  ];
  function orank(id) { var i = ORDER.indexOf(id); return i < 0 ? 1e6 : i; }
  function norm(g) { return String(g || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim(); }
  var GROUP_ORDER = ['oscillographic', 'spectral', 'cymatic', 'fluid', 'particle', 'vibration', 'frequency', 'fractal', 'raster', 'line', 'texture'];
  function grank(g) { var n = norm(g).split(' ')[0]; var i = GROUP_ORDER.indexOf(n); return i < 0 ? 50 : i; }
  demos.sort(function (a, b) { return (orank(a.id) - orank(b.id)) || (grank(a.group) - grank(b.group)) || String(a.title).localeCompare(String(b.title)); });
  demos.forEach(function (d, i) { d._no = ('0' + (i + 1)).slice(-2); });

  // ---------- virtual clock ----------
  var vt = 0, lastNow = null, paused = false;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) paused = true;
  var active = new Set();
  function tick(now) {
    if (lastNow == null) lastNow = now;
    var dt = (now - lastNow) / 1000; lastNow = now;
    if (dt > 0.1) dt = 0.1;
    if (!paused) vt += dt;
    if (A.update) A.update(paused ? 0.0001 : dt);
    active.forEach(drawInstance);
    if (glyph) glyph.draw();
    if (live.on) liveTick();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- instances ----------
  function makeInstance(def, canvas, detail) {
    var inst = { def: def, canvas: canvas, ctx: canvas.getContext('2d', { alpha: false }), params: {}, state: {}, errored: false, inited: false, detail: !!detail, dpr: 1, w: 0, h: 0 };
    (def.params || []).forEach(function (p) { inst.params[p.key] = p.value; });
    return inst;
  }
  var COARSE = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
  function sizeInstance(inst) {
    var rect = inst.canvas.getBoundingClientRect();
    var cap = inst.detail ? 2 : (COARSE ? 1.25 : 1.5);
    var dpr = Math.min(window.devicePixelRatio || 1, cap);
    var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    if (inst.canvas.width !== Math.round(w * dpr) || inst.canvas.height !== Math.round(h * dpr)) {
      inst.canvas.width = Math.round(w * dpr); inst.canvas.height = Math.round(h * dpr);
    }
    inst.dpr = dpr; inst.w = w; inst.h = h;
  }
  function drawInstance(inst) {
    if (inst.errored) return;
    sizeInstance(inst);
    if (inst.w < 2 || inst.h < 2) return;
    var ctx = inst.ctx;
    ctx.setTransform(inst.dpr, 0, 0, inst.dpr, 0, 0);
    try {
      if (!inst.inited) { if (inst.def.init) inst.def.init(inst.state, inst.w, inst.h); inst.inited = true; }
      inst.def.draw(ctx, inst.w, inst.h, vt, inst.params, inst.state, theme(), A.frame);
    } catch (e) {
      inst.errored = true;
      var th = theme();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, inst.canvas.width, inst.canvas.height);
      ctx.fillStyle = U.rgba(th.dim, 0.85); ctx.font = '11px monospace'; ctx.fillText('// render error', 10, 18);
      if (console && console.error) console.error('demo error:', inst.def.id, e);
    }
  }

  // ---------- header glyph field (homage to glyphfield.js) ----------
  var glyph = null;
  (function initGlyph() {
    var canvas = document.getElementById('glyphfield');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var IDLE = ['.', '·', ':', '-', '=', '+', '·', '∙', '⋮', '°'];
    var CHURN = ['/', '\\', '|', '-', '=', '+', '<', '>', '[', ']', '·', ':', '*', 'k', 'i', 'n', 'd', 'l', '0', '1'];
    var WORDS = ['SOUND', 'IMAGE', 'FREQUENCY', 'VIBRATION', 'OSCILLO', 'CYMATIC', 'FOURIER', 'MEMBRANE', 'STRING', 'FRACTAL', 'PHASE', 'SPECTRUM', 'LISSAJOUS', 'RASTER', 'GLYPH', 'SIGNAL', 'TRACE', 'MODE', 'IMAGE'];
    var fontPx = 14, cw = fontPx * 0.62, rh = fontPx * 1.18;
    var pX = -999, pY = -999, words = [], lastSpawn = -2, wordRng = U.mulberry32(7);
    canvas.parentElement.addEventListener('mousemove', function (e) { var r = canvas.getBoundingClientRect(); pX = e.clientX - r.left; pY = e.clientY - r.top; });
    canvas.parentElement.addEventListener('mouseleave', function () { pX = -999; pY = -999; });
    glyph = {
      draw: function () {
        var rect = canvas.getBoundingClientRect();
        if (rect.width < 2 || rect.bottom < 0) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var w = Math.round(rect.width), h = Math.round(rect.height);
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        var th = theme(), tt = THEMES[themeKey];
        ctx.font = fontPx + "px 'IBM Plex Mono', monospace";
        ctx.textBaseline = 'top';
        var cols = Math.ceil(w / cw), rows = Math.ceil(h / rh);
        var calm = Math.floor(cols * 0.34);
        // idle drifting field
        for (var ry = 0; ry < rows; ry++) {
          for (var rx = 0; rx < cols; rx++) {
            var nx = rx * cw, ny = ry * rh;
            var n = U.fbm(rx * 0.18 + vt * 0.08, ry * 0.22 - vt * 0.05, 3);
            var a = U.smoothstep(0.05, 0.6, n) * 0.5;
            if (rx < calm) a *= 0.32;
            // pointer wake
            var dx = nx - pX, dy = ny - pY, dist = Math.sqrt(dx * dx + dy * dy);
            var wake = dist < 90 ? (1 - dist / 90) : 0;
            if (a < 0.02 && wake < 0.05) continue;
            var gi = (U.hash2(rx, ry) * IDLE.length) | 0;
            var ch = IDLE[gi];
            if (wake > 0.05) { ch = CHURN[(U.hash2(rx + vt * 9, ry) * CHURN.length) | 0]; ctx.fillStyle = U.rgba(th.dim, Math.min(0.55, a + wake * 0.5)); }
            else ctx.fillStyle = U.rgba(tt.faint, a);
            ctx.fillText(ch, nx, ny);
          }
        }
        // settling words (right of the calm zone)
        if (vt - lastSpawn > 2.6 && words.length < 3) {
          lastSpawn = vt;
          var wstr = WORDS[(wordRng() * WORDS.length) | 0];
          var col = calm + 2 + Math.floor(wordRng() * Math.max(1, cols - calm - wstr.length - 3));
          var row = 1 + Math.floor(wordRng() * Math.max(1, rows - 2));
          words.push({ s: wstr, col: col, row: row, born: vt });
        }
        for (var wi = words.length - 1; wi >= 0; wi--) {
          var wd = words[wi], age = vt - wd.born, life = 3.6;
          if (age > life) { words.splice(wi, 1); continue; }
          var decode = U.smoothstep(0, 0.5, age), diss = 1 - U.smoothstep(life - 0.7, life, age);
          for (var li = 0; li < wd.s.length; li++) {
            var settled = U.hash2(wd.col + li, wd.row) < decode;
            var c2 = settled ? wd.s[li] : CHURN[(U.hash2(wd.col + li + vt * 12, wd.row) * CHURN.length) | 0];
            ctx.fillStyle = U.rgba(settled ? th.ink : th.dim, (settled ? 0.7 : 0.4) * diss);
            ctx.fillText(c2, (wd.col + li) * cw, wd.row * rh);
          }
        }
      }
    };
  })();

  // ---------- featured (hero) shelf + catalogue grid ----------
  // Hero specimens shown first, big (2:1), in this curated order. Edit freely.
  // (mapped from the SPEC numbers Kindl picked 2026-06-23; ordered by visual flow, not number)
  // The index is a single uniform grid (4:3 tiles, ~2-3 per row), no separate hero shelf,
  // so the catalogue is easy to scan and navigate when returning from the live view.
  var FEATURED = [];

  var grid = document.getElementById('grid');
  var featured = document.getElementById('featured');
  var cards = [], groupHeads = {}, lastGroup = null, gmark = 0;

  function buildCard(def, hero) {
    var card = document.createElement('div'); card.className = 'card' + (hero ? ' hero' : '');
    if (hero) {
      card.innerHTML =
        '<div class="thumb"><canvas></canvas></div>' +
        '<div class="feat-cap"><span class="fn">SPEC-' + def._no + '</span><span class="ft">' + esc(def.title) + '</span></div>';
    } else {
      card.innerHTML =
        '<span class="reg tl"></span><span class="reg tr"></span><span class="reg bl"></span><span class="reg br"></span>' +
        '<div class="thumb"><span class="spec-no">SPEC-' + def._no + '</span><canvas></canvas><div class="hovercap">SPEC-' + def._no + ' &middot; ' + esc(def.title) + '</div></div>' +
        '<div class="card-body"><div class="card-grp">' + esc(def.group) + '</div><div class="card-title">' + esc(def.title) + '</div>' +
        '<div class="card-ess">' + esc(def.essence || '') + '</div><div class="card-tags">' + (def.tags || []).slice(0, 5).map(function (t) { return '<span class="t">' + esc(t) + '</span>'; }).join('') + '</div></div>';
    }
    var inst = makeInstance(def, card.querySelector('canvas'), hero);
    cards.push({ el: card, def: def, inst: inst, group: def.group, hero: !!hero });
    // the tile is not clickable as a whole; a small corner icon opens the patch (parameter editor)
    var opener = document.createElement('button');
    opener.className = 'patch-open'; opener.type = 'button';
    opener.setAttribute('aria-label', 'open patch: ' + def.title);
    opener.title = 'open patch';
    opener.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="9" cy="7" r="1.8" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="8" cy="17" r="1.8" fill="currentColor" stroke="none"/></svg>';
    card.querySelector('.thumb').appendChild(opener);
    opener.addEventListener('click', function (e) { e.stopPropagation(); openDetail(def); });
    // clicking the tile (anywhere but the patch icon) opens the fullscreen live pager
    var thumb = card.querySelector('.thumb');
    thumb.classList.add('live-open');
    thumb.addEventListener('click', function (e) { if (e.target.closest('.patch-open')) return; enterLive(def); });
    return card;
  }

  // hero shelf, in FEATURED order, pulled out of the families
  var heroSet = {};
  FEATURED.forEach(function (id) {
    var def = demos.find(function (d) { return d.id === id; });
    if (def && !heroSet[id]) { heroSet[id] = true; featured.appendChild(buildCard(def, true)); }
  });
  var restDiv = document.getElementById('restdiv');
  if (!featured.children.length) { featured.style.display = 'none'; if (restDiv) restDiv.style.display = 'none'; }

  // flat grid in the curated ORDER (no per-family headers; the sequence is the curation)
  demos.forEach(function (def) {
    if (heroSet[def.id]) return;
    grid.appendChild(buildCard(def, false));
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { var rec = cards.find(function (c) { return c.el === en.target; }); if (!rec) return; if (en.isIntersecting) active.add(rec.inst); else active.delete(rec.inst); });
  }, { rootMargin: '120px' });
  cards.forEach(function (c) { io.observe(c.el); });

  // ---------- filters ----------
  var activeGroup = null, activeTags = new Set(), query = '';
  var groupsEl = document.getElementById('groups');
  var groupNames = []; demos.forEach(function (d) { if (groupNames.indexOf(d.group) < 0) groupNames.push(d.group); });
  groupNames.forEach(function (g) {
    var c = document.createElement('button'); c.className = 'chip'; c.textContent = g.toLowerCase();
    c.addEventListener('click', function () {
      activeGroup = (activeGroup === g) ? null : g;
      [].forEach.call(groupsEl.children, function (x) { x.classList.toggle('on', x.textContent === g.toLowerCase() && activeGroup === g); });
      applyFilter();
    });
    groupsEl.appendChild(c);
  });
  var freq = {}; demos.forEach(function (d) { (d.tags || []).forEach(function (t) { freq[t] = (freq[t] || 0) + 1; }); });
  var tagList = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a] || a.localeCompare(b); }).slice(0, 18);
  var tagsEl = document.getElementById('tags');
  tagList.forEach(function (t) {
    var c = document.createElement('button'); c.className = 'chip tag'; c.textContent = t;
    c.addEventListener('click', function () { if (activeTags.has(t)) activeTags.delete(t); else activeTags.add(t); c.classList.toggle('on'); applyFilter(); });
    tagsEl.appendChild(c);
  });
  var searchEl = document.getElementById('search');
  searchEl.addEventListener('input', function () { query = searchEl.value.toLowerCase().trim(); applyFilter(); });

  function matches(def) {
    if (activeGroup && def.group !== activeGroup) return false;
    if (activeTags.size) { var has = false; (def.tags || []).forEach(function (t) { if (activeTags.has(t)) has = true; }); if (!has) return false; }
    if (query) { var hay = (def.title + ' ' + def.group + ' ' + def.essence + ' ' + def.blurb + ' ' + (def.tags || []).join(' ') + ' ' + def.lineage).toLowerCase(); if (hay.indexOf(query) < 0) return false; }
    return true;
  }
  function applyFilter() {
    var shown = 0;
    cards.forEach(function (c) { var ok = matches(c.def); c.el.style.display = ok ? '' : 'none'; if (ok) shown++; });
    Object.keys(groupHeads).forEach(function (g) { var any = cards.some(function (c) { return c.group === g && c.el.style.display !== 'none'; }); groupHeads[g].style.display = any ? '' : 'none'; });
    document.getElementById('count').textContent = shown + ' / ' + demos.length + ' specimens';
  }

  // ---------- detail overlay ----------
  var overlay = document.getElementById('overlay');
  var detailInst = null, detailIndex = -1;
  function visibleDefs() { var v = cards.filter(function (c) { return c.el.style.display !== 'none'; }).map(function (c) { return c.def; }); return v.length ? v : demos; }
  function openDetail(def) {
    var list = visibleDefs(); detailIndex = list.indexOf(def);
    overlay.innerHTML =
      '<div class="detail"><div class="stage"><span class="spec-no">SPEC-' + def._no + '</span><canvas></canvas><div class="xhair"></div></div>' +
      '<button class="detail-close" id="dclose">close [esc]</button><div class="side">' +
      '<div class="grp">' + esc(def.group) + ' &middot; SPEC-' + def._no + '</div><h2>' + esc(def.title) + '</h2><div class="ess">' + esc(def.essence || '') + '</div><div class="blurb">' + esc(def.blurb || '') + '</div>' +
      '<div class="kv">' + (def.dialect && def.dialect !== '-' ? '<div class="k">dialect</div><div class="v">' + esc(def.dialect) + '</div>' : '') +
      '<div class="k">lineage</div><div class="v">' + esc(def.lineage || '') + '</div><div class="k">palette</div><div class="v mono">' + esc(def.palette || '') + '</div><div class="k">params</div><div class="v">' + esc(def.paramNotes || '') + '</div></div>' +
      '<div class="params" id="dparams"></div><div class="detail-tags">' + (def.tags || []).map(function (t) { return '<span class="t">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<div class="detail-foot"><button class="btn" id="drand">randomize</button><button class="btn" id="dreset">reset</button><button class="btn accent" id="dpresent">&#9658; live</button><span class="spacer"></span><span class="nav-hint">&larr; &rarr; specimens</span></div></div></div>';
    overlay.classList.add('open');
    if (detailInst) active.delete(detailInst);
    detailInst = makeInstance(def, overlay.querySelector('.stage canvas'), true); active.add(detailInst);
    var pc = document.getElementById('dparams');
    (def.params || []).forEach(function (p) {
      var row = document.createElement('div'); row.className = 'param';
      row.innerHTML = '<label>' + esc(p.label) + '</label><span class="pv">' + fmt(detailInst.params[p.key]) + '</span>';
      var inp = document.createElement('input'); inp.type = 'range'; inp.min = p.min; inp.max = p.max; inp.step = p.step; inp.value = detailInst.params[p.key];
      var pv = row.querySelector('.pv');
      inp.addEventListener('input', function () { detailInst.params[p.key] = parseFloat(inp.value); pv.textContent = fmt(detailInst.params[p.key]); });
      row.appendChild(inp); pc.appendChild(row); row._inp = inp; row._pv = pv; row._p = p;
    });
    document.getElementById('dclose').addEventListener('click', closeDetail);
    document.getElementById('dpresent').addEventListener('click', function () { closeDetail(); enterLive(def); });
    document.getElementById('drand').addEventListener('click', function () {
      [].forEach.call(pc.children, function (row) { var p = row._p, steps = Math.max(1, Math.round((p.max - p.min) / p.step)); var v = p.min + Math.round(Math.random() * steps) * p.step; v = Math.min(p.max, Math.max(p.min, v)); detailInst.params[p.key] = v; row._inp.value = v; row._pv.textContent = fmt(v); });
    });
    document.getElementById('dreset').addEventListener('click', function () { (def.params || []).forEach(function (p) { detailInst.params[p.key] = p.value; }); [].forEach.call(pc.children, function (row) { row._inp.value = detailInst.params[row._p.key]; row._pv.textContent = fmt(detailInst.params[row._p.key]); }); });
  }
  function closeDetail() { overlay.classList.remove('open'); if (detailInst) { active.delete(detailInst); detailInst = null; } overlay.innerHTML = ''; }
  function navDetail(d) { var list = visibleDefs(); if (!list.length) return; detailIndex = (detailIndex + d + list.length) % list.length; openDetail(list[detailIndex]); }
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDetail(); });

  // ---------- live pager (fullscreen, one specimen, audio-reactive; play.kindl.work-style) ----------
  var live = { on: false, inst: null, index: -1, el: null, infoOpen: false, dismissedTap: false };
  (function buildLive() {
    var el = document.createElement('div'); el.id = 'livemode';
    el.innerHTML =
      '<div class="lstage">' +
        '<canvas></canvas>' +
        '<span class="lmark"></span>' +
        '<button class="ltap" type="button"><span class="dot"></span> tap to listen<small>let this specimen hear the room</small></button>' +
      '</div>' +
      '<div class="lbar">' +
        '<button class="lbtn lindex" type="button">&#9783; index</button>' +
        '<button class="lbtn lprev" type="button">&#8249; prev</button>' +
        '<div class="lcenter">' +
          '<div class="ltitle"></div>' +
          '<div class="lmeter"><span class="lm-level"><i></i></span><span class="lm-band b"></span><span class="lm-band m"></span><span class="lm-band h"></span><span class="lm-sens">x1.0</span></div>' +
        '</div>' +
        '<button class="lbtn linfobtn" type="button">info</button>' +
        '<button class="lbtn lmic" type="button">mic: off</button>' +
        '<button class="lbtn lnext" type="button">next &#8250;</button>' +
      '</div>' +
      '<div class="linfo"><button class="linfoclose" type="button">close</button>' +
        '<div class="li-line"><span class="li-k">specimen</span><span class="li-v li-title"></span></div>' +
        '<div class="li-line"><span class="li-k">family</span><span class="li-v li-grp"></span></div>' +
        '<div class="li-line"><span class="li-k">reveals</span><span class="li-v li-ess"></span></div>' +
        '<div class="li-line"><span class="li-k">about</span><span class="li-v li-blurb"></span></div>' +
        '<div class="li-line"><span class="li-k">lineage</span><span class="li-v li-lin"></span></div>' +
        '<div class="li-hint">&larr; &rarr; / swipe move &middot; m mic &middot; i info &middot; p palette &middot; [ ] sensitivity &middot; esc exit</div>' +
      '</div>' +
      '<div class="lhint">swipe or arrows to move &middot; tap to listen &middot; m mic &middot; i info &middot; esc exit</div>';
    document.body.appendChild(el); live.el = el;
    el.querySelector('.lindex').addEventListener('click', function (e) { e.stopPropagation(); exitLive(); });
    el.querySelector('.lprev').addEventListener('click', function (e) { e.stopPropagation(); liveNav(-1); });
    el.querySelector('.lnext').addEventListener('click', function (e) { e.stopPropagation(); liveNav(1); });
    el.querySelector('.linfobtn').addEventListener('click', function (e) { e.stopPropagation(); toggleLiveInfo(); });
    el.querySelector('.linfoclose').addEventListener('click', function (e) { e.stopPropagation(); toggleLiveInfo(false); });
    el.querySelector('.lmic').addEventListener('click', function (e) { e.stopPropagation(); toggleMic(); });
    el.querySelector('.ltap').addEventListener('click', function (e) { e.stopPropagation(); toggleMic(); });
    // stage click = next (quick browsing); swipe handled below
    var stage = el.querySelector('.lstage');
    stage.addEventListener('click', function () { if (!live.swiped) liveNav(1); });
    // touch swipe
    var sx = 0, sy = 0, st = 0;
    stage.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); live.swiped = false; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0]; var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) { live.swiped = true; liveNav(dx < 0 ? 1 : -1); }
    }, { passive: true });
    // reflect mic state coming from the engine
    A.onchange = function (on) { reflectMic(on); };
  })();

  function enterLive(def) {
    var list = visibleDefs(); live.index = def ? list.indexOf(def) : 0; if (live.index < 0) live.index = 0;
    live.on = true; live.el.classList.add('on');
    document.body.classList.add('live-active');
    reflectMic(A.on);
    liveShow(list[live.index]);
  }
  function liveShow(def) {
    if (live.inst) active.delete(live.inst);
    var cv = live.el.querySelector('.lstage canvas');
    live.inst = makeInstance(def, cv, true); active.add(live.inst);
    live.el.querySelector('.lmark').textContent = 'SPEC-' + def._no;
    var list = visibleDefs(); var pos = list.indexOf(def);
    live.el.querySelector('.ltitle').textContent = def.title.toLowerCase() + '   ' + ('0' + (pos + 1)).slice(-2) + ' / ' + ('0' + list.length).slice(-2);
    live.el.querySelector('.li-title').textContent = 'SPEC-' + def._no + '  ' + def.title;
    live.el.querySelector('.li-grp').textContent = def.group + (def.dialect && def.dialect !== '-' ? '  /  ' + def.dialect : '');
    live.el.querySelector('.li-ess').textContent = def.essence || '';
    live.el.querySelector('.li-blurb').textContent = def.blurb || '';
    live.el.querySelector('.li-lin').textContent = def.lineage || '';
  }
  function liveNav(d) { var list = visibleDefs(); if (!list.length) return; live.index = (live.index + d + list.length) % list.length; liveShow(list[live.index]); }
  function exitLive() {
    live.on = false; live.el.classList.remove('on'); document.body.classList.remove('live-active');
    if (live.inst) { active.delete(live.inst); live.inst = null; }
    toggleLiveInfo(false);
  }
  function toggleLiveInfo(force) { live.infoOpen = (force == null) ? !live.infoOpen : force; live.el.classList.toggle('info-on', live.infoOpen); }
  function toggleMic() {
    if (A.on) { A.disable(); reflectMic(false); }
    else { A.enable().then(function () { reflectMic(true); }).catch(function (err) { reflectMic(false); var b = live.el.querySelector('.lmic'); if (b) b.textContent = 'mic: ' + (String(err).indexOf('denied') >= 0 ? 'denied' : 'n/a'); }); }
  }
  function reflectMic(on) {
    var b = live.el.querySelector('.lmic'); if (b) { b.textContent = on ? 'mic: live' : 'mic: off'; b.classList.toggle('on', on); }
    live.el.classList.toggle('mic-on', !!on);
    if (on) live.dismissedTap = true;
  }
  // per-frame meter + heat update while live
  function liveTick() {
    var f = A.frame; if (!f) return;
    var fill = live.el.querySelector('.lm-level i'); if (fill) fill.style.width = Math.round(f.level * 100) + '%';
    var bb = live.el.querySelector('.lm-band.b'); if (bb) bb.style.opacity = (0.18 + f.bass * 0.82).toFixed(2);
    var bm = live.el.querySelector('.lm-band.m'); if (bm) bm.style.opacity = (0.18 + f.mid * 0.82).toFixed(2);
    var bh = live.el.querySelector('.lm-band.h'); if (bh) bh.style.opacity = (0.18 + f.high * 0.82).toFixed(2);
  }
  function setSens(d) {
    A.sensitivity = U.clamp((A.sensitivity || 1) * (d > 0 ? 1.18 : 0.85), 0.2, 6);
    var s = live.el.querySelector('.lm-sens'); if (s) s.textContent = 'x' + A.sensitivity.toFixed(1);
  }
  document.getElementById('live').addEventListener('click', function () { enterLive(null); });

  // ---------- controls + keys ----------
  document.getElementById('palette').addEventListener('click', function () { applyTheme(THEME_ORDER[(THEME_ORDER.indexOf(themeKey) + 1) % THEME_ORDER.length]); });
  var pp = document.getElementById('playpause'); pp.textContent = paused ? 'play' : 'pause';
  pp.addEventListener('click', function () { paused = !paused; pp.textContent = paused ? 'play' : 'pause'; });

  // ---------- visuals-first (bare) mode, default on ----------
  var bareBtn = document.getElementById('bare');
  function applyBare(on) {
    document.body.classList.toggle('bare', on);
    if (bareBtn) { bareBtn.textContent = on ? 'settings' : 'close settings'; bareBtn.classList.toggle('on', !on); }
    try { localStorage.setItem('soundviz-bare', on ? '1' : '0'); } catch (e) {}
  }
  var bareInit = true;
  try { var bs = localStorage.getItem('soundviz-bare'); if (bs !== null) bareInit = (bs !== '0'); } catch (e) {}
  applyBare(bareInit);
  if (bareBtn) bareBtn.addEventListener('click', function () { applyBare(!document.body.classList.contains('bare')); });
  document.addEventListener('keydown', function (e) {
    if (live.on) {
      if (e.key === 'Escape' || e.key === 'q') exitLive();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); liveNav(1); }
      else if (e.key === 'ArrowLeft') liveNav(-1);
      else if (e.key === 'i') toggleLiveInfo();
      else if (e.key === 'm') toggleMic();
      else if (e.key === '[') setSens(-1);
      else if (e.key === ']') setSens(1);
      else if (e.key === 'p' || e.key === 't') applyTheme(THEME_ORDER[(THEME_ORDER.indexOf(themeKey) + 1) % THEME_ORDER.length]);
      return;
    }
    if (overlay.classList.contains('open')) { if (e.key === 'Escape') closeDetail(); else if (e.key === 'ArrowRight') navDetail(1); else if (e.key === 'ArrowLeft') navDetail(-1); }
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); paused = !paused; pp.textContent = paused ? 'play' : 'pause'; }
    if (e.key === 't' && e.target.tagName !== 'INPUT') applyTheme(THEME_ORDER[(THEME_ORDER.indexOf(themeKey) + 1) % THEME_ORDER.length]);
    if (e.key === 'i' && e.target.tagName !== 'INPUT') applyBare(!document.body.classList.contains('bare'));
  });

  // ---------- header meta ----------
  document.getElementById('metarow').innerHTML =
    '<span><b>' + demos.length + '</b> specimens / <b>' + groupNames.length + '</b> families</span>' +
    '<span>live, microphone-reactive &middot; one signal, every dialect</span>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function fmt(v) { v = +v; return (Math.abs(v) >= 100 || v === Math.round(v)) ? String(Math.round(v)) : v.toFixed(2); }

  applyTheme('signal');
  applyFilter();

  // default view: open straight into the full-viewport live pager on the first specimen
  enterLive(null);
})();
