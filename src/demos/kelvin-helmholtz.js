LAB.register({
  id: 'kelvin-helmholtz',
  title: 'Kelvin-Helmholtz Billows',
  group: 'Fluid and field',
  essence: "Two fluid layers in shear roll a perturbed interface into a periodic row of cat's-eye billows, dye advected by a Stuart vortex-row stream-function.",
  blurb: "When two layers slide past each other the interface is unstable; small ripples grow and overturn into a chain of spiraling cat's-eyes. This advects dye in the exact Kelvin-Stuart cat's-eye flow, a hyperbolic-tangent shear layer plus a row of co-rotating vortices.",
  tags: ['field', 'fluid', 'raster', 'particle', 'monochrome', 'realtime'],
  lineage: "Kelvin 1871, Helmholtz 1868 shear instability; Stuart 1967 exact nonlinear cat's-eye solution of the 2D Euler/vorticity equation, stream-function psi = ln(cosh(y) + eps*cos(x)).",
  dialect: 'Vector Plume',
  palette: 'Monochrome warm. Dyed lower layer in warm amber, clear upper layer near black; the rolled interface a bright amber spiral. One accent.',
  paramNotes: 'billowCount sets how many cat\'s-eyes span the width (the unstable wavelength). eyeWidth is Stuart\'s eps in [0,1): 0 is a flat tanh shear layer, near 1 are fat overturned eyes. shear scales advection speed. rollUp blends from a sinusoidal interface toward the fully overturned vortex row. Audio: loudness scales the shear (advection speed) and treble adds drift to the billow row.',
  params: [
    { key: 'billowCount', label: 'Billows', min: 2, max: 8, step: 1, value: 4 },
    { key: 'eyeWidth', label: 'Eye width eps', min: 0.05, max: 0.95, step: 0.01, value: 0.55 },
    { key: 'shear', label: 'Shear speed', min: 0.2, max: 2.5, step: 0.05, value: 1 },
    { key: 'rollUp', label: 'Roll-up', min: 0, max: 1, step: 0.01, value: 0.7 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.GW = 168;
    s.GH = 96;
    var n = s.GW * s.GH;
    s.C = new Float32Array(n);
    s.C2 = new Float32Array(n);
    s.img = null;
    s.lastKey = null;
    s.ySpan = 6;     // shear layer spans +/- a few e-folding lengths
  },
  // seed the dye as a slightly perturbed step: lower layer = 1, upper = 0
  seedDye(s, billows) {
    var GW = s.GW, GH = s.GH, C = s.C, ySpan = s.ySpan;
    for (var py = 0; py < GH; py++) {
      var Y = (py / GH - 0.5) * ySpan;
      for (var px = 0; px < GW; px++) {
        var X = (px / GW) * billows * 2 * Math.PI;
        var iface = 0.35 * Math.sin(X);   // a gentle ripple to break symmetry
        C[py * GW + px] = (Y < iface) ? 1 : 0;
      }
    }
  },
  // advect the dye one semi-Lagrangian step in the steady cat's-eye flow
  advect(s, eps, dt, phase) {
    var GW = s.GW, GH = s.GH, ySpan = s.ySpan;
    var C = s.C, C2 = s.C2;
    var ax = GW / (s.billows * 2 * Math.PI);   // dX per px
    var ay = GH / ySpan;                        // dY per px (Y increases downward)
    for (var py = 0; py < GH; py++) {
      var Y = (py / GH - 0.5) * ySpan;
      var sinhY = Math.sinh(Y), coshY = Math.cosh(Y);
      var row = py * GW;
      for (var px = 0; px < GW; px++) {
        var X = (px / GW) * s.billows * 2 * Math.PI + phase;
        var cosX = Math.cos(X), sinX = Math.sin(X);
        var Den = coshY + eps * cosX;
        if (Den < 1e-4) Den = 1e-4;
        // u = +d psi/dY = sinh(Y)/Den ;  v = -d psi/dX = eps*sin(X)/Den
        var u = sinhY / Den;
        var v = eps * sinX / Den;
        if (!isFinite(u)) u = 0;
        if (!isFinite(v)) v = 0;
        // backtrace in pixel space. The flow is PERIODIC in X (the cat's-eye row
        // repeats every wavelength), so wrap X to conserve dye; clamp only in Y.
        var bx = px - u * ax * dt;
        var by = py - v * ay * dt;
        // wrap bx into [0, GW)
        bx = bx % GW; if (bx < 0) bx += GW;
        if (by < 0) by = 0; else if (by > GH - 1.001) by = GH - 1.001;
        var x0 = bx | 0, y0 = by | 0;
        var x1 = x0 + 1; if (x1 >= GW) x1 = 0;     // wrap right neighbour
        var fx = bx - x0, fy = by - y0;
        var r0 = y0 * GW, r1 = r0 + GW;
        var c00 = C[r0 + x0], c10 = C[r0 + x1], c01 = C[r1 + x0], c11 = C[r1 + x1];
        var top = c00 + (c10 - c00) * fx;
        var bot = c01 + (c11 - c01) * fx;
        var nv = top + (bot - top) * fy;
        if (!(nv >= 0)) nv = 0; else if (nv > 1) nv = 1;
        C2[row + px] = nv;
      }
    }
    var sw = s.C; s.C = s.C2; s.C2 = sw;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var react = (p.react == null ? 0.85 : p.react);
    var GW = s.GW, GH = s.GH;
    s.billows = Math.max(1, Math.round(p.billowCount));
    var eps = LABUTIL.clamp(p.eyeWidth, 0.05, 0.95);
    var shear = LABUTIL.clamp(p.shear, 0.2, 2.5);
    var rollUp = LABUTIL.clamp(p.rollUp, 0, 1);

    // rollUp scales how many warm-up steps wind the dye (sinusoid -> overturned row)
    var key = s.billows + ':' + Math.round(eps * 100) + ':' + Math.round(rollUp * 100);
    // Activity: ~0 in silence, ~1 with sound. Scales the advection step so the
    // billow row only creeps when quiet and rolls fully with sound.
    var act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    var dt = 0.045 * shear * (0.06 + 1.5 * act);
    if (s.lastKey !== key) {
      this.seedDye(s, s.billows);
      var warm = Math.round(60 + rollUp * 420);   // many silent steps for a finished thumbnail
      for (var i = 0; i < warm; i++) this.advect(s, eps, 0.6, 0);
      s.lastKey = key;
    }
    // horizontal phase drift: integrate our own clock so the row nearly freezes in
    // silence (scaled by act); treble adds a bounded drift offset with sound
    s.phase = (s.phase || 0) + a.dt * 0.05 * (0.06 + 1.5 * act);
    var phase = s.phase + 0.6 * react * LABUTIL.clamp(a.high, 0, 1);
    this.advect(s, eps, dt, phase);

    var C = s.C;
    var img = s.img;
    if (!img || img.width !== GW || img.height !== GH) {
      img = s.img = ctx.createImageData(GW, GH);
      var dd = img.data;
      for (var q = 3; q < dd.length; q += 4) dd[q] = 255;
    }
    var data = img.data;
    var n = GW * GH;
    for (var k = 0; k < n; k++) {
      var m = C[k];
      if (m < 0) m = 0; else if (m > 1) m = 1;
      var o = k * 4;
      data[o] = 255 * Math.pow(m, 0.8);
      data[o + 1] = 160 * m * m;
      data[o + 2] = 55 * m * m * m;
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

    // faint streamlines: contours of psi at fixed levels, for the instrument feel
    var ySpan = s.ySpan;
    var levels = [-0.6, 0.0, 0.6];
    var denom = Math.sqrt(Math.max(1e-6, 1 - eps * eps));
    ctx.lineWidth = 1;
    var sxp = w / GW, syp = h / GH;
    for (var li = 0; li < levels.length; li++) {
      var lev = levels[li];
      ctx.strokeStyle = 'rgba(255,170,70,' + (0.05 + 0.02 * li) + ')';
      ctx.beginPath();
      for (var py = 0; py < GH - 1; py++) {
        var Y0 = (py / GH - 0.5) * ySpan;
        var Y1 = ((py + 1) / GH - 0.5) * ySpan;
        for (var px = 0; px < GW; px += 2) {
          var X = (px / GW) * s.billows * 2 * Math.PI + phase;
          var cosX = Math.cos(X);
          var psi0 = Math.log(Math.max(1e-4, (Math.cosh(Y0) + eps * cosX) / denom));
          var psi1 = Math.log(Math.max(1e-4, (Math.cosh(Y1) + eps * cosX) / denom));
          if ((psi0 - lev) * (psi1 - lev) < 0) {
            var fr = (lev - psi0) / ((psi1 - psi0) || 1e-6);
            var yy = (py + fr) * syp;
            var xx = px * sxp;
            ctx.moveTo(xx, yy);
            ctx.lineTo(xx + sxp * 2, yy);
          }
        }
      }
      ctx.stroke();
    }
    ctx.imageSmoothingEnabled = prevSmooth;
  }
});

