LAB.register({
  id: 'error-diffusion-dither',
  title: 'Error-Diffusion Dither',
  group: 'Raster, glyph, text',
  essence: 'Floyd-Steinberg 1-bit dithering of a slowly moving grayscale field, spreading quantization error 7/16, 3/16, 5/16, 1/16.',
  blurb: 'A continuous gray field thresholded to pure black and white, the rounding error pushed downstream by the 1976 kernel. The result is a living stipple that crawls as the field drifts. Floyd and Steinberg, 1976.',
  tags: ['raster','dots','texture','field','monochrome','realtime'],
  lineage: 'Robert Floyd and Louis Steinberg, An Adaptive Algorithm for Spatial Greyscale (1976), classic newspaper and Macintosh 1-bit halftoning',
  dialect: '-',
  palette: 'Strictly 1-bit: black and white only, no gray output (the gray lives only in the pre-quantized field). Optional: render the white dots in warm amber on black for the lab accent variant.',
  paramNotes: 'cellSize sets the dither grid resolution (smaller = finer stipple, more cost). driftSpeed moves the underlying field. fieldFreq sets spatial frequency of the source gradient. threshold biases black/white balance. serpentine toggles boustrophedon scan to kill directional worm artifacts. Audio: a.level pushes more cells white, a.bands brighten columns per spectral region, a.centroid shifts the field frequency (react scales the drive).',
  params: [
    { key: 'cellSize', label: 'Cell size (px)', min: 2, max: 12, step: 1, value: 4 },
    { key: 'driftSpeed', label: 'Field drift speed', min: 0, max: 2, step: 0.05, value: 0.4 },
    { key: 'fieldFreq', label: 'Field frequency', min: 0.5, max: 6, step: 0.25, value: 2 },
    { key: 'threshold', label: 'Black/white bias', min: 0.2, max: 0.8, step: 0.02, value: 0.5 },
    { key: 'serpentine', label: 'Serpentine scan', min: 0, max: 1, step: 1, value: 1 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.F = null;
    s.gw = 0; s.gh = 0;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var clamp = LABUTIL.clamp;
    var TAU = LABUTIL.TAU;
    if (!a) a = {};

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var cellSize = clamp(Math.round(p.cellSize), 2, 12);
    // bound the logical grid so the in-place pass stays cheap
    var gw = Math.ceil(w / cellSize);
    var gh = Math.ceil(h / cellSize);
    var MAXCELLS = 30000;
    while (gw * gh > MAXCELLS) { cellSize++; gw = Math.ceil(w / cellSize); gh = Math.ceil(h / cellSize); }
    if (gw < 1) gw = 1; if (gh < 1) gh = 1;

    var F = s.F;
    if (!F || s.gw !== gw || s.gh !== gh) { F = s.F = new Float32Array(gw * gh); s.gw = gw; s.gh = gh; }

    var ff = clamp(p.fieldFreq, 0.5, 6);
    var ds = p.driftSpeed;
    var thr = clamp(p.threshold, 0.2, 0.8);
    var serp = p.serpentine >= 0.5;
    var bias = 0.5 - thr;   // remap so threshold biases black/white balance

    // Audio drive: centroid bends field frequency, level pushes more cells white,
    // bands brighten the column mapped to their spectral region.
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = clamp(a.level || 0, 0, 1);
    var aCent = clamp(a.centroid || 0, 0, 1);
    var bands = (a.bands && a.bands.length) ? a.bands : null;
    var ffEff = clamp(ff * (1 + react * (aCent - 0.3) * 0.9), 0.3, 9);
    var lvlBias = react * aLevel * 0.3;
    // Activity gate + integrated drift phase: the source field drifts only with
    // sound, crawling to a near-stop when quiet (level/bands still flip cells).
    var aBeat = clamp(a.beat || 0, 0, 1);
    var act = clamp(Math.max(aLevel, (a.peak || 0) * 0.7, aBeat) * react, 0, 1);
    s.ph = (s.ph || 0) + (a.dt || 0.016) * ds * (0.06 + 1.1 * act);
    var ph = s.ph;

    // build the smooth moving source field in [0,1]
    for (var gy = 0; gy < gh; gy++) {
      var v = gy / gh;
      for (var gx = 0; gx < gw; gx++) {
        var u = gx / gw;
        var bandV = bands ? clamp(bands[Math.min(31, (u * 32) | 0)], 0, 1) : 0;
        var val = 0.5
          + 0.5 * Math.sin(TAU * ffEff * u + ph) * Math.cos(TAU * ffEff * v - ph * 0.7);
        // a touch of slow noise so the field is not a pure ruled grating
        val += 0.18 * LABUTIL.fbm(u * ffEff * 1.3 + ph * 0.15, v * ffEff * 1.3 - ph * 0.1, 3);
        val = val + bias + lvlBias + react * bandV * 0.22;
        F[gy * gw + gx] = clamp(val, 0, 1);
      }
    }

    // Floyd-Steinberg in place, top to bottom, serpentine optional
    for (var y = 0; y < gh; y++) {
      var leftToRight = !(serp && (y & 1));
      var dir = leftToRight ? 1 : -1;
      var xStart = leftToRight ? 0 : gw - 1;
      var xEnd = leftToRight ? gw : -1;
      var rowOff = y * gw;
      var nextOff = (y + 1) * gw;
      for (var x = xStart; x !== xEnd; x += dir) {
        var idx = rowOff + x;
        var old = F[idx];
        if (!isFinite(old)) old = 0;
        var nw = old < 0.5 ? 0 : 1;
        F[idx] = nw;
        var err = old - nw;
        if (err === 0) continue;
        // distribute along scan direction and into the next row
        var xr = x + dir;          // ahead in this row
        if (xr >= 0 && xr < gw) F[rowOff + xr] += err * (7 / 16);
        if (y + 1 < gh) {
          var xbl = x - dir;       // below, behind scan
          var xbr = x + dir;       // below, ahead scan
          if (xbl >= 0 && xbl < gw) F[nextOff + xbl] += err * (3 / 16);
          F[nextOff + x] += err * (5 / 16);
          if (xbr >= 0 && xbr < gw) F[nextOff + xbr] += err * (1 / 16);
        }
      }
    }

    // render: white (or amber, via theme.ink) dot per set cell
    var sxk = w / gw, syk = h / gh;
    var rDot = Math.max(0.5, Math.min(sxk, syk) * 0.45);
    var useDots = cellSize >= 4;   // dots read as instrument marks; tiny cells fill blocks
    ctx.fillStyle = theme.ink;
    if (useDots) {
      ctx.beginPath();
      for (var y2 = 0; y2 < gh; y2++) {
        var cyp = (y2 + 0.5) * syk;
        var base2 = y2 * gw;
        for (var x2 = 0; x2 < gw; x2++) {
          if (F[base2 + x2] < 0.5) continue;
          var cxp = (x2 + 0.5) * sxk;
          ctx.moveTo(cxp + rDot, cyp);
          ctx.arc(cxp, cyp, rDot, 0, TAU);
        }
      }
      ctx.fill();
    } else {
      for (var y3 = 0; y3 < gh; y3++) {
        var base3 = y3 * gw;
        for (var x3 = 0; x3 < gw; x3++) {
          if (F[base3 + x3] < 0.5) continue;
          ctx.fillRect(x3 * sxk, y3 * syk, sxk + 0.6, syk + 0.6);
        }
      }
    }
  }
});

