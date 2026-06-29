LAB.register({
  id: 'osc-waveform-scan',
  title: 'Vector Waveform Line-Scan',
  group: 'Oscillographic',
  essence: 'A left-to-right beam draws the time-domain waveform as a single luminous line.',
  blurb: "The horizontal oscilloscope trace. A synthetic waveform, sum of a few sines plus noise, is drawn as one polyline sweeping the full width, with a bright leading dot where the beam currently writes. It is the most literal sound-as-line image and the honest baseline of the oscillographic family. Vasulka pushed exactly this signal into video; here it stays a clean diagnostic line on black, latency authentic, no snapping.",
  tags: ['oscillographic', 'line', 'monochrome', 'realtime'],
  lineage: 'Steina + Woody Vasulka Violin Power and C-Trend 1974 (Rutt/Etra voltage-to-line); Carsten Nicolai test-pattern register; anchor Vasulka 1974. Scientific anchor: cathode-ray oscilloscope time-base sweep.',
  dialect: 'Oscillographic/XY (proposed 6th)',
  palette: 'monochrome ink',
  paramNotes: 'The harmonic content slider and the amplitude slider are the real levers and read instantly. The sweep-speed slider only matters at the extremes; mid-range changes are invisible, so a coarse step is fine. Trail length is worth a slider for the climax. Do not add colour gradients along the line, it reads as a music-app visualiser the instant you do. Audio drive blends the live waveform (a.wave) into the trace as loudness rises and pulses the write-head on a.beat.',
  params: [
    { key: 'harmonics', label: 'Harmonics', min: 1, max: 8, step: 1, value: 4 },
    { key: 'amp', label: 'Amplitude', min: 0.05, max: 0.45, step: 0.01, value: 0.25 },
    { key: 'speed', label: 'Sweep speed', min: 0.2, max: 3, step: 0.1, value: 1 },
    { key: 'trail', label: 'Trail', min: 0, max: 0.95, step: 0.05, value: 0.4 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.started = false;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    if (!s.started) {
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);
      s.started = true;
    }
    // fade: even at trail 0 keep a strong fade so the frame reads fresh
    var fade = LABUTIL.clamp(1 - p.trail * 0.9, 0.06, 1);
    ctx.fillStyle = LABUTIL.rgba(theme.bg, fade);
    ctx.fillRect(0, 0, w, h);

    var cy = h / 2;
    var TAU = LABUTIL.TAU;
    var harm = Math.max(1, Math.round(p.harmonics));
    var react = (p.react == null ? 0.85 : p.react);
    var act = LABUTIL.clamp(Math.max(a.level || 0, (a.peak || 0) * 0.7, a.beat || 0) * react, 0, 1);
    // integrate our own sweep clock so the trace nearly stops in silence and animates with sound
    s.clk = (s.clk || 0) + (a.dt || 0.016) * (0.07 + 1.0 * act);
    var clk = s.clk;
    var lvl = LABUTIL.clamp(a.level || 0, 0, 1);
    var wav = a.wave;
    var wn = wav && wav.length ? wav.length : 1;
    // blend from the synthetic harmonic baseline (alive in silence, sliders work)
    // toward the real injected waveform as loudness rises
    var mix = LABUTIL.clamp(react * (0.25 + 1.1 * lvl), 0, 1);

    // waveform value at a given x (CSS px)
    var waveY = function (x) {
      var fx = x / w;
      var phase = fx * TAU * 4 + clk * p.speed;
      var sv = 0, norm = 0;
      for (var k = 1; k <= harm; k++) {
        sv += Math.sin(phase * k + clk * 0.7 * k) / k;
        norm += 1 / k;
      }
      sv = sv / (norm || 1); // keep amplitude bounded regardless of harmonic count
      sv += LABUTIL.noise2(x * 0.01, clk) * 0.3;
      // sample the live time-domain waveform across the full width
      var idx = Math.round(fx * (wn - 1));
      if (idx < 0) idx = 0; else if (idx > wn - 1) idx = wn - 1;
      var wv = wav ? (wav[idx] || 0) : 0;
      var v = sv + (wv * 1.15 - sv) * mix;
      var y = cy + v * p.amp * h;
      return LABUTIL.clamp(y, -h, 2 * h);
    };

    var step = 2;
    ctx.beginPath();
    for (var x = 0; x <= w; x += step) {
      var y = waveY(x);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // faint bloom under the trace
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.12);
    ctx.lineWidth = 3;
    ctx.stroke();
    // crisp line
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.85);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // live write head
    var xb = ((clk * p.speed * 0.2) % 1);
    if (xb < 0) xb += 1;
    xb *= w;
    var yb = waveY(xb);
    var headR = LABUTIL.clamp(3 + 5 * react * (a.beat || 0), 2, 14);
    ctx.beginPath();
    ctx.arc(xb, yb, headR, 0, TAU);
    ctx.fillStyle = theme.ink;
    ctx.fill();
    // a faint vertical time-base tick at the head, very dim
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xb, 0);
    ctx.lineTo(xb, h);
    ctx.stroke();
  }
});
