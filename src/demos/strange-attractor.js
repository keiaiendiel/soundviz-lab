LAB.register({
  id: 'strange-attractor',
  title: 'Strange Attractor (de Jong)',
  group: 'Particle and attractor',
  essence: 'Iterating a chaotic map plots a dense filamented figure that morphs with its constants.',
  blurb: 'Order inside chaos. Iterating the Peter de Jong map thousands of times per frame and plotting each point builds a luminous filamented structure whose shape is set by four constants; nudging a constant morphs the whole figure continuously. It is the fractal-adjacent member of the catalog, math made visible, and it pairs naturally with a slow sustain because the attractor itself breathes when you animate one constant. Lorenz is the 3D alternative.',
  tags: ['fractal','particle','line','monochrome','slow'],
  lineage: 'Peter de Jong / Clifford attractors; Edward Lorenz 1963; John Whitney Digital Harmony geometric resonance. Scientific anchor: dissipative chaotic dynamical systems, strange attractors.',
  dialect: 'Phase Interferometer',
  palette: 'monochrome ink',
  paramNotes: 'The four map constants a,b,c,d are the levers; animating even one slowly morphs the figure, so bind the most sensitive one (a) to a slider and let the others sit. Iteration count is a density dial. There is no useful colour control; accumulation alpha is the only tone. Audio drive nudges constants a and b by centroid and loudness, sets point count and accumulation alpha from level, and bursts points on each beat.',
  params: [
    { key: 'a', label: 'Constant a', min: -3, max: 3, step: 0.01, value: 1.4 },
    { key: 'b', label: 'Constant b', min: -3, max: 3, step: 0.01, value: -2.3 },
    { key: 'iter', label: 'Iterations', min: 2000, max: 40000, step: 1000, value: 15000 },
    { key: 'fade', label: 'Trail fade', min: 0, max: 0.3, step: 0.01, value: 0.06 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h){
    s.x = 0.0;
    s.y = 0.0;
  },
  draw(ctx, w, h, t, p, s, theme, aud){
    // fade prior frame to build accumulation
    var fade = LABUTIL.clamp(p.fade, 0.0, 0.3);
    ctx.fillStyle = LABUTIL.rgba(theme.bg, fade);
    ctx.fillRect(0, 0, w, h);

    // audio: centroid/loudness nudge the map constants, level sets density/tone, beat bursts
    var react = (p.react == null ? 0.85 : p.react);
    var lv = aud ? LABUTIL.clamp(aud.level, 0, 1) : 0;
    var ce = aud ? LABUTIL.clamp(aud.centroid, 0, 1) : 0;
    var bt = aud ? LABUTIL.clamp(aud.beat, 0, 1) : 0;
    var pk = aud ? LABUTIL.clamp(aud.peak, 0, 1) : 0;
    // silence = stillness: act ~0 when quiet, rises only with real sound
    var act = LABUTIL.clamp(Math.max(lv, pk * 0.7, bt) * react, 0, 1);
    var dtv = (aud && isFinite(aud.dt)) ? LABUTIL.clamp(aud.dt, 0, 0.1) : 0.016;
    // advance the morph phase from audio so c,d nearly freeze in silence
    s.ph = (s.ph || 0) + dtv * (0.04 + 1.1 * act);

    var a = LABUTIL.clamp(p.a + (ce - 0.5) * 0.6 * react, -3, 3);
    var b = LABUTIL.clamp(p.b + (lv - 0.3) * 0.4 * react, -3, 3);
    var c = 2.0 + 0.4 * Math.sin(s.ph * 0.2);
    var d = -2.1 + 0.3 * Math.cos(s.ph * 0.17);

    var cx = w * 0.5, cy = h * 0.5;
    var R = 0.22 * Math.min(w, h);

    // iter slider sets density target; cap real iterations to 4000 for the loop guard,
    // map the rest of the density onto per-point alpha so the figure thickens.
    var want = LABUTIL.clamp(p.iter, 2000, 40000);
    var iters = Math.round(LABUTIL.clamp(Math.min(want, 4000) * (0.85 + 0.7 * react * lv) + bt * 1500 * react, 200, 4000));
    var densityBoost = LABUTIL.clamp(want / 4000, 1, 10);
    var alpha = LABUTIL.clamp(0.075 * densityBoost * (1 + 0.5 * react * lv + 0.6 * react * bt), 0.04, 0.45);
    var dot = 1.7;   // bigger than 1px so the filament reads clearly

    var x = s.x, y = s.y;
    if (!isFinite(x) || !isFinite(y)) { x = 0; y = 0; }

    ctx.fillStyle = LABUTIL.rgba(theme.ink, alpha);

    for (var i = 0; i < iters; i++) {
      var nx = Math.sin(a * y) - Math.cos(b * x);
      var ny = Math.sin(c * x) - Math.cos(d * y);
      x = nx; y = ny;
      // de Jong output is bounded in [-2,2]; guard anyway
      if (!isFinite(x) || !isFinite(y)) { x = 0; y = 0; continue; }
      var px = cx + x * R;
      var py = cy + y * R;
      ctx.fillRect(px - dot * 0.5, py - dot * 0.5, dot, dot);
    }

    s.x = x; s.y = y;
  }
});
