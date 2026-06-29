LAB.register({
  id: "wave-packet",
  title: "Quantum Wave Packet",
  group: "Frequency synthesis",
  essence: "A free Schrodinger Gaussian spreads as it travels, phase fringes under a widening envelope.",
  blurb: "A free particle as a moving lump of probability. The Schrodinger equation lets a Gaussian wave packet keep its shape but widen as it goes, the centre sliding at the group velocity while the envelope spreads and flattens. Under that envelope the wavefunction is not smooth, it carries fast phase fringes, ripples whose spacing chirps from front to back because the packet disperses. Shown as a 1D probability curve below and a 2D luminous blob above with the internal fringes drawn in, all from the exact closed form, no time stepping. Dispersion made into a slow, legible image.",
  tags: ["line", "field", "monochrome", "realtime", "optics"],
  lineage: "Schrodinger 1926 free-particle Gaussian packet; standard treatment in Cohen-Tannoudji, Quantum Mechanics. Scientific anchor: closed-form psi(x,t)=(a/(a+i*hbar*t/m))^{1/2} exp(-(x-vt)^2/(2(a+i*hbar*t/m))) e^{i k0 x}, |psi|^2 a Gaussian of width sigma_t=sqrt(sigma0^2+(hbar t/(2 m sigma0))^2).",
  dialect: "Phase Interferometer",
  palette: "monochrome ink",
  paramNotes: "Initial width sets how compact the packet starts and so how fast it must spread (narrow spreads fast, the uncertainty trade). Mean wavenumber k0 sets both the group velocity and how dense the internal fringes are. Dispersion rate scales hbar/m, the spreading speed. Cycle time loops the analytic clock. All four change the figure and are worth sliders, no colour. Audio drive (react): spectral centroid sets the carrier wavenumber k0 (fringe density) and tightens the packet, while loudness raises the probability amplitude and the blob glow; silence leaves a calm, formed packet.",
  params: [
    { key: "width0", label: "Initial width", min: 1.5, max: 8, step: 0.1, value: 3 },
    { key: "k0", label: "Wavenumber k0", min: 1, max: 8, step: 0.1, value: 3.5 },
    { key: "disp", label: "Dispersion", min: 0.2, max: 2.5, step: 0.1, value: 1 },
    { key: "cycle", label: "Cycle time", min: 3, max: 14, step: 0.5, value: 8 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.BW = 160;
    s.BH = 72;
    s.buf = null;
    s.ph = 0.5; // rest at the compact, well-formed packet (tt~0)
  },
  draw(ctx, w, h, t, p, s, theme, af) {
    var TAU = LABUTIL.TAU;
    var clamp = LABUTIL.clamp;

    af = af || {};
    var react = (p.react == null ? 0.85 : clamp(p.react, 0, 1.5));
    var lvl = clamp(af.level || 0, 0, 1);
    var peak = clamp(af.peak || 0, 0, 1);
    var beat = clamp(af.beat || 0, 0, 1);
    var dt = clamp(af.dt == null ? 0.016 : af.dt, 0, 0.1);
    var centroid = clamp(af.centroid || 0, 0, 1);
    // activity envelope: ~0 in silence, ~1 with sound
    var act = clamp(Math.max(lvl, peak * 0.7, beat) * react, 0, 1);
    // loudness raises displayed amplitude (base keeps a calm packet in silence)
    var ampMod = clamp(0.55 + 0.95 * react * lvl, 0, 1.5);

    // --- physics constants (hbar=1, m=1) ---
    var sigma0 = clamp(p.width0, 1.0, 10);
    // brightness/centroid drives both fringe density and packet tightness
    var k0 = clamp(clamp(p.k0, 0.5, 10) * (0.6 + 1.0 * react * centroid), 0.5, 12);
    sigma0 = clamp(sigma0 * (1.2 - 0.4 * react * centroid), 1.0, 10);
    var a = 2 * sigma0 * sigma0;
    var v = k0;
    var TT = 18;
    var bScale = clamp(p.disp, 0.1, 4);
    var cyc = clamp(p.cycle, 3, 14);

    // analytic clock: integrate phase so the packet travel/spread freezes in
    // silence (calm formed packet) and only disperses while sound plays
    var IDLE = 0.06, GAIN = 1.5;
    if (s.ph == null) s.ph = 0.5;
    s.ph += dt * (1 / cyc) * (IDLE + GAIN * act);
    if (!isFinite(s.ph)) s.ph = 0.5;
    var frac = s.ph % 1;
    if (frac < 0) frac += 1;
    if (!isFinite(frac)) frac = 0;
    var tt = frac * TT - TT * 0.5;
    var b = bScale * tt;

    var D2 = a * a + b * b;
    if (D2 < 1e-9) D2 = 1e-9;
    var prePhase = -0.5 * Math.atan2(b, a);
    var preMag = Math.sqrt(a / Math.sqrt(D2));
    var center = v * tt;

    // peak normalization (dx=0): mag=preMag, dens=preMag^2
    var peakMag = preMag;
    var peakDens = preMag * preMag;
    if (!(peakDens > 1e-12)) peakDens = 1e-12;
    if (!(peakMag > 1e-12)) peakMag = 1e-12;

    // world window: covers the spread plus several wavelengths, centred on packet
    var bMax = bScale * TT * 0.5;
    var sigTmax = Math.sqrt(sigma0 * sigma0 + (bMax / (2 * sigma0)) * (bMax / (2 * sigma0)));
    var wl = TAU / k0;
    var W = Math.max(3.5 * sigTmax, wl * 7);
    if (!isFinite(W) || W < 2) W = 12;

    function evalAt(x) {
      var dx = x - center;
      var reE = -(dx * dx) * a / (2 * D2);
      var imE = (dx * dx) * b / (2 * D2);
      var mag = preMag * Math.exp(reE);
      var phase = imE + k0 * x + prePhase;
      var re = mag * Math.cos(phase);
      var dens = mag * mag;
      if (!isFinite(re)) re = 0;
      if (!isFinite(dens)) dens = 0;
      if (!isFinite(mag)) mag = 0;
      return { re: re, dens: dens, mag: mag };
    }

    function worldX(px) { return center - W + (px / w) * (2 * W); }

    // --- parse theme bg/ink for grayscale blit ---
    function parseCol(c) {
      var m;
      if (c[0] === "#") {
        var hex = c.slice(1);
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
      }
      m = c.match(/rgba?\(([^)]+)\)/);
      if (m) { var a2 = m[1].split(","); return [parseFloat(a2[0]), parseFloat(a2[1]), parseFloat(a2[2])]; }
      return [16, 15, 20];
    }
    var bgC = parseCol(theme.bg);
    var inkC = parseCol(theme.ink);

    // --- clear ---
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // band geometry
    var topY0 = 0.06 * h, topY1 = 0.55 * h;
    var topH = topY1 - topY0;
    var bandMidY = (topY0 + topY1) * 0.5;
    var sigY = topH * 0.32;

    // --- 2D luminous blob via small buffer ---
    var BW = s.BW, BH = s.BH;
    if (!s.buf || s.bufW !== BW || s.bufH !== BH) {
      s.buf = ctx.createImageData(BW, BH);
      s.bufW = BW; s.bufH = BH;
    }
    var img = s.buf, data = img.data;

    // precompute column brightness (dens + fringe) once per column
    var col = new Float32Array(BW);
    for (var cx = 0; cx < BW; cx++) {
      var x = center - W + (cx / BW) * (2 * W);
      var r = evalAt(x);
      var dnorm = r.dens / peakDens;
      if (dnorm > 1) dnorm = 1;
      var fringe = 0.5 + 0.5 * (r.mag > 1e-12 ? (r.re / r.mag) : 0); // 0.5+0.5cos(phase)
      col[cx] = dnorm * (0.42 + 0.58 * fringe);
    }

    var midRow = (BH - 1) * ( (bandMidY - topY0) / topH ); // band-relative centre row
    var sigYrows = (sigY / topH) * (BH - 1);
    for (var py = 0; py < BH; py++) {
      var dyr = (py - midRow) / sigYrows;
      var transverse = Math.exp(-dyr * dyr);
      for (var px = 0; px < BW; px++) {
        var bright = transverse * col[px] * ampMod;
        if (bright < 0) bright = 0; else if (bright > 1) bright = 1;
        bright = bright * bright; // gamma for crisp fringes
        var idx = (py * BW + px) * 4;
        data[idx]     = bgC[0] + (inkC[0] - bgC[0]) * bright;
        data[idx + 1] = bgC[1] + (inkC[1] - bgC[1]) * bright;
        data[idx + 2] = bgC[2] + (inkC[2] - bgC[2]) * bright;
        data[idx + 3] = 255;
      }
    }

    // blit scaled into top band via offscreen
    var off = s.off;
    if (!off || s.offW !== BW || s.offH !== BH) {
      try { off = new OffscreenCanvas(BW, BH); } catch (e) { off = null; }
      s.off = off; s.offW = BW; s.offH = BH;
    }
    if (off) {
      var octx = off.getContext("2d");
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, topY0, w, topH);
    }

    // --- 1D probability curve (bottom band) ---
    var axisY = 0.94 * h;
    // axis baseline
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, axisY);
    ctx.lineTo(w, axisY);
    ctx.stroke();

    // centre tick at packet centre
    var scx = w * (center - (center - W)) / (2 * W); // = w*0.5 (centre always mid)
    ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.4);
    ctx.beginPath();
    ctx.moveTo(scx, axisY);
    ctx.lineTo(scx, axisY - 0.018 * h);
    ctx.stroke();

    // phase ripple line Re(psi)/peakMag (drawn under, dim)
    var rippleBaseY = 0.78 * h;
    ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    var started = false;
    for (var pxr = 0; pxr <= w; pxr += 2) {
      var rr = evalAt(worldX(pxr));
      var ry = rippleBaseY - (rr.re / peakMag) * (0.12 * h) * ampMod;
      if (!isFinite(ry)) ry = rippleBaseY;
      if (!started) { ctx.moveTo(pxr, ry); started = true; } else ctx.lineTo(pxr, ry);
    }
    ctx.stroke();

    // probability density polyline (ink)
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.92);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    started = false;
    for (var pxd = 0; pxd <= w; pxd += 2) {
      var rd = evalAt(worldX(pxd));
      var d = rd.dens / peakDens;
      if (d > 1) d = 1; if (d < 0) d = 0;
      var yy = axisY - d * (0.30 * h) * ampMod;
      if (!isFinite(yy)) yy = axisY;
      if (!started) { ctx.moveTo(pxd, yy); started = true; } else ctx.lineTo(pxd, yy);
    }
    ctx.stroke();
  }
});
