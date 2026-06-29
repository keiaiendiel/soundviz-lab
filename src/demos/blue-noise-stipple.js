LAB.register({
  id: 'blue-noise-stipple',
  title: 'Blue-Noise Stipple',
  group: 'Raster, glyph, text',
  essence: 'Poisson-disk blue-noise dots whose local density tracks an intensity field by thresholding a void-and-cluster texture.',
  blurb: 'Dots that never clump and never line up, placed so denser fields draw darker. A precomputed void-and-cluster blue-noise texture thresholded by a moving field gives importance sampling for free. Ulichney 1993, Secord 2002.',
  tags: ['dots','raster','texture','field','monochrome','realtime'],
  lineage: 'Robert Ulichney void-and-cluster (SPIE 1993), Adrian Secord Weighted Voronoi Stippling (NPAR 2002), Poisson-disk / blue-noise importance sampling',
  dialect: '-',
  palette: 'Monochrome dots on black: white, or warm amber for the accent variant. Dot density carries all tone; no grays, no fills between dots.',
  paramNotes: 'dotSize sets stipple radius. coverage sets overall fill (global threshold offset). fieldFreq and driftSpeed shape and move the intensity field that density tracks. contrast sharpens how strongly density follows the field. Audio: a.level raises overall stipple coverage and a.bands act as a per-row brightness source, so energetic frequency bands thicken into denser horizontal stripes (a spectrogram read in dots).',
  params: [
    { key: 'dotSize', label: 'Dot radius (px)', min: 0.75, max: 3, step: 0.25, value: 1.25 },
    { key: 'coverage', label: 'Overall coverage', min: 0.05, max: 0.6, step: 0.01, value: 0.28 },
    { key: 'fieldFreq', label: 'Field frequency', min: 0.5, max: 5, step: 0.25, value: 1.5 },
    { key: 'driftSpeed', label: 'Field drift speed', min: 0, max: 1.5, step: 0.05, value: 0.3 },
    { key: 'contrast', label: 'Density contrast', min: 0.5, max: 3, step: 0.1, value: 1.4 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    // ----- precompute a tileable blue-noise threshold texture via void-and-cluster -----
    var T = 64;                       // tile size
    var N = T * T;
    s.T = T;
    var b = new Uint8Array(N);        // binary pattern
    var energy = new Float32Array(N); // running energy field (incremental)
    var rank = new Int32Array(N);
    for (var i = 0; i < N; i++) rank[i] = -1;

    var rng = LABUTIL.mulberry32(987654321);
    var sigma = 1.9;
    var inv2s2 = 1 / (2 * sigma * sigma);
    var rad = 6;                      // splat radius ~ 3 sigma

    // precompute the Gaussian splat kernel with toroidal-safe offsets
    var kernel = [];
    for (var ky = -rad; ky <= rad; ky++) {
      for (var kx = -rad; kx <= rad; kx++) {
        var d2 = kx * kx + ky * ky;
        if (d2 > rad * rad) continue;
        kernel.push([kx, ky, Math.exp(-d2 * inv2s2)]);
      }
    }
    var KLEN = kernel.length;

    function splat(p, sign) {
      var px = p % T, py = (p / T) | 0;
      for (var k = 0; k < KLEN; k++) {
        var ke = kernel[k];
        var x = px + ke[0]; if (x < 0) x += T; else if (x >= T) x -= T;
        var y = py + ke[1]; if (y < 0) y += T; else if (y >= T) y -= T;
        energy[y * T + x] += sign * ke[2];
      }
    }

    // seed ~10% ones
    var ones = 0, want = Math.max(1, Math.round(N * 0.1));
    var guard = 0;
    while (ones < want && guard < N * 20) {
      guard++;
      var idx = (rng() * N) | 0;
      if (idx >= N) idx = N - 1;
      if (!b[idx]) { b[idx] = 1; splat(idx, 1); ones++; }
    }

    function tightestCluster() {        // set pixel with highest energy
      var best = -1, bv = -Infinity;
      for (var q = 0; q < N; q++) { if (b[q] && energy[q] > bv) { bv = energy[q]; best = q; } }
      return best;
    }
    function largestVoid() {            // unset pixel with lowest energy
      var best = -1, bv = Infinity;
      for (var q = 0; q < N; q++) { if (!b[q] && energy[q] < bv) { bv = energy[q]; best = q; } }
      return best;
    }

    // snapshot the initial binary pattern for restoration
    var initial = b.slice(0);

    // ---- Phase 1: make the initial pattern progressive (rank downward) ----
    var remaining = ones;
    var ph1guard = 0;
    while (remaining > 0 && ph1guard < N) {
      ph1guard++;
      var tc = tightestCluster();
      if (tc < 0) break;
      b[tc] = 0; splat(tc, -1);
      remaining--;
      rank[tc] = remaining;           // rank = ones remaining after removal
    }

    // ---- restore the initial pattern ----
    for (var r = 0; r < N; r++) energy[r] = 0;
    b.set(initial);
    var cnt = 0;
    for (var rr = 0; rr < N; rr++) { if (b[rr]) { splat(rr, 1); cnt++; } }

    // ---- Phase 2: fill voids up to 50%, ranking upward ----
    var half = (N / 2) | 0;
    var ph2guard = 0;
    while (cnt < half && ph2guard < N) {
      ph2guard++;
      var lv = largestVoid();
      if (lv < 0) break;
      rank[lv] = cnt;                 // rank = ones count before adding
      b[lv] = 1; splat(lv, 1);
      cnt++;
    }

    // ---- Phase 3: rank the remaining 50% by largest cluster of zeros ----
    // Treat zeros as the minority: invert the energy interpretation by finding,
    // among the still-zero pixels, the one whose REMOVAL relieves the tightest void,
    // i.e. the zero pixel with highest energy (most surrounded), set it, rank upward.
    var ph3guard = 0;
    while (cnt < N && ph3guard < N) {
      ph3guard++;
      // zero pixel with highest energy = tightest remaining cluster of zeros' complement
      var best = -1, bv = -Infinity;
      for (var z = 0; z < N; z++) { if (!b[z] && energy[z] > bv) { bv = energy[z]; best = z; } }
      if (best < 0) break;
      rank[best] = cnt;
      b[best] = 1; splat(best, 1);
      cnt++;
    }

    // ---- ranks -> flat-histogram thresholds in [0,1) ----
    var BN = new Float32Array(N);
    for (var f = 0; f < N; f++) {
      var rk = rank[f];
      if (rk < 0) rk = 0;
      BN[f] = (rk + 0.5) / N;
    }
    s.BN = BN;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var clamp = LABUTIL.clamp;
    var TAU = LABUTIL.TAU;
    var BN = s.BN, T = s.T;
    var react = (p.react == null ? 0.85 : p.react);

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    if (!BN) return;

    var dotSize = clamp(p.dotSize, 0.75, 3);
    var coverage = clamp(p.coverage, 0.05, 0.6);
    var ff = clamp(p.fieldFreq, 0.5, 5);
    var ds = p.driftSpeed;
    var contrast = clamp(p.contrast, 0.5, 3);
    var act = clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    if (s.lastT == null) s.lastT = t;
    var dt = t - s.lastT; if (!(dt > 0) || dt > 0.1) dt = 0.016; s.lastT = t;
    // field drift advances with audio so the stipple field is near-still in silence
    s.ph = (s.ph || 0) + dt * ds * (0.06 + 1.4 * act);
    // loudness lifts overall coverage; bands feed a per-row brightness source
    var covEff = clamp(coverage * (0.55 + 1.1 * react * a.level), 0.02, 0.95);
    var bands = a.bands;

    // stipple grid spacing: tie to dot size, but keep the per-frame loop bounded
    var spacing = Math.max(2, Math.round(2 + (3 - dotSize)));
    var nx = Math.ceil(w / spacing), ny = Math.ceil(h / spacing);
    var MAX = 26000;
    while (nx * ny > MAX) { spacing++; nx = Math.ceil(w / spacing); ny = Math.ceil(h / spacing); }

    ctx.fillStyle = theme.ink;
    ctx.beginPath();
    for (var j = 0; j < ny; j++) {
      var py = (j + 0.5) * spacing;
      var fy = py / h;
      var ty = ((Math.round(py) % T) + T) % T;
      // band for this row: top = high freq, bottom = low freq
      var bi = (clamp(1 - fy, 0, 1) * 31) | 0; if (bi > 31) bi = 31;
      var bandV = bands ? bands[bi] : 0; if (!(bandV >= 0)) bandV = 0;
      for (var i = 0; i < nx; i++) {
        var px = (i + 0.5) * spacing;
        var fx = px / w;
        // moving intensity field in [0,1]
        var I = 0.5 + 0.5 * Math.sin(TAU * ff * fx + s.ph) * Math.sin(TAU * ff * fy - s.ph * 0.6);
        I = clamp(0.5 + (I - 0.5) * contrast, 0, 1);
        // band energy pushes the intensity up for that row (brightness source)
        I = clamp(I + react * (bandV - 0.25) * 1.1, 0, 1);
        // importance: target density proportional to intensity
        var d = covEff * I;
        // blue-noise threshold at this position, tiling the texture
        var tx = ((Math.round(px) % T) + T) % T;
        var thr = BN[ty * T + tx];
        if (thr < d) {
          ctx.moveTo(px + dotSize, py);
          ctx.arc(px, py, dotSize, 0, TAU);
        }
      }
    }
    ctx.fill();
  }
});

