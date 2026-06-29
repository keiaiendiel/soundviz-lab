LAB.register({
  id: 'lorenz-attractor',
  title: 'Lorenz Attractor',
  group: 'Particle and attractor',
  essence: 'Numerically integrate the Lorenz 1963 system and trace its butterfly with a persistent fading line, rho and sigma exposed as live levers.',
  blurb: "Three coupled ODEs are stepped with a small fixed timestep (RK4) each frame; the moving state is projected from (x,y,z) onto the screen and appended to a fading trail, so the two lobes of the attractor accumulate into the familiar butterfly. Nudging rho collapses or re-opens the chaos; sigma reshapes the lobes. A faint moving head dot marks the present state.",
  tags: ['particle', 'line', '3d', 'fractal', 'monochrome', 'realtime'],
  lineage: 'Edward Lorenz, Deterministic Nonperiodic Flow (J. Atmos. Sci., 1963): the first widely known strange attractor and the origin of the butterfly-effect image.',
  dialect: 'Vector Plume',
  palette: 'Monochrome on near-black. Trail warm off-white with alpha decaying along its length so the path reads as a luminous filament; head as a single amber accent dot. No fills, no second hue.',
  paramNotes: 'rho and sigma are the genuine bifurcation levers from the paper (rho~28 chaotic; below ~24.74 it settles). speed multiplies how many integration substeps run per frame. trail sets filament length. projAngle rotates the 3D state before the 2D projection so the butterfly can be turned to its readable face. Audio drive nudges rho and sigma by spectral centroid, drives integration speed and trail glow from loudness, and kicks the trail on each beat.',
  params: [
    { key: 'rho', label: 'rho (Rayleigh)', min: 0.5, max: 90, step: 0.5, value: 28 },
    { key: 'sigma', label: 'sigma (Prandtl)', min: 1, max: 20, step: 0.5, value: 10 },
    { key: 'speed', label: 'Integration speed', min: 1, max: 30, step: 1, value: 12 },
    { key: 'trail', label: 'Trail length', min: 200, max: 8000, step: 100, value: 3000 },
    { key: 'projAngle', label: 'View rotation', min: 0, max: 6.28, step: 0.05, value: 0.6 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.x = 1; s.y = 1; s.z = 1;
    s.beta = 8 / 3;
    s.MAXTRAIL = 8000;
    s.trail = new Float32Array(s.MAXTRAIL * 2);
    s.zbuf = new Float32Array(s.MAXTRAIL);
    s.tn = 0;
    s.head = 0;
    s.rng = LABUTIL.mulberry32(0x10c2e3);
    // pre-warm: integrate the default attractor so the butterfly is full on the first frame
    var rho = 28, sigma = 10, beta = s.beta, DT = 0.008;
    var x = s.x, y = s.y, z = s.z;
    for (var i = 0; i < s.MAXTRAIL; i++) {
      var k1x = sigma * (y - x), k1y = x * (rho - z) - y, k1z = x * y - beta * z;
      var xa = x + DT / 2 * k1x, ya = y + DT / 2 * k1y, za = z + DT / 2 * k1z;
      var k2x = sigma * (ya - xa), k2y = xa * (rho - za) - ya, k2z = xa * ya - beta * za;
      var xb = x + DT / 2 * k2x, yb = y + DT / 2 * k2y, zb = z + DT / 2 * k2z;
      var k3x = sigma * (yb - xb), k3y = xb * (rho - zb) - yb, k3z = xb * yb - beta * zb;
      var xc = x + DT * k3x, yc = y + DT * k3y, zc = z + DT * k3z;
      var k4x = sigma * (yc - xc), k4y = xc * (rho - zc) - yc, k4z = xc * yc - beta * zc;
      x += DT / 6 * (k1x + 2 * k2x + 2 * k3x + k4x);
      y += DT / 6 * (k1y + 2 * k2y + 2 * k3y + k4y);
      z += DT / 6 * (k1z + 2 * k2z + 2 * k3z + k4z);
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) { x = 1; y = 1; z = 1; }
      s.trail[i * 2] = x; s.trail[i * 2 + 1] = y; s.zbuf[i] = z;
    }
    s.head = 0; s.tn = s.MAXTRAIL; s.x = x; s.y = y; s.z = z;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // audio: centroid nudges the bifurcation, loudness drives speed/glow, beat kicks
    var react = (p.react == null ? 0.85 : p.react);
    var lv = a ? LABUTIL.clamp(a.level, 0, 1) : 0;
    var ce = a ? LABUTIL.clamp(a.centroid, 0, 1) : 0;
    var bt = a ? LABUTIL.clamp(a.beat, 0, 1) : 0;
    var pk = a ? LABUTIL.clamp(a.peak, 0, 1) : 0;
    // silence = stillness: act ~0 when quiet, rises only with real sound
    var act = LABUTIL.clamp(Math.max(lv, pk * 0.7, bt) * react, 0, 1);

    var rho = LABUTIL.clamp(p.rho + (ce - 0.5) * 6 * react, 0.5, 90);
    var sigma = LABUTIL.clamp(p.sigma + (ce - 0.5) * 3 * react, 1, 20);
    // near-still in silence: integration nearly halts when quiet, runs with sound
    var speed = Math.round(LABUTIL.clamp(p.speed * 1.3 * act, 0, 60));
    var glow = LABUTIL.clamp(0.85 + react * (0.4 * lv + 0.5 * bt), 0.4, 1.6);
    var trail = Math.round(LABUTIL.clamp(p.trail, 200, s.MAXTRAIL));
    var ang = LABUTIL.clamp(p.projAngle, 0, 6.2832);
    var beta = s.beta;
    var DT = 0.008;
    var cap = s.MAXTRAIL;
    if (!s.zbuf) s.zbuf = new Float32Array(cap);

    // reset if state went non-finite or diverged
    if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(s.z) ||
        Math.abs(s.x) > 1e4 || Math.abs(s.y) > 1e4 || Math.abs(s.z) > 1e4) {
      s.x = 1 + (s.rng() - 0.5) * 1e-3;
      s.y = 1 + (s.rng() - 0.5) * 1e-3;
      s.z = 1 + (s.rng() - 0.5) * 1e-3;
    }

    function fx(x, y, z) { return sigma * (y - x); }
    function fy(x, y, z) { return x * (rho - z) - y; }
    function fz(x, y, z) { return x * y - beta * z; }

    // integrate `speed` RK4 substeps; push each point onto the ring
    for (var i = 0; i < speed; i++) {
      var x = s.x, y = s.y, z = s.z;
      var k1x = fx(x, y, z), k1y = fy(x, y, z), k1z = fz(x, y, z);
      var x2 = x + DT / 2 * k1x, y2 = y + DT / 2 * k1y, z2 = z + DT / 2 * k1z;
      var k2x = fx(x2, y2, z2), k2y = fy(x2, y2, z2), k2z = fz(x2, y2, z2);
      var x3 = x + DT / 2 * k2x, y3 = y + DT / 2 * k2y, z3 = z + DT / 2 * k2z;
      var k3x = fx(x3, y3, z3), k3y = fy(x3, y3, z3), k3z = fz(x3, y3, z3);
      var x4 = x + DT * k3x, y4 = y + DT * k3y, z4 = z + DT * k3z;
      var k4x = fx(x4, y4, z4), k4y = fy(x4, y4, z4), k4z = fz(x4, y4, z4);
      s.x = x + DT / 6 * (k1x + 2 * k2x + 2 * k3x + k4x);
      s.y = y + DT / 6 * (k1y + 2 * k2y + 2 * k3y + k4y);
      s.z = z + DT / 6 * (k1z + 2 * k2z + 2 * k3z + k4z);
      if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(s.z)) {
        s.x = 1; s.y = 1; s.z = 1; continue;
      }
      s.trail[s.head * 2] = s.x;
      s.trail[s.head * 2 + 1] = s.y;
      s.zbuf[s.head] = s.z;
      s.head = (s.head + 1) % cap;
      if (s.tn < cap) s.tn++;
    }

    var nDraw = Math.min(trail, s.tn);
    if (nDraw < 2) return;

    var ca = Math.cos(ang), sa = Math.sin(ang);
    var scale = Math.min(w, h) / 60;
    var cx = w * 0.5, cy = h * 0.5;

    function project(px, py, pz) {
      var xr = px * ca - py * sa;
      return [cx + xr * scale, cy + (24 - pz) * scale];
    }

    // walk from oldest of the last nDraw points to the head
    var startPt = (s.head - nDraw + cap) % cap;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.25;

    var BANDS = 32;
    var per = Math.ceil((nDraw - 1) / BANDS);
    for (var b = 0; b < BANDS; b++) {
      var sIdx = b * per;
      if (sIdx >= nDraw - 1) break;
      var eIdx = Math.min(nDraw - 1, sIdx + per);
      var aMid = LABUTIL.lerp(0.14, 1.0, (sIdx + eIdx) * 0.5 / Math.max(1, nDraw - 1));
      ctx.strokeStyle = LABUTIL.rgba(theme.ink, LABUTIL.clamp(aMid * glow, 0, 1));
      ctx.beginPath();
      var pi0 = (startPt + sIdx) % cap;
      var P0 = project(s.trail[pi0 * 2], s.trail[pi0 * 2 + 1], s.zbuf[pi0]);
      ctx.moveTo(P0[0], P0[1]);
      for (var jj = sIdx + 1; jj <= eIdx; jj++) {
        var pii = (startPt + jj) % cap;
        var Pj = project(s.trail[pii * 2], s.trail[pii * 2 + 1], s.zbuf[pii]);
        ctx.lineTo(Pj[0], Pj[1]);
      }
      ctx.stroke();
    }

    // head dot in amber
    var hi = (s.head - 1 + cap) % cap;
    var Ph = project(s.trail[hi * 2], s.trail[hi * 2 + 1], s.zbuf[hi]);
    if (isFinite(Ph[0]) && isFinite(Ph[1])) {
      ctx.fillStyle = LABUTIL.rgba(theme.accent, 1);
      ctx.beginPath();
      var headR = LABUTIL.clamp(2 + react * (2.5 * lv + 3.5 * bt), 1, 9);
      ctx.arc(Ph[0], Ph[1], headR, 0, LABUTIL.TAU);
      ctx.fill();
    }
  }
});

