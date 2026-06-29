LAB.register({
  id: 'rutt-etra-mesh',
  title: 'Rutt-Etra Raster Rescan',
  group: 'Oscillographic',
  essence: 'Horizontal scanlines displaced vertically by signal amplitude, a deformed wire raster.',
  blurb: "The Rutt/Etra scan processor made the video raster a physical mesh: each scanline lifts where the signal is loud. Here a stack of horizontal lines is displaced in Y by a travelling waveform plus noise, giving a topographic ridged terrain that scrolls like a seismograph drum. This is the Vasulka machine itself, the exact piece of hardware on the lineage line, rendered as moving ink contour. It bridges oscillographic and field registers.",
  tags: ['oscillographic', 'line', 'raster', '3d', 'monochrome', 'realtime'],
  lineage: 'Bill Etra + Steve Rutt scan processor 1973, used by Steina + Woody Vasulka 1974 (lineage anchor); contemporary Rutt-Etra-Izer ports. Scientific anchor: raster scan deflection / Z-axis modulation.',
  dialect: 'Modal Coordinate Grid',
  palette: 'monochrome ink',
  paramNotes: 'Line count and displacement gain are the two levers that change the whole read and both deserve sliders. Scroll speed matters. A perspective-squash slider (top lines closer together) cheaply buys the 3D ridge look and is worth exposing. Colour does nothing useful here; keep it ink on black. Audio drive (react): the live waveform (a.wave) is read straight into the scanline Z-displacement, the voltage-to-relief Rutt/Etra move, and loudness scales the relief depth; each row reads a delayed slice so the sound scrolls down the drum.',
  params: [
    { key: 'lines', label: 'Scanlines', min: 20, max: 120, step: 2, value: 64 },
    { key: 'gain', label: 'Displacement', min: 0.02, max: 0.3, step: 0.01, value: 0.12 },
    { key: 'scroll', label: 'Scroll speed', min: 0.1, max: 2, step: 0.1, value: 0.6 },
    { key: 'squash', label: 'Perspective squash', min: 0, max: 1, step: 0.05, value: 0.4 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    a = a || {};
    var clamp = LABUTIL.clamp;
    var react = (p.react == null ? 0.85 : clamp(p.react, 0, 1.5));
    var lvl = clamp(a.level || 0, 0, 1);
    var peak = clamp(a.peak || 0, 0, 1);
    var beat = clamp(a.beat || 0, 0, 1);
    var dt = clamp(a.dt == null ? 0.016 : a.dt, 0, 0.1);
    var wave = a.wave;
    var WN = (wave && wave.length) ? wave.length : 0;
    // loudness scales the relief depth (base keeps the ridge alive in silence)
    var reliefMod = 0.6 + 1.2 * react * lvl;
    // activity envelope: ~0 in silence so the synthetic terrain flattens / stops scrolling
    var act = clamp(Math.max(lvl, peak * 0.7, beat) * react, 0, 1);
    var ampEnv = 0.1 + 1.2 * act; // synthetic relief near-flat in silence, full with sound
    // integrate scroll so the drum freezes when quiet and rolls with sound
    s.ph = (s.ph || 0) + dt * p.scroll * (0.06 + 1.5 * act);
    if (!isFinite(s.ph)) s.ph = 0;

    var lines = Math.max(2, Math.round(p.lines));
    var step = 8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // r = 0 is the far/back row (top), r = lines is the near/front row (bottom).
    // draw back-to-front so near rows occlude far ones.
    for (var r = 0; r <= lines; r++) {
      var f = r / lines; // 0 far .. 1 near
      // perspective: rows bunch up toward the top, spread toward the bottom
      var yBase = h * (0.08 + 0.9 * (f + p.squash * 0.35 * (f * f - f)));
      var scrollPhase = s.ph + f * 3;
      var depth = 0.4 + 0.6 * f; // near rows lift more

      ctx.beginPath();
      var first = true;
      for (var x = 0; x <= w; x += step) {
        var amp = LABUTIL.fbm(x * 0.008, scrollPhase, 4);
        amp += 0.4 * Math.sin(x * 0.02 + scrollPhase * 2);
        amp *= 0.5 * ampEnv; // synthetic terrain flattens in silence
        // voltage-to-relief: read the live waveform straight into Z; each row
        // reads a delayed slice (offset by r and scroll) so the sound rolls down.
        var wv = 0;
        if (WN) {
          var widx = (x / Math.max(1, w)) * (WN - 1) + r * (WN / lines) + s.ph * 40;
          widx = widx % WN; if (widx < 0) widx += WN;
          var wi = widx | 0; if (wi < 0) wi = 0; else if (wi >= WN) wi = WN - 1;
          var sv = wave[wi];
          if (isFinite(sv)) wv = sv;
        }
        var disp = (amp * 0.6 + wv * 1.1) * reliefMod;
        var y = yBase - disp * p.gain * h * depth;
        if (!isFinite(y)) y = yBase;
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      var a = 0.18 + 0.72 * f;
      ctx.strokeStyle = LABUTIL.rgba(theme.ink, a);
      ctx.lineWidth = 0.6 + 0.7 * f;
      ctx.stroke();
    }
  }
});
