LAB.register({
  id: "soliton-kdv",
  title: "KdV Solitons",
  group: "Vibration and matter",
  essence: "Sech-squared water pulses, the tall one overtakes the short one and passes through unchanged.",
  blurb: "Solitary waves that survive collision. The Korteweg-de Vries equation for shallow water has exact pulse solutions shaped like sech-squared, and a taller pulse runs faster than a short one. Two or three of them travel along a water-line, the tall one catches up, climbs over the others and passes through, the heap at the meeting point not the sum of two pulses but the nonlinear interaction, and then each re-emerges with its old height and speed, only shifted in position. Drawn from the exact Hirota tau-function, so the collision is faithful, no stiff PDE solving. Clean ink line on black, the cleanest picture of a nonlinear wave that keeps its identity.",
  tags: ["line", "fluid", "vibration", "monochrome", "realtime"],
  lineage: "Korteweg and de Vries 1895; Zabusky and Kruskal 1965 coined soliton; Hirota bilinear method. Scientific anchor: u=2 d^2/dx^2 log F, F=1+e^eta1+e^eta2+A12 e^(eta1+eta2), eta_i=k_i(x-x0_i)-k_i^3 t, A12=((k1-k2)/(k1+k2))^2, amplitude k_i^2/2 and speed k_i^2 coupled.",
  dialect: "Phase Interferometer",
  palette: "monochrome ink",
  paramNotes: "The two wavenumbers k1 and k2 set both the heights and the speeds of the two solitons at once (that coupling is the physics, taller is faster), expose both. Separation sets how far apart they start so the overtake lands on screen. Speed scales the shared clock so the collision reads at a calm pace. All real levers, no colour. Audio drive (react): loudness lifts the water amplitude and quickens the collision, low end adds body, and each beat launches a fresh sech-squared pulse riding across the line.",
  params: [
    { key: "k1", label: "Soliton 1 k", min: 0.6, max: 1.6, step: 0.05, value: 1.2 },
    { key: "k2", label: "Soliton 2 k", min: 0.4, max: 1.2, step: 0.05, value: 0.7 },
    { key: "sep", label: "Separation", min: 6, max: 24, step: 1, value: 14 },
    { key: "speed", label: "Speed", min: 0.1, max: 1.5, step: 0.05, value: 0.5 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.ready = true;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var clamp = LABUTIL.clamp;
    a = a || {};
    var react = (p.react == null ? 0.85 : clamp(p.react, 0, 1.5));
    var lvl = clamp(a.level || 0, 0, 1);
    var bass = clamp(a.bass || 0, 0, 1);
    var beat = clamp(a.beat || 0, 0, 1);
    var peak = clamp(a.peak || 0, 0, 1);
    var dt = clamp(a.dt == null ? 0.016 : a.dt, 0, 0.1);
    // activity envelope: ~0 in silence, ~1 with sound
    var act = clamp(Math.max(lvl, peak * 0.7, beat) * react, 0, 1);
    var IDLE = 0.07, GAIN = 1.6;

    // --- params / physics ---
    var k1 = clamp(p.k1, 0.4, 1.8);
    var k2 = clamp(p.k2, 0.4, 1.8);
    if (Math.abs(k1 - k2) < 0.03) k2 += 0.03; // keep A12 finite, nonzero
    var sep = clamp(p.sep, 4, 30);
    // base travel rate; the collision crawls in silence and rides the room with sound
    var speedP = clamp(p.speed, 0.05, 2);

    var kFast = Math.max(k1, k2);
    var A12 = ((k1 - k2) / (k1 + k2));
    A12 = A12 * A12;

    // place the faster soliton behind (to the left) so it overtakes
    var x0_1 = (k1 >= k2) ? -sep : 0;
    var x0_2 = (k1 >= k2) ? 0 : -sep;

    var W = Math.max(18, sep * 1.3);

    // world clock: loop so the overtake replays; fast sweeps the frame
    var Tspan = (2 * W * 1.3) / (kFast * kFast);
    if (!isFinite(Tspan) || Tspan < 1) Tspan = 20;
    // integrate our own phase so the solitons freeze in silence, travel with sound
    s.ph = (s.ph || 0) + dt * speedP * (IDLE + GAIN * act);
    if (!isFinite(s.ph)) s.ph = 0;
    var tt = (s.ph % Tspan) - Tspan * 0.5;
    if (!isFinite(tt)) tt = -Tspan * 0.5;

    // window follows midpoint of the two analytic crest paths
    var c1 = x0_1 + k1 * k1 * tt;
    var c2 = x0_2 + k2 * k2 * tt;
    var mid = (c1 + c2) * 0.5;
    if (!isFinite(mid)) mid = 0;

    function lF(x) {
      var e1 = k1 * (x - x0_1) - k1 * k1 * k1 * tt;
      var e2 = k2 * (x - x0_2) - k2 * k2 * k2 * tt;
      if (e1 > 60) e1 = 60; else if (e1 < -60) e1 = -60;
      if (e2 > 60) e2 = 60; else if (e2 < -60) e2 = -60;
      var E1 = Math.exp(e1), E2 = Math.exp(e2);
      var F = 1 + E1 + E2 + A12 * E1 * E2;
      if (!(F >= 1)) F = 1;
      return Math.log(F);
    }
    var hh = 0.01;
    function u(x) {
      var val = 2 * (lF(x + hh) - 2 * lF(x) + lF(x - hh)) / (hh * hh);
      if (!isFinite(val)) return 0;
      if (val < 0) val = 0; // physical solution is >=0 here
      return val;
    }

    function sx(x) { return w * (x - (mid - W)) / (2 * W); }
    function invSx(px) { return mid - W + (px / w) * (2 * W); }

    var baseY = h * 0.72;
    var ampScale = (h * 0.34) / (kFast * kFast / 2);
    if (!isFinite(ampScale)) ampScale = h * 0.34;

    // loudness lifts the water relief, low end adds body (base term keeps it alive in silence)
    var ampMod = clamp(0.65 + 0.8 * react * lvl + 0.5 * react * bass, 0, 3);

    // a.beat launches a fresh sech-squared pulse that rides across the line
    var peakU = kFast * kFast / 2;
    var beatAmp = react * beat * peakU * 0.9;
    var kb = kFast;
    // launch a fresh pulse on beat onset; its travel also crawls in silence
    var prevBeat = s.pbeat || 0;
    if (beat > 0.5 && prevBeat <= 0.5) s.bph = 0;
    s.pbeat = beat;
    s.bph = (s.bph || 0) + dt * speedP * 0.5 * (IDLE + GAIN * act);
    if (!isFinite(s.bph)) s.bph = 0;
    var travel = (s.bph % (2 * W));
    if (!isFinite(travel)) travel = 0;
    function sech2(z) {
      var c = Math.cosh(z);
      if (!isFinite(c) || c < 1e-6) return 0;
      var v = 1 / (c * c);
      return isFinite(v) ? v : 0;
    }
    function extraU(x) {
      if (beatAmp <= 0) return 0;
      var xb = (mid - W) + travel;
      return beatAmp * sech2(kb * (x - xb));
    }

    // --- frame ---
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // still-water reference line
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(w, baseY);
    ctx.stroke();

    // build profile points once (reuse for fill + stroke)
    var pts = [];
    for (var px = 0; px <= w; px += 2) {
      var x = invSx(px);
      var uu = u(x) * ampMod + extraU(x);
      var y = baseY - uu * ampScale;
      if (!isFinite(y)) y = baseY;
      pts.push(px, y);
    }

    // fill under curve (water body)
    ctx.fillStyle = LABUTIL.rgba(theme.ink, 0.06);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (var i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineTo(w, baseY);
    ctx.closePath();
    ctx.fill();

    // crest-path ticks for the two identities, only when well separated
    var sepNow = Math.abs(c1 - c2);
    if (sepNow > 4.5) {
      ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.4);
      ctx.lineWidth = 1;
      var tx1 = sx(c1), tx2 = sx(c2);
      if (tx1 >= 0 && tx1 <= w) {
        ctx.beginPath();
        ctx.moveTo(tx1, baseY + 0.02 * h);
        ctx.lineTo(tx1, baseY - 0.04 * h);
        ctx.stroke();
      }
      if (tx2 >= 0 && tx2 <= w) {
        ctx.beginPath();
        ctx.moveTo(tx2, baseY + 0.02 * h);
        ctx.lineTo(tx2, baseY - 0.04 * h);
        ctx.stroke();
      }
    }

    // wave profile stroke
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.92);
    ctx.lineWidth = 1.5 + 0.8 * react * beat;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (var j = 2; j < pts.length; j += 2) ctx.lineTo(pts[j], pts[j + 1]);
    ctx.stroke();
  }
});
