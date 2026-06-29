LAB.register({
  id: 'reversible-spectrogram',
  title: 'Reversible Spectrogram',
  group: 'Raster, glyph, text',
  essence: 'A scrolling STFT image where spectral energy is deposited to draw a word, so the picture provably is the sound.',
  blurb: 'Energy painted into the time-frequency plane spells the lineage name. The image is not a picture of a sound; it is a spectrogram that, fed through an inverse STFT, would say its own name. Aphex Twin, Photosounder, Xenakis UPIC.',
  tags: ['raster', 'spectral', 'text', 'monochrome', 'realtime'],
  lineage: 'Xenakis UPIC (1977), Aphex Twin Windowlicker face (1999), Photosounder, ARSS analysis-resynthesis spectrograph',
  dialect: '-',
  palette: 'Pure grayscale on near-black. Single warm amber accent reserved for the active (rightmost) write column only, marking where new energy is being deposited.',
  paramNotes: 'scrollSpeed sets columns advanced per frame (time resolution feel). glyphGain scales deposited magnitude (brightness of the word). logBase warps the frequency axis. noiseFloor sets the dim STFT haze behind the glyph. blurY adds spectral bleed. Audio drive feeds the live spectrum and loudness into each written column, so a.spectrum and a.level brighten and shape the deposited word.',
  params: [
    { key: 'scrollSpeed', label: 'Scroll speed (cols/frame)', min: 0.25, max: 4, step: 0.25, value: 1 },
    { key: 'glyphGain', label: 'Glyph energy gain', min: 0.2, max: 2, step: 0.05, value: 1.1 },
    { key: 'logBase', label: 'Freq axis log warp', min: 0, max: 1, step: 0.05, value: 0.55 },
    { key: 'noiseFloor', label: 'STFT haze floor', min: 0, max: 0.3, step: 0.01, value: 0.06 },
    { key: 'blurY', label: 'Spectral bleed (bins)', min: 0, max: 4, step: 0.5, value: 1.5 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.WORD = 'SOUND';
    s.buf = null; s.bw = 0; s.bh = 0;
    s.mask = null; s.maskW = 0; s.maskH = 0; s.maskBuilt = false;
    s.writeCol = 0; s.p = 0; s.pPrev = 0;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var U = LABUTIL, clamp = U.clamp, hash2 = U.hash2;
    function mkc(cw, ch) {
      try {
        if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(cw, ch);
        if (typeof document !== 'undefined') { var c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; }
      } catch (e) {}
      return null;
    }
    function parseRGB(css) {
      if (css && css[0] === '#') { var hx = css.slice(1); if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2]; var n = parseInt(hx.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
      var m = String(css).match(/(\d+(?:\.\d+)?)/g); if (m && m.length >= 3) return [+m[0], +m[1], +m[2]]; return [233, 231, 223];
    }

    var BW = Math.max(8, Math.min(560, Math.round(w)));
    var BH = Math.max(8, Math.min(300, Math.round(h)));
    var prefill = false;

    if (!s.buf || s.bw !== BW || s.bh !== BH) {
      var c = mkc(BW, BH);
      if (c) { c.width = BW; c.height = BH; s.buf = c; s.bw = BW; s.bh = BH; try { var ic = c.getContext('2d'); ic.fillStyle = theme.bg; ic.fillRect(0, 0, BW, BH); } catch (e) {} }
      else s.buf = null;
      s.maskBuilt = false; prefill = true;
    }

    // tiled-word mask (the word repeats across the scroll length so any window shows letters)
    if (!s.maskBuilt || s.maskH !== BH || !s.mask) {
      var SCROLL_LEN = Math.max(BW * 2, Math.min(2400, Math.round(BW * 3)));
      var mc = mkc(SCROLL_LEN, BH);
      s.mask = new Float32Array(SCROLL_LEN * BH); s.maskW = SCROLL_LEN; s.maskH = BH;
      if (mc) {
        try {
          var mx = mc.getContext('2d'); mx.fillStyle = '#000'; mx.fillRect(0, 0, SCROLL_LEN, BH);
          var fp = Math.round(BH * 0.6);
          mx.font = '700 ' + fp + "px 'IBM Plex Mono', ui-monospace, monospace";
          mx.fillStyle = '#fff'; mx.textBaseline = 'middle'; mx.textAlign = 'left';
          var unit = s.WORD + '   ';
          var uw = fp * unit.length * 0.6; try { uw = mx.measureText(unit).width; } catch (e) {}
          if (!(uw > 1)) uw = fp * unit.length * 0.6;
          var x = 0, guard = 0;
          while (x < SCROLL_LEN + uw && guard < 400) { mx.fillText(unit, x, BH * 0.5); x += uw; guard++; }
          var md = null; try { md = mx.getImageData(0, 0, SCROLL_LEN, BH).data; } catch (e) { md = null; }
          if (md) { for (var col = 0; col < SCROLL_LEN; col++) { for (var row = 0; row < BH; row++) { s.mask[col * BH + row] = md[(row * SCROLL_LEN + col) * 4] / 255; } } }
        } catch (e) {}
      }
      s.maskBuilt = true; s.writeCol = 0; s.p = 0; s.pPrev = 0; prefill = true;
    }

    var mask = s.mask, maskW = s.maskW;
    var glyphGain = clamp(p.glyphGain, 0.2, 2), logBase = clamp(p.logBase, 0, 1), noiseFloor = clamp(p.noiseFloor, 0, 0.3), blurY = clamp(p.blurY, 0, 4);
    var warpK = logBase * 8; var warpDen = Math.pow(2, warpK) - 1; if (!isFinite(warpDen) || warpDen <= 0) warpDen = 1;

    var maskRowFor = s.maskRowFor;
    if (!maskRowFor || maskRowFor.length !== BH || s.warpKCache !== warpK) {
      maskRowFor = s.maskRowFor = new Int32Array(BH); s.warpKCache = warpK;
      for (var r = 0; r < BH; r++) { var yn = r / BH; var vn = logBase > 0 ? (Math.pow(2, yn * warpK) - 1) / warpDen : yn; vn = clamp(vn, 0, 1); var mr = Math.floor((1 - vn) * (BH - 1)); maskRowFor[r] = mr < 0 ? 0 : (mr > BH - 1 ? BH - 1 : mr); }
    }
    var taps = s.taps, tapW = s.tapW;
    if (!taps || s.tapsSigma !== blurY) {
      s.tapsSigma = blurY; var sig = blurY;
      if (sig < 0.01) { taps = s.taps = [1]; tapW = s.tapW = 0; }
      else { var rad = Math.min(3, Math.max(1, Math.round(sig * 2))); tapW = s.tapW = rad; var arr = [], sum = 0; for (var k = -rad; k <= rad; k++) { var g = Math.exp(-(k * k) / (2 * sig * sig)); arr.push(g); sum += g; } for (var k2 = 0; k2 < arr.length; k2++) arr[k2] /= (sum || 1); taps = s.taps = arr; }
    }
    var ink = s._ink; if (!ink || s._inkStr !== theme.ink) { s._inkStr = theme.ink; ink = s._ink = parseRGB(theme.ink); }
    var acc = s._acc; if (!acc || s._accStr !== theme.accent) { s._accStr = theme.accent; acc = s._acc = parseRGB(theme.accent); }
    var bctx = null; try { bctx = s.buf ? s.buf.getContext('2d') : null; } catch (e) { bctx = null; }
    var S = s.spectrum; if (!S || S.length !== BH) S = s.spectrum = new Float32Array(BH);
    var Sb = s.spectrumB; if (!Sb || Sb.length !== BH) Sb = s.spectrumB = new Float32Array(BH);

    // LIVE spectral drive: per display-row gain from a.spectrum + a.level, with a
    // baseline kept so the deposited word stays legible; react = 0 restores the pure glyph.
    var react = (p.react == null ? 0.85 : p.react);
    var aw = clamp(react, 0, 1.5);
    var aLevel = (a && isFinite(a.level)) ? clamp(a.level, 0, 1) : 0;
    var aPeak = (a && isFinite(a.peak)) ? clamp(a.peak, 0, 1) : 0;
    var aBeat = (a && isFinite(a.beat)) ? clamp(a.beat, 0, 1) : 0;
    // audio activity gates the scroll/deposit advance: near-frozen in silence
    var act = clamp(Math.max(aLevel, aPeak * 0.7, aBeat) * react, 0, 1);
    var spec = a ? a.spectrum : null;
    var specLen = (spec && spec.length) ? spec.length : 1;
    var rowGain = s.rowGain; if (!rowGain || rowGain.length !== BH) rowGain = s.rowGain = new Float32Array(BH);
    for (var rgi = 0; rgi < BH; rgi++) {
      var rfy = (BH > 1) ? (1 - rgi / (BH - 1)) : 0;
      var rsi = Math.round(rfy * (specLen - 1)); if (rsi < 0) rsi = 0; else if (rsi > specLen - 1) rsi = specLen - 1;
      var rsv = spec ? spec[rsi] : 0; if (!isFinite(rsv)) rsv = 0;
      rowGain[rgi] = (1 - 0.5 * aw / 1.5) + aw * (1.1 * rsv + 0.4 * aLevel);
    }

    function emitColumn(colX, sc, head) {
      for (var rr = 0; rr < BH; rr++) { var mrr = maskRowFor[rr]; S[rr] = (mask ? mask[sc * BH + mrr] : 0) * glyphGain * rowGain[rr]; }
      if (tapW > 0) { for (var i = 0; i < BH; i++) { var v = 0; for (var k3 = -tapW; k3 <= tapW; k3++) { var j = i + k3; if (j < 0) j = 0; else if (j > BH - 1) j = BH - 1; v += S[j] * taps[k3 + tapW]; } Sb[i] = v; } }
      else { for (var i2 = 0; i2 < BH; i2++) Sb[i2] = S[i2]; }
      for (var y = 0; y < BH; y++) {
        var hz = noiseFloor * (0.5 + 0.5 * hash2(sc * 0.37 + 11.3, y * 0.91 + 7.1));
        var sv = Sb[y]; if (sv < hz) sv = hz; sv = clamp(sv, 0, 1);
        var gg = Math.sqrt(sv); if (!isFinite(gg)) gg = 0; if (gg < 0.012) continue;
        var rC = ink[0] * gg, gC = ink[1] * gg, bC = ink[2] * gg;
        if (head) { var mixA = 0.22; rC += (acc[0] * gg - rC) * mixA; gC += (acc[1] * gg - gC) * mixA; bC += (acc[2] * gg - bC) * mixA; }
        bctx.fillStyle = 'rgb(' + (rC | 0) + ',' + (gC | 0) + ',' + (bC | 0) + ')';
        bctx.fillRect(colX, y, 1, 1);
      }
    }

    if (bctx) {
      if (prefill) { bctx.fillStyle = theme.bg; bctx.fillRect(0, 0, BW, BH); for (var pc = 0; pc < BW; pc++) emitColumn(pc, pc % maskW, false); s.writeCol = BW; }
      var IDLE = 0.06, GAIN = 1.0; s.pPrev = s.p; s.p += clamp(p.scrollSpeed, 0.25, 4) * (IDLE + GAIN * act); if (!isFinite(s.p)) { s.p = 0; s.pPrev = 0; }
      var nNew = Math.floor(s.p) - Math.floor(s.pPrev); if (nNew < 0) nNew = 0; if (nNew > 8) nNew = 8;
      if (nNew > 0) {
        try { bctx.globalCompositeOperation = 'copy'; bctx.drawImage(s.buf, -nNew, 0); bctx.globalCompositeOperation = 'source-over'; }
        catch (e) { bctx.fillStyle = theme.bg; bctx.fillRect(0, 0, BW, BH); }
        bctx.fillStyle = theme.bg; bctx.fillRect(BW - nNew, 0, nNew, BH);
        for (var n = 0; n < nNew; n++) { var sc = ((s.writeCol % maskW) + maskW) % maskW; s.writeCol++; emitColumn(BW - nNew + n, sc, n === nNew - 1); }
      }
    }

    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, w, h);
    if (s.buf) { var prevSm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; try { ctx.drawImage(s.buf, 0, 0, BW, BH, 0, 0, w, h); } catch (e) {} ctx.imageSmoothingEnabled = prevSm; }
    ctx.strokeStyle = U.rgba(theme.grid, 1); ctx.lineWidth = 1;
    for (var gi = 1; gi < 5; gi++) { var gy = (gi / 5) * h; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = U.rgba(theme.accent, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w - 1, 0); ctx.lineTo(w - 1, h); ctx.stroke();
  }
});
