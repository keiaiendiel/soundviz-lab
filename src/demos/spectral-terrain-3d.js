LAB.register({
  id: 'spectral-terrain-3d',
  title: 'Spectral Terrain',
  group: 'Spectral',
  essence: 'A scrolling 3D wireframe waterfall where every row is one synthetic spectrum and the back-to-front paint order does the hidden-line work.',
  blurb: "Each frame computes a fresh magnitude spectrum, pushes it onto a ring buffer of rows, and draws the whole heightfield as oblique-projected polylines from the far row forward. Ridges that march toward the viewer are persistent frequency bands; valleys are the noise floor. The painter ordering plus a fill the colour of the background gives clean hidden-line occlusion with no z-buffer.",
  tags: ['3d', 'spectral', 'line', 'monochrome', 'realtime'],
  lineage: 'Spectral waterfall / wave-terrain synthesis lineage (Curtis Roads, Microsound, 2001); the waterfall display is the canonical sonogram-in-perspective. Hidden-line by back-to-front painting is the classic Tufte/Tukey terrain trick.',
  dialect: 'Modal Coordinate Grid',
  palette: 'Monochrome. Background near-black (#0b0b0b). Ridge lines warm off-white at full opacity for the front rows, fading toward 25% for the farthest rows to read depth. Optional single warm-amber accent (#d8a24a) on the frontmost row only.',
  paramNotes: 'rows = depth of the waterfall history (more rows = taller terrain, heavier paint). bins = spectral resolution per row. scrollRate ties spectrum advance to t. peakSharpness controls how narrow the synthetic partials are. tilt is the oblique projection angle. Audio drive pushes each new ridge from a.spectrum, with a.level raising ridge height and a.centroid positioning the crest.',
  params: [
    { key: 'rows', label: 'History rows', min: 16, max: 120, step: 1, value: 48 },
    { key: 'bins', label: 'Spectral bins', min: 32, max: 256, step: 1, value: 128 },
    { key: 'scrollRate', label: 'Scroll rate', min: 0.2, max: 4, step: 0.1, value: 1 },
    { key: 'peakSharpness', label: 'Peak sharpness', min: 2, max: 40, step: 1, value: 12 },
    { key: 'tilt', label: 'Oblique tilt', min: 0.2, max: 0.9, step: 0.05, value: 0.5 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.MAXROWS = 120;
    s.MAXBINS = 256;
    // ring buffer of rows; each row is a Float32Array of MAXBINS magnitudes.
    s.rowsArr = [];
    for (var r = 0; r < s.MAXROWS; r++) s.rowsArr.push(new Float32Array(s.MAXBINS));
    s.phase = 0;       // fractional spectrum-advance accumulator
    s.last = 0;        // previous t for dt
    s.rng = LABUTIL.mulberry32(0x5fb21c3);
  },
  // build one synthetic magnitude spectrum into target[] for `bins` bins at sim-time T
  _spectrum: function (target, bins, T, peakSharpness, rng, spec, specLen, aw, level, centroid) {
    var K = 4;
    var inv = 1 / Math.max(1, bins - 1);
    var sharp2 = peakSharpness * peakSharpness;
    // partial centres and amplitudes, slowly drifting
    var fk0 = 0.16 + 0.08 * Math.sin(0.30 * T + 0);
    var fk1 = 0.34 + 0.08 * Math.sin(0.30 * T + 1);
    var fk2 = 0.55 + 0.08 * Math.sin(0.30 * T + 2);
    var fk3 = 0.78 + 0.08 * Math.sin(0.30 * T + 3);
    var A0 = 0.5 + 0.5 * Math.sin(0.17 * T * 1);
    var A1 = 0.5 + 0.5 * Math.sin(0.17 * T * 2);
    var A2 = 0.5 + 0.5 * Math.sin(0.17 * T * 3);
    var A3 = 0.5 + 0.5 * Math.sin(0.17 * T * 4);
    for (var i = 0; i < bins; i++) {
      var f = i * inv;
      var d0 = f - fk0, d1 = f - fk1, d2 = f - fk2, d3 = f - fk3;
      var syn = A0 * Math.exp(-sharp2 * d0 * d0)
            + A1 * Math.exp(-sharp2 * d1 * d1)
            + A2 * Math.exp(-sharp2 * d2 * d2)
            + A3 * Math.exp(-sharp2 * d3 * d3);
      syn += 0.04 * rng();
      // LIVE row: real spectrum downsampled to this bin, plus a crest that loudness
      // raises and the centroid positions. react = 0 restores the synthetic terrain.
      var si = Math.round(LABUTIL.clamp(f, 0, 1) * (specLen - 1));
      if (si < 0) si = 0; else if (si > specLen - 1) si = specLen - 1;
      var sv = spec ? spec[si] : 0; if (!isFinite(sv)) sv = 0;
      var dc = f - centroid;
      var crest = Math.exp(-sharp2 * dc * dc);
      // live ridge built from a.spectrum (sv) and a.centroid crest, height scaled by a.level
      var live = (sv * 0.7 + crest * 0.45) * (0.1 + 1.0 * level);
      var m = syn * (1 - 0.6 * aw / 1.5) + aw * live;
      target[i] = m < 0 ? 0 : (m > 1 ? 1 : m);
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var rows = Math.round(LABUTIL.clamp(p.rows, 16, s.MAXROWS));
    var bins = Math.round(LABUTIL.clamp(p.bins, 32, s.MAXBINS));
    var tilt = LABUTIL.clamp(p.tilt, 0.2, 0.9);
    var sharp = LABUTIL.clamp(p.peakSharpness, 2, 40);
    var scrollRate = LABUTIL.clamp(p.scrollRate, 0.2, 4);

    var react = (p.react == null ? 0.85 : p.react);
    var aw = LABUTIL.clamp(react, 0, 1.5);
    var spec = a ? a.spectrum : null;
    var specLen = (spec && spec.length) ? spec.length : 1;
    var aLevel = (a && isFinite(a.level)) ? LABUTIL.clamp(a.level, 0, 1) : 0;
    var aCentroid = (a && isFinite(a.centroid)) ? LABUTIL.clamp(a.centroid, 0, 1) : 0.5;
    var aPeak = (a && isFinite(a.peak)) ? LABUTIL.clamp(a.peak, 0, 1) : 0;
    var aBeat = (a && isFinite(a.beat)) ? LABUTIL.clamp(a.beat, 0, 1) : 0;
    // audio activity gates the waterfall: ridge advance crawls in silence, scrolls with sound
    var act = LABUTIL.clamp(Math.max(aLevel, aPeak * 0.7, aBeat) * react, 0, 1);

    // advance phase by frame dt; the advance rate is gated by audio activity so the
    // waterfall scrolls (a new ridge row per few frames) with sound and crawls in silence
    var dt = (a && isFinite(a.dt) && a.dt > 0) ? a.dt : (t - s.last);
    if (!isFinite(dt) || dt < 0) dt = 1 / 60;
    if (dt > 0.25) dt = 0.25;
    s.last = t;
    // gated synthetic-drift time so the partials hold still in silence
    s.simT = (s.simT || 0) + dt * (0.05 + 1.0 * act);
    if (!isFinite(s.simT)) s.simT = 0;
    // rows/sec ~ scrollRate*28 at full activity, a slow crawl in silence
    s.phase += scrollRate * 28 * (0.04 + 1.0 * act) * dt;
    if (!isFinite(s.phase)) s.phase = 0;
    var newRows = Math.floor(s.phase);
    if (newRows > 0) {
      if (newRows > 4) newRows = 4; // cap catch-up after a stall
      s.phase -= Math.floor(s.phase);
      for (var n = 0; n < newRows; n++) {
        // recycle the oldest row buffer to the front, building it from the live spectrum
        var recycled = s.rowsArr.pop();
        this._spectrum(recycled, s.MAXBINS, s.simT, sharp, s.rng, spec, specLen, aw, aLevel, aCentroid);
        s.rowsArr.unshift(recycled);
      }
    } else if (s.rowsArr[0][0] === 0 && s.rowsArr[0][1] === 0) {
      // first frame: prime the front row so there is something to draw
      this._spectrum(s.rowsArr[0], s.MAXBINS, s.simT, sharp, s.rng, spec, specLen, aw, aLevel, aCentroid);
    }

    // plot geometry
    var marginX = w * 0.16;
    var Wplot = w * 0.62;
    var depthDX = -tilt * 8;
    var rowDY = tilt * 6;
    var heightScale = Math.min(110, h * 0.32);
    // baseline so the whole stack sits centred: top of stack rises by (rows-1)*rowDY
    var baseY = h * 0.78;
    var stepX = Wplot / Math.max(1, bins - 1);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // scratch buffer of projected screen points for the current row, reused both passes
    if (!s.px || s.px.length < bins) { s.px = new Float64Array(s.MAXBINS); s.py = new Float64Array(s.MAXBINS); }
    var PX = s.px, PY = s.py;

    // draw back-to-front: d = rows-1 (farthest) down to 0 (nearest)
    for (var d = rows - 1; d >= 0; d--) {
      var row = s.rowsArr[d];
      var dx = d * depthDX;
      var rowTopY = baseY - d * rowDY;
      // project every bin once into the scratch buffer
      for (var i = 0; i < bins; i++) {
        PX[i] = marginX + i * stepX + dx;
        PY[i] = rowTopY - row[i] * heightScale;
      }
      var firstX = PX[0], firstY = PY[0];
      var lastX = PX[bins - 1];

      // fill-mask pass: top polyline closed down to the row baseline, painted in bg to occlude
      var fillY = rowTopY + 4;
      ctx.beginPath();
      ctx.moveTo(firstX, firstY);
      for (var m = 1; m < bins; m++) ctx.lineTo(PX[m], PY[m]);
      ctx.lineTo(lastX, fillY);
      ctx.lineTo(firstX, fillY);
      ctx.closePath();
      ctx.fillStyle = theme.bg;
      ctx.fill();

      // stroke the top polyline only
      var near = (rows - 1 - d) / Math.max(1, rows - 1);
      var a = LABUTIL.lerp(0.25, 1.0, near);
      ctx.beginPath();
      ctx.moveTo(firstX, firstY);
      for (var j = 1; j < bins; j++) {
        var qx = PX[j], qy = PY[j];
        ctx.lineTo(qx, qy);
      }
      if (d === 0) {
        ctx.strokeStyle = LABUTIL.rgba(theme.accent, 1);
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = LABUTIL.rgba(theme.ink, a);
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }
  }
});

