LAB.register({
  id: "julia-fractal",
  title: "Julia Set (orbiting)",
  group: "Fractal and recursion",
  essence: "A self-similar escape-time set whose seed orbits slowly, breathing between forms.",
  blurb: "Frequency driving a fractal. The Julia set is the boundary of escape for z -> z^2 + c, and as the seed c orbits a circle the whole filigree morphs through dendrites, spirals, and dust. Rendered as smooth monochrome escape bands it is the recursion register of the lab, infinite structure from one rule, and the orbit rate is a frequency you can hear if you map it back to sound.",
  tags: ["fractal", "raster", "monochrome", "slow"],
  lineage: "Gaston Julia 1918; Mandelbrot 1980; demoscene fractal zoomers. Scientific anchor: escape-time iteration of z -> z^2 + c with smooth (continuous) iteration count.",
  dialect: "-",
  palette: "monochrome ink",
  paramNotes: "Orbit radius and orbit speed set which family of Julia forms you sweep and how fast, the real levers. Zoom and iteration count trade detail for speed. Colour off, smooth luminance bands only. Audio drive nudges the seed c by spectral centroid and loudness and lets level brighten and zoom the field.",
  params: [
    { key: "orbitR", label: "Seed orbit radius", min: 0.1, max: 0.9, step: 0.01, value: 0.62 },
    { key: "orbitSpeed", label: "Orbit speed", min: 0, max: 1, step: 0.02, value: 0.12 },
    { key: "zoom", label: "Zoom", min: 0.6, max: 3, step: 0.1, value: 1.3 },
    { key: "iter", label: "Iterations", min: 24, max: 120, step: 4, value: 64 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.bw = 150;
    s.bh = Math.max(40, Math.min(130, Math.round(s.bw * h / Math.max(1, w))));
    try {
      s.off = new OffscreenCanvas(s.bw, s.bh);
      s.octx = s.off.getContext("2d");
      s.img = s.octx.createImageData(s.bw, s.bh);
    } catch (e) {
      s.off = null;
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var BW = s.bw || 150;
    var BH = s.bh || 100;

    // recompute buffer height if aspect changed a lot
    var wantBH = Math.max(40, Math.min(130, Math.round(BW * h / Math.max(1, w))));
    if (s.off && wantBH !== BH) {
      try {
        s.off = new OffscreenCanvas(BW, wantBH);
        s.octx = s.off.getContext("2d");
        s.img = s.octx.createImageData(BW, wantBH);
        BH = s.bh = wantBH;
      } catch (e) { /* keep old */ }
    }

    var img = s.img;
    if (!img || !s.octx) {
      // fallback: no offscreen, draw a calm placeholder spine
      ctx.strokeStyle = theme.grid;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }
    var data = img.data;

    var orbitR = LABUTIL.clamp(p.orbitR, 0.1, 0.9);
    var orbitSpeed = LABUTIL.clamp(p.orbitSpeed, 0, 1);
    var zoom = LABUTIL.clamp(p.zoom, 0.6, 3);
    var maxI = Math.round(LABUTIL.clamp(p.iter, 24, 120));

    // audio: nudge the Julia seed and brighten / zoom the field, around the slider baseline
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = a ? LABUTIL.clamp(a.level, 0, 1) : 0;
    var aCentroid = a ? LABUTIL.clamp(a.centroid, 0, 1) : 0;
    var aPeak = a ? LABUTIL.clamp(a.peak, 0, 1) : 0;
    var aBeat = a ? LABUTIL.clamp(a.beat, 0, 1) : 0;
    // silence = stillness: act ~0 when quiet, rises only with real sound
    var act = LABUTIL.clamp(Math.max(aLevel, aPeak * 0.7, aBeat) * react, 0, 1);
    var dtv = (a && isFinite(a.dt)) ? LABUTIL.clamp(a.dt, 0, 0.1) : 0.016;
    zoom = LABUTIL.clamp(zoom * (1 + 0.28 * react * aLevel), 0.6, 3);
    var bright = 1 + 0.45 * react * aLevel;

    // integrate the orbit phase from audio so the seed nearly stops moving in silence
    s.ph = (s.ph || 0) + dtv * orbitSpeed * LABUTIL.TAU * (0.04 + 1.1 * act);
    var cre = orbitR * Math.cos(s.ph);
    var cim = orbitR * Math.sin(s.ph * 0.85);
    if (!isFinite(cre)) cre = 0;
    if (!isFinite(cim)) cim = 0;
    cre += (aCentroid - 0.5) * 0.18 * react;
    cim += (aLevel - 0.5) * 0.14 * react;
    cre = LABUTIL.clamp(cre, -1.2, 1.2);
    cim = LABUTIL.clamp(cim, -1.2, 1.2);

    // parse theme bg / ink into rgb for luminance lerp
    var bg = parseRGB(theme.bg, [10, 11, 13]);
    var ink = parseRGB(theme.ink, [233, 230, 220]);

    var span = 1.6 / zoom;
    var aspect = BH / BW;
    var log2 = Math.log(2);

    var k = 0;
    for (var py = 0; py < BH; py++) {
      var zy0 = ((py / (BH - 1)) * 2 - 1) * span * aspect;
      for (var px = 0; px < BW; px++) {
        var zx = ((px / (BW - 1)) * 2 - 1) * span;
        var zy = zy0;
        var i = 0;
        var mag2 = 0;
        for (; i < maxI; i++) {
          var zx2 = zx * zx - zy * zy + cre;
          zy = 2 * zx * zy + cim;
          zx = zx2;
          mag2 = zx * zx + zy * zy;
          if (mag2 > 16) break;
        }
        var b;
        if (i >= maxI) {
          b = 0.0; // inside
        } else {
          // smooth iteration count
          var mag = Math.sqrt(mag2);
          var smooth = i + 1 - Math.log(Math.log(mag > 1 ? mag : 1.0000001)) / log2;
          if (!isFinite(smooth)) smooth = i;
          b = LABUTIL.clamp(smooth / maxI, 0, 1);
          b = Math.pow(b, 0.7);
        }
        b = LABUTIL.clamp(b * bright, 0, 1);
        var r = bg[0] + (ink[0] - bg[0]) * b;
        var g = bg[1] + (ink[1] - bg[1]) * b;
        var bl = bg[2] + (ink[2] - bg[2]) * b;
        data[k] = r | 0;
        data[k + 1] = g | 0;
        data[k + 2] = bl | 0;
        data[k + 3] = 255;
        k += 4;
      }
    }

    s.octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality !== undefined) ctx.imageSmoothingQuality = "high";
    ctx.drawImage(s.off, 0, 0, BW, BH, 0, 0, w, h);

    function parseRGB(css, fallback) {
      if (typeof css !== "string") return fallback;
      var hx = css.trim();
      if (hx.charAt(0) === "#") {
        if (hx.length === 4) {
          return [
            parseInt(hx[1] + hx[1], 16),
            parseInt(hx[2] + hx[2], 16),
            parseInt(hx[3] + hx[3], 16)
          ];
        }
        if (hx.length >= 7) {
          return [
            parseInt(hx.substr(1, 2), 16),
            parseInt(hx.substr(3, 2), 16),
            parseInt(hx.substr(5, 2), 16)
          ];
        }
      }
      var m = hx.match(/rgba?\(\s*([0-9.]+)[, ]+([0-9.]+)[, ]+([0-9.]+)/i);
      if (m) return [parseFloat(m[1]) | 0, parseFloat(m[2]) | 0, parseFloat(m[3]) | 0];
      return fallback;
    }
  }
});
