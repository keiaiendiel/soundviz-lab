LAB.register({
  id: 'chladni-nodal',
  title: 'Chladni Nodal Figures',
  group: 'Cymatic and modal',
  essence: 'Sand settles on the still nodal lines of a vibrating plate, a standing-wave map.',
  blurb: 'The 18th-century plate experiment. Particles flee the antinodes and pile on the nodal lines of a square plate, so the standing-wave mode appears as a black filigree. Here thousands of sprites do a gradient descent on the analytic mode-shape field cos(n.pi.x)cos(m.pi.y) and settle into the figure; sweeping the mode integers morphs one pattern into the next. Static, solid-state, precise: the clean counterpart to the fluid Faraday field.',
  tags: ['cymatic','particle','field','monochrome','slow'],
  lineage: 'Ernst Chladni 1787; Hans Jenny cymatics; Linden Gledhill macro plates. Scientific anchor: square-plate eigenmodes, nodal-line equation.',
  dialect: 'Faraday Cymatic Field',
  palette: 'monochrome ink',
  paramNotes: 'The two mode integers n and m are the entire instrument; expose both as integer sliders and the morph between figures is the demo. Particle count affects density not pattern. A settle-rate slider helps the transition read. Do not parametrise colour; the physics is one substance on a plate. Audio: spectral centroid raises the mode order so the figure reorganises with pitch, while loudness and beats agitate the grains, so silence lets them settle on the nodal lines; react scales the drive.',
  params: [
    { key: 'modeN',  label: 'Mode n',         min: 1,   max: 8,    step: 1,    value: 3 },
    { key: 'modeM',  label: 'Mode m',         min: 1,   max: 8,    step: 1,    value: 2 },
    { key: 'count',  label: 'Particle count', min: 500, max: 6000, step: 100,  value: 3000 },
    { key: 'settle', label: 'Settle rate',    min: 0.01,max: 0.2,  step: 0.01, value: 0.06 },
    { key: 'react',  label: 'Audio drive',    min: 0,   max: 1.5,  step: 0.05, value: 0.85 }
  ],
  init(s, w, h){
    s.rng = LABUTIL.mulberry32(0x9e3779b9 >>> 0);
    s.parts = [];
  },
  draw(ctx, w, h, t, p, s, theme, a){
    a = a || {};
    // fade the previous frame so settled grains leave a filigree, not a smear
    ctx.fillStyle = LABUTIL.rgba(theme.bg, 0.2);
    ctx.fillRect(0, 0, w, h);

    var react = (p.react == null ? 0.85 : p.react);
    var centroid = LABUTIL.clamp(a.centroid || 0, 0, 1);
    var level = LABUTIL.clamp(a.level || 0, 0, 1);
    var peak = LABUTIL.clamp(a.peak || 0, 0, 1);
    var beat = LABUTIL.clamp(a.beat || 0, 0, 1);
    // audio activity: near-zero in silence so the figure freezes and grains settle
    var act = LABUTIL.clamp(Math.max(level, peak * 0.7, beat) * react, 0, 1);

    var want = Math.max(50, Math.round(p.count));
    var parts = s.parts;
    // grow
    while (parts.length < want){
      parts.push({ x: s.rng(), y: s.rng() });
    }
    // shrink
    if (parts.length > want) parts.length = want;

    var n = Math.max(1, Math.round(p.modeN));
    var m = Math.max(1, Math.round(p.modeM));
    // slow morph toward the next integers, gated by audio so silence freezes the figure
    var blend = (0.5 - 0.5 * Math.cos(t * 0.18)) * act;
    var blend2 = (0.5 - 0.5 * Math.cos(t * 0.13)) * act;
    // brightness lifts the mode order so pitch reorganises the figure (clamp to slider range)
    var shift = react * centroid * 4;
    var nF = LABUTIL.clamp(n + blend + shift, 1, 8);
    var mF = LABUTIL.clamp(m + blend2 + shift * 0.6, 1, 8);
    var PI = Math.PI;

    function field(x, y){
      return Math.cos(nF * PI * x) * Math.cos(mF * PI * y);
    }

    var eps = 0.002;
    var rate = LABUTIL.clamp(p.settle, 0.01, 0.2);
    // loudness + transients agitate the grains; silence lets them settle on the nodes
    var jit = 0.0018 * (0.08 + 2.3 * act);

    var INK = LABUTIL.rgba(theme.ink, 0.85);
    ctx.fillStyle = INK;

    for (var i = 0; i < parts.length; i++){
      var pt = parts[i];
      var x = pt.x, y = pt.y;
      var f = field(x, y);
      var s_ = f < 0 ? -1 : 1;
      // finite-difference gradient of f
      var gx = (field(x + eps, y) - field(x - eps, y)) / (2 * eps);
      var gy = (field(x, y + eps) - field(x, y - eps)) / (2 * eps);
      // descend |f| toward the nodal line f=0: move against sign(f)*grad
      var nx = x - s_ * gx * rate * 0.02;
      var ny = y - s_ * gy * rate * 0.02;
      // tiny structured jitter so grains keep migrating, deterministic
      nx += LABUTIL.noise2(x * 10, y * 10 + t) * jit;
      ny += LABUTIL.noise2(x * 10 + 5.3, y * 10 - t) * jit;
      // clamp inside the plate
      if (nx < 0) nx = 0; else if (nx > 1) nx = 1;
      if (ny < 0) ny = 0; else if (ny > 1) ny = 1;
      pt.x = nx; pt.y = ny;

      ctx.fillRect(nx * w, ny * h, 1, 1);
    }

    // thin plate frame so it reads as a bounded square-plate experiment
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 1);
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }
});
