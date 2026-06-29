LAB.register({
  id: 'scanned-string',
  title: 'Scanned String',
  group: 'Vibration and matter',
  essence: 'A plucked closed string is both a deforming ring and the waveform you would hear by scanning it.',
  blurb: "Scanned synthesis, where the shape of a vibrating string IS the wavetable. A ring of masses is plucked and slowly relaxes under tension and damping; the same instantaneous shape is shown twice, as the deforming ring and as the unrolled waveform read around it. It is the cleanest statement that sound is shape, descended from Max Mathews and Bill Verplank, and it rhymes with a long monochord string.",
  tags: ['line', 'strings', 'vibration', 'oscillographic', 'monochrome', 'realtime'],
  lineage: 'Max Mathews and Bill Verplank scanned synthesis (CCRMA); Karplus-Strong; the monochord. Scientific anchor: 1D wave equation on a ring with tension and damping.',
  dialect: 'Oscillographic/XY (proposed 6th)',
  palette: 'monochrome ink',
  paramNotes: 'Tension sets the wave speed and pitch of the morphing; damping sets how fast it relaxes to a circle; pluck strength and rate set the disturbance. The ring vs waveform split is fixed. Colour off. Audio: a.level scales every pluck and a.beat fires extra plucks on the rising edge, while a.high lifts the stroke brightness so brighter sound reads as a sharper line.',
  params: [
    { key: 'tension', label: 'Tension', min: 0.05, max: 0.45, step: 0.01, value: 0.3 },
    { key: 'damping', label: 'Damping', min: 0, max: 0.5, step: 0.01, value: 0.06 },
    { key: 'pluck', label: 'Pluck strength', min: 0.1, max: 1, step: 0.05, value: 0.5 },
    { key: 'pluckRate', label: 'Pluck rate', min: 0.1, max: 2, step: 0.1, value: 0.5 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    var M = 180;
    s.M = M;
    s.u = new Float32Array(M);
    s.uPrev = new Float32Array(M);
    s.uNext = new Float32Array(M);
    s.lastPluck = -1e9;
    s.rng = LABUTIL.mulberry32(20231);
    s.started = false;
    s.prevBeat = 0;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var TAU = LABUTIL.TAU;
    var M = s.M;
    var u = s.u, uPrev = s.uPrev, uNext = s.uNext;

    // wave parameters, kept inside stable bounds for the explicit ring scheme
    var tension = LABUTIL.clamp(p.tension, 0.0, 0.49);
    var damp = LABUTIL.clamp(p.damping, 0, 0.5) * 0.1;
    var pluckRate = LABUTIL.clamp(p.pluckRate, 0.05, 2);

    // audio levers: level scales pluck size, beat fires extra plucks, high = brightness
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = LABUTIL.clamp(a.level, 0, 1);
    var aBeat = LABUTIL.clamp(a.beat, 0, 1);
    var aHigh = LABUTIL.clamp(a.high, 0, 1);

    // advance several small sub-steps per frame so the morphing reads as motion,
    // not a per-displayed-frame jump, and stays deterministic in t.
    var SUB = 3;
    for (var st = 0; st < SUB; st++) {
      for (var i = 0; i < M; i++) {
        var iL = i === 0 ? M - 1 : i - 1;
        var iR = i === M - 1 ? 0 : i + 1;
        var cur = u[i];
        var acc = uPrev[i];
        if (!isFinite(cur)) cur = 0;
        if (!isFinite(acc)) acc = 0;
        var nx = (2 * cur - acc + tension * (u[iL] + u[iR] - 2 * cur)) * (1 - damp);
        if (!isFinite(nx)) nx = 0;
        nx = LABUTIL.clamp(nx, -2, 2);
        uNext[i] = nx;
      }
      // rotate buffers: uPrev <- u, u <- uNext
      var tmp = uPrev;
      uPrev = u;
      u = uNext;
      uNext = tmp;
    }
    s.u = u; s.uPrev = uPrev; s.uNext = uNext;

    // pluck: localised raised-cosine bump added into both current and previous
    // arrays so the disturbance starts at rest velocity, ~12 masses wide.
    function doPluck(height) {
      var span = 12;
      var idx = Math.floor(s.rng() * M);
      height = LABUTIL.clamp(height, 0.05, 2);
      for (var k = -span; k <= span; k++) {
        var j = ((idx + k) % M + M) % M;
        var env = 0.5 + 0.5 * Math.cos(Math.PI * k / span); // 1 at centre -> 0 at edge
        var add = height * env;
        u[j] = LABUTIL.clamp(u[j] + add, -2, 2);
        uPrev[j] = LABUTIL.clamp(uPrev[j] + add, -2, 2);
      }
    }

    // timed pluck; loudness scales the disturbance height around the slider
    if (t - s.lastPluck > 1 / pluckRate) {
      s.lastPluck = t;
      doPluck(LABUTIL.clamp(p.pluck, 0.1, 1) * (0.6 + 1.0 * react * aLevel));
    }
    // beat pluck on the rising edge, debounced so one onset = one strike
    var beatHit = (aBeat > 0.55 && s.prevBeat <= 0.55);
    s.prevBeat = aBeat;
    if (beatHit && (t - s.lastPluck) > 0.05) {
      s.lastPluck = t;
      doPluck(0.4 + 0.8 * react * aBeat);
    }

    // brighter sound = sharper, brighter line
    var bright = LABUTIL.clamp(0.62 + 0.38 * react * aHigh, 0, 1);

    // clean field
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // ---------- LEFT: the deforming ring ----------
    var cx = w * 0.32, cy = h / 2;
    var R = Math.min(w * 0.3, h * 0.4);

    // faint rest circle so the deformation reads against a baseline
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();

    ctx.beginPath();
    for (var i2 = 0; i2 <= M; i2++) {
      var idx2 = i2 % M;
      var ang = idx2 / M * TAU - Math.PI / 2;
      var disp = u[idx2];
      if (!isFinite(disp)) disp = 0;
      var rr = R * (1 + 0.5 * disp);
      if (rr < 1) rr = 1;
      var x = cx + Math.cos(ang) * rr;
      var y = cy + Math.sin(ang) * rr;
      if (i2 === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.2);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, bright);
    ctx.lineWidth = 1.0 + 0.8 * bright;
    ctx.stroke();

    // ---------- RIGHT: the unrolled waveform ----------
    var x0 = w * 0.6, x1 = w * 0.97;
    var midY = h / 2;
    var amp = h * 0.32;

    // baseline
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, midY);
    ctx.lineTo(x1, midY);
    ctx.stroke();

    ctx.beginPath();
    for (var i3 = 0; i3 < M; i3++) {
      var fx = x0 + (x1 - x0) * (i3 / (M - 1));
      var d3 = u[i3];
      if (!isFinite(d3)) d3 = 0;
      var fy = midY + LABUTIL.clamp(d3, -2, 2) * amp * 0.5;
      if (i3 === 0) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy);
    }
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.18);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, bright);
    ctx.lineWidth = 1.0 + 0.8 * bright;
    ctx.stroke();

    // the read-head marker: a dim dot tying ring angle 0 to the waveform start
    var headAng = -Math.PI / 2;
    var headR = R * (1 + 0.5 * (isFinite(u[0]) ? u[0] : 0));
    ctx.fillStyle = LABUTIL.rgba(theme.dim, 0.9);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(headAng) * headR, cy + Math.sin(headAng) * headR, 2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x0, midY + LABUTIL.clamp(isFinite(u[0]) ? u[0] : 0, -2, 2) * amp * 0.5, 2, 0, TAU);
    ctx.fill();
  }
});

