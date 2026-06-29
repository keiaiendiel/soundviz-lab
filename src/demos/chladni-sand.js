LAB.register({
  id: "chladni-sand",
  title: "Chladni Sand",
  group: "Vibration and matter",
  essence: "Grains shaken by a driven plate migrate off the antinodes and pile onto the silent nodal lines.",
  blurb: "The most tangible image of frequency shaping matter. A square plate is driven at a frequency, and sand walks away from the violently moving regions and settles where the plate is still, drawing the nodal figure. Change the frequency and the whole pattern reorganises. This is points plus vibration plus frequency in one specimen, the real phenomenon rather than a render of it, and it folds straight into the camera-as-aesthetic idea of filming a real plate.",
  tags: ["particle", "points", "cymatic", "vibration", "monochrome", "realtime"],
  lineage: "Ernst Chladni 1787 sound figures; Hans Jenny cymatics; John Stuart Reid CymaScope. Scientific anchor: plate eigenfunctions cos(n pi x)cos(m pi y) +/- cos(m pi x)cos(n pi y), grains settle at zero amplitude.",
  dialect: "Faraday Cymatic Field",
  palette: "monochrome ink",
  paramNotes: "The two mode numbers m and n ARE the frequency, sweeping them is the whole show and they deserve sliders. Grain count sets density; jitter sets how sharply grains settle. Colour off, it must read as sand on a plate. Audio: spectral centroid (pitch/brightness) reorganises the plate modes m and n so the figure follows the sound, while loudness and beats shake the grains harder, so silence settles into a crisp nodal figure; react scales the drive.",
  params: [
    { key: "m", label: "Mode m", min: 1, max: 8, step: 1, value: 3 },
    { key: "n", label: "Mode n", min: 1, max: 8, step: 1, value: 2 },
    { key: "grains", label: "Grains", min: 800, max: 5000, step: 100, value: 2600 },
    { key: "jitter", label: "Settle jitter", min: 0.2, max: 3, step: 0.1, value: 1 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    const MAXG = 5000;
    s.MAXG = MAXG;
    s.px = new Float32Array(MAXG);
    s.py = new Float32Array(MAXG);
    const rng = LABUTIL.mulberry32(7);
    for (let i = 0; i < MAXG; i++) {
      s.px[i] = rng();
      s.py[i] = rng();
    }
    s.frame = 0;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    a = a || {};
    if (!s.px) this.init(s, w, h);
    s.frame = (s.frame | 0) + 1;

    // trail clear
    ctx.fillStyle = LABUTIL.rgba(theme.bg, 0.25);
    ctx.fillRect(0, 0, w, h);

    var react = (p.react == null ? 0.85 : p.react);
    var centroid = LABUTIL.clamp(a.centroid || 0, 0, 1);
    var level = LABUTIL.clamp(a.level || 0, 0, 1);
    var peak = LABUTIL.clamp(a.peak || 0, 0, 1);
    var beat = LABUTIL.clamp(a.beat || 0, 0, 1);
    // audio activity: near-zero in silence so grains settle crisply and go still
    var act = LABUTIL.clamp(Math.max(level, peak * 0.7, beat) * react, 0, 1);

    // centroid (pitch/brightness) reorganises the plate mode: low pitch -> low modes
    var shift = react * centroid * 4;
    const m = LABUTIL.clamp(Math.round(p.m + shift), 1, 8);
    const n = LABUTIL.clamp(Math.round(p.n + shift * 0.6), 1, 8);
    const G = LABUTIL.clamp(Math.round(p.grains), 1, s.MAXG);
    // loudness + transients shake the grains harder; silence lets them settle crisply
    var agit = 0.08 + 2.4 * act;
    const jitter = LABUTIL.clamp(p.jitter * agit, 0, 8);

    const PI = Math.PI;
    // plate amplitude function in [0,1]^2
    const aFn = (x, y) => {
      return Math.cos(n * PI * x) * Math.cos(m * PI * y) - Math.cos(m * PI * x) * Math.cos(n * PI * y);
    };

    const eps = 0.01;
    const px = s.px, py = s.py;

    ctx.fillStyle = LABUTIL.rgba(theme.ink, 0.5);

    for (let i = 0; i < G; i++) {
      let x = px[i];
      let y = py[i];
      if (!isFinite(x)) x = 0.5;
      if (!isFinite(y)) y = 0.5;

      const av = aFn(x, y);
      const mag = Math.abs(av);

      // random walk step, larger where the plate moves more
      const step = (0.004 + 0.03 * mag) * jitter;

      // deterministic jitter direction from hash (no engine RNG in draw)
      const r1 = LABUTIL.hash2(x * 997.0 + i, y * 991.0 + s.frame * 0.131);
      const r2 = LABUTIL.hash2(y * 977.0 + i * 1.7, x * 983.0 + s.frame * 0.197);
      x += (r1 - 0.5) * step;
      y += (r2 - 0.5) * step;

      // downhill bias on |a|: sample neighbours, move toward smaller |a|
      const axp = Math.abs(aFn(x + eps, y));
      const axm = Math.abs(aFn(x - eps, y));
      const ayp = Math.abs(aFn(x, y + eps));
      const aym = Math.abs(aFn(x, y - eps));
      let gx = (axp - axm) / (2 * eps);
      let gy = (ayp - aym) / (2 * eps);
      if (!isFinite(gx)) gx = 0;
      if (!isFinite(gy)) gy = 0;
      // normalise gradient direction so the bias is a fixed fraction of mag
      const gl = Math.sqrt(gx * gx + gy * gy) + 1e-6;
      const biasMag = 0.15 * mag;
      x -= (gx / gl) * biasMag;
      y -= (gy / gl) * biasMag;

      // clamp to plate
      x = LABUTIL.clamp(x, 0, 1);
      y = LABUTIL.clamp(y, 0, 1);
      if (!isFinite(x)) x = 0.5;
      if (!isFinite(y)) y = 0.5;

      px[i] = x;
      py[i] = y;

      // plot 1px dot
      ctx.fillRect(x * w, y * h, 1, 1);
    }

    // plate frame
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }
});
