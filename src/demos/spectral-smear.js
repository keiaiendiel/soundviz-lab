LAB.register({
  id: 'spectral-smear',
  title: 'Phase-Vocoder Spectral Paint',
  group: 'Spectral',
  essence: 'Spectral energy smeared and time-stretched into soft horizontal drift, frozen sound.',
  blurb: 'Sound held still and dragged. A phase-vocoder freezes and smears spectral frames so partials become long horizontal brush-strokes that blur and recombine, the audible equivalent of a long-exposure photograph of a chord. It is the soft, painterly end of the spectral family and the closest image to Akten latent hovering, kept monochrome so it reads as a measurement and not a dream. Good for the witness / sustain register.',
  tags: ['spectral','field','blur','feedback','monochrome','slow'],
  lineage: 'Phase vocoder (Flanagan + Golden 1966); spectral freeze in Paulstretch / GRM Tools; Memo Akten Deep Meditations latent smear. Scientific anchor: STFT magnitude with phase-locked time stretch.',
  dialect: 'Phase Interferometer',
  palette: 'monochrome ink',
  paramNotes: 'Smear length and freeze probability are the two levers that define the gesture and must be sliders. Vertical drift is secondary. Resist a saturation/colour control; the technique only reads as scientific while it is grey on black, the instant it tints it becomes a screensaver. Audio drive deposits the live spectrum at the write edge scaled by a.level, so the frozen smear is painted from real sound.',
  params: [
    { key: 'smear',    label: 'Smear length',   min: 0.8, max: 0.99, step: 0.005, value: 0.96 },
    { key: 'freeze',   label: 'Freeze amount',  min: 0,   max: 1,    step: 0.05,  value: 0.5 },
    { key: 'partials', label: 'Partials',       min: 2,   max: 10,   step: 1,     value: 5 },
    { key: 'drift',    label: 'Vertical drift', min: 0,   max: 0.5,  step: 0.02,  value: 0.1 },
    { key: 'react',    label: 'Audio drive',    min: 0,   max: 1.5,  step: 0.05,  value: 0.85 }
  ],
  init(s, w, h){
    s.BW = 160;
    s.BH = 120;
    // single-channel intensity buffer in [0,1], scrolled right each step
    s.buf = new Float32Array(s.BW * s.BH);
    s.img = null;     // lazily created ImageData via ctx
    s.last = 0;       // time accumulator
    s.seed = 0;
  },
  draw(ctx, w, h, t, p, s, theme, a){
    var BW = s.BW, BH = s.BH;
    var buf = s.buf;

    var react = (p.react == null ? 0.85 : p.react);
    var aw = LABUTIL.clamp(react, 0, 1.5);
    var synFade = 1 - 0.6 * aw / 1.5;
    var spec = a ? a.spectrum : null;
    var specLen = (spec && spec.length) ? spec.length : 1;
    var aLevel = (a && isFinite(a.level)) ? LABUTIL.clamp(a.level, 0, 1) : 0;

    // advance the feedback in fixed sub-steps so smear is frame-rate independent
    var dt = t - s.last;
    if (!isFinite(dt) || dt < 0) dt = 1 / 60;
    if (dt > 0.25) dt = 0.25; // guard against tab-resume jumps
    s.last = t;
    var steps = Math.max(1, Math.min(4, Math.round(dt / (1 / 60))));

    // retention per step from smear; decay = how fast old paint fades
    var retain = LABUTIL.clamp(p.smear, 0.8, 0.99);
    var P = Math.max(2, Math.round(p.partials));

    for (var st = 0; st < steps; st++){
      // scroll every column one pixel to the right, fading as it goes
      for (var y = 0; y < BH; y++){
        var row = y * BW;
        for (var x = BW - 1; x > 0; x--){
          buf[row + x] = buf[row + x - 1] * retain;
        }
        buf[row] = 0; // clear the new left column for fresh deposit
      }

      // deposit fresh partials at the left edge
      for (var k = 0; k < P; k++){
        var fy = (0.13 + 0.74 * k / Math.max(1, P - 1))
               + p.drift * 0.12 * Math.sin(t * 0.3 * (k + 1) + k);
        fy = LABUTIL.clamp(fy, 0.02, 0.98);
        // freeze gate: higher freeze -> more partials sustain at full strength
        var gate = LABUTIL.noise2(k, t * 0.5);
        var thr = 1 - 0.5 - 0.5 * LABUTIL.clamp(p.freeze, 0, 1);
        var active = gate > thr ? 1 : 0.2;
        var amp = (0.5 + 0.5 * active) * synFade;
        var thick = 1 + Math.round(2 * active);
        var cyp = Math.floor(fy * BH);
        for (var dy = -thick; dy <= thick; dy++){
          var yy = cyp + dy;
          if (yy < 0 || yy >= BH) continue;
          var fall = 1 - Math.abs(dy) / (thick + 1);
          var idx = yy * BW; // left column x=0
          var v = buf[idx] + amp * fall;
          buf[idx] = v > 1 ? 1 : v;
        }
      }

      // LIVE spectral deposit at the left edge: brightness per row comes from the mic
      if (spec) {
        for (var sy = 0; sy < BH; sy++){
          var sfy = (BH > 1) ? (1 - sy / BH) : 0;
          var si = Math.round(sfy * (specLen - 1));
          if (si < 0) si = 0; else if (si > specLen - 1) si = specLen - 1;
          var sv = spec[si]; if (!isFinite(sv)) sv = 0;
          var dep = aw * sv * (0.35 + 0.9 * aLevel);
          if (dep > 0){
            var sidx = sy * BW;
            var nv = buf[sidx] + dep;
            buf[sidx] = nv > 1 ? 1 : nv;
          }
        }
      }
    }

    // render buffer into ImageData (grey on near-black), monochrome
    if (!s.img) s.img = ctx.createImageData(BW, BH);
    var im = s.img.data;
    // parse theme ink + bg to rgb once per frame (cheap, robust)
    var ink = parseRGB(theme.ink, 233, 230, 220);
    var bg  = parseRGB(theme.bg, 10, 11, 13);
    for (var i = 0; i < BW * BH; i++){
      var vv = buf[i]; if (vv > 1) vv = 1; else if (vv < 0) vv = 0;
      var o = i * 4;
      im[o]     = bg.r + (ink.r - bg.r) * vv;
      im[o + 1] = bg.g + (ink.g - bg.g) * vv;
      im[o + 2] = bg.b + (ink.b - bg.b) * vv;
      im[o + 3] = 255;
    }

    // blit small buffer to an offscreen-sized region, then scale up smoothly
    // putImageData ignores transforms, so paint at 1:1 then scale via drawImage of self is unsafe;
    if (!s.tmp){
      // build a tiny canvas-like via OffscreenCanvas if present, else fall back to per-block scale
      s.tmp = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(BW, BH) : null;
      if (s.tmp) s.tctx = s.tmp.getContext('2d');
    }
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    if (s.tctx){
      s.tctx.putImageData(s.img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(s.tmp, 0, 0, BW, BH, 0, 0, w, h);
    } else {
      // fallback: block scale, never per-pixel over full canvas
      var sx = w / BW, sy = h / BH;
      for (var by = 0; by < BH; by += 1){
        for (var bx = 0; bx < BW; bx += 1){
          var b2 = buf[by * BW + bx];
          if (b2 < 0.04) continue;
          ctx.fillStyle = LABUTIL.rgba(theme.ink, b2 * 0.9);
          ctx.fillRect(bx * sx, by * sy, sx + 1, sy + 1);
        }
      }
    }

    // faint frequency grid so it reads as a measurement, not a dream
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 1);
    ctx.lineWidth = 1;
    for (var g = 1; g < 6; g++){
      var gy = (g / 6) * h;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    function parseRGB(css, dr, dg, db){
      if (typeof css === 'string'){
        var m = css.match(/^#([0-9a-f]{6})$/i);
        if (m){
          var nv = parseInt(m[1], 16);
          return { r: (nv >> 16) & 255, g: (nv >> 8) & 255, b: nv & 255 };
        }
        var m3 = css.match(/^#([0-9a-f]{3})$/i);
        if (m3){
          var h3 = m3[1];
          return {
            r: parseInt(h3[0] + h3[0], 16),
            g: parseInt(h3[1] + h3[1], 16),
            b: parseInt(h3[2] + h3[2], 16)
          };
        }
        var mr = css.match(/rgba?\(([^)]+)\)/i);
        if (mr){
          var parts = mr[1].split(',');
          return { r: +parts[0] || dr, g: +parts[1] || dg, b: +parts[2] || db };
        }
      }
      return { r: dr, g: dg, b: db };
    }
  }
});
