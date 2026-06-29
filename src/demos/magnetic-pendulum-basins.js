LAB.register({
  id: 'magnetic-pendulum-basins',
  title: 'Magnetic Pendulum Basins',
  group: 'Fractal and recursion',
  essence: 'A damped pendulum over three magnets settles on one of them; each starting point is painted by which magnet it reaches, and the basin boundaries come out fractal. The map is computed once into a cached buffer; a live pendulum traces toward its magnet on top.',
  blurb: 'An iron bob on a rod hangs above three magnets at the corners of an equilateral triangle. It feels a linear restoring pull toward the centre, viscous friction, and an inverse-square attraction to each magnet softened by a finite bob-to-magnet height. From most starting points the long-run fate is simple, the bob parks over one magnet. Near the seams it is not, two points a hair apart land on different magnets, so the three basins interleave into a fractal lacework with three-fold symmetry. The basin map is integrated once at low resolution and cached; only a parameter change recomputes it. A single live pendulum is integrated on top and drawn as a fading filament with a head dot, then it respawns when it settles.',
  tags: ['fractal','raster','line','monochrome','accent','slow'],
  lineage: 'Magnetic pendulum with three fixed-point attractors, a textbook case of fractal basins of attraction in a dissipative system. Models from R. Taylor (Thompson Rivers University) and the beltoforion magnetic-pendulum writeup: linear restoring force, linear friction, inverse-square magnet attraction softened by a height offset.',
  dialect: 'Vector Plume',
  palette: 'Near-black ground. The three basins are three flat grey levels (about 0.18, 0.34, 0.52 luminance toward ink) with a faint darker tint where convergence was slow, so the fractal seam reads without colour. The live pendulum path is the single amber accent, a fading filament with a small head dot. No second hue.',
  paramNotes: 'friction and magnetStrength are the genuine levers from the model: lowering friction or raising magnet strength deepens the fractal boundary, raising friction smooths it toward three clean lobes. height is the bob-to-magnet gap that softens the inverse-square singularity. spread sets the triangle radius. Any of these invalidates and recomputes the cached basin; speed only drives the live tracer and leaves the cache intact. Audio drive sets tracer speed from loudness, kicks the bob on each beat, and lights the magnet of the active basin in amber by spectral centroid (cache untouched).',
  params: [
    { key: 'friction', label: 'Friction', min: 0.05, max: 0.6, step: 0.01, value: 0.18 },
    { key: 'magnetStrength', label: 'Magnet strength', min: 0.5, max: 4, step: 0.1, value: 1.6 },
    { key: 'height', label: 'Bob height', min: 0.1, max: 0.6, step: 0.02, value: 0.28 },
    { key: 'spread', label: 'Magnet spread', min: 0.6, max: 1.6, step: 0.05, value: 1 },
    { key: 'speed', label: 'Tracer speed', min: 1, max: 12, step: 1, value: 5 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.WORLD = 1.5;
    s.kg = 0.6;
    s.DT = 0.05;
    s.SETTLE = 0.25;
    s.STOPV2 = 0.05 * 0.05;
    s.rng = LABUTIL.mulberry32(1337);
    s.sig = '';
    s.buf = null;
    s.off = null;
    s.octx = null;
    s.bw = 0;
    s.bh = 0;
    // hex->rgb
    s.toRGB = function (css) {
      var hex = css.trim();
      if (hex[0] === '#') {
        if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        var n = parseInt(hex.slice(1, 7), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      var m = hex.match(/(\d+(?:\.\d+)?)/g);
      if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
      return [233, 231, 223];
    };
    // magnet geometry for a given spread
    s.magnets = function (spread) {
      var R = spread * 1.1, M = [], a;
      var degs = [90, 210, 330];
      for (var k = 0; k < 3; k++) {
        a = degs[k] * Math.PI / 180;
        M.push([R * Math.cos(a), R * Math.sin(a)]);
      }
      return M;
    };
    // integrate one step in place: state [x,y,vx,vy]; returns winner index or -1
    s.step = function (st, M, kf, S, h2) {
      var x = st[0], y = st[1], vx = st[2], vy = st[3];
      var ax = -s.kg * x - kf * vx, ay = -s.kg * y - kf * vy;
      for (var k = 0; k < 3; k++) {
        var dx = M[k][0] - x, dy = M[k][1] - y;
        var d2 = dx * dx + dy * dy + h2;
        var d = Math.sqrt(d2);
        var inv = 1 / (d2 * d);
        ax += S * dx * inv;
        ay += S * dy * inv;
      }
      vx += ax * s.DT; vy += ay * s.DT;
      x += vx * s.DT; y += vy * s.DT;
      st[0] = x; st[1] = y; st[2] = vx; st[3] = vy;
      return -1;
    };
    s.winnerAt = function (st, M) {
      if (st[2] * st[2] + st[3] * st[3] < s.STOPV2) {
        for (var k = 0; k < 3; k++) {
          var dx = M[k][0] - st[0], dy = M[k][1] - st[1];
          if (dx * dx + dy * dy < s.SETTLE * s.SETTLE) return k;
        }
      }
      return -1;
    };
    s.nearest = function (st, M) {
      var best = 0, bd = Infinity;
      for (var k = 0; k < 3; k++) {
        var dx = M[k][0] - st[0], dy = M[k][1] - st[1];
        var d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };
    s.buildBasin = function (p, theme, w, h) {
      var BW = 160;
      var BH = LABUTIL.clamp(Math.round(160 * h / Math.max(1, w)), 60, 160);
      var kf = p.friction, S = p.magnetStrength, h2 = p.height * p.height;
      var M = s.magnets(p.spread);
      var bg = s.toRGB(theme.bg), ink = s.toRGB(theme.ink);
      var levels = [0.18, 0.34, 0.52];
      var data = new Uint8ClampedArray(BW * BH * 4);
      var WORLD = s.WORLD;
      var st = [0, 0, 0, 0];
      for (var py = 0; py < BH; py++) {
        var wy = (py / (BH - 1) * 2 - 1) * WORLD;
        for (var px = 0; px < BW; px++) {
          var wx = (px / (BW - 1) * 2 - 1) * WORLD;
          st[0] = wx; st[1] = wy; st[2] = 0; st[3] = 0;
          var winner = -1, steps = 600;
          for (var it = 0; it < 600; it++) {
            s.step(st, M, kf, S, h2);
            if (!isFinite(st[0]) || !isFinite(st[1])) break;
            var win = s.winnerAt(st, M);
            if (win >= 0) { winner = win; steps = it; break; }
          }
          if (winner < 0) winner = s.nearest(st, M);
          var lvl = levels[winner] * (1 - 0.18 * LABUTIL.clamp(steps / 600, 0, 1));
          var idx = (py * BW + px) * 4;
          data[idx] = bg[0] + (ink[0] - bg[0]) * lvl;
          data[idx + 1] = bg[1] + (ink[1] - bg[1]) * lvl;
          data[idx + 2] = bg[2] + (ink[2] - bg[2]) * lvl;
          data[idx + 3] = 255;
        }
      }
      s.bw = BW; s.bh = BH;
      var img;
      if (typeof OffscreenCanvas !== 'undefined') {
        if (!s.off || s.off.width !== BW || s.off.height !== BH) {
          s.off = new OffscreenCanvas(BW, BH);
          s.octx = s.off.getContext('2d');
        }
        img = s.octx.createImageData(BW, BH);
        img.data.set(data);
        s.octx.putImageData(img, 0, 0);
        s.buf = s.off;
      } else {
        // ImageData fallback: keep the ImageData and blit per frame at native size, then scale via temp path
        s.imgData = new Uint8ClampedArray(data);
        s.buf = null;
      }
    };
    s.respawn = function () {
      var W = 0.95 * s.WORLD;
      s.tx = (s.rng() * 2 - 1) * W;
      s.ty = (s.rng() * 2 - 1) * W;
      s.tvx = 0; s.tvy = 0;
      s.life = 0;
      s.trail = s.trail || new Float32Array(240 * 2);
      s.thead = 0; s.tcount = 0;
    };
    s.pushTrail = function () {
      s.trail[s.thead * 2] = s.tx;
      s.trail[s.thead * 2 + 1] = s.ty;
      s.thead = (s.thead + 1) % 240;
      if (s.tcount < 240) s.tcount++;
    };
    // PREWARM: build basin for default params + canonical theme
    var defTheme = { bg: '#100f14', ink: '#e9e7df', accent: '#6f66e6' };
    var defP = { friction: 0.18, magnetStrength: 1.6, height: 0.28, spread: 1, speed: 5 };
    s.buildBasin(defP, defTheme, w, h);
    s.sig = (0.18).toFixed(3) + '|' + 1.6 + '|' + 0.28 + '|' + 1 + '|' + defTheme.bg + '|' + defTheme.ink;
    s.curM = s.magnets(1);
    s.respawn();
    // step tracer ~120 substeps so frame one shows a filament mid-flight
    var h2d = 0.28 * 0.28, stt = [s.tx, s.ty, 0, 0];
    for (var i = 0; i < 120; i++) {
      s.step(stt, s.curM, 0.18, 1.6, h2d);
      if (!isFinite(stt[0])) break;
      s.tx = stt[0]; s.ty = stt[1]; s.tvx = stt[2]; s.tvy = stt[3];
      if (i % 1 === 0) s.pushTrail();
      s.life++;
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var sig = p.friction.toFixed(3) + '|' + p.magnetStrength + '|' + p.height + '|' + p.spread + '|' + theme.bg + '|' + theme.ink;
    if (sig !== s.sig) {
      s.buildBasin(p, theme, w, h);
      s.sig = sig;
      s.curM = s.magnets(p.spread);
    }
    if (!s.curM) s.curM = s.magnets(p.spread);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    var prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if (s.buf) {
      ctx.drawImage(s.buf, 0, 0, s.bw, s.bh, 0, 0, w, h);
    } else if (s.imgData) {
      // fallback: no OffscreenCanvas, so upscale the ImageData by drawing one rect per cell
      var BW = s.bw, BH = s.bh, sx = w / BW, sy = h / BH;
      var d = s.imgData;
      for (var py = 0; py < BH; py++) {
        for (var px = 0; px < BW; px++) {
          var idx = (py * BW + px) * 4;
          ctx.fillStyle = 'rgb(' + d[idx] + ',' + d[idx + 1] + ',' + d[idx + 2] + ')';
          ctx.fillRect(px * sx, py * sy, sx + 1, sy + 1);
        }
      }
    }
    ctx.imageSmoothingEnabled = prevSmooth;

    // audio: loudness drives tracer speed, beat kicks the bob, centroid lights the active basin
    var react = (p.react == null ? 0.85 : p.react);
    var lv = a ? LABUTIL.clamp(a.level, 0, 1) : 0;
    var ce = a ? LABUTIL.clamp(a.centroid, 0, 1) : 0;
    var bt = a ? LABUTIL.clamp(a.beat, 0, 1) : 0;
    var pk = a ? LABUTIL.clamp(a.peak, 0, 1) : 0;
    // silence = stillness: act ~0 when quiet, rises only with real sound
    var act = LABUTIL.clamp(Math.max(lv, pk * 0.7, bt) * react, 0, 1);
    var h2 = p.height * p.height, kf = p.friction, S = p.magnetStrength;
    var M = s.curM, stt = [s.tx, s.ty, s.tvx, s.tvy];
    // active-basin highlight: soft amber glow on the magnet the bob is nearest, lit by centroid
    var winNow = s.nearest(stt, M);
    if (winNow >= 0 && M[winNow]) {
      var gx = (M[winNow][0] / s.WORLD * 0.5 + 0.5) * w;
      var gy = (M[winNow][1] / s.WORLD * 0.5 + 0.5) * h;
      var gA = LABUTIL.clamp(react * (0.16 + 0.5 * lv) * (0.4 + 0.8 * ce), 0, 0.7);
      var gR = LABUTIL.clamp(6 + react * (10 * lv + 8 * ce), 3, 40);
      if (isFinite(gx) && isFinite(gy)) {
        ctx.fillStyle = LABUTIL.rgba(theme.accent, gA);
        ctx.beginPath();
        ctx.arc(gx, gy, gR, 0, LABUTIL.TAU);
        ctx.fill();
      }
    }
    // advance live tracer; near-still in silence: tracer nearly stops when quiet (cache untouched)
    var subs = Math.max(0, Math.min(24, Math.round(p.speed * (0.05 + 1.3 * act))));
    if (bt > 0.01) {
      stt[2] += (s.rng() * 2 - 1) * bt * react * 0.5;
      stt[3] += (s.rng() * 2 - 1) * bt * react * 0.5;
    }
    for (var i = 0; i < subs; i++) {
      s.step(stt, M, kf, S, h2);
      s.life++;
      var bad = !isFinite(stt[0]) || !isFinite(stt[1]);
      var settled = (stt[2] * stt[2] + stt[3] * stt[3] < s.STOPV2) && s.winnerAt(stt, M) >= 0;
      if (bad || settled || s.life > 900) {
        s.respawn();
        stt[0] = s.tx; stt[1] = s.ty; stt[2] = s.tvx; stt[3] = s.tvy;
        s.pushTrail();
        continue;
      }
      s.tx = stt[0]; s.ty = stt[1]; s.tvx = stt[2]; s.tvy = stt[3];
      s.pushTrail();
    }

    // draw trail (oldest -> newest), amber, fading tail->head
    var WORLD = s.WORLD;
    function sx(wx) { return (wx / WORLD * 0.5 + 0.5) * w; }
    function sy(wy) { return (wy / WORLD * 0.5 + 0.5) * h; }
    var n = s.tcount;
    if (n > 1) {
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var bands = 28;
      var aGain = LABUTIL.clamp(0.8 + 0.5 * react * lv, 0.5, 1.4);
      for (var b = 0; b < bands; b++) {
        var f0 = b / bands, f1 = (b + 1) / bands;
        var i0 = Math.floor(f0 * (n - 1));
        var i1 = Math.floor(f1 * (n - 1));
        if (i1 <= i0) continue;
        var alpha = LABUTIL.clamp(LABUTIL.lerp(0.12, 0.9, f0) * aGain, 0, 1);
        ctx.strokeStyle = LABUTIL.rgba(theme.accent, alpha);
        ctx.beginPath();
        for (var k = i0; k <= i1; k++) {
          var ri = (s.thead - n + k + 240 * 2) % 240;
          var wx = s.trail[ri * 2], wy = s.trail[ri * 2 + 1];
          var px = sx(wx), py = sy(wy);
          if (k === i0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // head dot
      ctx.fillStyle = LABUTIL.rgba(theme.accent, 0.95);
      ctx.beginPath();
      var hr = LABUTIL.clamp(2 + react * (2.5 * lv + 2 * bt), 1, 9);
      ctx.arc(sx(s.tx), sy(s.ty), hr, 0, LABUTIL.TAU);
      ctx.fill();
    }
  }
});
