LAB.register({
  id: 'curl-flow-field',
  title: 'Curl-Noise Flow Field',
  group: 'Fluid and field',
  essence: 'Thousands of particles streamed along a divergence-free noise field, smoke-like filaments.',
  blurb: "The flow itself, drawn by its streamlines. Particles ride a curl-of-noise field (divergence-free, so they swirl without piling up) and leave fading trails, building the filamented smoke texture that reads as moving air. It is the looser, more lyrical sibling of the schlieren plume, closer to Onformative's washes. Monochrome trails on black keep it a measurement of a wind rather than a particle screensaver.",
  tags: ['fluid', 'particle', 'field', 'line', 'monochrome', 'realtime'],
  lineage: 'Robert Bridson curl-noise 2007; Onformative Meandering River; Memo Akten flow studies. Scientific anchor: curl of a scalar noise potential, divergence-free advection.',
  dialect: 'Vector Plume',
  palette: 'monochrome ink',
  paramNotes: 'Field scale and flow speed are the levers that change the gesture; trail persistence sets how filamented vs cloudy it reads. All three deserve sliders. Particle count is a performance dial, not an aesthetic one. Colour adds nothing; keep ink on black. Audio: loudness drives flow speed, spectral centroid wobbles field scale, and each beat gusts fresh particles into the field.',
  params: [
    { key: 'scale', label: 'Field scale', min: 0.5, max: 5, step: 0.1, value: 1.8 },
    { key: 'speed', label: 'Flow speed', min: 0.2, max: 3, step: 0.1, value: 1 },
    { key: 'persist', label: 'Trail persistence', min: 0.8, max: 0.99, step: 0.01, value: 0.93 },
    { key: 'count', label: 'Particles', min: 500, max: 5000, step: 100, value: 2500 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.rng = LABUTIL.mulberry32(0x9e3779b9);
    s.px = new Float32Array(5000);
    s.py = new Float32Array(5000);
    s.age = new Float32Array(5000);
    for (var i = 0; i < 5000; i++) {
      s.px[i] = s.rng() * (w || 800);
      s.py[i] = s.rng() * (h || 600);
      s.age[i] = s.rng() * 200;
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var react = (p.react == null ? 0.85 : p.react);
    // Activity: near-zero in silence, ~1 with sound. Drives flow + field speed so
    // the field is near-still when quiet and streams when sound is present.
    var act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    // Trail fade: low-alpha bg over the previous frame builds filaments.
    var persist = LABUTIL.clamp(p.persist, 0.8, 0.99);
    ctx.fillStyle = LABUTIL.rgba(theme.bg, 1 - persist);
    ctx.fillRect(0, 0, w, h);

    var n = Math.max(1, Math.min(5000, Math.round(p.count)));
    // brightness wobbles the field scale: brighter sound = finer filaments
    var scWob = LABUTIL.clamp(1 + 0.6 * react * (a.centroid - 0.3), 0.4, 1.8);
    var sc = p.scale * 0.003 * scWob;
    // loudness drives flow speed; in silence it only crawls (idle), full with sound
    var spd = p.speed * 0.6 * (0.06 + 1.4 * act);
    // a beat gusts fresh particles into the field
    var beatInject = LABUTIL.clamp(0.05 * react * a.beat, 0, 0.2);
    var px = s.px, py = s.py, age = s.age, rng = s.rng;
    // integrate our own field-evolution phase so the curl field nearly freezes in
    // silence (scaled by act) instead of evolving off the global clock t
    s.ph = (s.ph || 0) + a.dt * 0.1 * (0.06 + 1.4 * act);
    var tt = s.ph;
    // step in NOISE space for a stable finite-difference curl
    var eps = 0.45;

    ctx.fillStyle = LABUTIL.rgba(theme.ink, 0.5);
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var x = px[i], y = py[i];
      var bx = x * sc, by = y * sc;
      // curl of scalar noise potential phi: v = ( dphi/dy, -dphi/dx )
      var phiY1 = LABUTIL.noise2(bx, by + eps + tt);
      var phiY0 = LABUTIL.noise2(bx, by - eps + tt);
      var phiX1 = LABUTIL.noise2(bx + eps, by + tt);
      var phiX0 = LABUTIL.noise2(bx - eps, by + tt);
      var vx = (phiY1 - phiY0) / (2 * eps);
      var vy = -(phiX1 - phiX0) / (2 * eps);
      x += vx * spd * 60;
      y += vy * spd * 60;
      age[i] += 1;
      // respawn off-screen or aged particles to keep the field seeded
      if (x < -2 || x > w + 2 || y < -2 || y > h + 2 || age[i] > 240 || rng() < beatInject) {
        x = rng() * w;
        y = rng() * h;
        age[i] = 0;
      }
      px[i] = x;
      py[i] = y;
      ctx.rect(x, y, 1, 1);
    }
    ctx.fill();
  }
});
