LAB.register({
  id: "harmonic-ladder",
  title: "Harmonic Series Ladder",
  group: "Frequency synthesis",
  essence: "The overtone stack of a single tone, each partial a rung pulsing at its own rate.",
  blurb: "The inside of a single sustained note. The fundamental and its partials are drawn as a ladder of rungs, each at a height set by its frequency and a brightness set by its amplitude, every rung pulsing at its own rate so the whole stack shimmers the way an overtone flute does. It is the spectral anatomy of a resonant instrument, shown as structure rather than as bars.",
  tags: ["line", "spectral", "frequency", "monochrome", "realtime"],
  lineage: "Helmholtz overtone series; spectral music (Grisey, Murail); overtone singing and flutes (Anna-Maria Hefele). Scientific anchor: harmonic partials f_n = n f_0 with 1/n^a amplitude rolloff.",
  dialect: "Phase Interferometer",
  palette: "monochrome ink",
  paramNotes: "Partial count and rolloff shape the spectrum and are the levers; fundamental sets the spacing; shimmer sets per-partial pulse depth. All worth sliders. No colour. Audio: each rung n is excited by band n of the live spectrum around its 1/n rolloff baseline, so a partial that sounds lights and lengthens; a.level scales the whole stack.",
  params: [
    { key: "partials", label: "Partials", min: 4, max: 32, step: 1, value: 16 },
    { key: "rolloff", label: "Rolloff", min: 0.3, max: 2.5, step: 0.1, value: 1 },
    { key: "shimmer", label: "Shimmer", min: 0, max: 1, step: 0.05, value: 0.4 },
    { key: "spread", label: "Spread", min: 0.3, max: 1, step: 0.05, value: 0.75 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var N = Math.round(LABUTIL.clamp(p.partials, 4, 32));
    var margin = Math.max(18, Math.min(w, h) * 0.07);
    var cx = w / 2;
    var usableH = h - 2 * margin;
    if (usableH < 1) usableH = 1;
    var spread = LABUTIL.clamp(p.spread, 0.3, 1);
    var rolloff = LABUTIL.clamp(p.rolloff, 0.3, 2.5);
    var shimmer = LABUTIL.clamp(p.shimmer, 0, 1);
    var logDen = Math.log(1 + N);
    if (!(logDen > 0)) logDen = 1;

    // audio: per-partial band excitation, level scales the whole stack
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = LABUTIL.clamp(a.level, 0, 1);
    var nb = a.bands.length;

    // faint vertical spine
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, margin * 0.5);
    ctx.lineTo(cx, h - margin * 0.5);
    ctx.stroke();

    ctx.lineCap = "round";
    ctx.font = "9px ui-monospace, Menlo, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    for (var n = 1; n <= N; n++) {
      // logarithmic vertical placement, fundamental near the bottom
      var f = Math.log(1 + n) / logDen;
      f = LABUTIL.clamp(f, 0, 1) * spread;
      var yy = h - margin - f * usableH;
      if (!isFinite(yy)) continue;

      var amp = Math.pow(1 / n, rolloff);
      if (!isFinite(amp)) amp = 0;
      amp = LABUTIL.clamp(amp, 0, 1);

      // band n-1 excites this partial around its rolloff baseline
      var bi = LABUTIL.clamp(n - 1, 0, nb - 1) | 0;
      var band = LABUTIL.clamp(a.bands[bi], 0, 1);
      var exc = amp * (0.5 + 1.3 * react * (0.6 * band + 0.4 * aLevel));
      exc = LABUTIL.clamp(exc, 0, 1);

      var pulse = 1 + shimmer * Math.sin(t * (1.5 + n * 0.7) + n);
      var bright = LABUTIL.clamp(exc * pulse, 0, 1);

      var halfLen = (w * 0.5 - margin) * Math.pow(exc, 0.5);
      if (!isFinite(halfLen) || halfLen < 0) halfLen = 0;
      // keep a minimal visible nub even for faint high partials
      halfLen = Math.max(halfLen, 2);

      var lw = 0.5 + 1.5 * bright;

      ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.3 + 0.7 * bright);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(cx - halfLen, yy);
      ctx.lineTo(cx + halfLen, yy);
      ctx.stroke();

      // small node markers at the rung tips for instrument feel
      var nodeR = 0.6 + 1.2 * bright;
      ctx.fillStyle = LABUTIL.rgba(theme.ink, 0.25 + 0.6 * bright);
      ctx.beginPath();
      ctx.arc(cx - halfLen, yy, nodeR, 0, LABUTIL.TAU);
      ctx.arc(cx + halfLen, yy, nodeR, 0, LABUTIL.TAU);
      ctx.fill();

      // accent only on the fundamental, sparingly
      if (n === 1) {
        ctx.strokeStyle = LABUTIL.rgba(theme.accent, 0.35);
        ctx.lineWidth = lw + 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - halfLen, yy);
        ctx.lineTo(cx + halfLen, yy);
        ctx.stroke();
      }

      // partial index in dim mono at left
      ctx.fillStyle = LABUTIL.rgba(theme.dim, 0.55 + 0.35 * bright);
      ctx.fillText(String(n), margin * 0.35, yy);
    }
  }
});
