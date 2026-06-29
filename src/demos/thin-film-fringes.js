LAB.register({
  id: 'thin-film-fringes',
  title: 'Thin-Film Interference',
  group: 'Texture and feedback',
  essence: 'Monochromatic light reflecting off the two faces of a thin film interferes with itself. As the film thickness drifts, the interference contours crawl across the surface as Newton-ring fringes.',
  blurb: 'Two reflections, one off the top of a thin film and one off the bottom, recombine with a phase difference set by the extra path 2*n*d through the film. At normal incidence the reflected intensity is cos^2 of half that phase. Hold the wavelength fixed and vary the thickness d(x,y,t) and the bright and dark fringes trace contours of constant thickness, the same circular Newton rings you see in an oil slick or between two pressed lenses.',
  tags: ['optics', 'texture', 'field', 'raster', 'monochrome', 'feedback', 'moire'],
  lineage: "Newton's rings; two-beam interference; thin-film reflectance with half-wave phase shift; OpenStax University Physics III optics.",
  dialect: 'Phase Interferometer',
  palette: 'Single amber channel modulated by cos^2 fringe intensity. No spectral rainbow (monochromatic source by definition). Dark fringes near-black, bright fringes warm amber.',
  paramNotes: 'filmindex n scales optical path; wavelength sets fringe spacing (smaller lambda = denser rings); bumprate animates the thickness deformation; bumpcount sets how many drifting thickness lobes overlap (Newton-ring centers); tilt adds a linear thickness wedge that turns rings into straight contour fringes. Audio: a.centroid densifies the fringes, a.level drives brightness, a.beat sends ring ripples across the film (react scales the whole drive).',
  params: [
    { key: 'filmindex', label: 'Film index n', min: 1, max: 2.4, step: 0.01, value: 1.45 },
    { key: 'wavelength', label: 'Wavelength', min: 0.004, max: 0.05, step: 0.001, value: 0.014 },
    { key: 'bumprate', label: 'Deform rate', min: 0, max: 1.5, step: 0.01, value: 0.35 },
    { key: 'bumpcount', label: 'Ring centers', min: 1, max: 6, step: 1, value: 3 },
    { key: 'tilt', label: 'Wedge tilt', min: 0, max: 1, step: 0.01, value: 0.2 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.bw = 150;
    s.bh = Math.max(40, Math.min(130, Math.round(s.bw * h / Math.max(1, w))));
    try {
      s.off = new OffscreenCanvas(s.bw, s.bh);
      s.octx = s.off.getContext('2d');
      s.img = s.octx.createImageData(s.bw, s.bh);
    } catch (e) {
      s.off = null;
    }
    // Fixed lobe layout, deterministic. Each lobe is a gaussian bump in the
    // thickness field, a Newton-ring center. Phases and base centers seeded.
    var rnd = LABUTIL.mulberry32(31459265);
    s.lobes = [];
    for (var i = 0; i < 6; i++) {
      s.lobes.push({
        cx: (rnd() * 1.4 - 0.7),
        cy: (rnd() * 1.4 - 0.7),
        ph: rnd() * 6.2831853,
        sig: 0.30 + rnd() * 0.30,   // lobe width 0.30..0.60
        amp: 6 + rnd() * 6          // amplitude in wavelength units
      });
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    if (!s.lobes) this.init(s, w, h);
    if (!a) a = {};
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // Audio drive: centroid densifies fringes, level lifts brightness, beat ripples.
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = LABUTIL.clamp(a.level || 0, 0, 1);
    var aCent = LABUTIL.clamp(a.centroid || 0, 0, 1);
    var aBeat = LABUTIL.clamp(a.beat || 0, 0, 1);
    // Activity gate: near-zero when quiet so the thickness drift nearly halts.
    var act = LABUTIL.clamp(Math.max(aLevel, (a.peak || 0) * 0.7, aBeat) * react, 0, 1);
    var densMul = 1 + react * (0.8 * (aCent - 0.15) + 0.25 * aLevel);
    if (densMul < 0.2) densMul = 0.2;
    var intens = LABUTIL.clamp(0.55 + 0.85 * react * aLevel, 0, 1.4);
    var beatRip = react * aBeat * 3.0;

    var BW = s.bw || 150;
    var BH = s.bh || 100;
    var wantBH = Math.max(40, Math.min(130, Math.round(BW * h / Math.max(1, w))));
    if (s.off && wantBH !== BH) {
      try {
        s.off = new OffscreenCanvas(BW, wantBH);
        s.octx = s.off.getContext('2d');
        s.img = s.octx.createImageData(BW, wantBH);
        BH = s.bh = wantBH;
      } catch (e) { /* keep old */ }
    }

    var img = s.img;
    if (!img || !s.octx) {
      ctx.strokeStyle = theme.grid;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }
    var data = img.data;

    var nIdx = LABUTIL.clamp(p.filmindex, 1, 2.4);
    var lambda = LABUTIL.clamp(p.wavelength, 0.004, 0.05);
    var bumprate = LABUTIL.clamp(p.bumprate, 0, 1.5);
    var bumpcount = Math.max(1, Math.min(6, Math.round(p.bumpcount)));
    var tilt = LABUTIL.clamp(p.tilt, 0, 1);

    // delta = (2*PI/lambda)*(2*n*d) + PI, I = cos^2(delta/2).
    // Precompute the path-to-phase scale and the amplitude unit (lobe amps are
    // stored in wavelength units so the ring count tracks lambda sensibly).
    var phaseScale = (LABUTIL.TAU / lambda) * (2 * nIdx);
    var ampUnit = lambda;

    // Integrate the thickness-drift phase from audio: a slow idle crawl when
    // silent, opening up as sound arrives, so the rings nearly freeze in quiet.
    s.ph = (s.ph || 0) + (a.dt || 0.016) * bumprate * (0.06 + 1.1 * act);
    var drift = s.ph;

    // Precompute the current lobe centers (slow drift) once per frame.
    var lobes = s.lobes;
    var lx = new Array(bumpcount), ly = new Array(bumpcount);
    var lInv2s2 = new Array(bumpcount), lA = new Array(bumpcount);
    for (var li = 0; li < bumpcount; li++) {
      var lb = lobes[li];
      lx[li] = lb.cx + 0.15 * Math.cos(drift + lb.ph);
      ly[li] = lb.cy + 0.15 * Math.sin(0.8 * drift + lb.ph);
      var sg = lb.sig;
      lInv2s2[li] = 1 / (2 * sg * sg);
      lA[li] = lb.amp * ampUnit;
    }

    // Wedge direction a = (1, 0.3) normalized-ish, scaled by tilt. Several
    // wavelengths of ramp across the field straighten rings into contours.
    var wax = 1.0, way = 0.3;
    var wedgeAmp = tilt * 30 * ampUnit;

    var aspect = BH / BW;
    var idx = 0;
    for (var py = 0; py < BH; py++) {
      var wy = ((py / (BH - 1)) * 2 - 1) * aspect;
      for (var px = 0; px < BW; px++) {
        var wx = (px / (BW - 1)) * 2 - 1;

        // Thickness field: base + sum of gaussian lobes + linear wedge.
        var d = 1.5 * ampUnit;  // small positive base so d >= 0
        for (var j = 0; j < bumpcount; j++) {
          var ddx = wx - lx[j];
          var ddy = wy - ly[j];
          var r2 = ddx * ddx + ddy * ddy;
          d += lA[j] * Math.exp(-r2 * lInv2s2[j]);
        }
        d += wedgeAmp * (wax * wx + way * wy);
        if (d < 0) d = 0;

        var delta = phaseScale * densMul * d + Math.PI;
        if (beatRip > 0.001) {
          var rr = Math.sqrt(wx * wx + wy * wy);
          delta += beatRip * Math.sin(rr * 14 - t * 7);
        }
        var c = Math.cos(delta * 0.5);
        var I = c * c;            // two-beam reflectance cos^2(delta/2)
        // crisp the fringes slightly
        I = Math.pow(I, 1.2);
        I *= intens;
        if (!isFinite(I)) I = 0;
        I = LABUTIL.clamp(I, 0, 1);

        data[idx] = (I * 255) | 0;
        data[idx + 1] = (I * 185) | 0;
        data[idx + 2] = (I * 70) | 0;
        data[idx + 3] = 255;
        idx += 4;
      }
    }

    s.octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality !== undefined) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(s.off, 0, 0, BW, BH, 0, 0, w, h);
  }
});

