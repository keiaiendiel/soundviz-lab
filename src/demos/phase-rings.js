LAB.register({
  id: 'phase-rings',
  title: 'Concentric Phase Rings',
  group: 'Line and geometry',
  essence: 'Razor-thin rings expanding from sources, colliding into moire interference.',
  blurb: 'The interferometer dialect in its clean form. Each source emits expanding razor-thin concentric rings; where two ring systems overlap, their sum produces moire interference fringes, the holography image directly. Drawn as pure white circles on black it is delicate and diagrammatic, the Nicolai milch register, and it holds the witness / sustain state. The collisions are the event, so source placement and wavelength are everything.',
  tags: ['line', 'moire', 'field', 'monochrome', 'slow'],
  lineage: 'Digital off-axis color holography (Montrésor, Picart, LAUM); Carsten Nicolai milch 75 hz; concentric-ring interference. Scientific anchor: spherical-wave interference, two-source moire.',
  dialect: 'Phase Interferometer',
  palette: 'monochrome ink',
  paramNotes: 'Wavelength (ring spacing) and source count are the levers that control how dense the moire becomes; expand speed sets the pulse. Source positions could animate slowly. Colour off; the interference itself is the only texture and it must stay luminance. Audio drive (react) gives each source a band (a.bass/a.mid/a.high): louder energy tightens and speeds its rings, and a.beat shoves every ring outward as a pulse.',
  params: [
    { key: 'wavelength', label: 'Ring spacing', min: 8, max: 60, step: 2, value: 22 },
    { key: 'sources', label: 'Sources', min: 1, max: 5, step: 1, value: 2 },
    { key: 'expand', label: 'Expand speed', min: 0, max: 3, step: 0.1, value: 1 },
    { key: 'thin', label: 'Ring thinness', min: 1, max: 8, step: 0.5, value: 4 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h){
    s.bw = 0;
    s.bh = 0;
    s.buf = null;
  },
  draw(ctx, w, h, t, p, s, theme, a){
    var U = LABUTIL, TAU = U.TAU;
    var react = (p.react == null ? 0.85 : p.react);
    var bass = (a && isFinite(a.bass)) ? U.clamp(a.bass, 0, 1) : 0;
    var mid = (a && isFinite(a.mid)) ? U.clamp(a.mid, 0, 1) : 0;
    var high = (a && isFinite(a.high)) ? U.clamp(a.high, 0, 1) : 0;
    var beat = (a && isFinite(a.beat)) ? U.clamp(a.beat, 0, 1) : 0;
    var en = [bass, mid, high];
    var lvl = (a && isFinite(a.level)) ? U.clamp(a.level, 0, 1) : 0;
    var peak = (a && isFinite(a.peak)) ? U.clamp(a.peak, 0, 1) : 0;
    // audio activity gates ring drift and source orbit; beat still pulses (beatPulse below)
    var act = U.clamp(Math.max(lvl, peak * 0.7, beat) * react, 0, 1);
    s.tph = (s.tph || 0) + (a.dt || 0.016) * (0.06 + 1.0 * act);
    if (!isFinite(s.tph)) s.tph = 0;
    // small offscreen buffer (<=160x160) computed per frame, then scaled up
    var BW = 150, BH = Math.max(2, Math.min(160, Math.round(BW * h / Math.max(1, w))));
    if (!s.buf || s.bw !== BW || s.bh !== BH){
      s.buf = ctx.createImageData(BW, BH);
      s.bw = BW; s.bh = BH;
    }
    var img = s.buf;
    var data = img.data;
    var nSrc = Math.max(1, Math.round(p.sources));
    var wl = Math.max(2, p.wavelength);
    var thin = p.thin;
    var expand = p.expand;
    // parse theme colours to rgb so we can write pixels
    function toRGB(col){
      var m = U.rgba(col, 1).match(/rgba?\(([0-9.]+),\s*([0-9.]+),\s*([0-9.]+)/);
      if (!m) return [233, 230, 220];
      return [parseFloat(m[1]) | 0, parseFloat(m[2]) | 0, parseFloat(m[3]) | 0];
    }
    var bg = toRGB(theme.bg);
    var ink = toRGB(theme.ink);
    // source positions in buffer space (orbiting slowly); each source also
    // tracks one frequency band so its rings tighten and speed with energy
    var sx = [], sy = [], wlSrc = [], phSrc = [];
    var ocx = BW * 0.5, ocy = BH * 0.5;
    var orbR = Math.min(BW, BH) * 0.30;
    // wavelength in buffer units (scale from CSS px by buffer ratio)
    var wlB = wl * (BW / Math.max(1, w));
    if (wlB < 1.2) wlB = 1.2;
    var basePhase = s.tph * expand * 30 * (BW / Math.max(1, w));
    var beatPulse = react * beat * wlB * 1.3;   // a beat shoves every ring outward
    for (var si = 0; si < nSrc; si++){
      var ang = TAU * si / nSrc + s.tph * 0.13;
      var rr = orbR * (nSrc === 1 ? 0 : 1);
      sx.push(ocx + Math.cos(ang) * rr);
      sy.push(ocy + Math.sin(ang + 0.4) * rr);
      var e = en[si % 3];
      var wls = wlB * (1 - 0.5 * react * e);
      if (wls < 1.2) wls = 1.2;
      wlSrc.push(wls);
      phSrc.push(basePhase * (1 + 0.5 * react * e) + beatPulse);
    }
    var idx = 0;
    for (var y = 0; y < BH; y++){
      for (var x = 0; x < BW; x++){
        var sum = 0;
        for (var k = 0; k < nSrc; k++){
          var dx = x - sx[k], dy = y - sy[k];
          var d = Math.sqrt(dx * dx + dy * dy);
          sum += Math.sin((d - phSrc[k]) / wlSrc[k] * TAU);
        }
        var val = sum / nSrc; // [-1,1]
        // thin bright rings on the zero-crossings of the interference
        var bright = 1 - Math.abs(val) * thin;
        if (bright < 0) bright = 0; else if (bright > 1) bright = 1;
        // gentle gamma for crisp filaments
        bright = bright * bright;
        var r = bg[0] + (ink[0] - bg[0]) * bright;
        var g = bg[1] + (ink[1] - bg[1]) * bright;
        var b = bg[2] + (ink[2] - bg[2]) * bright;
        data[idx++] = r;
        data[idx++] = g;
        data[idx++] = b;
        data[idx++] = 255;
      }
    }
    // paint buffer, then scale to full canvas
    // fill bg first (covers any letterbox)
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    // use a temp canvas via putImageData on an offscreen then drawImage scaled
    if (!s.tmp || s.tmp.width !== BW || s.tmp.height !== BH){
      s.tmp = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(BW, BH) : document.createElement('canvas');
      s.tmp.width = BW; s.tmp.height = BH;
      s.tctx = s.tmp.getContext('2d');
    }
    s.tctx.putImageData(img, 0, 0);
    var prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s.tmp, 0, 0, BW, BH, 0, 0, w, h);
    ctx.imageSmoothingEnabled = prevSmooth;
  }
});
