/* LABUTIL - shared helpers for every demo. Identical in the page and the node verifier.
   Attaches to globalThis.LABUTIL. Deterministic noise/PRNG so demos never NaN or drift. */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    var d = (b - a) || 1e-9;
    var t = clamp((x - a) / d, 0, 1);
    return t * t * (3 - 2 * t);
  }
  function hexToRgb(c) {
    if (typeof c !== 'string') return null;
    c = c.trim();
    if (c.charAt(0) === '#') {
      var h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (h.length >= 6) {
        var n = parseInt(h.slice(0, 6), 16);
        if (!isFinite(n)) return null;
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
    }
    return null;
  }
  function rgba(c, a) {
    a = (a == null) ? 1 : clamp(a, 0, 1);
    var rgb = hexToRgb(c);
    if (rgb) return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
    var m = String(c).match(/[\d.]+/g);
    if (m && m.length >= 3) return 'rgba(' + (+m[0]) + ',' + (+m[1]) + ',' + (+m[2]) + ',' + a + ')';
    return 'rgba(0,0,0,' + a + ')';
  }
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y) {
    var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    var top = a + (b - a) * u, bot = c + (d - c) * u;
    return (top + (bot - top) * v) * 2 - 1;
  }
  function fbm(x, y, oct) {
    oct = oct || 4;
    var amp = 0.5, freq = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) { sum += amp * vnoise(x * freq, y * freq); norm += amp; amp *= 0.5; freq *= 2; }
    return sum / (norm || 1);
  }
  function hsl(h, s, l) { return 'hsl(' + h + ',' + s + '%,' + l + '%)'; }

  var API = { TAU: TAU, clamp: clamp, lerp: lerp, smoothstep: smoothstep, rgba: rgba,
    mulberry32: mulberry32, hash2: hash2, noise2: vnoise, fbm: fbm, hsl: hsl };
  if (typeof globalThis !== 'undefined') globalThis.LABUTIL = API;
  else if (typeof window !== 'undefined') window.LABUTIL = API;
})();
