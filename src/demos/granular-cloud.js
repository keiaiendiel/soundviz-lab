LAB.register({
  id: 'granular-cloud',
  title: 'Granular Sprite Cloud',
  group: 'Particle and attractor',
  essence: 'Hundreds of short-lived grains scattered in time-frequency space, the granular-synthesis image.',
  blurb: 'Granular synthesis seen. Each grain is a small mark placed by a time position (X) and a pitch (Y) with a short Gaussian life, exactly the grain cloud a granular synth scatters. Density and spread are the controls a granular patch exposes, so the image and the sound share a parameter set. This is the literal portrait of Granular Synthesis on the lineage line, kept as monochrome specks on black.',
  tags: ['particle', 'glyph', 'spectral', 'monochrome', 'realtime'],
  lineage: 'Curtis Roads microsound / granular synthesis; Granular Synthesis MODELL 5 (lineage anchor 1994); Iannis Xenakis grains. Scientific anchor: granular synthesis, time-frequency grain scattering.',
  dialect: 'Oscillographic/XY (proposed 6th)',
  palette: 'monochrome ink',
  paramNotes: 'Grain density and pitch spread are the genuine granular levers and map one-to-one to the sound parameters, so this is a case where the slider IS the synthesis control. Grain lifetime matters. Colour does not; grains are luminance events. Audio: a.level and a.flux raise emission rate and pitch spread, a.bands place grains along the pitch axis so energetic bands seed more grains, and a.beat fires a burst of grains.',
  params: [
    { key: 'density', label: 'Grain density', min: 10, max: 400, step: 10, value: 120 },
    { key: 'spread', label: 'Pitch spread', min: 0.05, max: 0.6, step: 0.02, value: 0.25 },
    { key: 'life', label: 'Grain lifetime', min: 0.2, max: 2, step: 0.1, value: 0.8 },
    { key: 'center', label: 'Pitch centre', min: 0.1, max: 0.9, step: 0.02, value: 0.5 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.cap = 2200;
    s.x = new Float32Array(s.cap);
    s.y = new Float32Array(s.cap);
    s.life = new Float32Array(s.cap);   // remaining life, seconds
    s.life0 = new Float32Array(s.cap);  // birth lifetime
    s.alive = new Uint8Array(s.cap);
    s.head = 0;
    s.rnd = LABUTIL.mulberry32(1994);
    s.acc = 0;
    s.last = 0;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    const cap = s.cap, rnd = s.rnd;
    var react = (p.react == null ? 0.85 : p.react);
    // frame dt, robust against first-frame and time jumps
    let dt = t - s.last;
    if (!(dt > 0) || dt > 0.1) dt = 0.016;
    s.last = t;
    var act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    // playhead advances with audio so cursor and grain placement are near-still in silence
    s.sweep = (s.sweep || 0) + dt * 0.1 * (0.08 + 1.6 * act);
    const tpos = ((s.sweep % 1) + 1) % 1;
    const playX = tpos * w;

    // gentle fade so grains bloom and vanish like windowed audio grains
    ctx.fillStyle = LABUTIL.rgba(theme.bg, 0.18);
    ctx.fillRect(0, 0, w, h);

    // faint time-frequency frame: pitch-centre line + a sweep cursor
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, (1 - p.center) * h);
    ctx.lineTo(w, (1 - p.center) * h);
    ctx.stroke();
    ctx.strokeStyle = LABUTIL.rgba(theme.accent, 0.18);
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, h);
    ctx.stroke();

    // audio-effective emission rate and pitch spread (slider is the baseline)
    var densEff = p.density * (0.07 + 1.6 * act);
    var spreadEff = LABUTIL.clamp(p.spread * (0.6 + 1.3 * react * a.flux), 0.01, 1);
    // band-energy CDF so grains settle at the loud pitches
    var bands = a.bands;
    var cdf = s.cdf || (s.cdf = new Float32Array(32));
    var btot = 0;
    for (var bI = 0; bI < 32; bI++) {
      var bv = bands ? bands[bI] : 0;
      if (!(bv >= 0)) bv = 0;
      btot += bv * bv + 0.003;
      cdf[bI] = btot;
    }

    // spawn grains: density grains/sec, scaled by dt, fractional accumulator
    s.acc += densEff * dt;
    let toSpawn = Math.floor(s.acc);
    s.acc -= toSpawn;
    toSpawn += Math.floor(react * a.beat * 26); // beat fires a grain burst
    if (toSpawn > 150) toSpawn = 150; // cap inner loop
    if (toSpawn < 0) toSpawn = 0;
    for (let k = 0; k < toSpawn; k++) {
      const i = s.head; s.head = (s.head + 1) % cap;
      const tx = LABUTIL.clamp(tpos + (rnd() - 0.5) * (0.1 + 0.25 * react * a.level), 0, 1);
      const pn = LABUTIL.noise2(rnd() * 10, t); // [-1,1]
      // pitch axis: slider centre blended toward an energetic band
      var rr = rnd() * btot, bi = 0;
      while (bi < 31 && cdf[bi] < rr) bi++;
      var pitchBand = bi / 31;
      var pitchSlider = p.center + pn * spreadEff;
      const pitch = LABUTIL.clamp(LABUTIL.lerp(pitchSlider, pitchBand + pn * spreadEff * 0.4, react * 0.7), 0.02, 0.98);
      s.x[i] = tx * w;
      s.y[i] = (1 - pitch) * h;
      const l0 = p.life * (0.5 + rnd());
      s.life0[i] = l0;
      s.life[i] = l0;
      s.alive[i] = 1;
    }

    // draw + age grains; Gaussian-ish envelope on size and alpha
    ctx.fillStyle = theme.ink;
    for (let i = 0; i < cap; i++) {
      if (!s.alive[i]) continue;
      let life = s.life[i] - dt;
      if (life <= 0) { s.alive[i] = 0; continue; }
      s.life[i] = life;
      const l0 = s.life0[i];
      const phase = LABUTIL.clamp(life / l0, 0, 1); // 1 -> 0
      const env = Math.sin(Math.PI * phase); // 0 at ends, 1 mid-life
      if (env <= 0.01) continue;
      const r = 0.6 + 1.5 * env;
      ctx.globalAlpha = env;
      ctx.beginPath();
      ctx.arc(s.x[i], s.y[i], r, 0, LABUTIL.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
});
