LAB.register({
  id: 'phyllotaxis-vogel',
  title: 'Phyllotaxis Spiral',
  group: 'Particle and attractor',
  essence: "Vogel's sunflower model places the n-th seed at radius c*sqrt(n) and angle n times the golden angle; about 1500 dots self-organise into interlocking parastichy spirals that morph as the divergence angle drifts.",
  blurb: 'Helmut Vogel showed in 1979 that a sunflower head needs only one rule: place each seed one golden angle further around than the last, at a radius growing as the square root of the count. No spiral is drawn, yet the Fibonacci spiral families (parastichies) appear on their own, 34 one way crossing 55 the other, because the golden angle is the most irrational rotation and packs the disc most evenly. The dots are placed by the rule and the divergence angle is animated by a fraction of a degree around 137.5; the parastichy families slide and reconnect, locking into clean spirals exactly at the golden angle and shearing into looser arms on either side. A slow breathing scale lets the whole head inhale.',
  tags: ['particle','dots','monochrome','accent','slow'],
  lineage: 'Helmut Vogel, A better way to construct the sunflower head (Mathematical Biosciences 44, 1979): r = c*sqrt(n), theta = n * golden angle. Golden angle 360*(2 - phi) = 137.50776 degrees; parastichy counts are consecutive Fibonacci numbers.',
  dialect: '-',
  palette: 'Monochrome on near-black. Seeds are small ink dots; radius modulates dot size and alpha slightly so the centre reads dense and the rim sparse, the scientific look of a seed head under raking light. The single newest (outermost) ring of seeds, and the seed at n nearest the live count, carry the one amber accent so growth has a leading edge. No second hue.',
  paramNotes: 'divergence is the angle per seed in degrees, the heart of the model: hold it at the golden angle 137.507 for the clean interlock, drift it a fraction either way and the parastichy families slide and reconnect; even 0.1 degree off visibly shears the spirals. seeds is the dot count (more seeds reveal higher Fibonacci parastichy pairs). scale is c, the radial spacing constant. drift sets how far divergence is animated around its centre, breathe sets the slow scale pulsation; both can be zeroed for a still plate. Audio: a.level sets the growth rate of the leading edge and lifts dot size, a.beat pulses every dot, and a.centroid adds a fraction-of-a-degree wobble to the divergence angle so the spirals gently shear with brightness.',
  params: [
    { key: 'divergence', label: 'Divergence angle', min: 137, max: 138, step: 0.001, value: 137.507 },
    { key: 'seeds', label: 'Seed count', min: 200, max: 2600, step: 50, value: 1500 },
    { key: 'scale', label: 'Spacing c', min: 0.4, max: 1.6, step: 0.02, value: 0.9 },
    { key: 'drift', label: 'Angle drift', min: 0, max: 0.6, step: 0.01, value: 0.18 },
    { key: 'breathe', label: 'Breathing', min: 0, max: 0.12, step: 0.005, value: 0.04 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.sqrtN = null;
    s.lastN = -1;
    s.buildSqrt = function (N) {
      s.sqrtN = new Float32Array(N);
      for (var n = 0; n < N; n++) s.sqrtN[n] = Math.sqrt(n);
      s.lastN = N;
    };
    s.buildSqrt(1500);
    s.grow = 0;
    s.lastT = null;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var react = (p.react == null ? 0.85 : p.react);
    var N = Math.max(2, Math.round(p.seeds));
    if (N !== s.lastN) s.buildSqrt(N);
    var sqrtN = s.sqrtN;

    var act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    if (s.lastT == null) s.lastT = t;
    var dt = t - s.lastT; if (!(dt > 0) || dt > 0.1) dt = 0.016; s.lastT = t;
    // drift (shear) and breathing advance with audio so the head is near-still in silence
    s.dph = (s.dph || 0) + dt * 0.15 * (0.06 + 1.4 * act);
    s.bph = (s.bph || 0) + dt * 0.4 * (0.06 + 1.4 * act);

    // tiny brightness-driven wobble on the divergence angle (fraction of a degree shears the spirals)
    var wob = react * (a.centroid - 0.5) * 0.06;
    var alphaDeg = p.divergence + p.drift * Math.sin(s.dph) + wob;
    var alpha = alphaDeg * Math.PI / 180;
    // loudness lifts dot size, beat pulses it
    var sizeMul = LABUTIL.clamp(1 + react * (0.4 * a.level + 0.8 * a.beat), 0.5, 4);
    var minWH = Math.min(w, h);
    var baseR = 0.46 * minWH / Math.max(1e-6, Math.sqrt(N - 1));
    var cEff = p.scale * baseR * (1 + p.breathe * Math.sin(s.bph));
    var cx = w / 2, cy = h / 2;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var inv = 1 / Math.max(1, N - 1);
    var rimStart = 0.97 * N;
    // moving placement seed index; audio drives the growth rate so the leading edge is near-still in silence
    var growthRate = 60 * (0.06 + 1.5 * act);
    s.grow = (s.grow || 0) + growthRate * dt;
    var moveIdx = Math.floor(((s.grow % N) + N) % N);

    // pre-set ink fill; switch only for accents to minimise state changes
    var inkA_lo = 0.40, inkA_hi = 0.92;
    var curStyle = '';
    for (var n = 0; n < N; n++) {
      var ang = n * alpha;
      var rad = cEff * sqrtN[n];
      var x = cx + rad * Math.cos(ang);
      var y = cy + rad * Math.sin(ang);
      if (!isFinite(x) || !isFinite(y)) continue;
      var frac = n * inv;
      var dotR = LABUTIL.lerp(2.1, 0.9, frac) * sizeMul;
      var isRim = n >= rimStart;
      if (isRim) {
        ctx.fillStyle = LABUTIL.rgba(theme.accent, 0.9);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.8, dotR), 0, LABUTIL.TAU);
        ctx.fill();
        curStyle = '';
      } else {
        var inkAlpha = LABUTIL.lerp(inkA_hi, inkA_lo, frac);
        var style = LABUTIL.rgba(theme.ink, inkAlpha);
        if (style !== curStyle) { ctx.fillStyle = style; curStyle = style; }
        if (dotR > 1.3) {
          ctx.beginPath();
          ctx.arc(x, y, dotR, 0, LABUTIL.TAU);
          ctx.fill();
        } else {
          ctx.fillRect(x - dotR, y - dotR, dotR * 2, dotR * 2);
        }
      }
    }
    // moving placement accent dot
    if (moveIdx >= 0 && moveIdx < N) {
      var angM = moveIdx * alpha;
      var radM = cEff * sqrtN[moveIdx];
      var xm = cx + radM * Math.cos(angM), ym = cy + radM * Math.sin(angM);
      if (isFinite(xm) && isFinite(ym)) {
        ctx.fillStyle = LABUTIL.rgba(theme.accent, 0.95);
        ctx.beginPath();
        ctx.arc(xm, ym, 2.4 * sizeMul, 0, LABUTIL.TAU);
        ctx.fill();
      }
    }
  }
});
