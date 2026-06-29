LAB.register({
  id: 'feedback-trails',
  title: 'Feedback / Datamosh Trails',
  group: 'Texture and feedback',
  essence: 'The frame fed back zoomed and rotated, motion smeared into video-feedback tunnels.',
  blurb: 'The frame eating itself. Each frame is the previous frame drawn back slightly zoomed and rotated, so any fresh mark spirals into a feedback tunnel, the classic camera-into-monitor or datamosh smear. A small moving source feeds it and the feedback does the rest, building endless self-similar motion. It is the feedback register and a Vasulka-lineage move (video feedback as material), kept monochrome so it reads as signal decay rather than psychedelia.',
  tags: ['feedback', 'blur', 'fractal', 'monochrome', 'realtime'],
  lineage: 'Steina + Woody Vasulka video feedback; Nam June Paik; datamosh / Rutt-Etra recursion. Scientific anchor: iterated affine image feedback, self-similar attractor of the feedback loop.',
  dialect: 'Oscillographic/XY (proposed 6th)',
  palette: 'monochrome ink',
  paramNotes: 'Zoom and rotation per frame are the levers that set the tunnel geometry; decay controls how long trails persist. All three are essential sliders. The source pattern fed in is a build choice. Colour off; feedback luminance carries it. Audio drive (react): loudness raises the injected source brightness and speeds the feeder orbit, and each beat kicks the feedback zoom so the tunnel pumps with the sound.',
  params: [
    { key: 'zoom', label: 'Feedback zoom', min: 0.97, max: 1.06, step: 0.005, value: 1.02 },
    { key: 'rot', label: 'Feedback rotation', min: -0.1, max: 0.1, step: 0.005, value: 0.02 },
    { key: 'decay', label: 'Trail decay', min: 0.7, max: 0.99, step: 0.01, value: 0.9 },
    { key: 'inject', label: 'Source brightness', min: 0.1, max: 1, step: 0.05, value: 0.6 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    // self-contained feedback buffer (single luminance channel), no DOM needed.
    s.bw = 160;
    s.bh = 0;     // set on first draw to match aspect
    s.buf = null; // Float32Array luminance
    s.tmp = null;
    s.img = null;
    s.lastT = 0;
  },
  draw(ctx, w, h, t, p, s, theme, af) {
    af = af || {};
    var react = (p.react == null ? 0.85 : LABUTIL.clamp(p.react, 0, 1.5));
    var lvl = LABUTIL.clamp(af.level || 0, 0, 1);
    var beat = LABUTIL.clamp(af.beat || 0, 0, 1);
    var peak = LABUTIL.clamp(af.peak || 0, 0, 1);
    // activity envelope: ~0 in silence so the tunnel barely evolves, pumps with sound
    var act = LABUTIL.clamp(Math.max(lvl, beat, peak * 0.7) * react, 0, 1);
    var motion = 0.06 + 1.5 * act;
    var bw = 128;
    var bh = Math.max(40, Math.min(128, Math.round(bw * h / Math.max(1, w))));
    if (!s.buf || s.bw !== bw || s.bh !== bh) {
      s.bw = bw; s.bh = bh;
      s.buf = new Float32Array(bw * bh);
      s.tmp = new Float32Array(bw * bh);
      s.img = ctx.createImageData(bw, bh);
    }
    var buf = s.buf, tmp = s.tmp;
    var N = bw * bh;

    var dt = LABUTIL.clamp(t - s.lastT, 0, 0.1);
    s.lastT = t;
    // normalise per-frame transforms to ~60fps so sliders feel stable
    var fr = dt * 60;
    // zoom/rotation displacement scale with activity: near-zero in silence, each
    // beat kicks the zoom so the tunnel pumps with the sound
    var zoomBase = LABUTIL.clamp(1 + (p.zoom - 1) * motion + react * beat * 0.025, 0.9, 1.12);
    var zoom = Math.pow(zoomBase, fr);
    var rot = p.rot * motion * fr;
    var decay = Math.pow(p.decay, fr);

    // inverse affine sample: dest <- source pulled from a zoomed/rotated frame.
    // For each dest pixel, find where it came from in the previous frame.
    var cx = bw * 0.5, cy = bh * 0.5;
    var inv = 1 / zoom;
    var cosr = Math.cos(-rot) * inv;
    var sinr = Math.sin(-rot) * inv;

    for (var y = 0; y < bh; y++) {
      var dy = y - cy;
      for (var x = 0; x < bw; x++) {
        var dx = x - cx;
        var sxp = cx + (dx * cosr - dy * sinr);
        var syp = cy + (dx * sinr + dy * cosr);
        // bilinear sample with clamp
        var x0 = Math.floor(sxp), y0 = Math.floor(syp);
        var fx = sxp - x0, fy = syp - y0;
        var x1 = x0 + 1, y1 = y0 + 1;
        if (x0 < 0) x0 = 0; else if (x0 >= bw) x0 = bw - 1;
        if (x1 < 0) x1 = 0; else if (x1 >= bw) x1 = bw - 1;
        if (y0 < 0) y0 = 0; else if (y0 >= bh) y0 = bh - 1;
        if (y1 < 0) y1 = 0; else if (y1 >= bh) y1 = bh - 1;
        var v00 = buf[y0 * bw + x0], v10 = buf[y0 * bw + x1];
        var v01 = buf[y1 * bw + x0], v11 = buf[y1 * bw + x1];
        var top = v00 + (v10 - v00) * fx;
        var bot = v01 + (v11 - v01) * fx;
        tmp[y * bw + x] = (top + (bot - top) * fy) * decay;
      }
    }

    // inject a fresh source into tmp: an orbiting bar / sine arc, drawn as bright
    // stamps.
    // injection is faint in silence and pumps with loudness + beat
    var bright = LABUTIL.clamp(p.inject * (0.12 + 1.3 * act) + react * beat * 0.5, 0, 1.4);
    // integrate the feeder orbit so it crawls in silence, orbits with sound
    s.fph = (s.fph || 0) + dt * 0.9 * motion;
    if (!isFinite(s.fph)) s.fph = 0;
    var a = s.fph;
    // orbiting endpoint
    var orbR = Math.min(bw, bh) * 0.28;
    var ox = cx + Math.cos(a) * orbR;
    var oy = cy + Math.sin(a * 1.0) * orbR;
    // a short bar from centre toward the orbit point, plus a sine arc
    var seg = 26;
    for (var i = 0; i <= seg; i++) {
      var u = i / seg;
      // bar
      var px = LABUTIL.lerp(cx, ox, u);
      var py = LABUTIL.lerp(cy, oy, u);
      stamp(tmp, bw, bh, px, py, bright * (0.6 + 0.4 * (1 - u)));
      // sine arc orbiting the other way, gives the tunnel two feeders
      var ang2 = -a * 1.3 + u * 3.4;
      var rr = orbR * (0.5 + 0.5 * Math.sin(u * 6.28 + s.fph));
      var ax = cx + Math.cos(ang2) * rr;
      var ay = cy + Math.sin(ang2) * rr;
      stamp(tmp, bw, bh, ax, ay, bright * 0.5);
    }

    // swap
    s.buf = tmp; s.tmp = buf;

    function stamp(b, bw, bh, fx, fy, val) {
      var ix = Math.round(fx), iy = Math.round(fy);
      // 2px soft stamp
      for (var yy = iy - 1; yy <= iy + 1; yy++) {
        if (yy < 0 || yy >= bh) continue;
        for (var xx = ix - 1; xx <= ix + 1; xx++) {
          if (xx < 0 || xx >= bw) continue;
          var d = (xx === ix && yy === iy) ? 1 : 0.45;
          var k = yy * bw + xx;
          var nv = b[k] + val * d;
          b[k] = nv > 1.4 ? 1.4 : nv;
        }
      }
    }

    // render buffer to ImageData, tinting ink with a faint accent in hot cores
    var data = s.img.data;
    var ink = LABUTIL.rgba(theme.ink, 1).match(/[\d.]+/g);
    var ir = +ink[0], ig = +ink[1], ib = +ink[2];
    var ac = LABUTIL.rgba(theme.accent, 1).match(/[\d.]+/g);
    var ar = +ac[0], ag = +ac[1], ab = +ac[2];
    var bgc = LABUTIL.rgba(theme.bg, 1).match(/[\d.]+/g);
    var br0 = +bgc[0], bg0 = +bgc[1], bb0 = +bgc[2];
    var src = s.buf;
    for (var q = 0; q < N; q++) {
      var v = src[q];
      if (v > 1) v = 1; else if (v < 0) v = 0;
      // gamma for a filmic ramp
      var lum = Math.pow(v, 0.8);
      // hot cores lean to accent slightly
      var hot = LABUTIL.smoothstep(0.75, 1, v) * 0.5;
      var rr = LABUTIL.lerp(br0, LABUTIL.lerp(ir, ar, hot), lum);
      var gg = LABUTIL.lerp(bg0, LABUTIL.lerp(ig, ag, hot), lum);
      var bb = LABUTIL.lerp(bb0, LABUTIL.lerp(ib, ab, hot), lum);
      var di = q * 4;
      data[di] = rr; data[di + 1] = gg; data[di + 2] = bb; data[di + 3] = 255;
    }

    // paint: clear bg then upscale buffer with stamped rects (cap-safe)
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    var cw = w / bw, ch = h / bh;
    var step = (bw * bh > 14000) ? 2 : 1;
    for (var yp = 0; yp < bh; yp += step) {
      for (var xp = 0; xp < bw; xp += step) {
        var ii = (yp * bw + xp) * 4;
        // skip near-bg pixels to save fills and keep it crisp
        var lv = src[yp * bw + xp];
        if (lv < 0.015) continue;
        ctx.fillStyle = 'rgb(' + data[ii] + ',' + data[ii + 1] + ',' + data[ii + 2] + ')';
        ctx.fillRect(xp * cw, yp * ch, cw * step + 1, ch * step + 1);
      }
    }
  }
});
