LAB.register({
  id: 'schlieren-plume',
  title: 'Schlieren Breath Plume',
  group: 'Fluid and field',
  essence: 'Advected dye in a curl-noise flow, a roiling high-contrast density column.',
  blurb: "Background-Oriented Schlieren made into motion. A dye field is advected through a curl-noise velocity field and rendered by its gradient magnitude, so density edges glow white the way refractive-index gradients do under a knife-edge. A column rises and tears into turbulence behind where a performer's breath would be. This is Dialect 1, the Vector Plume, and the most physically honest of the fluid family.",
  tags: ['fluid', 'field', 'blur', 'monochrome', 'realtime'],
  lineage: 'Gary Settles / Michael Hargather BOS; Manabe + Kurotaki border (sample-accurate binding); Onformative simulation-as-substrate. Scientific anchor: Background-Oriented Schlieren, refractive-index gradient imaging.',
  dialect: 'Vector Plume',
  palette: 'monochrome ink',
  paramNotes: 'Buoyancy (upward bias) and turbulence scale are the levers that swing it from laminar thread to ripped plume and both must be sliders, this is the laminar-to-turbulent transition the climax wants. Injection rate matters. Do not parametrise colour; schlieren is a grey-gradient technique by definition. Audio: loudness lifts the plume rise rate and dye density, treble sharpens the turbulence scale, and each beat puffs an extra breath into the column.',
  params: [
    { key: 'buoyancy', label: 'Buoyancy', min: 0, max: 2, step: 0.1, value: 0.9 },
    { key: 'turb', label: 'Turbulence scale', min: 0.5, max: 6, step: 0.1, value: 2.5 },
    { key: 'inject', label: 'Injection rate', min: 0.1, max: 1, step: 0.05, value: 0.5 },
    { key: 'decay', label: 'Dissipation', min: 0.9, max: 0.999, step: 0.001, value: 0.985 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.GW = 120;
    s.GH = 90;
    s.dye = new Float32Array(s.GW * s.GH);
    s.tmp = new Float32Array(s.GW * s.GH);
    s.img = null;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var react = (p.react == null ? 0.85 : p.react);
    var GW = s.GW, GH = s.GH;
    var dye = s.dye, tmp = s.tmp;
    var turb = p.turb, buoy = p.buoyancy, decay = LABUTIL.clamp(p.decay, 0.9, 0.999);
    // Activity: ~0 in silence, ~1 with sound. flow scales the advection step (incl.
    // buoyant rise) so the plume is near-still when quiet; ph is our own integrated
    // field-evolution clock so the velocity field also nearly freezes in silence.
    var act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    var flow = 0.06 + 1.3 * act;
    s.ph = (s.ph || 0) + a.dt * (0.06 + 1.3 * act);
    var ph = s.ph;

    // Semi-Lagrangian advection on the coarse grid. Velocity from layered
    // curl-ish noise; buoyancy biases the flow upward (negative y).
    // treble sharpens the turbulence scale.
    var ts = turb * 0.04 * (1 + 0.4 * react * LABUTIL.clamp(a.high, 0, 1));
    for (var y = 0; y < GH; y++) {
      for (var x = 0; x < GW; x++) {
        var nx = x * ts, ny = y * ts;
        var vx = LABUTIL.noise2(nx, ny + ph) * 0.9 + LABUTIL.fbm(nx * 2.0, ny * 2.0 - ph * 0.5, 3) * 0.4;
        var vy = LABUTIL.noise2(nx + 5, ny - ph) * 0.9 + LABUTIL.fbm(nx * 2.0 + 9, ny * 2.0 + ph * 0.5, 3) * 0.4;
        vy -= buoy * 0.9;
        // advection step scales with audio: near-zero in silence, full with sound
        var sx = x - vx * flow, sy = y - vy * flow;
        if (sx < 0) sx = 0; else if (sx > GW - 1.001) sx = GW - 1.001;
        if (sy < 0) sy = 0; else if (sy > GH - 1.001) sy = GH - 1.001;
        var x0 = sx | 0, y0 = sy | 0;
        var fx = sx - x0, fy = sy - y0;
        var i00 = y0 * GW + x0;
        var d00 = dye[i00], d10 = dye[i00 + 1], d01 = dye[i00 + GW], d11 = dye[i00 + GW + 1];
        var top = d00 + (d10 - d00) * fx;
        var bot = d01 + (d11 - d01) * fx;
        tmp[x + y * GW] = (top + (bot - top) * fy) * decay;
      }
    }
    dye.set(tmp);

    // Inject at a bottom-centre disc (where breath would enter).
    // density rides loudness; a beat puffs an extra breath. Faint idle keeps only a
    // near-static seed so silence reads as still rather than empty.
    var icx = GW * 0.5, icy = GH - 8, r = 5;
    var amt = p.inject * 1.4 * (0.08 + 1.1 * act) + 1.2 * react * LABUTIL.clamp(a.beat, 0, 1);
    var jitter = Math.sin(ph * 1.3) * 2.0 * flow;
    for (var yy = -r; yy <= r; yy++) {
      for (var xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy > r * r) continue;
        var gx = Math.round(icx + xx + jitter), gy = Math.round(icy + yy);
        if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) continue;
        var fall = 1 - (xx * xx + yy * yy) / (r * r);
        var gi = gy * GW + gx;
        dye[gi] = Math.min(1, dye[gi] + amt * fall);
      }
    }

    // Render the GRADIENT magnitude (schlieren), not the dye, to a small buffer.
    var img = s.img;
    if (!img || img.width !== GW || img.height !== GH) {
      img = s.img = ctx.createImageData(GW, GH);
      var dd = img.data;
      for (var q = 3; q < dd.length; q += 4) dd[q] = 255;
    }
    var data = img.data;
    // parse ink once into rgb
    var ink = s._ink;
    if (!ink || s._inkStr !== theme.ink) { s._inkStr = theme.ink; ink = s._ink = parseRGB(theme.ink); }
    var br = ink[0], bg = ink[1], bb = ink[2];
    var bgc = s._bg;
    if (!bgc || s._bgStr !== theme.bg) { s._bgStr = theme.bg; bgc = s._bg = parseRGB(theme.bg); }
    var kr = bgc[0], kg = bgc[1], kb = bgc[2];

    for (var yg = 0; yg < GH; yg++) {
      for (var xg = 0; xg < GW; xg++) {
        var idx = yg * GW + xg;
        var c = dye[idx];
        var rt = xg < GW - 1 ? dye[idx + 1] : c;
        var dn = yg < GH - 1 ? dye[idx + GW] : c;
        var g = Math.abs(rt - c) + Math.abs(dn - c);
        var a = LABUTIL.clamp(g * 18, 0, 1);
        var o = idx * 4;
        data[o] = kr + (br - kr) * a;
        data[o + 1] = kg + (bg - kg) * a;
        data[o + 2] = kb + (bb - kb) * a;
      }
    }

    // Scale the small schlieren buffer up to fill the canvas, via a cached offscreen
    // canvas (putImageData cannot scale); fall back to upscaled blocks if unavailable.
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    var prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    var off = s._off;
    if (!off) {
      try { off = s._off = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(GW, GH) : null; } catch (e) { off = s._off = null; }
      if (off) s._offctx = off.getContext('2d');
    }
    if (off && s._offctx) {
      s._offctx.putImageData(img, 0, 0);
      ctx.drawImage(off, 0, 0, GW, GH, 0, 0, w, h);
    } else {
      // Fallback: draw upscaled blocks (still bounded by GW*GH).
      var sxk = w / GW, syk = h / GH;
      for (var by = 0; by < GH; by++) {
        for (var bx = 0; bx < GW; bx++) {
          var bi = (by * GW + bx) * 4;
          var av = (data[bi] + data[bi + 1] + data[bi + 2]) / 3;
          if (av < kr + 4) continue;
          var aa = LABUTIL.clamp((av - kr) / Math.max(1, br - kr), 0, 1);
          ctx.fillStyle = LABUTIL.rgba(theme.ink, aa);
          ctx.fillRect(bx * sxk, by * syk, sxk + 1, syk + 1);
        }
      }
    }
    ctx.imageSmoothingEnabled = prevSmooth;

    function parseRGB(css) {
      if (css[0] === '#') {
        var hx = css.slice(1);
        if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];
        return [parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16)];
      }
      var m = css.match(/(\d+(?:\.\d+)?)/g);
      if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
      return [233, 230, 220];
    }
  }
});
