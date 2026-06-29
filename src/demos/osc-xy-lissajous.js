LAB.register({
  id: 'osc-xy-lissajous',
  title: 'Oscilloscope XY (Lissajous)',
  group: 'Oscillographic',
  essence: "Two waveforms drive X and Y of a single beam; the closed curve is the sound's geometry.",
  blurb: "The purest direct-signal dialect. One channel is X, the other Y, and the dot traces a figure whose closure and rotation read the frequency ratio and phase between the two voices. With persistence trails it becomes a glowing wire that breathes as the ratio drifts. This is the diagnostic instrument made into an image, the lineage root that runs Pesanek through Vasulka to the XY scope artists. It looks intentional with the audio muted, which is the authorship test.",
  tags: ['oscillographic', 'line', 'monochrome', 'realtime', 'accent'],
  lineage: 'Mary Ellen Bute (oscilloscope films, 1947), Jerobeam Fenderson (oscilloscope music), Ben Laposky Oscillons; signal-as-material root Steina + Woody Vasulka 1974; anchor to lineage line Vasulka 1974. Scientific anchor: Lissajous 1857 phase figures.',
  dialect: 'Oscillographic/XY (proposed 6th)',
  palette: 'monochrome + single accent',
  paramNotes: 'Parametric control pays off on the frequency ratio (a:b) and phase drift; those are the real visual levers and a slider sweep through integer ratios is the whole show. Persistence and beam glow are worth sliders. Do not parametrise colour, the dialect dies the moment it stops being one beam on black. Audio drive morphs the figure from the slider Lissajous into the real XY phase scope of a.wave as level rises, with a.centroid slowly rotating it.',
  params: [
    { key: 'ratioA', label: 'X frequency', min: 1, max: 9, step: 1, value: 3 },
    { key: 'ratioB', label: 'Y frequency', min: 1, max: 9, step: 1, value: 2 },
    { key: 'persist', label: 'Beam persistence', min: 0.5, max: 0.99, step: 0.01, value: 0.92 },
    { key: 'drift', label: 'Phase drift', min: 0, max: 1, step: 0.01, value: 0.15 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.started = false;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var TAU = LABUTIL.TAU;
    // first frame: lay down a clean black field so trails build from it
    if (!s.started) {
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);
      s.started = true;
    }
    // fade trails (never a hard clear)
    var fade = LABUTIL.clamp(1 - p.persist, 0.01, 0.5);
    ctx.fillStyle = LABUTIL.rgba(theme.bg, fade);
    ctx.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h / 2;
    var R = 0.4 * Math.min(w, h);
    var react = (p.react == null ? 0.85 : p.react);
    var act = LABUTIL.clamp(Math.max(a.level || 0, (a.peak || 0) * 0.7, a.beat || 0) * react, 0, 1);
    // integrate our own clock: a near-static Lissajous in silence, advancing with sound
    s.clk = (s.clk || 0) + (a.dt || 0.016) * (0.06 + 1.0 * act);
    var phase = s.clk * 1.2;
    var rA = Math.max(1, Math.round(p.ratioA));
    var rB = Math.max(1, Math.round(p.ratioB));
    var N = 2000;

    var lvl = LABUTIL.clamp(a.level || 0, 0, 1);
    var cen = LABUTIL.clamp(a.centroid || 0, 0, 1);
    var wav = a.wave;
    var WN = wav && wav.length ? wav.length : 1;
    // morph from the slider Lissajous toward the real XY phase scope of a.wave
    var morph = LABUTIL.clamp(react * (0.2 + 1.2 * lvl), 0, 1);
    // a.centroid slowly rotates the whole figure
    var rot = s.clk * 0.15 * react * (0.15 + 0.85 * cen);
    var cosR = Math.cos(rot), sinR = Math.sin(rot);
    // ratioB nudges the X/Y sample offset so that slider still reads in wave mode
    var off = Math.round(64 + rB * 48);
    if (off < 1) off = 1; else if (off > WN - 1) off = WN - 1;
    var waveGain = 0.95;

    // point of the figure at parameter index i (blended slider/wave, then rotated)
    var pt = function (i) {
      var u = (i / N) * TAU;
      var sx = R * Math.sin(rA * u + phase * p.drift);
      var sy = R * Math.sin(rB * u);
      var wi = Math.round((i / N) * (WN - 1));
      if (wi < 0) wi = 0; else if (wi > WN - 1) wi = WN - 1;
      var wx = (wav ? (wav[wi] || 0) : 0) * R * waveGain;
      var wy = (wav ? (wav[(wi + off) % WN] || 0) : 0) * R * waveGain;
      var ox = sx + (wx - sx) * morph;
      var oy = sy + (wy - sy) * morph;
      return [cx + ox * cosR - oy * sinR, cy + ox * sinR + oy * cosR];
    };

    // build the closed figure
    var build = function () {
      ctx.beginPath();
      for (var i = 0; i <= N; i++) {
        var pp = pt(i);
        if (i === 0) ctx.moveTo(pp[0], pp[1]); else ctx.lineTo(pp[0], pp[1]);
      }
    };

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // beam bloom: wide, very faint
    build();
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.15);
    ctx.lineWidth = 3;
    ctx.stroke();

    // faint accent overstroke for the climax glow (single restrained accent)
    build();
    ctx.strokeStyle = LABUTIL.rgba(theme.accent, 0.18);
    ctx.lineWidth = 2;
    ctx.stroke();

    // the live beam: crisp 1.2px ink line
    build();
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.9);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // bright write head, a single dot riding the curve
    var hi = Math.round(((((s.clk * 0.35) % 1) + 1) % 1) * N);
    if (hi < 0) hi = 0; else if (hi > N) hi = N;
    var hp = pt(hi);
    ctx.beginPath();
    ctx.arc(hp[0], hp[1], 2.2, 0, TAU);
    ctx.fillStyle = theme.ink;
    ctx.fill();
  }
});
