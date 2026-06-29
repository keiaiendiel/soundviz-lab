LAB.register({
  id: 'rayleigh-benard',
  title: 'Rayleigh-Benard Convection',
  group: 'Fluid and field',
  essence: 'A heated fluid layer past the critical Rayleigh number breaks into counter-rotating convection rolls; warm fluid rises, cool fluid sinks, the cellular temperature field wobbling slowly.',
  blurb: 'Heat a thin fluid layer from below and below Ra = 1708 it just conducts; above it the layer organizes into rolls. This renders a stream-function of a few counter-rotating rolls advecting the temperature scalar, plumes rising warm, lanes sinking cool.',
  tags: ['field', 'fluid', 'raster', 'monochrome', 'slow', 'realtime'],
  lineage: 'Henri Benard 1900 cells, Lord Rayleigh 1916 linear stability; Boussinesq convection, critical Rayleigh number Ra_c = 1708 with critical wavenumber k_c = 3.117 for rigid-rigid boundaries.',
  dialect: 'Vector Plume',
  palette: 'Monochrome warm. Black-to-warm-amber ramp on the temperature field; hot plumes near white-amber, cold lanes near black. One accent only.',
  paramNotes: 'rollCount sets how many roll pairs span the width (the convective wavenumber). rayleigh scales supercriticality above 1708, driving plume sharpness and advection speed. wobble sets the slow lateral drift of roll boundaries. warmth biases the amber ramp. Audio: loudness drives convective vigour (plume sharpness and advection speed) and spectral centroid sets the cell count.',
  params: [
    { key: 'rollCount', label: 'Roll pairs', min: 2, max: 10, step: 1, value: 5 },
    { key: 'rayleigh', label: 'Ra / Ra_c', min: 1.05, max: 6, step: 0.05, value: 2.4 },
    { key: 'wobble', label: 'Roll wobble', min: 0, max: 1, step: 0.01, value: 0.35 },
    { key: 'warmth', label: 'Plume warmth', min: 0.2, max: 1, step: 0.01, value: 0.7 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    // Coarse field grid; bilinear-upscaled to the canvas via an offscreen blit.
    s.GW = 132;
    s.GH = 84;
    var n = s.GW * s.GH;
    s.T = new Float32Array(n);   // temperature scalar
    s.C = new Float32Array(n);   // advected dye, curls plumes into rolls
    s.C2 = new Float32Array(n);
    s.img = null;
    s.warm = -1;                 // marks first frame so dye seeds from T
    // a fixed pre-warm phase so the very first frame already shows full rolls
    s.t0 = 60;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var react = (p.react == null ? 0.85 : p.react);
    var level = LABUTIL.clamp(a.level, 0, 1);
    var centroid = LABUTIL.clamp(a.centroid, 0, 1);
    var GW = s.GW, GH = s.GH;
    var T = s.T, C = s.C, C2 = s.C2;
    // brightness sets how many convection cells span the width
    var rolls = Math.max(1, Math.round(p.rollCount + react * (centroid - 0.4) * 3));
    var W = GW, H = GH;
    // amplitude grows like the Stuart-Landau saturation above the bifurcation;
    // loudness raises the effective supercriticality (convective vigour)
    var sup = LABUTIL.clamp(p.rayleigh, 1.0, 6);
    var supEff = LABUTIL.clamp(sup * (0.75 + 0.85 * react * level), 1.0, 9);
    var A = Math.sqrt(Math.max(0, supEff - 1));
    if (!isFinite(A)) A = 0;
    var B = 0.45 * A / (1 + 0.3 * A);
    var k = rolls * Math.PI / W;          // each roll pair is one wavelength 2W/rolls
    var piH = Math.PI / H;
    // Activity: ~0 in silence, ~1 with sound. flow scales dye advection and the roll
    // drift so the cells are near-still when quiet and churn with sound.
    var act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    var flow = 0.06 + 1.3 * act;
    // integrate our own pre-warmed wobble clock so roll drift nearly freezes in silence
    s.wph = (s.wph == null ? s.t0 : s.wph) + a.dt * (0.06 + 1.3 * act);
    var tt = s.wph;                       // pre-warmed time, never a cold start
    // slow lateral roll drift / wobble, periodicity preserved
    var d = LABUTIL.clamp(p.wobble, 0, 1) * 0.15 * W * Math.sin(0.11 * tt + 0.7 * Math.sin(0.05 * tt));

    // ---- temperature field T(x,y,t) = conductive profile + convective correction
    for (var y = 0; y < H; y++) {
      var sy = Math.sin(piH * y);
      var cond = 1 - y / H;
      var row = y * W;
      for (var x = 0; x < W; x++) {
        var ph = k * (x + d);
        var conv = B * Math.sin(ph) * sy;
        var val = cond + conv;
        if (val < 0) val = 0; else if (val > 1) val = 1;
        T[row + x] = val;
      }
    }

    // ---- semi-Lagrangian dye advection: backtrace along the stream-function velocity
    // u = +A(PI/H)cos(k(x+d))cos(PI y/H);  v = +A k sin(k(x+d))sin(PI y/H)
    if (s.warm < 0) { C.set(T); s.warm = sup; }
    var dt = 0.6;
    var uK = A * (Math.PI / H);
    var vK = A * k;
    var sc = 6.0;   // px scale so velocity backtrace covers grid cells visibly
    for (var yy = 0; yy < H; yy++) {
      var cy = Math.cos(piH * yy);
      var syy = Math.sin(piH * yy);
      var r2 = yy * W;
      for (var xx = 0; xx < W; xx++) {
        var ph2 = k * (xx + d);
        var u = uK * Math.cos(ph2) * cy * sc;
        var v = vK * Math.sin(ph2) * syy * sc;
        var bx = xx - u * dt * flow;
        var by = yy - v * dt * flow;
        if (bx < 0) bx = 0; else if (bx > W - 1.001) bx = W - 1.001;
        if (by < 0) by = 0; else if (by > H - 1.001) by = H - 1.001;
        var x0 = bx | 0, y0 = by | 0;
        var fx = bx - x0, fy = by - y0;
        var i00 = y0 * W + x0;
        var c00 = C[i00], c10 = C[i00 + 1], c01 = C[i00 + W], c11 = C[i00 + W + 1];
        var top = c00 + (c10 - c00) * fx;
        var bot = c01 + (c11 - c01) * fx;
        var adv = top + (bot - top) * fy;
        // relax toward temperature
        var tv = T[r2 + xx];
        adv += 0.08 * (tv - adv);
        if (!(adv >= 0)) adv = 0; else if (adv > 1) adv = 1;
        C2[r2 + xx] = adv;
      }
    }
    var sw = C; s.C = C2; s.C2 = sw; C = s.C;

    // ---- render: warm amber ramp into a small buffer, then scale up
    var img = s.img;
    if (!img || img.width !== GW || img.height !== GH) {
      img = s.img = ctx.createImageData(GW, GH);
      var dd = img.data;
      for (var q = 3; q < dd.length; q += 4) dd[q] = 255;
    }
    var data = img.data;
    var warmth = LABUTIL.clamp(p.warmth, 0.2, 1);
    var gx = 1.4 - 0.8 * warmth;
    for (var i = 0; i < GW * GH; i++) {
      var m = 0.6 * T[i] + 0.4 * C[i];
      if (m < 0) m = 0; else if (m > 1) m = 1;
      var g = Math.pow(m, gx);
      var o = i * 4;
      data[o] = 255 * g;
      data[o + 1] = 180 * g * g;
      data[o + 2] = 70 * g * g * g;
    }

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    var off = s._off;
    if (!off) {
      try { off = s._off = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(GW, GH) : null; } catch (e) { off = s._off = null; }
      if (off) s._offctx = off.getContext('2d');
    }
    var prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if (off && s._offctx) {
      s._offctx.putImageData(img, 0, 0);
      ctx.drawImage(off, 0, 0, GW, GH, 0, 0, w, h);
    } else {
      ctx.putImageData(img, 0, 0);
      if (ctx.canvas) ctx.drawImage(ctx.canvas, 0, 0, GW, GH, 0, 0, w, h);
    }

    // ---- faint isotherm contours for the scientific-instrument register
    var levels = [0.25, 0.5, 0.75];
    var sxp = w / W, syp = h / H;
    ctx.lineWidth = 1;
    for (var li = 0; li < 3; li++) {
      var lev = levels[li];
      ctx.strokeStyle = 'rgba(255,180,70,' + (0.05 + 0.03 * li) + ')';
      ctx.beginPath();
      for (var cy2 = 0; cy2 < H - 1; cy2++) {
        for (var cx2 = 0; cx2 < W - 1; cx2++) {
          var a = T[cy2 * W + cx2], b = T[cy2 * W + cx2 + 1];
          // mark a crossing on the horizontal edge between a and b
          if ((a - lev) * (b - lev) < 0) {
            var fr = (lev - a) / ((b - a) || 1e-6);
            var px = (cx2 + fr) * sxp;
            var py = cy2 * syp;
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + syp);
          }
        }
      }
      ctx.stroke();
    }
    ctx.imageSmoothingEnabled = prevSmooth;
  }
});

