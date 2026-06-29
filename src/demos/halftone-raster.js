LAB.register({
  id: 'halftone-raster',
  title: 'Dot-Matrix Halftone Raster',
  group: 'Raster, glyph, text',
  essence: 'A grid of dots whose radius tracks an underlying intensity field, print-screen sound.',
  blurb: 'Sound as a printed screen. A regular grid of dots sizes each dot to a sampled intensity field (a moving waveform-driven gradient), giving the newspaper-halftone or LED-pixel look where tone is dot area. It is the cleanest raster member, all structure and no blur, and it rhymes with the physical LED panel itself, the image admitting it is made of dots. Monochrome by construction.',
  tags: ['raster','glyph','field','monochrome','realtime'],
  lineage: 'Halftone print process; Ikeda test pattern pixel grids; Vera Molnar grid systems. Scientific anchor: halftone screening, area-modulated dot density.',
  dialect: 'Brittle Stress Matrix',
  palette: 'monochrome ink',
  paramNotes: 'Grid resolution and contrast are the levers; a dot-shape slider (circle to square) cheaply shifts between halftone and LED-pixel registers and is worth exposing. Wave speed is secondary. Colour stays off, area carries tone. Audio: a.level swells dot area globally, a.bands excite columns per spectral region, a.centroid shifts the screen frequency (react scales the drive).',
  params: [
    { key: 'res', label: 'Grid resolution', min: 12, max: 80, step: 2, value: 40 },
    { key: 'contrast', label: 'Contrast', min: 0.5, max: 4, step: 0.1, value: 1.6 },
    { key: 'shape', label: 'Dot squareness', min: 0, max: 1, step: 0.05, value: 0 },
    { key: 'speed', label: 'Wave speed', min: 0.1, max: 2, step: 0.1, value: 0.6 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a){
    var clamp = LABUTIL.clamp;
    if (!a) a = {};
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var res = clamp(Math.round(p.res), 12, 80);
    var cell = Math.min(w, h) / res;
    if (cell < 1) cell = 1;
    var nx = Math.ceil(w / cell);
    var ny = Math.ceil(h / cell);
    var contrast = clamp(p.contrast, 0.5, 4);
    var speed = p.speed;
    var TAU = LABUTIL.TAU;

    // Audio drive: level lifts dot area, bands excite per-column, centroid bends frequency.
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = clamp(a.level || 0, 0, 1);
    var aCent = clamp(a.centroid || 0, 0, 1);
    var bands = (a.bands && a.bands.length) ? a.bands : null;
    var freqMul = clamp(1 + react * (aCent - 0.3) * 1.1, 0.3, 3);
    var lift = react * aLevel;
    // Activity gate + integrated scroll phase: the screen drifts only with sound,
    // crawling to a near-stop when quiet (dot area still breathes via lift/bands).
    var aBeat = clamp(a.beat || 0, 0, 1);
    var act = clamp(Math.max(aLevel, (a.peak || 0) * 0.7, aBeat) * react, 0, 1);
    s.ph = (s.ph || 0) + (a.dt || 0.016) * speed * (0.06 + 1.1 * act);
    var ph = s.ph;

    ctx.fillStyle = theme.ink;

    for (var j = 0; j < ny; j++) {
      for (var i = 0; i < nx; i++) {
        var cx0 = (i + 0.5) * cell;
        var cy0 = (j + 0.5) * cell;
        var wave = 0.5 + 0.5 * Math.sin(cx0 * 0.02 * freqMul - ph * 3);
        var field = 0.5 + 0.5 * LABUTIL.fbm(cx0 * 0.005 * freqMul, cy0 * 0.005 + ph);
        var I = wave * field;
        // level swells every dot; bands push the column mapped to their region
        var bandV = bands ? clamp(bands[Math.min(31, (nx > 1 ? (i / (nx - 1) * 31) | 0 : 0))], 0, 1) : 0;
        I = I * (0.6 + 0.9 * lift) + react * bandV * 0.5;
        I = clamp(I, 0, 1);
        I = Math.pow(I, 1 / contrast);
        I = clamp(I, 0, 1);
        var r = I * cell * 0.55;
        if (r < 0.15) continue;
        if (p.shape < 0.5) {
          // circle, with a slight square bias as shape rises toward 0.5
          ctx.beginPath();
          ctx.arc(cx0, cy0, r, 0, TAU);
          ctx.fill();
        } else {
          ctx.fillRect(cx0 - r, cy0 - r, 2 * r, 2 * r);
        }
      }
    }
  }
});
