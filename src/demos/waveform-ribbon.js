LAB.register({
  id: 'waveform-ribbon',
  title: 'Waveform Ribbon',
  group: 'Spectral',
  essence: 'A filled mirror waveform, thick at loud moments, a breathing horizontal band.',
  blurb: 'The waveform as mass rather than line. The time-domain envelope is mirrored top and bottom and filled, so loud passages swell the ribbon and silence pinches it to a thread. Slow lateral drift gives it the look of an audio-editor overview made monumental. It is deliberately the friendly, legible member of the spectral family, the one that reads from the back row of a large hall.',
  tags: ['spectral','field','gradient','monochrome','slow'],
  lineage: 'DAW waveform overview convention; Alva Noto / Raster-Noton block aesthetic. Scientific anchor: amplitude envelope (Hilbert / RMS) display.',
  dialect: 'Vector Plume',
  palette: 'monochrome + single accent',
  paramNotes: 'Envelope smoothing and thickness gain are the levers; both visibly change the gesture. A bilateral-symmetry toggle as a 0/1 slider is cheap and useful. Drift speed matters less. The single accent fill at climax is the one colour use; keep it as a slider you push once, not a continuous control. Audio drive injects a.wave per column and swells the whole band with a.level.',
  params: [
    { key: 'smooth', label: 'Envelope smoothing', min: 0.01, max: 0.4, step: 0.01, value: 0.12 },
    { key: 'thick',  label: 'Thickness gain',    min: 0.1,  max: 0.9, step: 0.05, value: 0.45 },
    { key: 'drift',  label: 'Drift speed',       min: 0,    max: 2,   step: 0.1,  value: 0.5 },
    { key: 'accent', label: 'Accent fill',       min: 0,    max: 1,   step: 0.05, value: 0 },
    { key: 'react',  label: 'Audio drive',       min: 0,    max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h){
    s.env = [];
  },
  draw(ctx, w, h, t, p, s, theme, aud){
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var cy = h / 2;
    var step = 3;
    var n = Math.max(2, Math.floor(w / step) + 2);

    var react = (p.react == null ? 0.85 : p.react);
    var lvl = LABUTIL.clamp(aud.level || 0, 0, 1);
    var act = LABUTIL.clamp(Math.max(aud.level || 0, (aud.peak || 0) * 0.7, aud.beat || 0) * react, 0, 1);
    // own clock: the band holds still in silence, breathes only with sound
    s.clk = (s.clk || 0) + (aud.dt || 0.016) * (0.07 + 1.0 * act);
    var wav = aud.wave;
    var wn = wav && wav.length ? wav.length : 1;

    // smoothing coefficient: small p.smooth -> heavy smoothing, large -> responsive
    var a = LABUTIL.clamp(p.smooth * 2.5, 0.02, 1);

    // build the (half) envelope along x with a single-pass recursive smoother
    if (!s.env || s.env.length !== n) s.env = new Array(n).fill(0.3);
    var prev = s.env[0];
    for (var i = 0; i < n; i++){
      var x = i * step;
      var ph = x * 0.006 + s.clk * p.drift;
      // fbm gesture scaled by activity and frozen in time when silent, so the band stays calm and near-flat
      var fb = Math.abs(LABUTIL.fbm(ph, s.clk * 0.2, 4));
      var raw = 0.16 + (0.18 + 0.9 * fb) * act;
      // slow swell only when there is sound
      raw *= 0.85 + 0.15 * act * (0.5 + 0.5 * Math.sin(s.clk * 0.35 + x * 0.0015));
      // inject the live waveform per column on top of the breathing baseline
      var wi = Math.round((i / (n - 1)) * (wn - 1));
      if (wi < 0) wi = 0; else if (wi > wn - 1) wi = wn - 1;
      var wmag = wav ? Math.abs(wav[wi] || 0) : 0;
      raw = raw * (0.45 + 0.25 * react) + wmag * 2.0 * react;
      var sm = prev + (raw - prev) * a;
      prev = sm;
      s.env[i] = sm;
    }

    // map envelope to half-height, capped so it never leaves the canvas
    var maxHalf = h * 0.5 - 4;
    var gainLvl = 0.7 + 0.7 * react * lvl;   // loud passages swell the whole band
    function halfAt(i){
      var e = LABUTIL.clamp(s.env[i], 0, 2.5);
      return LABUTIL.clamp(e * p.thick * h * 0.5 * gainLvl, 1.5, maxHalf);
    }

    // trace the closed ribbon: top edge L->R, bottom edge R->L
    ctx.beginPath();
    for (var j = 0; j < n; j++){
      var xx = j * step;
      ctx.lineTo(xx, cy - halfAt(j));
    }
    for (var k = n - 1; k >= 0; k--){
      var xb = k * step;
      ctx.lineTo(xb, cy + halfAt(k));
    }
    ctx.closePath();

    // vertical gradient gives the band physical volume, monochrome
    var grad = ctx.createLinearGradient(0, cy - maxHalf, 0, cy + maxHalf);
    var acc = LABUTIL.clamp(p.accent, 0, 1);
    var edge = LABUTIL.rgba(theme.ink, 0.55);
    var core = acc > 0.001
      ? LABUTIL.rgba(theme.accent, 0.55 + 0.35 * acc)
      : LABUTIL.rgba(theme.ink, 0.92);
    grad.addColorStop(0.0, edge);
    grad.addColorStop(0.5, core);
    grad.addColorStop(1.0, edge);
    ctx.fillStyle = grad;
    ctx.fill();

    // crisp 1px outline keeps the editor-overview legibility
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.9);
    ctx.stroke();

    // centre seam line, the zero-crossing axis of a waveform overview
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 1);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
});
