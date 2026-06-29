LAB.register({
  id: 'particle-envelope-swarm',
  title: 'Particle Swarm to Envelope',
  group: 'Particle and attractor',
  essence: 'A swarm whose birth rate and energy track the amplitude envelope, breathing density.',
  blurb: 'The default reactive logic, owned honestly. Particle birth rate and outward velocity follow a synthetic amplitude envelope, so the swarm blooms on loud transients and thins in silence. The artistic memo flags amplitude-to-birth-rate as undergraduate when alone; included here as the controlled study of exactly that, kept monochrome and gravity-bound so it reads as a measured exhalation rather than confetti. Useful as a texture under another dialect, not as a soloist.',
  tags: ['particle', 'field', 'monochrome', 'realtime'],
  lineage: 'Markos Kay aBiogenesis (earned emergence); generic Notch particle demo (the trap). Scientific anchor: amplitude envelope to emission rate mapping.',
  dialect: 'Vector Plume',
  palette: 'monochrome ink',
  paramNotes: 'Envelope shape (attack vs sustain) and outward velocity are the levers that make it read as breath; expose both. Gravity/drag pulls it back from confetti and is worth a slider. The honest paramNote is that no slider makes this technique authorial alone, so the demo also shows it dimmed as a sub-layer. Audio: a.level feeds the amplitude envelope (birth rate and outward velocity), a.beat kicks a burst of fast particles, and a.centroid tightens the emission core.',
  params: [
    { key: 'birth', label: 'Birth gain', min: 0.2, max: 3, step: 0.1, value: 1.2 },
    { key: 'vel', label: 'Outward velocity', min: 0.5, max: 4, step: 0.1, value: 1.8 },
    { key: 'drag', label: 'Drag', min: 0.9, max: 0.995, step: 0.005, value: 0.97 },
    { key: 'gravity', label: 'Gravity', min: -1, max: 1, step: 0.05, value: 0.2 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.cap = 1400;
    s.x = new Float32Array(s.cap);
    s.y = new Float32Array(s.cap);
    s.vx = new Float32Array(s.cap);
    s.vy = new Float32Array(s.cap);
    s.life = new Float32Array(s.cap); // <=0 means dead
    s.head = 0; // ring cursor for spawning
    s.rnd = LABUTIL.mulberry32(20260619);
    s.acc = 0; // fractional spawn accumulator
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    const cap = s.cap, rnd = s.rnd;
    var react = (p.react == null ? 0.85 : p.react);
    // trail fade
    ctx.fillStyle = LABUTIL.rgba(theme.bg, 0.12);
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5, cy = h * 0.5;
    // audio activity gates emission; in silence the swarm settles and stops breathing
    var act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    // synthetic envelope shapes the bloom, but its amplitude tracks the sound
    let base = Math.sin(t * 1.5) + 0.5 * Math.sin(t * 4.3);
    if (base < 0) base = 0;
    let env = base * (0.05 + 1.4 * act);
    var kick = react * a.beat;
    // centroid (brightness) tightens the emission core
    var tight = LABUTIL.clamp(react * a.centroid, 0, 1);
    var jitR = LABUTIL.lerp(6, 1.5, tight);

    // spawn with a fractional accumulator so low rates still emit smoothly
    s.acc += env * p.birth * 40 * 0.5 + kick * 60; // per-frame budget; beat adds a burst
    let toSpawn = Math.floor(s.acc);
    if (toSpawn > 160) toSpawn = 160; // cap inner spawn loop
    if (toSpawn < 0) toSpawn = 0;
    s.acc -= toSpawn;
    for (let k = 0; k < toSpawn; k++) {
      const i = s.head; s.head = (s.head + 1) % cap;
      const ang = rnd() * LABUTIL.TAU;
      const sp = p.vel * (0.5 + env + kick * 1.5) * (0.6 + 0.8 * rnd());
      s.x[i] = cx + (rnd() - 0.5) * jitR;
      s.y[i] = cy + (rnd() - 0.5) * jitR;
      s.vx[i] = Math.cos(ang) * sp;
      s.vy[i] = Math.sin(ang) * sp;
      s.life[i] = 1;
    }

    // integrate + draw alive particles
    ctx.fillStyle = theme.ink;
    for (let i = 0; i < cap; i++) {
      let life = s.life[i];
      if (life <= 0) continue;
      let vx = s.vx[i], vy = s.vy[i];
      // curl: a slow noise field bends trajectories so they don't fly straight
      const n = LABUTIL.noise2(s.x[i] * 0.01, s.y[i] * 0.01 + t);
      const n2 = LABUTIL.noise2(s.x[i] * 0.01 + 5, s.y[i] * 0.01 - t);
      vx += n * 0.18;
      vy += n2 * 0.18 + p.gravity * 0.05;
      vx *= p.drag; vy *= p.drag;
      let x = s.x[i] + vx, y = s.y[i] + vy;
      life -= 0.01;

      // recycle if off-canvas or dead
      if (life <= 0 || x < -20 || x > w + 20 || y < -20 || y > h + 20) {
        s.life[i] = 0; continue;
      }
      s.vx[i] = vx; s.vy[i] = vy; s.x[i] = x; s.y[i] = y; s.life[i] = life;

      const sz = 1 + 2 * life;
      ctx.globalAlpha = life * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, sz * 0.5, 0, LABUTIL.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // centre source mark
    ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.25 + 0.5 * env);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 4 + env * 6, 0, LABUTIL.TAU);
    ctx.stroke();
  }
});
