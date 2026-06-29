LAB.register({
  id: 'topographic-contour',
  title: 'Topographic Contour Lines',
  group: 'Line and geometry',
  essence: 'Iso-lines of a slowly evolving height field, a moving contour map of the sound.',
  blurb: 'Sound as terrain read by its contours. A scalar height field (fbm plus a few moving sources) is sliced at evenly spaced levels and only the iso-lines are drawn, giving the Onformative satellite-contour look without the wash. The lines crowd where the field is steep, opening and closing like breathing isobars. Pure line, pure monochrome, it is the most diagrammatic field technique and reads as a survey of the score.',
  tags: ['line', 'field', 'monochrome', 'slow'],
  lineage: 'Onformative Meandering River topographic register; cartographic contour convention; Nearfield Acoustic Holography contour lobes. Scientific anchor: iso-contour extraction (marching squares) of a scalar field.',
  dialect: 'Phase Interferometer',
  palette: 'monochrome ink',
  paramNotes: 'Contour count and field evolution speed are the levers; a source-count slider (how many moving hills) changes the complexity. Line interval is the same lever as count. No colour; line weight alone separates major and minor contours. Audio: a.bands raise each hill per spectral region and a.level swells the noise terrain, so the contours crowd and open as the field breathes (react scales the drive).',
  params: [
    { key: 'levels', label: 'Contour count', min: 6, max: 40, step: 2, value: 18 },
    { key: 'sources', label: 'Field sources', min: 1, max: 6, step: 1, value: 3 },
    { key: 'evolve', label: 'Evolve speed', min: 0, max: 1.5, step: 0.05, value: 0.4 },
    { key: 'scale', label: 'Field scale', min: 0.5, max: 3, step: 0.1, value: 1.2 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a){
    var U = LABUTIL;
    if (!a) a = {};
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    var scale = p.scale;
    var evolve = p.evolve;
    var nSrc = Math.max(1, Math.round(p.sources));
    var levels = Math.max(2, Math.round(p.levels));

    // Audio drive: bands raise each hill per spectral region, level swells the terrain.
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = U.clamp(a.level || 0, 0, 1);
    var bands = (a.bands && a.bands.length) ? a.bands : null;
    var fbmAmp = 0.6 * (0.7 + 0.9 * react * aLevel);
    // Activity gate + integrated phase: the hills orbit and the terrain evolves
    // only with sound, crawling to a near-stop when quiet (heights still swell
    // via level and bands, so the contours hold a still frame in silence).
    var aBeat = U.clamp(a.beat || 0, 0, 1);
    var act = U.clamp(Math.max(aLevel, (a.peak || 0) * 0.7, aBeat) * react, 0, 1);
    s.ph = (s.ph || 0) + (a.dt || 0.016) * (0.06 + 1.1 * act);
    var tph = s.ph;
    var evoT = tph * evolve;

    // precompute source centers (slowly orbiting)
    var cx = w * 0.5, cy = h * 0.5;
    var orbit = Math.min(w, h) * 0.28;
    var sx = [], sy = [], sAmp = [];
    for (var si = 0; si < nSrc; si++){
      var ph = si * 1.7;
      sx.push(cx + Math.cos(tph * 0.2 + ph) * orbit * (0.5 + 0.5 * Math.cos(si)));
      sy.push(cy + Math.sin(tph * 0.27 + ph) * orbit * (0.5 + 0.5 * Math.sin(si * 1.3)));
      var bi = bands ? Math.min(31, ((si + 0.5) / nSrc * 28 | 0) + 2) : 0;
      var bv = bands ? U.clamp(bands[bi], 0, 1) : 0;
      sAmp.push(0.5 * (0.6 + 1.3 * react * bv));
    }
    function field(x, y){
      var f = U.fbm(x * 0.004 * scale, y * 0.004 * scale + evoT, 4) * fbmAmp;
      for (var i = 0; i < nSrc; i++){
        var dx = x - sx[i], dy = y - sy[i];
        var d2 = dx * dx + dy * dy;
        f += sAmp[i] * Math.exp(-d2 / 8000);
      }
      return f;
    }
    // grid sampling; cap cells for robustness
    var step = 6;
    var cells = (w / step) * (h / step);
    if (cells > 14000) step = Math.max(6, Math.ceil(Math.sqrt((w * h) / 14000)));
    var cw = Math.max(2, Math.ceil(w / step) + 1);
    var chh = Math.max(2, Math.ceil(h / step) + 1);
    if (cw > 320) cw = 320;
    if (chh > 320) chh = 320;
    // sample field on grid
    var grid = new Float32Array(cw * chh);
    var fmin = Infinity, fmax = -Infinity;
    for (var gy = 0; gy < chh; gy++){
      for (var gx = 0; gx < cw; gx++){
        var vx = gx * step, vy = gy * step;
        var fv = field(vx, vy);
        grid[gy * cw + gx] = fv;
        if (fv < fmin) fmin = fv;
        if (fv > fmax) fmax = fv;
      }
    }
    if (!(fmax > fmin)) { fmax = fmin + 1; }
    var span = fmax - fmin;
    ctx.lineCap = 'round';
    // for each level draw iso-contour via marching squares
    for (var L = 1; L < levels; L++){
      var lev = fmin + span * (L / levels);
      var major = (L % 5 === 0);
      ctx.lineWidth = major ? 1.6 : 1;
      ctx.strokeStyle = U.rgba(theme.ink, major ? 0.85 : 0.42);
      ctx.beginPath();
      for (var yy = 0; yy < chh - 1; yy++){
        for (var xx = 0; xx < cw - 1; xx++){
          var i0 = yy * cw + xx;
          var a = grid[i0];           // top-left
          var b = grid[i0 + 1];       // top-right
          var c = grid[i0 + cw + 1];  // bottom-right
          var d = grid[i0 + cw];      // bottom-left
          var code = 0;
          if (a > lev) code |= 1;
          if (b > lev) code |= 2;
          if (c > lev) code |= 4;
          if (d > lev) code |= 8;
          if (code === 0 || code === 15) continue;
          var x0 = xx * step, y0 = yy * step;
          // edge interpolation points
          function ip(va, vb){ var dd = vb - va; return dd === 0 ? 0.5 : (lev - va) / dd; }
          var pTop = [x0 + ip(a, b) * step, y0];
          var pRight = [x0 + step, y0 + ip(b, c) * step];
          var pBot = [x0 + ip(d, c) * step, y0 + step];
          var pLeft = [x0, y0 + ip(a, d) * step];
          function seg(P, Q){ ctx.moveTo(P[0], P[1]); ctx.lineTo(Q[0], Q[1]); }
          switch(code){
            case 1: case 14: seg(pLeft, pTop); break;
            case 2: case 13: seg(pTop, pRight); break;
            case 3: case 12: seg(pLeft, pRight); break;
            case 4: case 11: seg(pRight, pBot); break;
            case 6: case 9: seg(pTop, pBot); break;
            case 7: case 8: seg(pLeft, pBot); break;
            case 5: seg(pLeft, pTop); seg(pRight, pBot); break;
            case 10: seg(pTop, pRight); seg(pLeft, pBot); break;
          }
        }
      }
      ctx.stroke();
    }
  }
});
