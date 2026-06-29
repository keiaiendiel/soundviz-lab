LAB.register({
  id: 'photoelastic-fringes',
  title: 'Photoelastic Stress Fringes',
  group: 'Texture and feedback',
  essence: 'Isochromatic bands radiating from a stress point, fracture-light on a percussive strike.',
  blurb: 'The percussion dialect. Under polarised light a stressed transparent solid shows isochromatic fringes, nested bands of light around stress concentrations; a strike fires a burst of fringes that propagate from the impact point and decay along fracture paths. This is Dialect 3, the Brittle Stress Matrix, the highest-impact lowest-cost prototype, brutalist and stark. The bands are a sine of the stress field, so the math is cheap and the read is immediate.',
  tags: ['field', 'raster', 'line', 'monochrome', 'realtime'],
  lineage: 'David Brewster photoelasticity 1816; CAS State Key Lab ultrasonic photoelasticity; Robert Henke CBM 8032 + Krystof Kintera brutalism. Scientific anchor: stress-optic law, isochromatic fringe order.',
  dialect: 'Brittle Stress Matrix',
  palette: 'monochrome ink',
  paramNotes: 'Fringe density (stress-optic constant) and strike decay are the levers; a strike trigger (a slider you pulse, or auto-fire on a timer) is the event. Number of stress points matters. The fringes are born monochrome under crossed polars; do not add the rainbow isochromatics, that breaks the discipline. Audio: a.beat strikes the stress points, a.centroid sets fringe density, a.level drives intensity (react scales the drive).',
  params: [
    { key: 'fringeDensity', label: 'Fringe density', min: 2, max: 20, step: 1, value: 9 },
    { key: 'decay', label: 'Strike decay', min: 0.9, max: 0.995, step: 0.005, value: 0.96 },
    { key: 'points', label: 'Stress points', min: 1, max: 5, step: 1, value: 2 },
    { key: 'fracture', label: 'Fracture spread', min: 0, max: 1, step: 0.05, value: 0.4 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    var rnd = LABUTIL.mulberry32(1729);
    s.src = [];
    for (var i = 0; i < 5; i++) {
      s.src.push({
        bx: 0.18 + rnd() * 0.64,   // base position (fraction)
        by: 0.18 + rnd() * 0.64,
        wob: rnd() * 6.28,          // wander phase
        ax: rnd() * 6.28,           // anisotropy axis phase
        fire: rnd() * 6.28,         // firing phase offset
        energy: 0,
        last: -1
      });
    }
    s.lastT = 0;
    s.img = null; // small ImageData field buffer, allocated on first draw
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    if (!s.src) this.init(s, w, h);
    if (!a) a = {};
    var dt = LABUTIL.clamp(t - s.lastT, 0, 0.1);
    s.lastT = t;

    // Audio drive: beat strikes points, centroid sets density, level sets intensity.
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = LABUTIL.clamp(a.level || 0, 0, 1);
    var aCent = LABUTIL.clamp(a.centroid || 0, 0, 1);
    var aBeat = LABUTIL.clamp(a.beat || 0, 0, 1);
    // Activity gate: silence -> near-zero, so auto-fire, wobble and axis rotation
    // nearly stop. Sound (level, peak, beat) brings the field back to life.
    var act = LABUTIL.clamp(Math.max(aLevel, (a.peak || 0) * 0.7, aBeat) * react, 0, 1);
    // Slow phase for source wobble + anisotropy rotation; idle crawl when quiet.
    s.ph = (s.ph || 0) + (a.dt || 0.016) * (0.06 + 1.3 * act);

    var pts = Math.max(1, Math.min(5, Math.round(p.points)));
    // per-frame decay factor normalised to ~60fps so the slider feels right
    var decF = Math.pow(p.decay, dt * 60);

    for (var i = 0; i < pts; i++) {
      var src = s.src[i];
      // always decay; the auto-fire clock now only re-strikes with energy scaled
      // by activity, so in silence the points never re-light on their own
      src.energy *= decF;
      // auto-fire: each source has its own slow clock; on a rising zero-cross, strike
      var phase = t * 1.3 + src.fire;
      var cyc = Math.floor(phase / Math.PI);
      if (cyc !== src.last) {
        src.last = cyc;
        if (act > src.energy) src.energy = act;   // strike magnitude tracks sound
      }
      // audio strike: a beat above a per-source threshold re-fires the point, so
      // louder onsets light more of the field at once (staggered across points)
      if (react > 0 && aBeat > (0.35 + i * 0.12)) {
        var hit = LABUTIL.clamp(react * aBeat, 0, 1);
        if (hit > src.energy) src.energy = hit;
      }
      // faint residual stress so the field is never fully dark; static when quiet,
      // breathing only as sound returns, so silence reads as a still frame
      var floor = 0.10 + 0.05 * act * (0.72 + 0.28 * Math.sin(s.ph * 0.55 + src.wob));
      if (src.energy < floor) src.energy = floor;
    }

    // background, with a faint persistence to soften the strike onset
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // coarse buffer field. Kept small so the manual upscale stays well under
    // the ~4000 inner-iteration budget even when the whole field is lit.
    var bw = 80;
    var bh = Math.max(36, Math.min(80, Math.round(bw * h / Math.max(1, w))));
    if (!s.img || s.img.width !== bw || s.img.height !== bh) {
      s.img = ctx.createImageData(bw, bh);
    }
    var data = s.img.data;

    // resolve ink colour to rgb once
    var ink = LABUTIL.rgba(theme.ink, 1);
    var im = ink.match(/[\d.]+/g);
    var ir = +im[0], ig = +im[1], ib = +im[2];
    // accent rgb for the warm seed at the impact core
    var ac = LABUTIL.rgba(theme.accent, 1).match(/[\d.]+/g);
    var ar = +ac[0], ag = +ac[1], ab = +ac[2];

    var dens = p.fringeDensity * 3 * (1 + react * (aCent - 0.3) * 1.2);
    if (dens < 2) dens = 2;
    var intens = LABUTIL.clamp(0.7 + react * aLevel * 0.9, 0, 1.7);
    var frac = p.fracture;
    // falloff radii expressed as a fraction of buffer size so the fringe rings
    // keep the same visual scale regardless of buffer resolution
    var rGlow = (bw * 0.34); var rGlow2 = rGlow * rGlow;       // gaussian sigma^2 region
    var rCore = (bw * 0.07); var rCore2 = rCore * rCore;

    // precompute active source positions in buffer space
    var sx = [], sy = [], se = [], saxis = [];
    for (var k = 0; k < pts; k++) {
      var sc = s.src[k];
      var wob = 0.03;
      sx.push((sc.bx + Math.sin(s.ph * 0.3 + sc.wob) * wob) * bw);
      sy.push((sc.by + Math.cos(s.ph * 0.27 + sc.wob) * wob) * bh);
      se.push(sc.energy);
      saxis.push(sc.ax + s.ph * 0.2);
    }

    var idx = 0;
    for (var y = 0; y < bh; y++) {
      for (var x = 0; x < bw; x++) {
        var stress = 0;
        var core = 0;
        for (var n = 0; n < pts; n++) {
          var e = se[n];
          if (e < 0.004) continue;
          var ddx = x - sx[n];
          var ddy = y - sy[n];
          var d2 = ddx * ddx + ddy * ddy;
          var ang = Math.atan2(ddy, ddx);
          // fracture anisotropy: stress leaks along an axis
          var dir = Math.cos((ang - saxis[n]) * 2) * frac;
          // gaussian falloff, scaled to buffer resolution
          var fall = Math.exp(-d2 / rGlow2);
          stress += e * fall * (1 + dir);
          core += e * Math.exp(-d2 / rCore2);
        }
        var fringe = Math.abs(Math.sin(stress * dens));
        var bright = fringe * LABUTIL.clamp(stress, 0, 1);
        core = LABUTIL.clamp(core, 0, 1);
        // mix toward accent only at the hot core, very restrained
        var rr = ir + (ar - ir) * core * 0.55;
        var gg = ig + (ag - ig) * core * 0.55;
        var bb = ib + (ab - ib) * core * 0.55;
        var al = LABUTIL.clamp((bright + core * 0.3) * intens, 0, 1);
        data[idx] = rr; data[idx + 1] = gg; data[idx + 2] = bb;
        data[idx + 3] = (al * 255) | 0;
        idx += 4;
      }
    }

    // Upscale the buffer to the full canvas with one fillRect per buffer cell.
    // The buffer is small (<= 80x80 = 6400) and we skip near-empty cells, so
    // the worst-case fill count stays under the inner-loop budget.
    var cw = w / bw, ch = h / bh;
    var step = (bw * bh > 5000) ? 2 : 1;
    for (var yy = 0; yy < bh; yy += step) {
      for (var xx = 0; xx < bw; xx += step) {
        var di = (yy * bw + xx) * 4;
        var alpha = data[di + 3] / 255;
        if (alpha < 0.02) continue;
        ctx.fillStyle = 'rgba(' + data[di] + ',' + data[di + 1] + ',' + data[di + 2] + ',' + alpha.toFixed(3) + ')';
        ctx.fillRect(xx * cw, yy * ch, cw * step + 1, ch * step + 1);
      }
    }
  }
});
