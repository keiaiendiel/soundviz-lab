/* Single-demo verifier. Loads LABUTIL + ONE demo file, runs its init+draw against a
   mock Canvas2D ctx across t / param / audio extremes (incl. a full-scale and a quiet
   frame). Catches throws and non-finite geometry without a browser, no races with other
   files. Usage: node verify-one.js demos/<file>.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = process.argv[2];
if (!file) { console.error('usage: node verify-one.js demos/<file>.js'); process.exit(2); }
const utilSrc = fs.readFileSync(path.join(__dirname, 'labutil.js'), 'utf8');

const GEO = new Set(['moveTo','lineTo','rect','fillRect','strokeRect','clearRect','arc','arcTo',
  'ellipse','translate','rotate','scale','bezierCurveTo','quadraticCurveTo','setTransform',
  'transform','fillText','strokeText','roundRect']);

function mockCtx(w, h) {
  const store = { canvas: { width: w, height: h }, fillStyle: '#000', strokeStyle: '#000',
    globalAlpha: 1, lineWidth: 1, font: '10px sans', globalCompositeOperation: 'source-over',
    lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, shadowBlur: 0, shadowColor: '#000',
    shadowOffsetX: 0, shadowOffsetY: 0, textAlign: 'start', textBaseline: 'alphabetic',
    imageSmoothingEnabled: true, filter: 'none', lineDashOffset: 0 };
  const grad = { addColorStop: function () {} };
  return new Proxy({}, {
    get(_, k) {
      if (k in store) return store[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient' ||
          k === 'createConicGradient' || k === 'createPattern') return () => grad;
      if (k === 'getImageData') return (x, y, ww, hh) => ({ data: new Uint8ClampedArray(Math.max(1, ((ww | 0) || 1) * ((hh | 0) || 1) * 4)), width: ww | 0, height: hh | 0 });
      if (k === 'createImageData') return (ww, hh) => ({ data: new Uint8ClampedArray(Math.max(1, ((ww | 0) || 1) * ((hh | 0) || 1) * 4)), width: ww | 0, height: hh | 0 });
      if (k === 'measureText') return () => ({ width: 8 });
      if (k === 'setLineDash') return () => {};
      if (k === 'getLineDash') return () => [];
      if (GEO.has(k)) return function () {
        for (let i = 0; i < arguments.length; i++) {
          const a = arguments[i];
          if (typeof a === 'number' && !isFinite(a)) throw new Error('non-finite arg to ctx.' + k + '(): ' + Array.prototype.join.call(arguments, ','));
        }
      };
      return () => {};
    },
    set(_, k, v) { store[k] = v; return true; }
  });
}

const sandbox = { console, Math, Date, isFinite, isNaN, parseInt, parseFloat, Uint8ClampedArray, Uint8Array, Float32Array, Array, Object, JSON, String, Number };
sandbox.globalThis = sandbox;
function fakeCanvas(w, h) { const c = { width: w || 300, height: h || 150 }; c.getContext = function () { return mockCtx(c.width, c.height); }; return c; }
sandbox.OffscreenCanvas = function (w, h) { return fakeCanvas(w, h); };
sandbox.document = { createElement: function () { return fakeCanvas(300, 150); } };
vm.createContext(sandbox);
vm.runInContext(utilSrc, sandbox);
vm.runInContext('globalThis.LAB = { demos: [], register: function(d){ this.demos.push(d); } };', sandbox);

try { vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file }); }
catch (e) { console.error('LOAD ERROR ' + file + ' -> ' + e.message); process.exit(1); }

const demos = sandbox.LAB.demos;
if (!demos.length) { console.error('NO demo registered in ' + file); process.exit(1); }

function audioFrame(v) {
  return { on: v > 0, dt: 0.016, level: v, peak: v, bass: v, mid: v, high: v, centroid: v, flux: v, beat: v,
    pitch: v, flatness: v, spread: v, rolloff: v, zcr: v,
    bands: new Float32Array(32).fill(v), chroma: new Float32Array(12).fill(v), spectrum: new Float32Array(512).fill(v),
    wave: (function () { const a = new Float32Array(1024); for (let i = 0; i < 1024; i++) a[i] = v * Math.sin(i * 0.3); return a; })() };
}
const AUDIO = [audioFrame(0), audioFrame(1), audioFrame(0.37)];
const theme = { bg: '#0b0503', ink: '#ff7a2e', dim: '#a8542a', accent: '#ffb24d', grid: 'rgba(255,122,46,0.06)' };
const W = 320, H = 200;
const TS = [0, 0.016, 0.5, 3.33, 20, 123.4, 999.9];

let ok = true, msg = '';
for (const def of demos) {
  try {
    const sets = [];
    const d = {}, lo = {}, hi = {}, mid = {};
    (def.params || []).forEach(p => { d[p.key] = p.value; lo[p.key] = p.min; hi[p.key] = p.max; mid[p.key] = (p.min + p.max) / 2; });
    sets.push(d, lo, hi, mid);
    for (const ps of sets) for (const af of AUDIO) { const s = {}; if (def.init) def.init(s, W, H); for (const t of TS) def.draw(mockCtx(W, H), W, H, t, ps, s, theme, af); }
  } catch (e) { ok = false; msg = (def.id || '?') + ' -> ' + e.message; break; }
}
if (ok) { console.log('OK ' + demos.map(d => d.id).join(', ')); process.exit(0); }
console.error('FAIL ' + msg); process.exit(1);
