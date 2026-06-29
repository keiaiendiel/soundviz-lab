LAB.register({
  id: 'faraday-interference',
  title: 'Faraday Wave Interference',
  group: 'Cymatic and modal',
  essence: 'Subharmonic standing waves on a driven liquid surface, a pulsing symmetric lattice.',
  blurb: "The driven-liquid successor to Chladni. Above a critical drive the surface breaks into a hexagonal or square lattice of oscillating cells that pulse at half the drive frequency. Rendered as a summed-wavevector height field thresholded into bright cell walls, it gives Nicolai's milch 75 hz directly. This is the climax dialect and the one place the single accent is licensed, motivated as a physical phase change, not decoration.",
  tags: ['cymatic', 'field', 'raster', 'accent', 'slow'],
  lineage: 'Michael Faraday 1831; John Stuart Reid Water journal; Carsten Nicolai milch 75 hz; Linden Gledhill. Scientific anchor: parametric subharmonic instability, Faraday waves.',
  dialect: 'Faraday Cymatic Field',
  palette: 'monochrome + single accent',
  paramNotes: 'Symmetry order (number of wavevectors) and drive frequency are the levers that change the lattice and must be sliders. The accent slider is the climax control, push once. Threshold sharpness toggles between soft fluid and hard cell-wall looks and is worth exposing. Colour beyond the single accent breaks the discipline. Audio drive: loudness (level/peak) is the parametric drive amplitude that crisps the lattice, spectral centroid sets the cell scale, and a beat sloshes the standing-wave phase.',
  params: [
    { key: 'symmetry', label: 'Symmetry order', min: 2, max: 8, step: 1, value: 6 },
    { key: 'freq', label: 'Drive frequency', min: 4, max: 24, step: 1, value: 12 },
    { key: 'sharp', label: 'Cell sharpness', min: 1, max: 12, step: 0.5, value: 5 },
    { key: 'accent', label: 'Accent (climax)', min: 0, max: 1, step: 0.05, value: 0 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    // Render the height field into a small offscreen buffer and upscale once, instead of
    // tens of thousands of fillRect() calls per frame. Same look, an order of magnitude faster.
    s.bw = 200;
    s.bh = Math.max(40, Math.min(170, Math.round(s.bw * h / Math.max(1, w))));
    try {
      s.off = new OffscreenCanvas(s.bw, s.bh);
      s.octx = s.off.getContext('2d');
      s.img = s.octx.createImageData(s.bw, s.bh);
    } catch (e) { s.off = null; }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    if (s.bw == null) this.init(s, w, h);
    if (!a) a = {};

    var sym = Math.max(2, Math.round(p.symmetry));
    var freq = p.freq;
    var sharp = p.sharp;
    var accent = LABUTIL.clamp(p.accent, 0, 1);

    // Audio coupling. Loudness is the parametric drive amplitude above the
    // Faraday threshold, brightness (centroid) sets the lattice scale, a beat
    // sloshes the standing-wave phase.
    var react = (p.react == null ? 0.85 : p.react);
    var lvl = LABUTIL.clamp(a.level || 0, 0, 1);
    var pk = LABUTIL.clamp(a.peak || 0, 0, 1);
    var cen = LABUTIL.clamp(a.centroid || 0, 0, 1);
    var beat = LABUTIL.clamp(a.beat || 0, 0, 1);
    // audio activity: near-zero in silence so the lattice freezes (still)
    var act = LABUTIL.clamp(Math.max(lvl, pk * 0.7, beat) * react, 0, 1);
    freq = LABUTIL.clamp(freq * (0.7 + 0.6 * react * cen), 2, 40);
    var driveEnv = LABUTIL.clamp(1 + react * (0.8 * lvl + 0.5 * pk + 0.7 * beat), 0.2, 3);
    var slosh = react * beat * 1.5;
    // integrate pulse + scroll phases from a.dt, gated by audio so silence is still
    var dt = (a && isFinite(a.dt)) ? a.dt : 0.016;
    var ev = 0.06 + act;
    s.phP = (((s.phP || 0) + dt * 2 * ev) % LABUTIL.TAU);
    s.phW = (((s.phW || 0) + dt * 4 * ev) % LABUTIL.TAU);

    // Precompute wavevector directions once per frame (cheap, <= 8).
    var dirs = [];
    for (var k = 0; k < sym; k++) {
      var ang = k * Math.PI / sym;
      dirs.push([Math.cos(ang), Math.sin(ang)]);
    }
    var pulse = Math.cos(s.phP) * driveEnv;
    var invSym = 1 / sym;

    // resize the buffer to the live aspect if it changed
    var BW = s.bw, BH = s.bh;
    var wantBH = Math.max(40, Math.min(170, Math.round(BW * h / Math.max(1, w))));
    if (s.off && wantBH !== BH) {
      try { s.off = new OffscreenCanvas(BW, wantBH); s.octx = s.off.getContext('2d'); s.img = s.octx.createImageData(BW, wantBH); BH = s.bh = wantBH; } catch (e) { /* keep old */ }
    }
    var img = s.img;
    if (!img || !s.octx) return; // no offscreen support: stay safe + finite

    // theme colours -> rgb (alpha carries the cell-wall coverage, so bg blends correctly)
    function hexRgb(c) {
      if (typeof c !== 'string' || c.charAt(0) !== '#') return [233, 230, 220];
      var hx = c.slice(1); if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];
      return [parseInt(hx.slice(0, 2), 16) || 0, parseInt(hx.slice(2, 4), 16) || 0, parseInt(hx.slice(4, 6), 16) || 0];
    }
    var ink = hexRgb(theme.ink), acc = hexRgb(theme.accent);

    // field coords matched to the original (canvas-centred, scaled by the min dimension)
    var inv = 2 / Math.min(w, h);
    var cx = w * 0.5, cy = h * 0.5;
    var data = img.data, o = 0;
    for (var by = 0; by < BH; by++) {
      var v = ((by + 0.5) / BH * h - cy) * inv;
      for (var bx = 0; bx < BW; bx++) {
        var u = ((bx + 0.5) / BW * w - cx) * inv;
        var height = 0;
        for (var d = 0; d < sym; d++) {
          height += Math.cos((u * dirs[d][0] + v * dirs[d][1]) * freq + s.phW + slosh);
        }
        height *= invSym; height *= pulse;
        var b = LABUTIL.clamp(1 - Math.abs(height) * sharp, 0, 1);
        if (b <= 0.004) { data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 0; o += 4; continue; }
        // climax: brightest cell walls warm toward the single accent
        var mix = (accent > 0 && b > 0.7) ? accent * LABUTIL.smoothstep(0.7, 1, b) : 0;
        data[o] = ink[0] * (1 - mix) + acc[0] * mix;
        data[o + 1] = ink[1] * (1 - mix) + acc[1] * mix;
        data[o + 2] = ink[2] * (1 - mix) + acc[2] * mix;
        data[o + 3] = b * 255;
        o += 4;
      }
    }
    s.octx.putImageData(img, 0, 0);
    var prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s.off, 0, 0, w, h);
    ctx.imageSmoothingEnabled = prevSmooth;
  }
});
