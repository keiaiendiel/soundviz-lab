LAB.register({
  id: 'reaction-diffusion',
  title: 'Reaction-Diffusion (Gray-Scott)',
  group: 'Fluid and field',
  essence: 'Two reacting chemicals form growing spots and stripes, a self-organising raster.',
  blurb: 'Pattern that grows itself. The Gray-Scott equations breed spots, mazes and coral fronts from two diffusing chemicals; feed and kill rates steer between regimes. Driven slowly it gives the organic-but-rigorous field that escapes the screensaver trap because the rule, not a noise texture, makes the form. Rendered as the U concentration in ink it sits between the cymatic and fractal registers, a living membrane.',
  tags: ['field', 'raster', 'fractal', 'monochrome', 'slow'],
  lineage: 'Gray + Scott reaction-diffusion; Alan Turing morphogenesis; Markos Kay aBiogenesis emergence aesthetic. Scientific anchor: Gray-Scott two-species reaction-diffusion system.',
  dialect: 'Faraday Cymatic Field',
  palette: 'monochrome ink',
  paramNotes: 'Feed and kill are the entire parameter space of Gray-Scott; expose both and the demo walks through spots, stripes and mitosis, this is exactly where parametric control pays. Diffusion ratio is a third lever. Do not over-add; colour and extra sliders only obscure the regime map. Audio drive: a.level and a.flux quicken the reaction, a.centroid tilts feed/kill between spots and stripes, and a.beat injects fresh seed spots.',
  params: [
    { key: 'feed', label: 'Feed rate', min: 0.01, max: 0.09, step: 0.001, value: 0.037 },
    { key: 'kill', label: 'Kill rate', min: 0.045, max: 0.07, step: 0.001, value: 0.06 },
    { key: 'diff', label: 'Diffusion ratio', min: 0.2, max: 0.7, step: 0.02, value: 0.5 },
    { key: 'speed', label: 'Steps per frame', min: 1, max: 12, step: 1, value: 6 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    const GW = 160, GH = 110;
    s.GW = GW; s.GH = GH;
    s.U = new Float32Array(GW * GH);
    s.V = new Float32Array(GW * GH);
    s.U2 = new Float32Array(GW * GH);
    s.V2 = new Float32Array(GW * GH);
    s.img = null;
    // hex -> rgb helper kept on state so draw() needs no module-scope function
    s.hex = function (c) {
      if (typeof c === 'string' && c.charAt(0) === '#') {
        let h = c.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return { r: parseInt(h.slice(0, 2), 16) || 0, g: parseInt(h.slice(2, 4), 16) || 0, b: parseInt(h.slice(4, 6), 16) || 0 };
      }
      return { r: 233, g: 230, b: 220 };
    };
    const rnd = LABUTIL.mulberry32(7);
    for (let i = 0; i < GW * GH; i++) { s.U[i] = 1; s.V[i] = 0; }
    const seeds = 16;
    for (let k = 0; k < seeds; k++) {
      const sx = Math.floor(rnd() * GW), sy = Math.floor(rnd() * GH);
      const r = 2 + Math.floor(rnd() * 4);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const x = sx + dx, y = sy + dy;
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          const idx = y * GW + x;
          s.U[idx] = 0.5; s.V[idx] = 0.28;
        }
      }
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    const GW = s.GW, GH = s.GH;
    let U = s.U, V = s.V, U2 = s.U2, V2 = s.V2;
    var react = (p.react == null ? 0.85 : p.react);
    var lvl = LABUTIL.clamp(a.level, 0, 1);
    var cen = LABUTIL.clamp(a.centroid, 0, 1);
    var beat = LABUTIL.clamp(a.beat, 0, 1);
    var flux = LABUTIL.clamp(a.flux, 0, 1);
    var peak = LABUTIL.clamp(a.peak, 0, 1);
    // silence = stillness: act ~0 when quiet, rises only with real sound
    var act = LABUTIL.clamp(Math.max(lvl, peak * 0.7, beat) * react, 0, 1);
    // a.centroid tilts feed/kill between the spot and stripe regimes (kept in-window)
    const feed = LABUTIL.clamp(p.feed + react * (cen - 0.5) * 0.012, 0.01, 0.09);
    const kill = LABUTIL.clamp(p.kill + react * (cen - 0.5) * 0.005, 0.045, 0.07);
    const dV = LABUTIL.clamp(p.diff, 0.05, 0.95), dU = 1.0;
    // near-still in silence: 0 sub-steps when quiet, full rate only with sound
    const steps = Math.max(0, Math.min(12, Math.round(p.speed * (0.05 + 1.2 * act))));

    // a.beat injects fresh reaction seeds (new spots); a.level sets how many
    s.rnd = s.rnd || LABUTIL.mulberry32(1337);
    var seedN = (react * beat > 0.6) ? 1 + Math.round(react * lvl * 2) : 0;
    for (var ks = 0; ks < seedN; ks++) {
      var ssx = 1 + Math.floor(s.rnd() * (GW - 2));
      var ssy = 1 + Math.floor(s.rnd() * (GH - 2));
      var srr = 2 + Math.floor(s.rnd() * 2);
      for (var sdy = -srr; sdy <= srr; sdy++) {
        for (var sdx = -srr; sdx <= srr; sdx++) {
          if (sdx * sdx + sdy * sdy > srr * srr) continue;
          var sxx = ssx + sdx, syy = ssy + sdy;
          if (sxx < 0 || syy < 0 || sxx >= GW || syy >= GH) continue;
          var sidx = syy * GW + sxx;
          U[sidx] = 0.5; V[sidx] = 0.28;
        }
      }
    }

    for (let st = 0; st < steps; st++) {
      for (let y = 0; y < GH; y++) {
        const ym = (y - 1 + GH) % GH, yp = (y + 1) % GH;
        for (let x = 0; x < GW; x++) {
          const xm = (x - 1 + GW) % GW, xp = (x + 1) % GW;
          const i = y * GW + x;
          const u = U[i], v = V[i];
          const lapU = (U[ym * GW + x] + U[yp * GW + x] + U[y * GW + xm] + U[y * GW + xp]) * 0.2
            + (U[ym * GW + xm] + U[ym * GW + xp] + U[yp * GW + xm] + U[yp * GW + xp]) * 0.05 - u;
          const lapV = (V[ym * GW + x] + V[yp * GW + x] + V[y * GW + xm] + V[y * GW + xp]) * 0.2
            + (V[ym * GW + xm] + V[ym * GW + xp] + V[yp * GW + xm] + V[yp * GW + xp]) * 0.05 - v;
          const uvv = u * v * v;
          let nu = u + (dU * lapU - uvv + feed * (1 - u));
          let nv = v + (dV * lapV + uvv - (kill + feed) * v);
          U2[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
          V2[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
        }
      }
      const tu = U; U = U2; U2 = tu;
      const tv = V; V = V2; V2 = tv;
    }
    s.U = U; s.V = V; s.U2 = U2; s.V2 = V2;

    if (!s.img || s.img.width !== GW) s.img = ctx.createImageData(GW, GH);
    const data = s.img.data;
    const ink = s.hex(theme.ink), bg = s.hex(theme.bg), acc = s.hex(theme.accent);
    for (let i = 0; i < GW * GH; i++) {
      let b = V[i] * 3.2; if (b > 1) b = 1;
      // a sliver of accent only in the brightest ridges keeps the monochrome discipline
      const ax = b > 0.82 ? (b - 0.82) / 0.18 * 0.18 : 0;
      const j = i * 4;
      data[j] = bg.r + (ink.r - bg.r) * b + (acc.r - ink.r) * ax;
      data[j + 1] = bg.g + (ink.g - bg.g) * b + (acc.g - ink.g) * ax;
      data[j + 2] = bg.b + (ink.b - bg.b) * b + (acc.b - ink.b) * ax;
      data[j + 3] = 255;
    }
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    // paint native patch top-left then self-blit up to full canvas (valid Canvas2D)
    ctx.putImageData(s.img, 0, 0);
    if (ctx.canvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(ctx.canvas, 0, 0, GW, GH, 0, 0, w, h);
    }
  }
});
