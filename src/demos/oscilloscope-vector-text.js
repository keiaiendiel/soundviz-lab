LAB.register({
  id: 'oscilloscope-vector-text',
  title: 'Oscilloscope Vector Text',
  group: 'Oscillographic',
  essence: 'Text drawn as a single XY beam tracing stroke-font letters as continuous parametric paths with phosphor persistence.',
  blurb: 'A stroke font, not an outline font. The beam draws each letter as a continuous polyline, blanks across pen-up gaps, and leaves a decaying green-amber trail. The word alternates SOUND and IMAGE on each full pass of the beam. Hershey vectors, Vectrex, oscilloscope music.',
  tags: ['oscillographic','line','text','glyph','monochrome','realtime'],
  lineage: 'Allen Hershey vector fonts (1967, Naval Weapons Lab), Vectrex vector display, oscilloscope-music XY lettering, Xenakis/Tektronix CRT terminals',
  dialect: 'Oscillographic/XY',
  palette: 'Single phosphor color on black: warm amber or CRT green. Brightness from beam dwell and persistence only, no fills. Hot fresh trace, dim decaying tail.',
  paramNotes: 'beamSpeed sets path-length drawn per frame (how fast the beam writes). persistence sets phosphor decay (trail length). jitter adds analog beam wobble. glow sets bloom radius. strokeWeight sets beam line width. Audio drive lets a.level and a.peak speed and widen the beam, swell the trace, and perturb strokes with a.wave while keeping the letters legible.',
  params: [
    { key: 'beamSpeed', label: 'Beam speed (units/frame)', min: 20, max: 600, step: 10, value: 120 },
    { key: 'persistence', label: 'Phosphor persistence', min: 0.7, max: 0.99, step: 0.01, value: 0.92 },
    { key: 'jitter', label: 'Analog jitter', min: 0, max: 3, step: 0.1, value: 0.6 },
    { key: 'glow', label: 'Beam glow', min: 0, max: 12, step: 1, value: 5 },
    { key: 'strokeWeight', label: 'Beam width', min: 0.5, max: 3, step: 0.25, value: 1.25 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    // Compact simplex stroke font in the Hershey model. Each glyph: { l, r, strokes }
    // where l,r are the left/right bounds and strokes is a list of polylines, each
    // polyline a flat array [x0,y0,x1,y1,...] in a roughly -9..9 box (y up = negative).
    // Pen-up gaps live BETWEEN strokes (CRT beam blanking).
    var F = {};
    function g(l, r, strokes) { return { l: l, r: r, strokes: strokes }; }
    F[' '] = g(-8, 8, []);
    F['A'] = g(-8, 8, [[-7, 8, 0, -8, 7, 8], [-4, 1, 4, 1]]);
    F['B'] = g(-7, 7, [[-6, -8, -6, 8], [-6, -8, 4, -8, 6, -6, 6, -2, 4, 0, -6, 0], [-6, 0, 4, 0, 6, 2, 6, 6, 4, 8, -6, 8]]);
    F['C'] = g(-7, 7, [[7, -5, 4, -8, -3, -8, -6, -5, -7, -1, -7, 1, -6, 5, -3, 8, 4, 8, 7, 5]]);
    F['D'] = g(-7, 7, [[-6, -8, -6, 8], [-6, -8, 2, -8, 5, -5, 6, -1, 6, 1, 5, 5, 2, 8, -6, 8]]);
    F['E'] = g(-6, 7, [[6, -8, -6, -8, -6, 8, 6, 8], [-6, 0, 3, 0]]);
    F['F'] = g(-6, 7, [[6, -8, -6, -8, -6, 8], [-6, 0, 3, 0]]);
    F['G'] = g(-7, 8, [[7, -5, 4, -8, -3, -8, -6, -5, -7, -1, -7, 1, -6, 5, -3, 8, 4, 8, 7, 5, 7, 1, 2, 1]]);
    F['H'] = g(-7, 7, [[-6, -8, -6, 8], [6, -8, 6, 8], [-6, 0, 6, 0]]);
    F['I'] = g(-1, 1, [[0, -8, 0, 8]]);
    F['J'] = g(-5, 6, [[5, -8, 5, 4, 3, 8, -1, 8, -4, 5, -4, 2]]);
    F['K'] = g(-7, 7, [[-6, -8, -6, 8], [6, -8, -6, 2], [-2, -1, 6, 8]]);
    F['L'] = g(-6, 6, [[-6, -8, -6, 8, 6, 8]]);
    F['M'] = g(-8, 8, [[-7, 8, -7, -8, 0, 6, 7, -8, 7, 8]]);
    F['N'] = g(-7, 7, [[-6, 8, -6, -8, 6, 8, 6, -8]]);
    F['O'] = g(-7, 7, [[-3, -8, -6, -5, -7, -1, -7, 1, -6, 5, -3, 8, 3, 8, 6, 5, 7, 1, 7, -1, 6, -5, 3, -8, -3, -8]]);
    F['P'] = g(-7, 7, [[-6, 8, -6, -8, 4, -8, 6, -6, 6, -2, 4, 0, -6, 0]]);
    F['Q'] = g(-7, 7, [[-3, -8, -6, -5, -7, -1, -7, 1, -6, 5, -3, 8, 3, 8, 6, 5, 7, 1, 7, -1, 6, -5, 3, -8, -3, -8], [1, 4, 7, 9]]);
    F['R'] = g(-7, 7, [[-6, 8, -6, -8, 4, -8, 6, -6, 6, -3, 4, -1, -6, -1], [0, -1, 6, 8]]);
    F['S'] = g(-6, 7, [[6, -5, 3, -8, -3, -8, -6, -5, -6, -2, -3, 0, 3, 0, 6, 2, 6, 5, 3, 8, -3, 8, -6, 5]]);
    F['T'] = g(-7, 7, [[0, 8, 0, -8], [-7, -8, 7, -8]]);
    F['U'] = g(-7, 7, [[-6, -8, -6, 4, -3, 8, 3, 8, 6, 4, 6, -8]]);
    F['V'] = g(-7, 7, [[-7, -8, 0, 8, 7, -8]]);
    F['W'] = g(-8, 8, [[-7, -8, -4, 8, 0, -4, 4, 8, 7, -8]]);
    F['X'] = g(-7, 7, [[-6, -8, 6, 8], [6, -8, -6, 8]]);
    F['Y'] = g(-7, 7, [[-7, -8, 0, 0, 0, 8], [7, -8, 0, 0]]);
    F['Z'] = g(-6, 7, [[6, -8, -6, -8, 6, 8, -6, 8]]);
    F['0'] = g(-6, 6, [[-2, -8, -5, -5, -6, -1, -6, 1, -5, 5, -2, 8, 2, 8, 5, 5, 6, 1, 6, -1, 5, -5, 2, -8, -2, -8], [5, -7, -5, 7]]);
    F['1'] = g(-3, 4, [[-3, -5, 0, -8, 0, 8], [-3, 8, 3, 8]]);
    F['2'] = g(-6, 6, [[-5, -5, -2, -8, 3, -8, 6, -5, 6, -2, -6, 8, 6, 8]]);
    F['3'] = g(-6, 6, [[-5, -8, 5, -8, -1, -1, 2, -1, 5, 1, 6, 4, 4, 7, 0, 8, -4, 7, -6, 4]]);
    F['4'] = g(-6, 6, [[3, 8, 3, -8, -6, 4, 6, 4]]);
    F['5'] = g(-6, 6, [[5, -8, -5, -8, -6, 0, -2, -2, 3, -2, 6, 1, 6, 5, 3, 8, -2, 8, -5, 5]]);
    F['6'] = g(-6, 6, [[5, -6, 1, -8, -3, -8, -6, -4, -6, 4, -3, 8, 2, 8, 6, 5, 6, 1, 3, -2, -2, -2, -6, 1]]);
    F['7'] = g(-6, 6, [[-6, -8, 6, -8, -1, 8]]);
    F['8'] = g(-6, 6, [[-2, 0, -5, 2, -6, 5, -3, 8, 3, 8, 6, 5, 5, 2, 2, 0, -2, 0, -5, -2, -6, -5, -3, -8, 3, -8, 6, -5, 5, -2, 2, 0]]);
    F['9'] = g(-6, 6, [[-5, 6, -1, 8, 3, 8, 6, 4, 6, -4, 3, -8, -2, -8, -6, -5, -6, -1, -3, 2, 2, 2, 6, -1]]);
    F['.'] = g(-1, 2, [[0, 7, 0, 8]]);
    F['-'] = g(-5, 5, [[-4, 0, 4, 0]]);
    s.FONT = F;
    s.WORD = 'SOUND';
    s.path = null;       // built lazily, depends on canvas size
    s.pathW = 0; s.pathH = 0;
    s.beamPos = 0;
    s.started = false;
    s.rng = LABUTIL.mulberry32(40711);
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var clamp = LABUTIL.clamp;
    var TAU = LABUTIL.TAU;
    var react = (p.react == null ? 0.85 : p.react);
    var lvl = clamp(a.level || 0, 0, 1);
    var pk = clamp(a.peak || 0, 0, 1);
    var beat = clamp(a.beat || 0, 0, 1);
    // audio activity: ~0 in silence (the beam crawls), high when the room is loud
    var act = clamp(Math.max(lvl, pk * 0.8, beat) * react, 0, 1);
    var cxA = w / 2, cyA = h / 2;
    var traceScale = 1 + 0.10 * act;           // subtle breathe, text stays legible
    var wav = a.wave;
    var wn = wav && wav.length ? wav.length : 1;
    var waveAmp = 2.6 * react * (0.2 + 0.8 * pk);

    // --- build the concatenated path once per size ---
    if (!s.path || s.pathW !== w || s.pathH !== h) {
      s.pathW = w; s.pathH = h;
      var F = s.FONT;
      var word = s.WORD;
      var tracking = 3;     // glyph-space units between letters
      // measure total advance in glyph units
      var totalAdv = 0;
      for (var ci = 0; ci < word.length; ci++) {
        var gl = F[word[ci]] || F[' '];
        totalAdv += (gl.r - gl.l) + tracking;
      }
      totalAdv -= tracking;
      if (totalAdv < 1) totalAdv = 1;

      // scale so the word fits ~82% of width and a comfortable height
      var scaleX = (w * 0.82) / totalAdv;
      var scaleY = (h * 0.42) / 16;      // glyph box is ~16 units tall
      var scale = Math.min(scaleX, scaleY);
      if (!isFinite(scale) || scale <= 0) scale = 1;
      var glyphW = totalAdv * scale;
      var penX = (w - glyphW) * 0.5;     // center horizontally
      var cy = h * 0.5;

      // segments: {x0,y0,x1,y1,draw}  draw=true for stroke, false for pen-up jump
      var segs = [];
      var penX0 = penX;
      var prevEndX = null, prevEndY = null;
      for (var c2 = 0; c2 < word.length; c2++) {
        var glyph = F[word[c2]] || F[' '];
        var originX = penX0 - glyph.l * scale;   // place so glyph.l sits at penX0
        var strokes = glyph.strokes;
        for (var si = 0; si < strokes.length; si++) {
          var pts = strokes[si];
          var sx0 = originX + pts[0] * scale;
          var sy0 = cy + pts[1] * scale;
          // pen-up jump from previous stroke end to this stroke start
          if (prevEndX !== null) segs.push({ x0: prevEndX, y0: prevEndY, x1: sx0, y1: sy0, draw: false });
          for (var k = 2; k < pts.length; k += 2) {
            var nx = originX + pts[k] * scale;
            var ny = cy + pts[k + 1] * scale;
            segs.push({ x0: sx0, y0: sy0, x1: nx, y1: ny, draw: true });
            sx0 = nx; sy0 = ny;
          }
          prevEndX = sx0; prevEndY = sy0;
        }
        penX0 += ((glyph.r - glyph.l) + tracking) * scale;
      }
      // close the loop: pen-up jump from the very last point back to the first draw start
      if (segs.length) {
        var first = null;
        for (var fi = 0; fi < segs.length; fi++) { if (segs[fi].draw) { first = segs[fi]; break; } }
        if (first && prevEndX !== null) segs.push({ x0: prevEndX, y0: prevEndY, x1: first.x0, y1: first.y0, draw: false });
      }
      // cumulative arc length
      var total = 0;
      for (var gi2 = 0; gi2 < segs.length; gi2++) {
        var sg = segs[gi2];
        var dx = sg.x1 - sg.x0, dy = sg.y1 - sg.y0;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (!isFinite(len)) len = 0;
        sg.len = len; sg.s0 = total; total += len;
      }
      s.path = segs;
      s.total = total > 0 ? total : 1;
      s.beamPos = 0;
    }

    var segs = s.path;
    var total = s.total;

    // --- phosphor decay: fade the whole canvas toward black ---
    if (!s.started) { ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, w, h); s.started = true; }
    var persistence = clamp(p.persistence, 0.7, 0.99);
    // shorter phosphor when silent so only the slow travelling beam shows (not the whole word),
    // fuller persistence when the room is loud so the letters fill in
    persistence = clamp(persistence - (1 - act) * 0.13, 0.62, 0.99);
    ctx.fillStyle = LABUTIL.rgba(theme.bg, clamp(1 - persistence, 0.01, 1));
    ctx.fillRect(0, 0, w, h);

    if (!segs || !segs.length) return;

    // slow crawl in silence, quick when loud
    var beamSpeed = clamp(p.beamSpeed, 20, 600) * (0.05 + 1.5 * act);
    if (beamSpeed < 6) beamSpeed = 6;
    var jitter = clamp(p.jitter, 0, 3) * (1 + react * pk);
    var glow = clamp(p.glow, 0, 12) * (0.7 + 0.7 * react * pk);
    var sw = clamp(p.strokeWeight, 0.5, 3) * (1 + 0.4 * react * lvl);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var start = s.beamPos;
    var end = start + beamSpeed;
    // stop exactly at the end of the word this frame instead of wrapping the beam
    // back over the first letter (otherwise the hot head re-lights the old word's
    // opening glyph just before the swap, leaving a ghost fragment top-left).
    var wrapped = end >= total;
    if (wrapped) end = total;

    // analog wobble: faint mains-style sine on y plus per-vertex jitter
    var wob = Math.sin(t * 8.0) * 0.6 + Math.sin(t * 3.0) * 0.4;
    function jx(seed) { return jitter ? (LABUTIL.hash2(seed * 1.7 + 3.1, seed * 0.3) - 0.5) * jitter : 0; }
    function jy(seed) { return jitter ? (LABUTIL.hash2(seed * 0.9, seed * 2.3 + 5.7) - 0.5) * jitter + wob * jitter * 0.4 : wob * 0.0; }

    // walk arc-length from start to end in small constant steps so dwell is uniform
    var STEP = 2.0;
    var headStart = start + (end - start) * 0.85;  // last ~15% = hot beam head

    ctx.shadowColor = theme.ink;
    function plotRange(rngStart, rngEnd, alpha, width, withGlow) {
      ctx.shadowBlur = withGlow ? glow : 0;
      ctx.strokeStyle = LABUTIL.rgba(theme.ink, alpha);
      ctx.lineWidth = width;
      var pos = rngStart;
      var guard = 0;
      ctx.beginPath();
      var penDown = false;
      var px = 0, py = 0;
      while (pos < rngEnd && guard < 4000) {
        guard++;
        var mp = ((pos % total) + total) % total;
        // find segment containing mp (linear scan from a hint is fine; segs are few hundred)
        var seg = segLookup(mp);
        if (!seg) { pos += STEP; continue; }
        var localLen = seg.len > 1e-6 ? seg.len : 1e-6;
        var fr = (mp - seg.s0) / localLen;
        if (fr < 0) fr = 0; else if (fr > 1) fr = 1;
        var x = seg.x0 + (seg.x1 - seg.x0) * fr;
        var y = seg.y0 + (seg.y1 - seg.y0) * fr;
        // breathe the trace around centre with loudness (small, keeps letters readable)
        x = cxA + (x - cxA) * traceScale;
        y = cyA + (y - cyA) * traceScale;
        // perturb the beam with the live waveform
        var widx = Math.round((((pos % total) + total) % total) / total * (wn - 1));
        if (widx < 0) widx = 0; else if (widx > wn - 1) widx = wn - 1;
        var wv = wav ? (wav[widx] || 0) : 0;
        x += jx(pos) + wv * waveAmp; y += jy(pos) + wv * waveAmp * 0.5;
        if (!isFinite(x) || !isFinite(y)) { pos += STEP; continue; }
        if (seg.draw) {
          if (!penDown) { ctx.moveTo(x, y); penDown = true; }
          else ctx.lineTo(x, y);
        } else {
          // blanking: lift the pen
          penDown = false;
        }
        px = x; py = y;
        pos += STEP;
      }
      ctx.stroke();
    }

    // segment lookup with a moving hint to stay cheap
    var hint = s._hint || 0;
    function segLookup(mp) {
      var nseg = segs.length;
      // try the hinted segment and neighbours first
      for (var d = 0; d < nseg; d++) {
        var idx = (hint + d) % nseg;
        var sg = segs[idx];
        if (mp >= sg.s0 && mp < sg.s0 + (sg.len > 1e-6 ? sg.len : 1e-6)) { hint = idx; s._hint = idx; return sg; }
      }
      return segs[nseg - 1];
    }

    // body of the freshly written arc
    plotRange(start, headStart, 0.78, sw, glow > 0);
    // hot beam head: brighter, slightly wider
    plotRange(headStart, end, 1.0, sw + 0.6, glow > 0);
    ctx.shadowBlur = 0;

    // advance; on a full traversal the beam swaps SOUND <-> IMAGE so the two words
    // alternate continuously as the line reaches the end.
    if (wrapped) {
      s.WORD = (s.WORD === 'IMAGE') ? 'SOUND' : 'IMAGE';
      s.path = null;   // rebuild with the new word next frame (resets beamPos to 0)
    } else {
      s.beamPos = end;
      if (!isFinite(s.beamPos)) s.beamPos = 0;
    }
  }
});

