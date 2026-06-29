LAB.register({
  id: 'modal-plate',
  title: 'Modal Wireframe Plate',
  group: 'Cymatic and modal',
  essence: 'A 3D wire membrane flexing in its standing-wave eigenmodes, vibrometer style.',
  blurb: "The instrument body X-rayed. A rectangular wire mesh is displaced in Z by a sum of plate eigenmodes and projected to 2D by hand, so the membrane heaves and twists exactly as a scanning vibrometer would show it. Monochrome, diagrammatic, it makes the invisible structural vibration of sculptural instruments legible. This is Dialect 4 rendered cleanly, the bridge from cymatics to the 3D register.",
  tags: ['3d', 'line', 'field', 'monochrome', 'realtime'],
  lineage: 'Scanning Laser Doppler Vibrometry (Polytec, DLR); Kimchi and Chips Light Barrier optical-perception register; Federico Diaz TransFormace Pesanek-Diaz reconstruction. Scientific anchor: membrane/plate modal analysis, eigenmode superposition.',
  dialect: 'Modal Coordinate Grid',
  palette: 'monochrome ink',
  paramNotes: 'The mix of two competing eigenmodes (a slider that crossfades mode A to mode B) is the real lever and shows the morph a vibrometer captures. Camera tilt and grid density are worth sliders. Displacement gain matters. Colour-coded modal gradient is explicitly forced off here per the monochrome rule, so do not expose it. Audio: the spectrum bands excite extra higher eigenmodes on top of the slider mix (low band -> low mode, high band -> high mode), and loudness with beats drives the displacement amplitude; react scales the drive.',
  params: [
    { key: 'modeMix', label: 'Mode A to B', min: 0, max: 1, step: 0.02, value: 0.4 },
    { key: 'gain', label: 'Displacement', min: 0.05, max: 0.5, step: 0.02, value: 0.2 },
    { key: 'grid', label: 'Grid density', min: 8, max: 40, step: 2, value: 24 },
    { key: 'tilt', label: 'Camera tilt', min: 0.2, max: 0.9, step: 0.05, value: 0.55 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a) {
    a = a || {};
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var N = Math.max(8, Math.round(p.grid));
    var gain = p.gain;
    var tilt = p.tilt;
    var mix = LABUTIL.clamp(p.modeMix, 0, 1);
    var cx = w * 0.5, cy = h * 0.5;
    var TAU = LABUTIL.TAU;

    // Audio drive: spectrum bands excite extra eigenmodes, loudness sets amplitude.
    var react = (p.react == null ? 0.85 : p.react);
    var level = LABUTIL.clamp(a.level || 0, 0, 1);
    var peak = LABUTIL.clamp(a.peak || 0, 0, 1);
    var beat = LABUTIL.clamp(a.beat || 0, 0, 1);
    // audio activity: near-zero in silence so the plate lies near-flat and still
    var act = LABUTIL.clamp(Math.max(level, peak * 0.7, beat) * react, 0, 1);
    var bands = a.bands;
    function bandAt(i) {
      var v = (bands && bands.length > i) ? bands[i] : 0;
      return isFinite(v) ? LABUTIL.clamp(v, 0, 1) : 0;
    }
    var amp1 = bandAt(2);   // low band  -> low extra mode (1,1)
    var amp2 = bandAt(9);   // mid band  -> mode (3,2)
    var amp3 = bandAt(20);  // high band -> high mode (5,4)
    // amplitude envelope: near-flat in silence, sound drives the heave
    var ampScale = 0.06 + 1.65 * act;

    // Two competing plate eigenmodes, slowly phased so the morph reads as live.
    var phaseA = Math.cos(t * 3);
    var phaseB = Math.cos(t * 3 + 1.7);
    var phaseC = Math.cos(t * 3 + 3.1);

    // Build projected vertex grid. (N+1)^2 <= 41^2 ~ 1681 vertices.
    var cols = N + 1;
    var X = s._X && s._X.length === cols * cols ? s._X : (s._X = new Float32Array(cols * cols));
    var Y = s._Y && s._Y.length === cols * cols ? s._Y : (s._Y = new Float32Array(cols * cols));
    var Z = s._Z && s._Z.length === cols * cols ? s._Z : (s._Z = new Float32Array(cols * cols));

    var spanX = w * 0.7, spanY = h * 0.5 * tilt, lift = h * 0.4;
    var PI = Math.PI;
    var idx = 0;
    for (var j = 0; j <= N; j++) {
      var gy = j / N;
      var sgyA = Math.sin(2 * PI * gy);
      var sgyB = Math.sin(1 * PI * gy);
      var sy1 = Math.sin(1 * PI * gy);
      var sy2 = Math.sin(2 * PI * gy);
      var sy4 = Math.sin(4 * PI * gy);
      for (var i = 0; i <= N; i++, idx++) {
        var gx = i / N;
        var zA = Math.sin(2 * PI * gx) * sgyA;
        var zB = Math.sin(3 * PI * gx) * sgyB;
        var zBase = (1 - mix) * zA * phaseA + mix * zB * phaseB;
        // band-excited higher eigenmodes, additive on top of the slider mix
        var zAudio = amp1 * Math.sin(1 * PI * gx) * sy1 * phaseA
                   + amp2 * Math.sin(3 * PI * gx) * sy2 * phaseB
                   + amp3 * Math.sin(5 * PI * gx) * sy4 * phaseC;
        var z = (zBase + react * 0.6 * zAudio) * gain * ampScale;
        X[idx] = cx + (gx - 0.5) * spanX;
        Y[idx] = cy + (gy - 0.5) * spanY - z * lift;
        Z[idx] = z;
      }
    }

    // Draw back rows first (high gy projects lower; far = small j here since
    // far rows sit higher on screen). We render from j=0 (top/far) downward.
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    var invDen = 1 / (2 * Math.max(gain, 1e-4));
    for (var jj = 0; jj < N; jj++) {
      var row = jj * cols;
      var rowDown = (jj + 1) * cols;
      for (var ii = 0; ii < N; ii++) {
        var a = row + ii;
        var zAvg = (Z[a] + Z[a + 1] + Z[rowDown + ii]) / 3;
        var alpha = LABUTIL.clamp(0.4 + 0.6 * (zAvg + gain) * invDen, 0.08, 1);
        ctx.strokeStyle = LABUTIL.rgba(theme.ink, alpha);
        ctx.beginPath();
        // to right neighbour
        ctx.moveTo(X[a], Y[a]);
        ctx.lineTo(X[a + 1], Y[a + 1]);
        // to down neighbour
        ctx.moveTo(X[a], Y[a]);
        ctx.lineTo(X[rowDown + ii], Y[rowDown + ii]);
        ctx.stroke();
      }
      // close the right edge column segment for this row
      var e = row + N;
      ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.3);
      ctx.beginPath();
      ctx.moveTo(X[e], Y[e]);
      ctx.lineTo(X[rowDown + N], Y[rowDown + N]);
      ctx.stroke();
    }
    // close the bottom edge row
    var last = N * cols;
    ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.3);
    ctx.beginPath();
    for (var bi = 0; bi < N; bi++) {
      ctx.moveTo(X[last + bi], Y[last + bi]);
      ctx.lineTo(X[last + bi + 1], Y[last + bi + 1]);
    }
    ctx.stroke();
  }
});
