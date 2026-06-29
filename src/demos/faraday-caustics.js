LAB.register({
  id: 'faraday-caustics',
  title: 'Faraday Caustics',
  group: 'Cymatic and modal',
  essence: 'A vibrated liquid surface becomes a lens. Standing Faraday waves bend monochromatic light into a shifting caustic web, bright where the surface focuses rays, dark where it spreads them.',
  blurb: 'Drive a shallow dish at frequency f and above threshold the flat surface buckles into standing waves that oscillate at half the drive (subharmonic). Light passing through that rippled height field refracts and the rays cross. Where they pile up you get the bright filaments of a swimming-pool caustic; where they thin out, near darkness. The brightness is the inverse Jacobian of the ray map, the same quantity that makes caustics sharp.',
  tags: ['cymatic', 'optics', 'field', 'raster', 'monochrome', 'realtime', 'gradient'],
  lineage: 'Faraday 1831 parametric surface instability; Kudrolli and Gollub pattern selection; Yuksel and Keyser real-time caustics from height fields; Evan Wallace WebGL water caustics.',
  dialect: 'Faraday Cymatic Field',
  palette: 'Black field, warm-amber caustic web. Light is single-channel intensity, no hue. Caustic filaments near white-amber, background deep near-black, soft falloff. One restrained accent only.',
  paramNotes: 'drive sets the subharmonic temporal beat; wavenumber sets web density; depth is the lens-to-screen distance that controls caustic sharpness (high focus = thin bright lines); regime blends stripe vs hex Faraday symmetry; amplitude is surface steepness above threshold. Audio drive: loudness (level/peak) pushes the surface past the Faraday threshold (steeper waves), spectral centroid packs the caustic web denser, and a beat sloshes the standing-wave phase.',
  params: [
    { key: 'drive', label: 'Drive freq', min: 0.2, max: 4, step: 0.05, value: 1 },
    { key: 'wavenumber', label: 'Web density', min: 2, max: 22, step: 0.5, value: 9 },
    { key: 'depth', label: 'Focus depth', min: 0.05, max: 1.2, step: 0.01, value: 0.45 },
    { key: 'regime', label: 'Hex/stripe', min: 0, max: 1, step: 0.01, value: 0.6 },
    { key: 'amplitude', label: 'Surface steep', min: 0.05, max: 1, step: 0.01, value: 0.5 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.bw = 150;
    s.bh = Math.max(40, Math.min(130, Math.round(s.bw * h / Math.max(1, w))));
    try {
      s.off = new OffscreenCanvas(s.bw, s.bh);
      s.octx = s.off.getContext('2d');
      s.img = s.octx.createImageData(s.bw, s.bh);
    } catch (e) {
      s.off = null;
    }
    // Five plane-wave directions: three hex modes at 0/60/120, two stripe modes.
    // Each carries a small fixed phase so the lattice never sits on a perfect
    // node grid and the caustic web stays organic.
    s.modes = [
      { ax: 1, ay: 0, phi: 0.0 },
      { ax: 0.5, ay: 0.8660254, phi: 1.7 },
      { ax: -0.5, ay: 0.8660254, phi: 3.9 },
      { ax: 1, ay: 0, phi: 0.6 },        // stripe primary (shares dir with mode 0)
      { ax: 0, ay: 1, phi: 2.4 }         // stripe weak orthogonal
    ];
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    if (!s.modes) this.init(s, w, h);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var BW = s.bw || 150;
    var BH = s.bh || 100;
    var wantBH = Math.max(40, Math.min(130, Math.round(BW * h / Math.max(1, w))));
    if (s.off && wantBH !== BH) {
      try {
        s.off = new OffscreenCanvas(BW, wantBH);
        s.octx = s.off.getContext('2d');
        s.img = s.octx.createImageData(BW, wantBH);
        BH = s.bh = wantBH;
      } catch (e) { /* keep old */ }
    }

    var img = s.img;
    if (!img || !s.octx) {
      ctx.strokeStyle = theme.grid;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }
    var data = img.data;

    var drive = LABUTIL.clamp(p.drive, 0.2, 4);
    var k = LABUTIL.clamp(p.wavenumber, 2, 22);
    var depth = LABUTIL.clamp(p.depth, 0.05, 1.2);
    var regime = LABUTIL.clamp(p.regime, 0, 1);
    var amp = LABUTIL.clamp(p.amplitude, 0.05, 1);

    // Audio coupling. Loudness drives the surface past the Faraday threshold,
    // brightness (centroid) sets the lattice scale, a beat sloshes the phase.
    var react = (p.react == null ? 0.85 : p.react);
    var lvl = LABUTIL.clamp(a.level, 0, 1);
    var pk = LABUTIL.clamp(a.peak, 0, 1);
    var cen = LABUTIL.clamp(a.centroid, 0, 1);
    var beat = LABUTIL.clamp(a.beat, 0, 1);
    // audio activity: near-zero in silence so the caustic web freezes
    var act = LABUTIL.clamp(Math.max(lvl, pk * 0.7, beat) * react, 0, 1);
    amp = LABUTIL.clamp(amp * (0.45 + react * (0.8 * lvl + 0.5 * pk + 0.6 * beat)), 0.02, 1.8);
    k = LABUTIL.clamp(k * (0.7 + 0.6 * react * cen), 1.5, 30);
    var slosh = react * beat * 1.6;

    // Subharmonic temporal envelope: the Faraday signature, surface oscillates
    // at half the drive rate. omega = TAU*drive, sub = omega/2. The breathing is
    // integrated from a.dt and gated by audio so the web is still in silence.
    var sub = Math.PI * drive;
    var dt = (a && isFinite(a.dt)) ? a.dt : 0.016;
    s.ph = (((s.ph || 0) + dt * sub * (0.06 + act)) % LABUTIL.TAU);

    // Per-mode weights blend stripe set (modes 0,3,4) into hex set (0,1,2).
    // regime 0 = pure stripe, regime 1 = pure hex.
    var m = s.modes;
    var wHex = [1 / 3, 1 / 3, 1 / 3, 0, 0];
    var wStr = [0.55, 0, 0, 0.30, 0.15];
    var wmode = [
      LABUTIL.lerp(wStr[0], wHex[0], regime),
      LABUTIL.lerp(wStr[1], wHex[1], regime),
      LABUTIL.lerp(wStr[2], wHex[2], regime),
      LABUTIL.lerp(wStr[3], wHex[3], regime),
      LABUTIL.lerp(wStr[4], wHex[4], regime)
    ];

    // Precompute the slow temporal cosine per mode (cos(sub*t + phi)). This is
    // the standing-wave breathing; it multiplies every spatial term and its
    // derivatives, so we factor it out of the pixel loop.
    var tcos = new Array(5);
    for (var mi = 0; mi < 5; mi++) tcos[mi] = Math.cos(s.ph + m[mi].phi + slosh);

    // World spans a handful of wavelengths. Aspect-correct so the web is round.
    var aspect = BH / BW;
    var spanX = 1.0, spanY = aspect;

    var idx = 0;
    for (var py = 0; py < BH; py++) {
      var wy = ((py / (BH - 1)) * 2 - 1) * spanY;
      for (var px = 0; px < BW; px++) {
        var wx = ((px / (BW - 1)) * 2 - 1) * spanX;

        // Accumulate the Hessian of h analytically. Brightness is the inverse
        // Jacobian of the ray map s(p) = p + depth*grad(h), so we only need the
        // second derivatives, det(I + depth*H).
        var hxx = 0, hyy = 0, hxy = 0;
        for (var j = 0; j < 5; j++) {
          var W = wmode[j];
          if (W <= 0) continue;
          var ax = m[j].ax, ay = m[j].ay;
          var arg = k * (ax * wx + ay * wy) + m[j].phi;
          var c = Math.cos(arg);
          var common = amp * W * c * tcos[j];
          var kax = k * ax, kay = k * ay;
          hxx += -(kax * kax) * common;
          hyy += -(kay * kay) * common;
          hxy += -(kax * kay) * common;
        }

        // Jacobian determinant of the displacement map. Near zero where rays
        // cross => bright caustic filament.
        var a11 = 1 + depth * hxx;
        var a22 = 1 + depth * hyy;
        var a12 = depth * hxy;
        var J = a11 * a22 - a12 * a12;
        J = J < 0 ? -J : J;
        if (!isFinite(J)) J = 1e3;

        // Inverse Jacobian capped by eps, then soft-compressed so filaments
        // saturate gently and background stays near zero.
        var inten = 1 / (J + 0.05);
        inten = 1 - Math.exp(-0.6 * inten);
        if (!isFinite(inten)) inten = 0;
        inten = LABUTIL.clamp(inten, 0, 1);

        // Warm amber, single channel. Gentle gamma lifts the thin filaments.
        var g = Math.pow(inten, 0.85);
        data[idx] = (g * 255) | 0;
        data[idx + 1] = (g * 180) | 0;
        data[idx + 2] = (g * 70) | 0;
        data[idx + 3] = 255;
        idx += 4;
      }
    }

    s.octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality !== undefined) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(s.off, 0, 0, BW, BH, 0, 0, w, h);
  }
});

