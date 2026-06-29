LAB.register({
  id: 'vector-field-arrows',
  title: 'Vector Field Arrows',
  group: 'Fluid and field',
  essence: 'A regular grid of arrows pointing along the acoustic-velocity field, Microflown style.',
  blurb: 'The flow as instrument readout. A grid of short arrows aligns with a time-varying noise field, each scaled by local magnitude, the way a Microflown particle-velocity camera paints the acoustic wind around a source. It is the most diagrammatic fluid dialect, all measurement and no spectacle, and it reads instantly as a scientific quiver plot. Sparse, monochrome, it is the lab\'s vector overlay.',
  tags: ['field', 'line', 'glyph', 'monochrome', 'realtime'],
  lineage: 'Microflown Scan and Paint (de Bree); quiver-plot lab convention; Nearfield Acoustic Holography intensity vectors. Scientific anchor: acoustic particle-velocity vector field.',
  dialect: 'Modal Coordinate Grid',
  palette: 'monochrome ink',
  paramNotes: 'Grid spacing and arrow length gain are the two levers and both read clearly; a swirl-vs-source toggle (rotational vs radial bias) is worth a slider. Animation speed is secondary. The technique is born monochrome; no colour control. Audio: loudness lengthens and agitates the arrows while spectral flux churns the field direction.',
  params: [
    { key: 'spacing', label: 'Grid spacing', min: 16, max: 80, step: 4, value: 36 },
    { key: 'length', label: 'Arrow length', min: 0.3, max: 1.5, step: 0.05, value: 0.8 },
    { key: 'swirl', label: 'Swirl bias', min: 0, max: 1, step: 0.05, value: 0.4 },
    { key: 'speed', label: 'Field speed', min: 0.1, max: 2, step: 0.1, value: 0.6 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a) {
    const TAU = LABUTIL.TAU;
    const react = (p.react == null ? 0.85 : p.react);
    const level = LABUTIL.clamp(a.level, 0, 1);
    const flux = LABUTIL.clamp(a.flux, 0, 1);
    // Activity: ~0 in silence, ~1 with sound. The field sweep is integrated on our
    // own clock and scaled by act, so arrows are near-still when quiet and sweep
    // with sound. Arrow length keeps its loudness mapping.
    const act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    s.ph = (s.ph || 0) + a.dt * p.speed * (0.05 + 1.4 * act);
    const ph = s.ph;
    // loudness lengthens the arrows; flux adds a bounded churn to the field phase
    const lenGain = p.length * (0.55 + 1.1 * react * level);
    const churn = 0.8 * react * flux;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5, cy = h * 0.5;
    const step = Math.max(8, p.spacing);
    // inset so arrows near the edge are not clipped
    const m = step * 0.5;

    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // a faint registration node at each grid point keeps the instrument feel
    for (let y = m; y <= h - m + 0.001; y += step) {
      for (let x = m; x <= w - m + 0.001; x += step) {
        const base = LABUTIL.noise2(x * 0.004, y * 0.004 + ph + churn) * TAU * 2;
        const radial = Math.atan2(y - cy, x - cx);
        const ang = base + p.swirl * radial;

        const mn = LABUTIL.noise2(x * 0.006 + 9, y * 0.006 - ph - churn); // [-1,1]
        const mag = (0.4 + 0.6 * (mn * 0.5 + 0.5)) * step * lenGain;

        const dx = Math.cos(ang) * mag;
        const dy = Math.sin(ang) * mag;
        const tx = x + dx, ty = y + dy;

        // magnitude reads as opacity so the field has depth, not just direction
        const a = 0.22 + 0.6 * LABUTIL.clamp(mag / (step * 1.2), 0, 1);

        // base node
        ctx.fillStyle = LABUTIL.rgba(theme.dim, 0.5);
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);

        // shaft
        ctx.strokeStyle = LABUTIL.rgba(theme.ink, a);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // arrowhead: two short strokes back along the shaft
        const head = Math.min(5, mag * 0.45);
        if (head > 0.5) {
          const ah = 0.45; // spread radians
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - head * Math.cos(ang - ah), ty - head * Math.sin(ang - ah));
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - head * Math.cos(ang + ah), ty - head * Math.sin(ang + ah));
          ctx.stroke();
        }
      }
    }
  }
});
