LAB.register({
  id: 'double-pendulum',
  title: 'Double Pendulum Ensemble',
  group: 'Particle and attractor',
  essence: 'An ensemble of double pendulums started from almost-identical angles is integrated together; the chaotic motion fans the tips out from one line into a divergent spray, sensitive dependence made directly visible.',
  blurb: "The double pendulum is the simplest mechanical system that turns chaotic. Two rods, two bobs, gravity, and the lower arm's reaction on the upper arm couple into two equations with no closed-form solution. About 80 copies are launched from the same release angle plus a microscopic increment between neighbours, then stepped together with RK4 at a small timestep. For a second or two they swing as one curtain; then the exponential separation takes over and the bob tips fan from a single line into a divergent spray. Each tip leaves a short fading filament, so the moment chaos sets in is drawn as the curtain tearing apart. The arms themselves are kept faint; the spreading tips carry the image.",
  tags: ['particle','line','monochrome','accent','realtime'],
  lineage: 'Double pendulum as the canonical low-dimensional chaotic mechanical system; explicit Lagrangian equations of motion from myPhysicsLab (Neumann), RK4 integration. Sensitive dependence on initial conditions per Wisdom/Shinbrot et al., Chaos in a double pendulum (Am. J. Phys. 60, 1992).',
  dialect: 'Vector Plume',
  palette: 'Monochrome on near-black. The ensemble of arms is drawn very faint in ink (alpha ~0.06) so it reads as a soft moving lattice; the bob-tip filaments are warm off-white fading to nothing along their length. The single newest, central pendulum tip is the one amber accent so the eye has an anchor as the others diverge. No second hue.',
  paramNotes: 'count is the ensemble size (more copies make the fan denser and the divergence cloud smoother). spreadDeg is the microscopic angular offset spanned across the ensemble in degrees, the sensitive-dependence knob: tiny values stay coherent longer before tearing, larger values fan out almost at once. gravity scales the timescale of the chaos. massRatio (m2/m1) and trail let the figure be tuned; lowering massRatio calms the lower arm, trail sets filament length. Audio drive raises gravity with loudness and re-energises the ensemble on each beat, pulsing the central accent tip.',
  params: [
    { key: 'count', label: 'Ensemble size', min: 8, max: 140, step: 1, value: 80 },
    { key: 'spreadDeg', label: 'Angle spread', min: 0.001, max: 2, step: 0.001, value: 0.05 },
    { key: 'gravity', label: 'Gravity', min: 4, max: 24, step: 0.5, value: 9.81 },
    { key: 'massRatio', label: 'Mass ratio m2/m1', min: 0.2, max: 3, step: 0.05, value: 1 },
    { key: 'trail', label: 'Tip trail', min: 6, max: 80, step: 1, value: 34 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.DT = 0.006;
    s.L1 = 1; s.L2 = 1; s.m1 = 1;
    s.TH1_0 = 2.2; s.TH2_0 = 2.2;
    s.modelTime = 0;
    s.WINDOW = 26;
    s.maxN = 140;
    s.maxTrail = 80;
    s.y = new Float32Array(s.maxN * 4);
    s.trail = new Float32Array(s.maxN * s.maxTrail * 2);
    s.thead = new Int32Array(s.maxN);
    s.tcount = new Int32Array(s.maxN);
    s.N = 0;
    // derivative f(state[i*4..], out[4]) using explicit EOM
    s.deriv = function (th1, th2, w1, w2, g, m2, out) {
      var L1 = s.L1, L2 = s.L2, m1 = s.m1;
      var d = th1 - th2;
      var den = L1 * (2 * m1 + m2 - m2 * Math.cos(2 * th1 - 2 * th2));
      if (Math.abs(den) < 1e-9) den = (den < 0 ? -1 : 1) * 1e-9;
      var a1 = (-g * (2 * m1 + m2) * Math.sin(th1)
        - m2 * g * Math.sin(th1 - 2 * th2)
        - 2 * Math.sin(d) * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * Math.cos(d))) / den;
      var den2 = L2 * (2 * m1 + m2 - m2 * Math.cos(2 * th1 - 2 * th2));
      if (Math.abs(den2) < 1e-9) den2 = (den2 < 0 ? -1 : 1) * 1e-9;
      var a2 = (2 * Math.sin(d) * (w1 * w1 * L1 * (m1 + m2)
        + g * (m1 + m2) * Math.cos(th1)
        + w2 * w2 * L2 * m2 * Math.cos(d))) / den2;
      out[0] = w1; out[1] = w2; out[2] = a1; out[3] = a2;
    };
    s.rk4 = function (N, g, m2, dt) {
      var y = s.y;
      var k1 = s._k1 || (s._k1 = new Float32Array(4));
      var k2 = s._k2 || (s._k2 = new Float32Array(4));
      var k3 = s._k3 || (s._k3 = new Float32Array(4));
      var k4 = s._k4 || (s._k4 = new Float32Array(4));
      for (var i = 0; i < N; i++) {
        var o = i * 4;
        var a = y[o], b = y[o + 1], c = y[o + 2], dd = y[o + 3];
        if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(dd)) continue;
        s.deriv(a, b, c, dd, g, m2, k1);
        s.deriv(a + dt / 2 * k1[0], b + dt / 2 * k1[1], c + dt / 2 * k1[2], dd + dt / 2 * k1[3], g, m2, k2);
        s.deriv(a + dt / 2 * k2[0], b + dt / 2 * k2[1], c + dt / 2 * k2[2], dd + dt / 2 * k2[3], g, m2, k3);
        s.deriv(a + dt * k3[0], b + dt * k3[1], c + dt * k3[2], dd + dt * k3[3], g, m2, k4);
        y[o] = a + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
        y[o + 1] = b + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        y[o + 2] = c + dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
        y[o + 3] = dd + dt / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
      }
    };
    s.seed = function (N, spreadDeg) {
      s.N = N;
      var spread = spreadDeg * Math.PI / 180;
      for (var i = 0; i < N; i++) {
        var o = i * 4;
        var frac = N > 1 ? (i / (N - 1) - 0.5) : 0;
        s.y[o] = s.TH1_0;
        s.y[o + 1] = s.TH2_0 + frac * spread;
        s.y[o + 2] = 0;
        s.y[o + 3] = 0;
        s.thead[i] = 0;
        s.tcount[i] = 0;
      }
      s.modelTime = 0;
    };
    s.tipOf = function (i, cx, cy, len) {
      var o = i * 4, th1 = s.y[o], th2 = s.y[o + 1];
      var p1x = cx + len * Math.sin(th1), p1y = cy + len * Math.cos(th1);
      var p2x = p1x + len * Math.sin(th2), p2y = p1y + len * Math.cos(th2);
      return [p1x, p1y, p2x, p2y];
    };
    s.pushTip = function (i, x, y, maxTrail) {
      var base = i * s.maxTrail * 2;
      var hd = s.thead[i];
      s.trail[base + hd * 2] = x;
      s.trail[base + hd * 2 + 1] = y;
      s.thead[i] = (hd + 1) % maxTrail;
      if (s.tcount[i] < maxTrail) s.tcount[i]++;
      else if (s.tcount[i] > maxTrail) s.tcount[i] = maxTrail;
    };
    // PREWARM: seed default ensemble and run ~1.6s of model time, filling tip rings
    var N0 = 80;
    s.seed(N0, 0.05);
    var g0 = 9.81, m20 = 1, dt = s.DT;
    // placeholder cx/cy/len for tip rings; refilled each frame anyway
    var cx = w / 2, cy = 0.32 * h, len = 0.22 * Math.min(w, h);
    var trailLen = 34;
    var steps = Math.round(1.6 / dt);
    var stride = Math.max(1, Math.floor(steps / trailLen));
    for (var st = 0; st < steps; st++) {
      s.rk4(N0, g0, m20, dt);
      s.modelTime += dt;
      if (st % stride === 0) {
        for (var i = 0; i < N0; i++) {
          var tp = s.tipOf(i, cx, cy, len);
          s.pushTip(i, tp[2], tp[3], trailLen);
        }
      }
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    // audio: loudness raises gravity (faster chaos), beat injects energy into the ensemble
    var react = (p.react == null ? 0.85 : p.react);
    var lv = a ? LABUTIL.clamp(a.level, 0, 1) : 0;
    var bt = a ? LABUTIL.clamp(a.beat, 0, 1) : 0;
    var pk = a ? LABUTIL.clamp(a.peak, 0, 1) : 0;
    // silence = stillness: act ~0 when quiet, rises only with real sound
    var act = LABUTIL.clamp(Math.max(lv, pk * 0.7, bt) * react, 0, 1);
    var N = Math.max(2, Math.min(s.maxN, Math.round(p.count)));
    var trailLen = Math.max(2, Math.min(s.maxTrail, Math.round(p.trail)));
    var g = LABUTIL.clamp(p.gravity * (1 + 0.55 * react * lv), 4, 40);
    var m2 = p.massRatio;
    if (N !== s.N) s.seed(N, p.spreadDeg);
    var kick = react * bt;
    if (kick > 0.001) {
      for (var qi = 0; qi < N; qi++) {
        var qo = qi * 4;
        s.y[qo + 2] = LABUTIL.clamp(s.y[qo + 2] + kick * 1.2, -60, 60);
        s.y[qo + 3] = LABUTIL.clamp(s.y[qo + 3] + kick * 1.8, -60, 60);
      }
    }
    // detect spread change implicitly via reseed on window; keep deterministic
    // integrate a fixed model-time budget per frame for smooth 60fps motion
    var dt = s.DT;
    // near-still in silence: integration nearly halts when quiet, swings with sound
    var subs = Math.round(LABUTIL.clamp(28 * act, 0, 28));
    var cx = w / 2, cy = 0.32 * h, len = 0.22 * Math.min(w, h);
    var pushEvery = 4, ctr = 0;
    for (var st = 0; st < subs; st++) {
      s.rk4(N, g, m2, dt);
      s.modelTime += dt;
      ctr++;
      if (ctr >= pushEvery) {
        ctr = 0;
        for (var i = 0; i < N; i++) {
          var tp = s.tipOf(i, cx, cy, len);
          s.pushTip(i, tp[2], tp[3], trailLen);
        }
      }
    }
    // reset story on window or non-finite
    var bad = false;
    var c0 = (N >> 1) * 4;
    if (!isFinite(s.y[c0]) || !isFinite(s.y[c0 + 1])) bad = true;
    if (s.modelTime > s.WINDOW || bad) {
      s.seed(N, p.spreadDeg);
      // refill tip rings along a short fresh path so no empty frame
      var stride = Math.max(1, Math.floor(Math.round(1.2 / dt) / trailLen));
      var steps2 = Math.round(1.2 / dt);
      for (var st2 = 0; st2 < steps2; st2++) {
        s.rk4(N, g, m2, dt);
        s.modelTime += dt;
        if (st2 % stride === 0) {
          for (var i2 = 0; i2 < N; i2++) {
            var tp2 = s.tipOf(i2, cx, cy, len);
            s.pushTip(i2, tp2[2], tp2[3], trailLen);
          }
        }
      }
    }

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // faint arms
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.06);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < N; i++) {
      var tp = s.tipOf(i, cx, cy, len);
      ctx.moveTo(cx, cy);
      ctx.lineTo(tp[0], tp[1]);
      ctx.lineTo(tp[2], tp[3]);
    }
    ctx.stroke();

    var center = N >> 1;
    // tip filaments
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = 0; i < N; i++) {
      if (i === center) continue;
      var nC = s.tcount[i];
      if (nC < 2) continue;
      var base = i * s.maxTrail * 2, hd = s.thead[i];
      var bands = Math.min(nC - 1, 16);
      for (var b = 0; b < bands; b++) {
        var f0 = b / bands, f1 = (b + 1) / bands;
        var i0 = Math.floor(f0 * (nC - 1)), i1 = Math.floor(f1 * (nC - 1));
        if (i1 <= i0) continue;
        var alpha = LABUTIL.lerp(0.0, 0.5, f1);
        ctx.strokeStyle = LABUTIL.rgba(theme.ink, alpha);
        ctx.beginPath();
        for (var k = i0; k <= i1; k++) {
          var ri = (hd - nC + k + s.maxTrail * 3) % s.maxTrail;
          var x = s.trail[base + ri * 2], y = s.trail[base + ri * 2 + 1];
          if (k === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // central accent filament
    var nCc = s.tcount[center];
    if (nCc >= 2) {
      var baseC = center * s.maxTrail * 2, hdC = s.thead[center];
      var bandsC = Math.min(nCc - 1, 18);
      ctx.lineWidth = 1.5;
      for (var b2 = 0; b2 < bandsC; b2++) {
        var f0c = b2 / bandsC, f1c = (b2 + 1) / bandsC;
        var i0c = Math.floor(f0c * (nCc - 1)), i1c = Math.floor(f1c * (nCc - 1));
        if (i1c <= i0c) continue;
        var alphaC = LABUTIL.lerp(0.05, 0.85, f1c);
        ctx.strokeStyle = LABUTIL.rgba(theme.accent, alphaC);
        ctx.beginPath();
        for (var kc = i0c; kc <= i1c; kc++) {
          var ric = (hdC - nCc + kc + s.maxTrail * 3) % s.maxTrail;
          var xc = s.trail[baseC + ric * 2], yc = s.trail[baseC + ric * 2 + 1];
          if (kc === i0c) ctx.moveTo(xc, yc); else ctx.lineTo(xc, yc);
        }
        ctx.stroke();
      }
      var tpc = s.tipOf(center, cx, cy, len);
      ctx.fillStyle = LABUTIL.rgba(theme.accent, 0.95);
      ctx.beginPath();
      var hr = LABUTIL.clamp(2.2 + react * (1.5 * lv + 2.2 * bt), 1, 8);
      ctx.arc(tpc[2], tpc[3], hr, 0, LABUTIL.TAU);
      ctx.fill();
    }
  }
});
