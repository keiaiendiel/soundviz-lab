LAB.register({
  id: 'vanishing-geometry',
  title: 'Vanishing-Point Line Geometry',
  group: 'Line and geometry',
  essence: 'Lines converging to a vanishing point, an architectural perspective cage that breathes.',
  blurb: 'Architecture drawn in light. Rays converge to one or two vanishing points and cross-bars step back in perspective, building the Lemercier line-architecture register, a cathedral of single-pixel lines that opens and rotates. Sound drives the convergence point and the bar spacing, so the room itself seems to inhale. It is the geometric, anti-organic pole of the catalog.',
  tags: ['line', '3d', 'monochrome', 'slow'],
  lineage: 'Joanie Lemercier line-architecture; Anthony McCall solid-light cones; Nonotak geometric projection. Scientific anchor: one-point/two-point linear perspective projection.',
  dialect: 'Phase Interferometer',
  palette: 'monochrome ink',
  paramNotes: 'Vanishing-point position and depth-bar count are the levers; a convergence-spread slider opens the cage from a tunnel to a fan. The breathing speed ties it to a slow drone. No colour; the architecture is line only. Audio drive (react): loudness makes the cage appear and deepens its breathing, while each beat pops the depth bars outward as a re-spawn; silence lets the architecture dissolve to a faint trace.',
  params: [
    { key: 'vpX', label: 'Vanishing X', min: 0.1, max: 0.9, step: 0.02, value: 0.5 },
    { key: 'rays', label: 'Ray count', min: 6, max: 48, step: 2, value: 20 },
    { key: 'depth', label: 'Depth bars', min: 3, max: 20, step: 1, value: 10 },
    { key: 'breathe', label: 'Breathing', min: 0, max: 1, step: 0.05, value: 0.4 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, af) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    af = af || {};
    var react = (p.react == null ? 0.85 : LABUTIL.clamp(p.react, 0, 1.5));
    var lvl = LABUTIL.clamp(af.level || 0, 0, 1);
    var beat = LABUTIL.clamp(af.beat || 0, 0, 1);
    var peak = LABUTIL.clamp(af.peak || 0, 0, 1);
    var dt = LABUTIL.clamp(af.dt == null ? 0.016 : af.dt, 0, 0.1);
    // activity envelope: ~0 in silence so the architecture is near-frozen
    var act = LABUTIL.clamp(Math.max(lvl, beat, peak * 0.7) * react, 0, 1);
    // loudness deepens the breathing and makes the cage appear; silence dissolves it
    var br = p.breathe * (0.5 + 1.0 * react * lvl);
    var appear = LABUTIL.clamp(0.4 + 0.9 * react * lvl, 0, 1.4);
    var respawn = react * beat * 0.15; // beat pops the depth bars outward
    // integrate breathing/spin phase: frozen in silence, breathes with sound
    s.ph = (s.ph || 0) + dt * (0.06 + 1.4 * act);
    if (!isFinite(s.ph)) s.ph = 0;
    var ph = s.ph;
    var breath = Math.sin(ph * 0.5);
    // primary vanishing point, drifts vertically with the drone
    var vpx = p.vpX * w;
    var vpy = h * 0.45 + breath * br * h * 0.1;
    // slow rotation of the whole cage, kept subtle
    var spin = Math.sin(ph * 0.13) * 0.12 * (0.4 + br);
    var R = Math.max(w, h) * 1.6;
    var rays = Math.max(2, Math.round(p.rays));

    // converging rays, fine single-pixel lines
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (var r = 0; r < rays; r++) {
      var ang = (r / rays) * LABUTIL.TAU + spin;
      var ex = vpx + Math.cos(ang) * R;
      var ey = vpy + Math.sin(ang) * R;
      // rays nearer the horizontal read brighter, like a vaulted hall
      var a = (0.18 + 0.32 * (0.5 + 0.5 * Math.cos(ang * 2))) * appear;
      ctx.strokeStyle = LABUTIL.rgba(theme.ink, LABUTIL.clamp(a, 0, 1));
      ctx.beginPath();
      ctx.moveTo(vpx, vpy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // receding cross-bars: nested rectangles stepping toward the vanishing point
    var depth = Math.max(1, Math.round(p.depth));
    // the full-frame rectangle we recede from, inset a touch
    var L = w * 0.04, T = h * 0.04, Rr = w * 0.96, B = h * 0.96;
    for (var d = 0; d <= depth; d++) {
      var f = Math.pow(d / depth, 1.6) + 0.05 * Math.sin(ph - d * 0.4) * br;
      // a beat pops the bars outward (toward the front), then they settle
      f = f - respawn * (1 - f);
      f = LABUTIL.clamp(f, 0, 0.992);
      var x0 = LABUTIL.lerp(L, vpx, f);
      var y0 = LABUTIL.lerp(T, vpy, f);
      var x1 = LABUTIL.lerp(Rr, vpx, f);
      var y1 = LABUTIL.lerp(B, vpy, f);
      var a2 = (0.3 + 0.5 * (1 - f)) * (0.5 + 0.5 * (0.4 + br)) * appear;
      ctx.strokeStyle = LABUTIL.rgba(theme.ink, LABUTIL.clamp(a2, 0, 0.85));
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }

    // accent: the vanishing point itself, a faint indigo seed
    ctx.fillStyle = LABUTIL.rgba(theme.accent, LABUTIL.clamp(0.5 + 0.3 * (0.5 + 0.5 * breath) + react * beat * 0.3, 0, 1));
    ctx.beginPath();
    ctx.arc(vpx, vpy, 1.6, 0, LABUTIL.TAU);
    ctx.fill();
  }
});
