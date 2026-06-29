LAB.register({
  id: 'ferrofluid-spikes',
  title: 'Ferrofluid Spikes',
  group: 'Texture and feedback',
  essence: 'The Rosensweig normal-field instability: above a critical magnetic field a flat ferrofluid surface breaks into a hexagonal lattice of spikes whose amplitude grows with field past threshold, rendered as a shaded 2.5D height field.',
  blurb: 'Put a ferrofluid in a vertical magnetic field. Below a critical field strength the surface stays flat, held by gravity and surface tension. Above it the flat state loses, and a regular hexagonal array of peaks erupts at the capillary wavelength. The spike amplitude rises roughly as the square root of how far the field exceeds threshold. We render that exact lattice as a side-lit height field, the corrugated mercury-black skin of a ferrofluid sculpture.',
  tags: ['texture', '3d', 'field', 'monochrome', 'feedback', 'raster'],
  lineage: 'Cowley and Rosensweig 1967 normal-field instability; capillary-wavelength spike spacing; amplitude equation for Rosensweig instability (Bohlius, Pleiner).',
  dialect: 'Modal Coordinate Grid',
  palette: 'Near-black specular ferrofluid, warm-amber specular highlights on spike flanks. Single accent, the metallic sheen carried by amber intensity only, deep shadow between spikes.',
  paramNotes: 'field is the magnetic drive (below threshold = flat, above = spikes emerge, amplitude ~ sqrt(field-threshold)); threshold is the critical field for onset; spacing sets the hex capillary wavelength; lightangle rotates the side light over the corrugation; sharpness narrows the peaks toward the cusped real spike shape. Audio drive: loudness and bass push the effective field past the Rosensweig onset so spikes erupt (bass also packs the lattice denser), treble sharpens the cusps, and a beat spawns a burst.',
  params: [
    { key: 'field', label: 'Magnetic field', min: 0, max: 2, step: 0.01, value: 1 },
    { key: 'threshold', label: 'Critical field', min: 0.1, max: 1.2, step: 0.01, value: 0.5 },
    { key: 'spacing', label: 'Hex spacing', min: 3, max: 20, step: 0.5, value: 8 },
    { key: 'lightangle', label: 'Light angle', min: 0, max: 6.283, step: 0.05, value: 2.2 },
    { key: 'sharpness', label: 'Spike sharpness', min: 1, max: 6, step: 0.1, value: 2.6 },
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
    // Three hex wave vectors at 0/60/120 deg build the hexagonal lattice.
    s.q = [
      [1, 0],
      [0.5, 0.8660254],
      [-0.5, 0.8660254]
    ];
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    if (!s.q) this.init(s, w, h);
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

    var field = LABUTIL.clamp(p.field, 0, 2);
    var threshold = LABUTIL.clamp(p.threshold, 0.1, 1.2);
    var spacing = LABUTIL.clamp(p.spacing, 3, 20);
    var lightangle = p.lightangle;
    if (!isFinite(lightangle)) lightangle = 2.2;
    var sharpness = LABUTIL.clamp(p.sharpness, 1, 6);

    // Audio coupling. Loudness and bass raise the effective field past onset so
    // spikes erupt, a beat spawns a burst, treble sharpens the cusps.
    var react = (p.react == null ? 0.85 : p.react);
    var lvl = LABUTIL.clamp(a.level, 0, 1);
    var pk = LABUTIL.clamp(a.peak, 0, 1);
    var bass = LABUTIL.clamp(a.bass, 0, 1);
    var high = LABUTIL.clamp(a.high, 0, 1);
    var beat = LABUTIL.clamp(a.beat, 0, 1);
    // audio activity: near-zero in silence so the spike lattice freezes (still)
    var act = LABUTIL.clamp(Math.max(lvl, pk * 0.7, beat) * react, 0, 1);
    var fieldEff = field + react * (0.6 * lvl + 0.7 * bass + 0.9 * beat);
    sharpness = LABUTIL.clamp(sharpness * (0.8 + react * 0.7 * high), 1, 8);

    // Rosensweig amplitude: flat below onset, sqrt of supercriticality above.
    var superc = (fieldEff - threshold) / threshold;
    if (superc < 0) superc = 0;
    var A = Math.sqrt(superc);
    if (!isFinite(A)) A = 0;

    var k = spacing;
    // Bass packs the hex lattice denser (shorter capillary wavelength).
    k = LABUTIL.clamp(k * (0.85 + react * 0.4 * bass), 2, 28);
    var q = s.q;
    // Slow phase drift on one mode gives a living-fluid shimmer, integrated from
    // a.dt and gated by audio so the lattice is still in silence.
    var dt = (a && isFinite(a.dt)) ? a.dt : 0.016;
    s.ph = (((s.ph || 0) + dt * 0.05 * (0.08 + act)) % LABUTIL.TAU);
    var drift = s.ph;

    // Light vector, low side light to rake the spikes. View is straight down (+z).
    var lx = Math.cos(lightangle), ly = Math.sin(lightangle), lz = 0.6;
    var lLen = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
    lx /= lLen; ly /= lLen; lz /= lLen;
    // Halfway vector between light and view (0,0,1) for Blinn-Phong specular.
    var hx = lx, hy = ly, hz = lz + 1;
    var hLen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
    hx /= hLen; hy /= hLen; hz /= hLen;

    // Height field as an inline closure over world coords; sharpness cusps the
    // peaks toward the real pointed spike shape.
    function height(wx, wy) {
      var base = Math.cos(k * (q[0][0] * wx + q[0][1] * wy) + drift)
        + Math.cos(k * (q[1][0] * wx + q[1][1] * wy))
        + Math.cos(k * (q[2][0] * wx + q[2][1] * wy));
      var hex = (base + 1.5) / 4.5;          // -> [0,1], 1 at lattice nodes
      if (hex < 0) hex = 0; else if (hex > 1) hex = 1;
      return A * Math.pow(hex, sharpness);
    }

    var aspect = BH / BW;
    // World extent: a few wavelengths across. Larger k -> finer spikes.
    var spanX = 3.0, spanY = 3.0 * aspect;
    var dwx = (2 * spanX) / (BW - 1);
    var dwy = (2 * spanY) / (BH - 1);
    // Finite-difference step in world units, one buffer pixel.
    var eps = dwx;

    var idx = 0;
    for (var py = 0; py < BH; py++) {
      var wy = -spanY + py * dwy;
      for (var px = 0; px < BW; px++) {
        var wx = -spanX + px * dwx;

        var h0 = height(wx, wy);
        var gx = (height(wx + eps, wy) - h0) / eps;
        var gy = (height(wx, wy + eps) - h0) / eps;

        // Surface normal N = normalize((-gx, -gy, 1)).
        var nx = -gx, ny = -gy, nz = 1;
        var nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nLen; ny /= nLen; nz /= nLen;

        var diffuse = nx * lx + ny * ly + nz * lz;
        if (diffuse < 0) diffuse = 0;
        var spec = nx * hx + ny * hy + nz * hz;
        if (spec < 0) spec = 0;
        spec = Math.pow(spec, 24);

        var I = 0.06 + 0.7 * diffuse + 0.9 * spec;
        if (!isFinite(I)) I = 0.06;
        I = LABUTIL.clamp(I, 0, 1);

        data[idx] = (I * 255) | 0;
        data[idx + 1] = (I * 175) | 0;
        data[idx + 2] = (I * 70) | 0;
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

