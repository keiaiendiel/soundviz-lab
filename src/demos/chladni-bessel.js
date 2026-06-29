LAB.register({
  id: 'chladni-bessel',
  title: 'Chladni Circular Plate',
  group: 'Cymatic and modal',
  essence: 'Bessel modes of a round plate, nodal circles and diameters in rings and spokes.',
  blurb: 'The circular sibling of the square Chladni figure. A round membrane vibrates in a single eigenmode, the displacement is a Bessel function in the radius times a cosine in the angle, so the still nodal lines fall on concentric circles and on straight diameters through the centre. Sweeping the two mode integers, the angular order m and the radial order n, morphs one rings-and-spokes figure into the next. Sand grains drift off the moving antinodes and settle on the quiet nodal lines, drawing the mode as a pale filigree on black. The clean polar counterpart to the square plate already in the cabinet.',
  tags: ['cymatic','particle','field','monochrome','slow'],
  lineage: 'Ernst Chladni 1787 plate figures; Lord Rayleigh, Theory of Sound, circular membrane eigenmodes; Hans Jenny cymatics. Scientific anchor: circular membrane eigenmodes u(r,theta)=J_m(j_mn r/a) cos(m theta), nodal radii at the lower Bessel zeros, m nodal diameters.',
  dialect: 'Faraday Cymatic Field',
  palette: 'monochrome ink',
  paramNotes: 'The two mode integers m (angular, the number of spokes) and n (radial, the number of rings) are the whole instrument, expose both as integer sliders and the morph between figures is the demo. Particle count sets density not pattern. Settle rate sets how fast grains find the nodal lines. No colour, one substance on a plate. Audio: spectral centroid lifts the angular and radial mode orders (smoothed, clamped to the slider range) so the rings-and-spokes figure reorganises with pitch, while loudness and beats set how violently the grains jump before re-settling; react scales the drive.',
  params: [
    { key: 'modeM', label: 'Angular m', min: 0, max: 6, step: 1, value: 2 },
    { key: 'modeN', label: 'Radial n', min: 1, max: 5, step: 1, value: 2 },
    { key: 'count', label: 'Particle count', min: 600, max: 6000, step: 100, value: 3200 },
    { key: 'settle', label: 'Settle rate', min: 0.01, max: 0.2, step: 0.01, value: 0.07 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    // factorials 0..30
    s.fact = new Float64Array(31);
    s.fact[0] = 1;
    for (var i = 1; i <= 30; i++) s.fact[i] = s.fact[i - 1] * i;
    s.JMN = [
      [2.405, 5.520, 8.654, 11.792, 14.931],
      [3.832, 7.016, 10.173, 13.324, 16.471],
      [5.136, 8.417, 11.620, 14.796, 17.960],
      [6.380, 9.761, 13.015, 16.223, 19.409],
      [7.588, 11.065, 14.373, 17.616, 20.827],
      [8.771, 12.339, 15.700, 19.006, 22.220],
      [9.936, 13.589, 17.004, 20.321, 23.586]
    ];
    // J_m(x) power series, 24 terms
    s.besselJ = function (m, x) {
      var sum = 0, half = x / 2;
      // (x/2)^m
      var base = Math.pow(half, m);
      var term = base; // s=0 term factor (x/2)^(2*0+m), divided by 0!(0+m)!
      var half2 = half * half;
      for (var sIdx = 0; sIdx <= 24; sIdx++) {
        var denom = s.fact[sIdx] * s.fact[sIdx + m];
        var sign = (sIdx & 1) ? -1 : 1;
        sum += sign * term / denom;
        term *= half2; // advances (x/2)^(2s+m) -> (2(s+1)+m)
      }
      return sum;
    };
    s.rng = LABUTIL.mulberry32(8675309);
    s.maxN = 6000;
    s.rho = new Float32Array(s.maxN);
    s.theta = new Float32Array(s.maxN);
    s.N = 0;
    s.field = function (m, kEff, rho, theta) {
      return s.besselJ(m, kEff * rho) * Math.cos(m * theta);
    };
    s.seedGrain = function (idx, m, kEff) {
      // rejection sample near nodal set: accept random (rho,theta) only if |field|<0.25
      var tries = 0, rho, th, f;
      do {
        rho = s.rng();
        th = s.rng() * LABUTIL.TAU;
        f = s.field(m, kEff, rho, th);
        tries++;
      } while (Math.abs(f) > 0.25 && tries < 24);
      s.rho[idx] = rho;
      s.theta[idx] = th;
    };
    s.descent = function (m, kEff, rate, jt, amp) {
      amp = (amp == null) ? 1 : amp;
      var eps = 0.004;
      for (var i = 0; i < s.N; i++) {
        var rho = s.rho[i], th = s.theta[i];
        var f = s.field(m, kEff, rho, th);
        var dfr = (s.field(m, kEff, rho + eps, th) - s.field(m, kEff, rho - eps, th)) / (2 * eps);
        var dft = (s.field(m, kEff, rho, th + eps) - s.field(m, kEff, rho, th - eps)) / (2 * eps);
        var sgn = f < 0 ? -1 : 1;
        rho -= sgn * dfr * rate * 0.03;
        th -= sgn * (dft / Math.max(0.05, rho)) * rate * 0.03;
        if (jt) {
          rho += LABUTIL.noise2(rho * 12, th * 3 + jt) * 0.0016 * amp;
          th += LABUTIL.noise2(th * 3, rho * 12 - jt) * 0.004 * amp;
        }
        if (rho < 0) { rho = -rho; th += Math.PI; }
        if (rho > 1) rho = 1;
        th = ((th % LABUTIL.TAU) + LABUTIL.TAU) % LABUTIL.TAU;
        if (!isFinite(rho)) rho = s.rng();
        if (!isFinite(th)) th = s.rng() * LABUTIL.TAU;
        s.rho[i] = rho; s.theta[i] = th;
      }
    };
    // PREWARM with default m=2,n=2
    var m0 = 2, n0 = 2;
    var kSel0 = s.JMN[m0][n0 - 1];
    var N0 = 3200;
    s.N = N0;
    for (var g = 0; g < N0; g++) s.seedGrain(g, m0, kSel0);
    for (var it = 0; it < 60; it++) s.descent(m0, kSel0, 0.07, 0);
    s.lastM = m0; s.lastN = n0; s.lastCount = N0;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    a = a || {};
    var react = (p.react == null ? 0.85 : p.react);
    var centroid = LABUTIL.clamp(a.centroid || 0, 0, 1);
    var level = LABUTIL.clamp(a.level || 0, 0, 1);
    var peak = LABUTIL.clamp(a.peak || 0, 0, 1);
    var beat = LABUTIL.clamp(a.beat || 0, 0, 1);
    // audio activity: near-zero in silence so grains settle and go still
    var act = LABUTIL.clamp(Math.max(level, peak * 0.7, beat) * react, 0, 1);
    // smooth the centroid so the mode reorganises with pitch without per-frame flicker
    s.cSmooth = (s.cSmooth == null) ? centroid : s.cSmooth + (centroid - s.cSmooth) * 0.06;
    var mShift = Math.round(react * s.cSmooth * 4);
    var nShift = Math.round(react * s.cSmooth * 2);

    var m = LABUTIL.clamp(Math.round(p.modeM) + mShift, 0, 6);
    var n = LABUTIL.clamp(Math.round(p.modeN) + nShift, 1, 5);
    var kSel = s.JMN[m][n - 1];
    var kEff = kSel * (1 + 0.012 * act * Math.sin(t * 0.5));
    var count = LABUTIL.clamp(Math.round(p.count), 600, 6000);
    var rate = LABUTIL.clamp(p.settle, 0.01, 0.2);
    // loudness + beats set how violently the grains jump; near-still in silence
    var amp = 2.6 * (0.06 + 0.94 * act);

    // grow / shrink pool; reseed near new mode if mode changed
    if (m !== s.lastM || n !== s.lastN) {
      for (var i = 0; i < count; i++) s.seedGrain(i, m, kSel);
      s.N = count;
      // a few silent descents so the new figure snaps in
      for (var it = 0; it < 20; it++) s.descent(m, kSel, rate, 0);
      s.lastM = m; s.lastN = n; s.lastCount = count;
    } else if (count !== s.N) {
      if (count > s.N) {
        for (var j = s.N; j < count; j++) s.seedGrain(j, m, kSel);
      }
      s.N = count;
      s.lastCount = count;
    }

    // 1. fade prior frame
    ctx.fillStyle = LABUTIL.rgba(theme.bg, 0.18);
    ctx.fillRect(0, 0, w, h);

    // geometry
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;

    // 5-7. one descent step + draw
    s.descent(m, kEff, rate, t, amp);
    ctx.fillStyle = LABUTIL.rgba(theme.ink, 0.85);
    for (var i = 0; i < s.N; i++) {
      var rho = s.rho[i], th = s.theta[i];
      var px = cx + Math.cos(th) * rho * R;
      var py = cy + Math.sin(th) * rho * R;
      ctx.fillRect(px, py, 1, 1);
    }

    // 8. rim circle
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, LABUTIL.TAU);
    ctx.stroke();
  }
});
