LAB.register({
  id: 'belousov-zhabotinsky',
  title: 'BZ Spiral Waves',
  group: 'Fluid and field',
  essence: 'An excitable chemical medium rotating spiral and target waves, computed as a two-variable FitzHugh-Nagumo reaction-diffusion field seeded to spawn spirals.',
  blurb: 'The Belousov-Zhabotinsky reaction makes self-organizing spiral fronts in a still dish. This integrates the FitzHugh-Nagumo excitable model on a small grid, seeds a broken wavefront so it curls into a rotating spiral, distinct from a Turing/Gray-Scott pattern.',
  tags: ['field', 'fluid', 'raster', 'monochrome', 'realtime', 'slow'],
  lineage: 'Belousov 1950s, Zhabotinsky 1960s; Greenberg-Hastings excitable automaton 1978; FitzHugh 1961 / Nagumo 1962 two-variable reduction of Hodgkin-Huxley. Spiral period ~ 11.2 in nondimensional FHN units.',
  dialect: 'Faraday Cymatic Field',
  palette: 'Monochrome. Excited (oxidized) wavefronts bright warm-amber on near-black refractory and resting medium; single accent.',
  paramNotes: 'excitability is the FHN epsilon (timescale separation): smaller means faster, thinner, more tightly wound spirals. threshold is beta, the firing offset that sets wave speed and gap. recovery is gamma, controlling refractory length. diffusion scales front sharpness vs blur. Audio drive: a.level and a.flux set the spiral integration speed (rotation), a.centroid biases the firing threshold (wave gap), a.level adds front diffusion, and a.beat injects fresh excitation that spawns new wave fronts.',
  params: [
    { key: 'excitability', label: 'Excitability eps', min: 0.1, max: 0.6, step: 0.01, value: 0.3 },
    { key: 'threshold', label: 'Threshold beta', min: 0.4, max: 0.95, step: 0.01, value: 0.7 },
    { key: 'recovery', label: 'Recovery gamma', min: 0.3, max: 0.9, step: 0.01, value: 0.5 },
    { key: 'diffusion', label: 'Diffusion', min: 0.4, max: 2.5, step: 0.05, value: 1 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    var N = 150;
    s.N = N;
    var n = N * N;
    s.u = new Float32Array(n);
    s.v = new Float32Array(n);
    s.un = new Float32Array(n);
    s.vn = new Float32Array(n);
    s.img = null;
    s.lastP = null;
    s.warmed = false;
  },
  seed(s) {
    // Barkley excitable medium: u in ~[0,1]. Broken-front initial condition:
    // left half excited (u=1), the recovery variable v ramps with the angle
    // around the centre so the excited edge meets fresh and refractory medium,
    // giving a free wave-tip that curls into a rotating spiral.
    var N = s.N, u = s.u, v = s.v;
    var cx = N / 2, cy = N / 2;
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var idx = j * N + i;
        u[idx] = (i < cx) ? 1.0 : 0.0;
        // lower half already partly recovered (refractory) -> tip forms at the gap
        v[idx] = (j < cy) ? 0.5 : 0.0;
      }
    }
  },
  step(s, p, sub) {
    // Barkley model (canonical excitable medium, reliable spirals):
    //   du/dt = (1/eps) u (1-u) (u - (v+b)/a) + D lap(u)
    //   dv/dt = kv (u - v)
    // params: eps = excitability (fast activator), a from recovery, b from threshold.
    var N = s.N;
    var u = s.u, v = s.v, un = s.un, vn = s.vn;
    // map sliders INSIDE Barkley's textbook spiral regime (around a=0.75, b=0.06,
    // eps=0.02..0.07) so a rotating spiral survives the whole range and never retracts.
    var eps = 0.02 + (LABUTIL.clamp(p.excitability, 0.1, 0.6) - 0.1) / 0.5 * 0.05;
    var thr = (LABUTIL.clamp(p.threshold, 0.4, 0.95) - 0.4) / 0.55;   // 0..1
    var rec = (LABUTIL.clamp(p.recovery, 0.3, 0.9) - 0.3) / 0.6;      // 0..1
    var D = LABUTIL.clamp(p.diffusion, 0.4, 2.5);
    var a = 0.70 + rec * 0.10;         // excitation gain / plateau height (0.70..0.80)
    var b = 0.03 + thr * 0.04;         // firing threshold offset (0.03..0.07)
    // recovery rate: slower wake at higher diffusion keeps the tip from retracting
    var kv = 0.9 - 0.18 * (D - 0.4) / 2.1 - 0.12 * thr;
    if (kv < 0.5) kv = 0.5;
    var invEps = 1 / eps;
    var invA = 1 / a;
    // explicit Euler; dt chosen so dt*D < ~0.2 and dt/eps stays stable
    var dt = Math.min(0.025, 0.18 / Math.max(0.4, D), eps * 1.4);
    for (var st = 0; st < sub; st++) {
      for (var j = 0; j < N; j++) {
        var jm = j > 0 ? j - 1 : 0;          // Neumann (zero-flux) clamp
        var jp = j < N - 1 ? j + 1 : N - 1;
        var row = j * N, rm = jm * N, rp = jp * N;
        for (var i = 0; i < N; i++) {
          var im = i > 0 ? i - 1 : 0;
          var ip = i < N - 1 ? i + 1 : N - 1;
          var c = row + i;
          var uc = u[c];
          var vc = v[c];
          var lap = u[row + im] + u[row + ip] + u[rm + i] + u[rp + i] - 4 * uc;
          var thresh = (vc + b) * invA;
          var fu = invEps * uc * (1 - uc) * (uc - thresh) + D * lap;
          var fv = kv * (uc - vc);
          var nu = uc + dt * fu;
          var nv = vc + dt * fv;
          // Barkley fields stay in [0,1]; clamp keeps the explicit scheme bounded
          if (nu < 0) nu = 0; else if (nu > 1) nu = 1;
          if (nv < 0) nv = 0; else if (nv > 1) nv = 1;
          if (!isFinite(nu)) nu = uc;
          if (!isFinite(nv)) nv = vc;
          un[c] = nu; vn[c] = nv;
        }
      }
      var tu = s.u; s.u = s.un; s.un = tu; u = s.u; un = s.un;
      var tv = s.v; s.v = s.vn; s.vn = tv; v = s.v; vn = s.vn;
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var N = s.N;
    var react = (p.react == null ? 0.85 : p.react);
    var lvl = LABUTIL.clamp(a.level, 0, 1);
    var cen = LABUTIL.clamp(a.centroid, 0, 1);
    var beat = LABUTIL.clamp(a.beat, 0, 1);
    var flux = LABUTIL.clamp(a.flux, 0, 1);
    var peak = LABUTIL.clamp(a.peak, 0, 1);
    // silence = stillness: act ~0 when quiet, rises only with real sound
    var act = LABUTIL.clamp(Math.max(lvl, peak * 0.7, beat) * react, 0, 1);
    // pk is slider-only so audio never triggers a reseed/warm; audio rides on top
    var pk = Math.round(p.excitability * 100) + ':' + Math.round(p.threshold * 100) + ':' + Math.round(p.recovery * 100) + ':' + Math.round(p.diffusion * 100);
    // (re)seed + pre-warm whenever the regime changes or on first frame
    if (!s.warmed || s.lastP !== pk) {
      this.seed(s);
      this.step(s, p, 900);   // run silently so the thumbnail shows a wound spiral
      s.warmed = true;
      s.lastP = pk;
    } else {
      // audio rides on the slider baseline, kept inside the stable Barkley window
      var pa = {
        excitability: p.excitability,
        threshold: LABUTIL.clamp(p.threshold + react * (cen - 0.5) * 0.18, 0.4, 0.95),
        recovery: p.recovery,
        diffusion: LABUTIL.clamp(p.diffusion + react * (0.5 * lvl) * 0.6, 0.4, 2.5)
      };
      // near-still in silence: spiral integration freezes when quiet, rotates with sound
      var sub = Math.max(0, Math.min(28, Math.round(26 * act)));
      this.step(s, pa, sub);
    }

    // a.beat injects a fresh excitation that spawns a new wave front
    s.rnd = s.rnd || LABUTIL.mulberry32(20240611);
    if (react * beat > 0.62) {
      var uu = s.u;
      var ssx = 4 + Math.floor(s.rnd() * (N - 8));
      var ssy = 4 + Math.floor(s.rnd() * (N - 8));
      var srr = 2 + Math.floor(s.rnd() * 2);
      for (var sdy = -srr; sdy <= srr; sdy++) {
        for (var sdx = -srr; sdx <= srr; sdx++) {
          if (sdx * sdx + sdy * sdy > srr * srr) continue;
          var sxx = ssx + sdx, syy = ssy + sdy;
          if (sxx < 0 || syy < 0 || sxx >= N || syy >= N) continue;
          uu[syy * N + sxx] = 1;
        }
      }
    }

    var u = s.u;
    var img = s.img;
    if (!img || img.width !== N || img.height !== N) {
      img = s.img = ctx.createImageData(N, N);
      var dd = img.data;
      for (var q = 3; q < dd.length; q += 4) dd[q] = 255;
    }
    var data = img.data;
    var n = N * N;
    // Barkley u in [0,1]: excited plateau ~1 glows amber, resting/refractory ~0 stays black.
    for (var i = 0; i < n; i++) {
      var m = u[i];
      if (m < 0) m = 0; else if (m > 1) m = 1;
      var g = LABUTIL.smoothstep(0.18, 0.62, m);
      var o = i * 4;
      data[o] = 255 * g;
      data[o + 1] = 170 * g * g;
      data[o + 2] = 60 * g * g * g;
    }

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    var off = s._off;
    if (!off) {
      try { off = s._off = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(N, N) : null; } catch (e) { off = s._off = null; }
      if (off) s._offctx = off.getContext('2d');
    }
    var prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if (off && s._offctx) {
      s._offctx.putImageData(img, 0, 0);
      ctx.drawImage(off, 0, 0, N, N, 0, 0, w, h);
    } else {
      ctx.putImageData(img, 0, 0);
      if (ctx.canvas) ctx.drawImage(ctx.canvas, 0, 0, N, N, 0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = prevSmooth;

    // faint dish vignette for the instrument register
    var cx = w * 0.5, cy = h * 0.5, rad = Math.min(w, h) * 0.5;
    var grad = ctx.createRadialGradient(cx, cy, rad * 0.7, cx, cy, rad * 1.05);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, LABUTIL.rgba(theme.bg, 0.55));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,170,60,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.96, 0, LABUTIL.TAU);
    ctx.stroke();
  }
});

