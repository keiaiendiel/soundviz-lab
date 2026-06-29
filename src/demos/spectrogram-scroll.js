LAB.register({
  id: 'spectrogram-scroll',
  title: 'Scrolling Spectrogram',
  group: 'Spectral',
  essence: 'Time on X, frequency on Y, brightness as energy, scrolling right to left.',
  blurb: "The lab's reference image of sound. A synthetic spectrum (a few drifting formant bands plus broadband noise) is painted as one column per frame and the whole field scrolls, leaving frequency tracks as horizontal ridges. This is the most information-dense sound image and the one a physicist recognises without a caption. Ikeda data-grid discipline keeps it monochrome and clinical rather than a heatmap.",
  tags: ['spectral', 'raster', 'field', 'monochrome', 'slow'],
  lineage: 'Ryoji Ikeda datamatics / test pattern; Florian Hecker; sonogram lab convention. Scientific anchor: short-time Fourier transform sonogram (Koenig 1946).',
  dialect: 'Phase Interferometer',
  palette: 'monochrome ink',
  paramNotes: 'Band count and band drift drive the musical read and are the levers worth sliders. Scroll speed is a real lever. Avoid a colour-map slider entirely, a jet/viridis ramp instantly turns this into a stock audio tool; the discipline is luminance only. Audio drive injects the live spectrum: each new column reads a.spectrum at its frequency, so with the mic on this is a real sonogram of the room.',
  params: [
    { key: 'bands', label: 'Formant bands', min: 1, max: 6, step: 1, value: 3 },
    { key: 'drift', label: 'Band drift', min: 0, max: 1, step: 0.05, value: 0.4 },
    { key: 'scroll', label: 'Scroll speed', min: 0.5, max: 6, step: 0.5, value: 2 },
    { key: 'noise', label: 'Broadband floor', min: 0, max: 0.6, step: 0.05, value: 0.2 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.buf = null;
    s.bw = 0;
    s.bh = 0;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    // (re)build the offscreen scroll buffer at a small fixed-ish resolution
    var BW = Math.max(8, Math.min(640, Math.round(w)));
    var BH = Math.max(8, Math.min(360, Math.round(h)));
    var bctx = null;
    try {
      if (!s.buf || s.bw !== BW || s.bh !== BH) {
        var c = (typeof OffscreenCanvas !== 'undefined')
          ? new OffscreenCanvas(BW, BH)
          : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
        if (c) {
          c.width = BW; c.height = BH;
          s.buf = c; s.bw = BW; s.bh = BH;
          var ic = c.getContext('2d');
          ic.fillStyle = theme.bg;
          ic.fillRect(0, 0, BW, BH);
        } else {
          s.buf = null;
        }
      }
      bctx = s.buf ? s.buf.getContext('2d') : null;
    } catch (e) {
      bctx = null;
    }

    var bands = Math.max(1, Math.round(p.bands));

    var react = (p.react == null ? 0.85 : p.react);
    var aw = LABUTIL.clamp(react, 0, 1.5);
    // audio activity gates motion: near-frozen in silence, scrolls with sound
    var act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    var IDLE = 0.06, GAIN = 1.0;
    // fractional scroll accumulator; ~p.scroll cols/frame at full activity, a crawl in silence
    var baseScroll = Math.max(0.5, p.scroll) * 60;
    s.sphase = (s.sphase || 0) + (a.dt || 0.016) * baseScroll * (IDLE + GAIN * act);
    if (!isFinite(s.sphase)) s.sphase = 0;
    var shift = Math.floor(s.sphase);
    if (shift > 8) shift = 8;            // cap catch-up after a stall
    s.sphase -= shift;
    // synthetic-baseline drift phase, gated so the formant bands hold still in silence
    s.ph = (s.ph || 0) + (a.dt || 0.016) * (0.08 + GAIN * act);
    if (!isFinite(s.ph)) s.ph = 0;
    var pt = s.ph;
    var spec = a ? a.spectrum : null;
    var specLen = (spec && spec.length) ? spec.length : 1;

    // energy at normalised frequency fy in [0,1] at time tt: a synthetic baseline
    // (keeps the sliders alive and the field breathing in silence) blended with the
    // LIVE spectrum read straight from a.spectrum, so mic-on is a real sonogram.
    var energyAt = function (fy, tt) {
      var e = p.noise * (0.5 + 0.5 * LABUTIL.noise2(fy * 8, tt * 2));
      for (var b = 0; b < bands; b++) {
        var cf = 0.15 + 0.25 * b * (5 / Math.max(1, bands)) * 0.6 + 0.15 * Math.sin(tt * 0.3 * (b + 1)) * p.drift;
        cf = LABUTIL.clamp(cf, 0.05, 0.95);
        var d = fy - cf;
        var g = Math.exp(-(d * d) / 0.0006);
        e += g * (0.55 + 0.45 * Math.sin(tt * (2 + b)));
      }
      var idx = Math.round(LABUTIL.clamp(fy, 0, 1) * (specLen - 1));
      if (idx < 0) idx = 0; else if (idx > specLen - 1) idx = specLen - 1;
      var sv = spec ? spec[idx] : 0;
      if (!isFinite(sv)) sv = 0;
      e = e * (1 - 0.6 * aw / 1.5) + sv * (0.4 + 1.1 * aw);
      return LABUTIL.clamp(e, 0, 1);
    };

    if (bctx) {
      if (shift > 0) {
        // scroll the buffer left by `shift`
        try {
          bctx.globalCompositeOperation = 'copy';
          bctx.drawImage(s.buf, -shift, 0);
          bctx.globalCompositeOperation = 'source-over';
        } catch (e2) {
          bctx.fillStyle = theme.bg;
          bctx.fillRect(0, 0, BW, BH);
        }
        // clear the freshly revealed right strip to bg, then paint the new column
        bctx.fillStyle = theme.bg;
        bctx.fillRect(BW - shift, 0, shift, BH);
        var rowStep = 1;
        for (var y = 0; y < BH; y += rowStep) {
          var fy = 1 - y / BH;
          var e = energyAt(fy, pt);
          if (e > 0.012) {
            bctx.fillStyle = LABUTIL.rgba(theme.ink, e);
            bctx.fillRect(BW - shift, y, shift, rowStep);
          }
        }
      }
      // blit buffer to the visible canvas, scaled
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(s.buf, 0, 0, BW, BH, 0, 0, w, h);
      // faint frequency grid lines for the instrument register
      ctx.strokeStyle = LABUTIL.rgba(theme.grid, 1);
      ctx.lineWidth = 1;
      for (var gi = 1; gi < 5; gi++) {
        var gy = (gi / 5) * h;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
    } else {
      // fallback: no offscreen buffer available, scroll the visible canvas itself
      if (shift > 0) {
        try {
          ctx.globalCompositeOperation = 'copy';
          ctx.drawImage(ctx.canvas, -shift, 0);
          ctx.globalCompositeOperation = 'source-over';
        } catch (e3) {
          ctx.fillStyle = theme.bg;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.fillStyle = theme.bg;
        ctx.fillRect(w - shift, 0, shift, h);
        var ry = 0;
        var rs = 2;
        for (ry = 0; ry < h; ry += rs) {
          var fy2 = 1 - ry / h;
          var e2v = energyAt(fy2, pt);
          if (e2v > 0.012) {
            ctx.fillStyle = LABUTIL.rgba(theme.ink, e2v);
            ctx.fillRect(w - shift, ry, shift, rs);
          }
        }
      }
    }
  }
});
