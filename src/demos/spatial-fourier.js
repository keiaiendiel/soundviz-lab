LAB.register({
  id: 'spatial-fourier',
  title: 'Spatial Fourier Field',
  group: 'Frequency synthesis',
  essence: 'A handful of 2D sine gratings sum into structure; more frequencies, more image.',
  blurb: "Frequency transforming the image in the spatial domain. Each component is a plane wave, a 2D sine grating at some orientation and frequency, and as they add the flat field grows interference structure, the same way a picture is the sum of its spatial frequencies. Sweep the component count from one clean grating to a dense moire and you are walking through a Fourier reconstruction. Pure luminance, the Nicolai test-field register.",
  tags: ['field', 'frequency', 'raster', 'moire', 'monochrome', 'slow'],
  lineage: 'Joseph Fourier; 2D Fourier optics; Carsten Nicolai grid works; Ryoji Ikeda spectra. Scientific anchor: image as a sum of 2D spatial-frequency components (plane waves).',
  dialect: 'Phase Interferometer',
  palette: 'monochrome ink',
  paramNotes: 'Component count is the lever that takes you from order to dense interference; max spatial frequency sets fineness; drift speed animates the phases. Contrast is worth a slider. Colour off, a colormap kills it. Audio drive (react) excites each grating amplitude from a live a.bands value, a.centroid shifts the dominant spatial frequency, and a.level lifts contrast.',
  params: [
    { key: 'components', label: 'Components', min: 1, max: 14, step: 1, value: 5 },
    { key: 'maxFreq', label: 'Max frequency', min: 1, max: 10, step: 0.5, value: 4 },
    { key: 'drift', label: 'Phase drift', min: 0, max: 1.5, step: 0.05, value: 0.4 },
    { key: 'contrast', label: 'Contrast', min: 0.5, max: 3, step: 0.1, value: 1.4 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    var rng = LABUTIL.mulberry32(11);
    var MAX = 14;
    s.MAX = MAX;
    s.fx = new Float32Array(MAX);
    s.fy = new Float32Array(MAX);
    s.ph = new Float32Array(MAX);
    s.mag = new Float32Array(MAX);
    for (var c = 0; c < MAX; c++) {
      var ang = rng() * LABUTIL.TAU;
      // each component sits at a different base spatial frequency so adding
      // components genuinely enriches the spectrum rather than repeating it.
      var m = 0.4 + rng() * 0.6 + c * 0.18;
      s.fx[c] = Math.cos(ang) * m;
      s.fy[c] = Math.sin(ang) * m;
      s.ph[c] = rng() * LABUTIL.TAU;
      s.mag[c] = 0.6 + rng() * 0.4;
    }
    s.img = null;
    s.BW = 0; s.BH = 0;
    s.hex = function (col) {
      if (typeof col === 'string' && col.charAt(0) === '#') {
        var hh = col.slice(1);
        if (hh.length === 3) hh = hh[0] + hh[0] + hh[1] + hh[1] + hh[2] + hh[2];
        return { r: parseInt(hh.slice(0, 2), 16) || 0, g: parseInt(hh.slice(2, 4), 16) || 0, b: parseInt(hh.slice(4, 6), 16) || 0 };
      }
      var mm = String(col).match(/[\d.]+/g);
      if (mm && mm.length >= 3) return { r: +mm[0], g: +mm[1], b: +mm[2] };
      return { r: 233, g: 230, b: 220 };
    };
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var TAU = LABUTIL.TAU;
    // small per-pixel buffer; width 140, height scaled to aspect, capped 120
    var BW = 140;
    var BH = Math.round(BW * h / Math.max(1, w));
    if (!isFinite(BH) || BH < 1) BH = 100;
    if (BH > 120) BH = 120;

    if (!s.img || s.BW !== BW || s.BH !== BH) {
      s.img = ctx.createImageData(BW, BH);
      s.BW = BW; s.BH = BH;
    }
    var data = s.img.data;

    var comps = Math.max(1, Math.min(s.MAX, Math.round(p.components)));
    var maxFreq = LABUTIL.clamp(p.maxFreq, 0.5, 12);
    var drift = LABUTIL.clamp(p.drift, 0, 2);
    var contrast = LABUTIL.clamp(p.contrast, 0.3, 3.5);

    var react = (p.react == null ? 0.85 : p.react);
    var lvl = (a && isFinite(a.level)) ? LABUTIL.clamp(a.level, 0, 1) : 0;
    var cen = (a && isFinite(a.centroid)) ? LABUTIL.clamp(a.centroid, 0, 1) : 0;
    var bands = (a && a.bands) ? a.bands : null;
    // brightness shifts the dominant spatial frequency and lifts contrast
    var maxFreqEff = maxFreq * LABUTIL.clamp(0.7 + react * 0.9 * cen, 0.4, 2.2);
    var contrastEff = LABUTIL.clamp(contrast * (0.7 + react * 0.8 * lvl), 0.3, 4);

    // audio activity gates the phase drift; in silence the grating field holds still
    var aPeak = (a && isFinite(a.peak)) ? LABUTIL.clamp(a.peak, 0, 1) : 0;
    var aBeat = (a && isFinite(a.beat)) ? LABUTIL.clamp(a.beat, 0, 1) : 0;
    var act = LABUTIL.clamp(Math.max(lvl, aPeak * 0.7, aBeat) * react, 0, 1);
    s.tph = (s.tph || 0) + (a.dt || 0.016) * (0.07 + 1.0 * act);
    if (!isFinite(s.tph)) s.tph = 0;

    var ink = s.hex(theme.ink), bg = s.hex(theme.bg);

    // each component's amplitude is excited by a live spectrum band so the
    // grating mix tracks the sound; the baseline keeps the field alive in silence
    var magA = [];
    var magSum = 0;
    var span = (s.MAX > 1) ? (s.MAX - 1) : 1;
    for (var mi = 0; mi < comps; mi++) {
      var bi = Math.round(mi / span * 31);
      if (bi < 0) bi = 0; else if (bi > 31) bi = 31;
      var bv = bands ? bands[bi] : 0;
      if (!isFinite(bv)) bv = 0;
      bv = LABUTIL.clamp(bv, 0, 1);
      var ma = s.mag[mi] * (0.35 + react * 1.5 * bv);
      if (!isFinite(ma) || ma < 0) ma = s.mag[mi];
      magA.push(ma);
      magSum += ma;
    }
    if (magSum <= 0) magSum = 1;
    var invMag = 1 / magSum;

    var invW = 1 / BW, invH = 1 / BH;
    for (var py = 0; py < BH; py++) {
      var ny = (py * invH) - 0.5;
      var rowBase = py * BW * 4;
      for (var px = 0; px < BW; px++) {
        var nx = (px * invW) - 0.5;
        var sum = 0;
        for (var c = 0; c < comps; c++) {
          var arg = (s.fx[c] * nx + s.fy[c] * ny) * maxFreqEff * TAU + s.ph[c] + s.tph * drift * (1 + c * 0.1);
          sum += magA[c] * Math.sin(arg);
        }
        var val = sum * invMag; // in roughly [-1,1]
        var b = 0.5 + val * 0.5 * contrastEff;
        if (b < 0) b = 0; else if (b > 1) b = 1;
        if (!isFinite(b)) b = 0;
        var j = rowBase + px * 4;
        data[j] = bg.r + (ink.r - bg.r) * b;
        data[j + 1] = bg.g + (ink.g - bg.g) * b;
        data[j + 2] = bg.b + (ink.b - bg.b) * b;
        data[j + 3] = 255;
      }
    }

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    // paint native patch top-left then self-blit scaled to the full canvas
    ctx.putImageData(s.img, 0, 0);
    if (ctx.canvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(ctx.canvas, 0, 0, BW, BH, 0, 0, w, h);
    }
  }
});

