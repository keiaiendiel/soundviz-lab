LAB.register({
  id: 'moire-grids',
  title: 'Moire Grid Interference',
  group: 'Line and geometry',
  essence: 'Two line gratings overlaid and counter-rotated, beating into large moire fringes.',
  blurb: 'Beating made visible. Two identical line gratings are overlaid; rotating or shifting one against the other makes low-frequency moire fringes sweep across the field, the spatial analogue of two close pitches beating. Tiny parameter changes produce huge visual motion, which is the lesson, so it is the most efficient sound-to-image lever in the catalog. Hard, monochrome, optical, it is pure interference with no simulation cost.',
  tags: ['moire', 'line', 'raster', 'monochrome', 'realtime'],
  lineage: 'Op-art moire (Bridget Riley, Carsten Nicolai moire works); Ikeda grid beats; physical moire metrology. Scientific anchor: moire fringe formation from superposed periodic gratings.',
  dialect: 'Brittle Stress Matrix',
  palette: 'monochrome ink',
  paramNotes: 'Grating pitch and the relative rotation angle are the levers and they are violently sensitive, a 0.5 degree change sweeps the whole fringe set, so this is where small parametric moves pay enormously. Line vs dot grating is a build choice. No colour. Audio: a.centroid and a.level swing the relative angle and a small pitch mismatch so the moire fringes beat with the sound, a.beat kicks the phase (react scales the drive).',
  params: [
    { key: 'pitch', label: 'Grating pitch', min: 4, max: 30, step: 1, value: 10 },
    { key: 'angle', label: 'Relative angle', min: 0, max: 10, step: 0.1, value: 2 },
    { key: 'shift', label: 'Phase shift', min: 0, max: 1, step: 0.02, value: 0 },
    { key: 'speed', label: 'Beat speed', min: 0, max: 2, step: 0.1, value: 0.5 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a) {
    if (!a) a = {};
    var pitch = Math.max(2, p.pitch);

    // Audio drive: centroid/level swing the angle, level offsets the second pitch,
    // beat kicks the phase, so the moire fringes beat with the sound.
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = LABUTIL.clamp(a.level || 0, 0, 1);
    var aCent = LABUTIL.clamp(a.centroid || 0, 0, 1);
    var aBeat = LABUTIL.clamp(a.beat || 0, 0, 1);
    // Activity gate + integrated beat phase: the moire sweeps with sound and
    // crawls to a near-stop when quiet. Audio angle/shift kicks still apply.
    var act = LABUTIL.clamp(Math.max(aLevel, (a.peak || 0) * 0.7, aBeat) * react, 0, 1);
    s.ph = (s.ph || 0) + (a.dt || 0.016) * p.speed * (0.06 + 1.1 * act);
    var ph = s.ph;

    // Grating one fills the field solid ink, then grating two is punched out
    // in bg over it, so the overlap reads as a true multiply moire.
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // ---- grating one: vertical ink bars (half-on, half-off duty) ----
    ctx.fillStyle = LABUTIL.rgba(theme.ink, 0.85);
    var bar = pitch * 0.5;
    // cap iteration count hard
    var n1 = Math.min(4000, Math.ceil(w / pitch) + 2);
    for (var i = 0; i < n1; i++) {
      var x = i * pitch;
      if (x > w) break;
      ctx.fillRect(x, 0, bar, h);
    }

    // ---- grating two: rotated + phase-shifted, drawn in bg to subtract ----
    var ang = (p.angle + Math.sin(ph) * 0.5
      + react * (aCent - 0.3) * 5 + react * aLevel * 1.5) * Math.PI / 180;
    // a small level-driven pitch mismatch makes the two gratings beat together
    var pitch2 = Math.max(2, pitch * (1 + react * (aLevel - 0.15) * 0.08));
    var bar2 = pitch2 * 0.5;
    var shift = p.shift * pitch + ph * 4 + react * aBeat * pitch * 2;
    var cx = w * 0.5, cy = h * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = LABUTIL.rgba(theme.bg, 0.92);
    // cover the rotated extent: from -h..w+h to stay full after rotation
    var span = w + h;
    var start = -h;
    var n2 = Math.min(4000, Math.ceil(span / pitch2) + 4);
    for (var j = 0; j < n2; j++) {
      var gx = start + j * pitch2 - (shift % pitch2);
      ctx.fillRect(gx, -h, bar2, h * 3);
    }
    ctx.restore();

    // ---- a faint second-order beat: a slow large sinusoidal vignette of the fringe ----
    // accent only as the very low-frequency envelope, kept restrained
    var env = 0.5 + 0.5 * Math.sin(ph * 0.5);
    ctx.fillStyle = LABUTIL.rgba(theme.bg, 0.05 + 0.05 * env);
    ctx.fillRect(0, 0, w, h);
  }
});
