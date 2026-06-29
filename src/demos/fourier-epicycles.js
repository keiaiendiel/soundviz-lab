LAB.register({
  id: 'fourier-epicycles',
  title: 'Fourier Epicycles',
  group: 'Frequency synthesis',
  essence: 'A chain of rotating circles, one per harmonic, whose tip draws the waveform it sums to.',
  blurb: "Frequencies building an image in front of you. Each circle turns at an integer multiple of the base frequency with a radius set by that harmonic amplitude, stacked tip to tip, and the end of the chain traces the curve their sum makes, a square or saw or triangle wave emerging from spinning epicycles. It is the Fourier series as a moving machine, the clearest answer to how frequency becomes form.",
  tags: ['line', 'frequency', 'oscillographic', 'monochrome', 'realtime', 'accent'],
  lineage: 'Ptolemy epicycles; Fourier 1822; 3blue1brown epicycle drawings. Scientific anchor: Fourier series partial sums of a periodic waveform.',
  dialect: 'Oscillographic/XY (proposed 6th)',
  palette: 'monochrome + single accent',
  paramNotes: 'Harmonic count is the lever, watching the traced curve sharpen as terms increase is the whole point and deserves a slider; waveform target (square/saw/triangle) changes the coefficients; speed and persistence are worth sliders. The accent is allowed only on the traced tip path. Audio drive (react) lets a.bands set the per-harmonic radii so the chain reconstructs the live spectrum while a.level scales the whole figure.',
  params: [
    { key: 'terms', label: 'Harmonics', min: 1, max: 24, step: 1, value: 7 },
    { key: 'wave', label: 'Target (0sq 1saw 2tri)', min: 0, max: 2, step: 1, value: 0 },
    { key: 'speed', label: 'Speed', min: 0.05, max: 1, step: 0.05, value: 0.3 },
    { key: 'persist', label: 'Trace persistence', min: 0.5, max: 0.99, step: 0.01, value: 0.94 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.trace = null;
    s.tctx = null;
    s.tw = 0; s.th = 0;
    s.history = [];   // recent tip Y values for the scrolling waveform region
    s.maxHist = 240;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var TAU = LABUTIL.TAU;
    var terms = Math.max(1, Math.min(24, Math.round(p.terms)));
    var wave = Math.round(LABUTIL.clamp(p.wave, 0, 2));
    var persist = LABUTIL.clamp(p.persist, 0.5, 0.99);
    var react = (p.react == null ? 0.85 : p.react);
    var lvl = (a && isFinite(a.level)) ? LABUTIL.clamp(a.level, 0, 1) : 0;
    var aPeak = (a && isFinite(a.peak)) ? LABUTIL.clamp(a.peak, 0, 1) : 0;
    var aBeat = (a && isFinite(a.beat)) ? LABUTIL.clamp(a.beat, 0, 1) : 0;
    // audio activity gates the chain rotation: nearly stops in silence, spins with sound
    var act = LABUTIL.clamp(Math.max(lvl, aPeak * 0.7, aBeat) * react, 0, 1);

    // ---- persistent trace buffer (OffscreenCanvas the size of the canvas) ----
    var haveTrace = false;
    if (typeof OffscreenCanvas !== 'undefined') {
      if (!s.trace || s.tw !== Math.round(w) || s.th !== Math.round(h)) {
        try {
          s.trace = new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
          s.tctx = s.trace.getContext('2d');
          s.tw = Math.round(w); s.th = Math.round(h);
        } catch (e) { s.trace = null; s.tctx = null; }
      }
      if (s.trace && s.tctx) haveTrace = true;
    }

    // base field
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var R = Math.min(w, h) * 0.16 * (0.7 + 0.7 * react * lvl);
    var x0 = w * 0.30, y0 = h / 2;
    // integrate spin from a gated rate instead of the free-running clock
    s.spin = (s.spin || 0) + (a.dt || 0.016) * p.speed * TAU * (0.06 + 1.0 * act);
    if (!isFinite(s.spin)) s.spin = 0;
    var omega = s.spin;

    // ---- build the harmonic list for the chosen target waveform ----
    // each entry: [freqMult, radiusCoef, phase]
    var harm = [];
    var n = 0;
    if (wave === 0) {
      // square: odd harmonics, radius 1/k, in-phase
      for (var k = 1; harm.length < terms && k < 200; k += 2) { harm.push([k, 1 / k, 0]); }
    } else if (wave === 1) {
      // saw: all harmonics, radius 1/k, alternating sign as phase pi
      for (var k2 = 1; harm.length < terms && k2 < 200; k2++) {
        var ph = (k2 % 2 === 0) ? Math.PI : 0;
        harm.push([k2, 1 / k2, ph]);
      }
    } else {
      // triangle: odd harmonics, radius 1/k^2, alternating sign
      var idx = 0;
      for (var k3 = 1; harm.length < terms && k3 < 200; k3 += 2) {
        var ph2 = (idx % 2 === 0) ? 0 : Math.PI;
        harm.push([k3, 1 / (k3 * k3), ph2]);
        idx++;
      }
    }
    n = harm.length;

    // ---- harmonic amplitudes come from the live spectrum (a.bands) so the
    // traced curve is the sound's own Fourier reconstruction, falling back to
    // the target-wave coefficients so the shape is never lost in silence ----
    var bands = (a && a.bands) ? a.bands : null;
    var effCoef = [];
    var sumR = 0;
    for (var qi = 0; qi < n; qi++) {
      var bi = Math.round(harm[qi][0]);
      if (bi < 0) bi = 0; else if (bi > 31) bi = 31;
      var bv = bands ? bands[bi] : 0;
      if (!isFinite(bv)) bv = 0;
      bv = LABUTIL.clamp(bv, 0, 1);
      var ec = harm[qi][1] * (0.4 + react * 1.7 * bv);
      if (!isFinite(ec) || ec < 0) ec = harm[qi][1];
      effCoef.push(ec);
      sumR += ec;
    }
    var norm = sumR > 0 ? (1 / sumR) : 1;

    // ---- walk the epicycle chain, drawing faint guide circles in dim ----
    var px = x0, py = y0;
    ctx.lineWidth = 1;
    for (var c = 0; c < n; c++) {
      var rc = R * effCoef[c] * norm;
      var fm = harm[c][0];
      var phh = harm[c][2];
      // guide circle for this epicycle
      ctx.strokeStyle = LABUTIL.rgba(theme.grid, 1);
      ctx.beginPath();
      ctx.arc(px, py, rc, 0, TAU);
      ctx.stroke();
      // radius arm
      var ang = fm * omega + phh;
      var nxp = px + rc * Math.cos(ang);
      var nyp = py + rc * Math.sin(ang);
      ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.55);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nxp, nyp);
      ctx.stroke();
      px = nxp; py = nyp;
    }
    var tx = px, ty = py;
    if (!isFinite(tx)) tx = x0;
    if (!isFinite(ty)) ty = y0;

    // tip joint
    ctx.fillStyle = LABUTIL.rgba(theme.ink, 0.9);
    ctx.beginPath();
    ctx.arc(tx, ty, 2.2, 0, TAU);
    ctx.fill();

    // ---- scrolling traced waveform on the right, accent only here ----
    s.history.push(ty);
    if (s.history.length > s.maxHist) s.history.shift();

    var traceX = w * 0.6;
    var traceRight = w * 0.97;

    // connector from tip to the trace entry point
    ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(traceX, ty);
    ctx.stroke();

    // if we have a persistent buffer, fade it and stamp the new entry point,
    // then composite it; otherwise draw the in-memory history polyline.
    if (haveTrace) {
      var tctx = s.tctx;
      // fade the whole buffer toward transparency by (1-persist)
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = LABUTIL.rgba('#000000', LABUTIL.clamp(1 - persist, 0.01, 0.5));
      tctx.fillRect(0, 0, s.tw, s.th);
      tctx.globalCompositeOperation = 'source-over';
      // plot the new tip point at the trace entry column in accent
      tctx.fillStyle = LABUTIL.rgba(theme.accent, 0.95);
      tctx.beginPath();
      tctx.arc(traceX, ty, 1.4, 0, TAU);
      tctx.fill();
      // composite buffer over the field
      try { ctx.drawImage(s.trace, 0, 0); } catch (e2) { haveTrace = false; }
    }
    if (!haveTrace) {
      // fallback: redraw scrolling history as a polyline in accent
      var hN = s.history.length;
      if (hN > 1) {
        ctx.strokeStyle = LABUTIL.rgba(theme.accent, 0.85);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var i = 0; i < hN; i++) {
          var hx = traceX + (traceRight - traceX) * (i / (s.maxHist - 1));
          var hy = s.history[i];
          if (!isFinite(hy)) hy = y0;
          if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.stroke();
      }
    }

    // current write head on the trace column, accent dot
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(traceX, ty, 2.2, 0, TAU);
    ctx.fill();

    // faint left anchor mark
    ctx.fillStyle = LABUTIL.rgba(theme.dim, 0.7);
    ctx.beginPath();
    ctx.arc(x0, y0, 1.6, 0, TAU);
    ctx.fill();
  }
});

