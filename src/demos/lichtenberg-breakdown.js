LAB.register({
  id: 'lichtenberg-breakdown',
  title: 'Lichtenberg Breakdown',
  group: 'Fractal and recursion',
  essence: 'Dielectric breakdown grown by the Niemeyer-Pietronero-Wiesmann model: thin ink filaments branch toward regions of high potential with probability proportional to the local field to the power eta, the field screened by the existing discharge.',
  blurb: "A discharge pattern grows on a lattice. At every candidate site on the pattern boundary the breakdown probability is the local potential gradient raised to a tuning exponent eta. The potential solves Laplace's equation with the pattern held at zero and the far boundary at one, so already-grown branches screen their neighbors. Low eta fills space densely; high eta gives the sparse, treelike Lichtenberg figure of a lightning strike or a discharge in acrylic.",
  tags: ['fractal', 'line', 'particle', 'monochrome', 'accent', 'field'],
  lineage: 'Niemeyer, Pietronero, Wiesmann 1984, Fractal Dimension of Dielectric Breakdown, PRL 52, 1033; diffusion-limited aggregation (Witten and Sander); Laplacian growth.',
  dialect: 'Brittle Stress Matrix',
  palette: 'Black dielectric, single warm-amber discharge filaments, optional brief white-hot at the active growth tips. One accent only, branches thin and bright on near-black.',
  paramNotes: 'eta is the central DBM lever: 0 = dense space-filling, ~1 = lightning-like, >2 = sparse spindly; growthrate sets new sites per frame; branchbias biases growth outward toward the boundary (the high-potential direction); decay fades old filaments; seedmode toggles a point strike vs a line electrode. Audio drive: a.level and a.peak set branch density (sites grown per frame), a.beat/a.peak trigger a fresh discharge once a figure has grown, and a.high lifts filament brightness.',
  params: [
    { key: 'eta', label: 'DBM eta', min: 0, max: 4, step: 0.05, value: 1.6 },
    { key: 'growthrate', label: 'Sites/frame', min: 1, max: 40, step: 1, value: 8 },
    { key: 'branchbias', label: 'Outward bias', min: 0, max: 2, step: 0.05, value: 0.8 },
    { key: 'decay', label: 'Filament decay', min: 0, max: 0.05, step: 0.001, value: 0.006 },
    { key: 'seedmode', label: 'Point/line seed', min: 0, max: 1, step: 1, value: 0 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.GW = 132;
    s.GH = 90;
    var N = s.GW * s.GH;
    s.occ = new Uint8Array(N);    // 1 = in discharge pattern (conductor, phi=0)
    s.bnd = new Uint8Array(N);    // 1 = outer boundary electrode (phi=1)
    s.inFront = new Uint8Array(N); // 1 = currently in the candidate frontier
    s.phi = new Float32Array(N);  // potential, persisted across frames
    s.front = [];                 // candidate cell indices on the pattern boundary
    s.segs = [];                  // recorded filaments {x0,y0,x1,y1,age}
    s.seededMode = -1;
    s.complete = 0;
    s.rnd = LABUTIL.mulberry32(982451653);
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    if (!s.occ) this.init(s, w, h);
    var GW = s.GW, GH = s.GH, N = GW * GH;
    var occ = s.occ, bnd = s.bnd, phi = s.phi, inFront = s.inFront;
    var front = s.front;

    var react = (p.react == null ? 0.85 : p.react);
    var lvl = LABUTIL.clamp(a.level, 0, 1);
    var peak = LABUTIL.clamp(a.peak, 0, 1);
    var beat = LABUTIL.clamp(a.beat, 0, 1);
    var hi = LABUTIL.clamp(a.high, 0, 1);
    // silence = stillness: act ~0 when quiet, rises only with real sound
    var act = LABUTIL.clamp(Math.max(lvl, peak * 0.7, beat) * react, 0, 1);

    var eta = LABUTIL.clamp(p.eta, 0, 4);
    // near-still in silence: discharge stops growing when quiet, branches with sound/beats
    var growth = Math.max(0, Math.min(40, Math.round(p.growthrate * (0.03 + 1.6 * act))));
    var branchbias = LABUTIL.clamp(p.branchbias, 0, 2);
    var decay = LABUTIL.clamp(p.decay, 0, 0.05);
    var seedmode = p.seedmode >= 0.5 ? 1 : 0;
    var rnd = s.rnd;

    // a.beat/a.peak trigger a fresh discharge once the current figure has grown
    if (react * (0.7 * beat + 0.3 * peak) > 0.7 && s.segs.length > 260) {
      s.seededMode = -1;
      s.complete = 0;
    }
    // a.high lifts filament brightness
    var glow = LABUTIL.clamp(0.6 + react * 0.9 * hi, 0.2, 1.4);
    // hold the figure near-frozen in silence: filaments barely age when quiet
    var ageStep = 0.06 + 1.4 * act;

    var i, x, y, ix;

    // addFront: register an empty interior cell adjacent to the pattern as a
    // growth candidate, once.
    function addFront(cx, cy) {
      if (cx < 1 || cy < 1 || cx >= GW - 1 || cy >= GH - 1) return;
      var ci = cy * GW + cx;
      if (occ[ci] || bnd[ci] || inFront[ci]) return;
      inFront[ci] = 1;
      front.push(ci);
    }

    // (Re)seed when first run or the seed mode changed.
    if (s.seededMode !== seedmode) {
      occ.fill(0); bnd.fill(0); inFront.fill(0); phi.fill(0);
      front.length = 0; s.segs.length = 0; s.complete = 0;
      for (x = 0; x < GW; x++) { bnd[x] = 1; bnd[(GH - 1) * GW + x] = 1; }
      for (y = 0; y < GH; y++) { bnd[y * GW] = 1; bnd[y * GW + GW - 1] = 1; }
      for (i = 0; i < N; i++) phi[i] = bnd[i] ? 1 : 0.5;
      if (seedmode === 0) {
        var cx = GW >> 1, cy = GH >> 1;
        occ[cy * GW + cx] = 1; phi[cy * GW + cx] = 0;
        s.seedX = cx; s.seedY = cy;
        addFront(cx - 1, cy); addFront(cx + 1, cy); addFront(cx, cy - 1); addFront(cx, cy + 1);
      } else {
        var ly = GH - 3;
        for (x = 1; x < GW - 1; x++) { occ[ly * GW + x] = 1; phi[ly * GW + x] = 0; }
        s.seedX = GW >> 1; s.seedY = ly;
        for (x = 1; x < GW - 1; x++) { addFront(x, ly - 1); }
      }
      s.seededMode = seedmode;
    }

    // --- Laplace relaxation: a few Jacobi sweeps per frame on the persisted
    // field. phi pinned to 0 on the pattern, 1 on the boundary; the screening
    // of neighbours by grown branches emerges from the solve. ---
    var SWEEPS = 12;
    for (var sw = 0; sw < SWEEPS; sw++) {
      for (y = 1; y < GH - 1; y++) {
        var row = y * GW;
        for (x = 1; x < GW - 1; x++) {
          ix = row + x;
          if (occ[ix]) { phi[ix] = 0; continue; }
          if (bnd[ix]) { phi[ix] = 1; continue; }
          var v = (phi[ix - 1] + phi[ix + 1] + phi[ix - GW] + phi[ix + GW]) * 0.25;
          phi[ix] = isFinite(v) ? v : 0.5;
        }
      }
    }

    // --- Growth: each step weights the bounded frontier by phi^eta times an
    // outward bias, roulette-picks one, occupies it, and extends the frontier
    // with its empty neighbours. Work per step is O(frontier), never O(grid). ---
    var grew = 0;
    for (var gstep = 0; gstep < growth; gstep++) {
      var n = front.length;
      if (n === 0) break;
      var sumW = 0;
      // weights buffer reused via a plain array sized to the frontier
      var wbuf = s._wbuf || (s._wbuf = []);
      if (wbuf.length < n) wbuf.length = n;
      for (i = 0; i < n; i++) {
        ix = front[i];
        var g = phi[ix];
        if (g < 0) g = 0;
        var base = (eta === 0) ? 1 : Math.pow(g + 1e-6, eta);
        var fx = ix % GW, fy = (ix / GW) | 0;
        var ddx = fx - s.seedX, ddy = fy - s.seedY;
        var dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        var gpx = phi[ix + 1] - phi[ix - 1];
        var gpy = phi[ix + GW] - phi[ix - GW];
        var out = (ddx / dl) * gpx + (ddy / dl) * gpy;
        if (out < 0) out = 0;
        var wgt = base * (1 + branchbias * out);
        if (!isFinite(wgt) || wgt < 0) wgt = 0;
        wbuf[i] = wgt; sumW += wgt;
      }
      var pick;
      if (sumW > 1e-12) {
        var r = rnd() * sumW, acc = 0;
        pick = n - 1;
        for (i = 0; i < n; i++) { acc += wbuf[i]; if (acc >= r) { pick = i; break; } }
      } else {
        pick = (rnd() * n) | 0;
      }
      var nix = front[pick];
      // swap-remove from the frontier
      front[pick] = front[n - 1];
      front.pop();
      inFront[nix] = 0;
      if (occ[nix] || bnd[nix]) continue; // guard against duplicates

      var nx = nix % GW, ny = (nix / GW) | 0;
      var pxp = nx, pyp = ny;
      if (occ[nix - 1]) { pxp = nx - 1; pyp = ny; }
      else if (occ[nix + 1]) { pxp = nx + 1; pyp = ny; }
      else if (occ[nix - GW]) { pxp = nx; pyp = ny - 1; }
      else if (occ[nix + GW]) { pxp = nx; pyp = ny + 1; }
      occ[nix] = 1; phi[nix] = 0;
      s.segs.push({ x0: pxp, y0: pyp, x1: nx, y1: ny, age: 0 });
      grew++;
      addFront(nx - 1, ny); addFront(nx + 1, ny); addFront(nx, ny - 1); addFront(nx, ny + 1);
      if (nx <= 1 || nx >= GW - 2 || ny <= 1 || ny >= GH - 2) s.complete++;
    }

    // Retrigger: once the discharge has reached the boundary and grown large,
    // restart the strike, the recurring lightning.
    if (s.complete > 0 && s.segs.length > 1400) {
      s.seededMode = -1;
      s.complete = 0;
    }
    if (s.segs.length > 3000) s.segs.splice(0, s.segs.length - 3000);

    // --- Render. Near-black field, amber filaments fading with age, freshest
    // tips a brief white-hot. Drawn fresh each frame; age increments after. ---
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var cw = w / GW, ch = h / GH;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, Math.min(cw, ch) * 0.7);

    var segs = s.segs;
    var ns = segs.length;
    for (i = 0; i < ns; i++) {
      var sg = segs[i];
      var bright = 1 - sg.age * decay;
      if (bright <= 0.02) { sg.age += ageStep; continue; }
      bright = LABUTIL.clamp(bright, 0, 1);
      ctx.strokeStyle = LABUTIL.rgba(theme.accent, LABUTIL.clamp(bright * 0.92 * glow, 0, 1));
      ctx.beginPath();
      ctx.moveTo((sg.x0 + 0.5) * cw, (sg.y0 + 0.5) * ch);
      ctx.lineTo((sg.x1 + 0.5) * cw, (sg.y1 + 0.5) * ch);
      ctx.stroke();
      sg.age += ageStep;
    }

    if (grew > 0) {
      ctx.lineWidth = Math.max(1, Math.min(cw, ch) * 0.9);
      ctx.strokeStyle = LABUTIL.rgba(theme.ink, LABUTIL.clamp(0.9 * glow, 0, 1));
      ctx.beginPath();
      var start = ns - grew;
      if (start < 0) start = 0;
      for (i = start; i < ns; i++) {
        var f = segs[i];
        ctx.moveTo((f.x0 + 0.5) * cw, (f.y0 + 0.5) * ch);
        ctx.lineTo((f.x1 + 0.5) * cw, (f.y1 + 0.5) * ch);
      }
      ctx.stroke();
    }
  }
});

