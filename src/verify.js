/* Node verifier: loads LABUTIL + all demo files, runs each demo's init+draw against a
   mock Canvas2D context across t and param extremes, and reports any that throw or emit
   non-finite geometry. Catches the common bugs (undefined vars, NaN coords, bad indexing)
   without a browser. Usage: node verify.js /tmp/lab/demos */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const demoDir = process.argv[2] || '/tmp/lab/demos';
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
  const handler = {
    get(_, k) {
      if (k in store) return store[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient' ||
          k === 'createConicGradient' || k === 'createPattern') return () => grad;
      if (k === 'getImageData') return (x, y, ww, hh) => ({ data: new Uint8ClampedArray(Math.max(1, (ww | 0) * (hh | 0) * 4)), width: ww | 0, height: hh | 0 });
      if (k === 'createImageData') return (ww, hh) => ({ data: new Uint8ClampedArray(Math.max(1, (ww | 0) * (hh | 0) * 4)), width: ww | 0, height: hh | 0 });
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
  };
  return new Proxy({}, handler);
}

// sandbox with LABUTIL + LAB registry
const sandbox = { console, Math, Date, isFinite, isNaN, parseInt, parseFloat, Uint8ClampedArray, Float32Array, Array, Object, JSON, String, Number };
sandbox.globalThis = sandbox;
// browser-accurate stubs for the legitimate offscreen-canvas scaling pattern several demos use
function fakeCanvas(w, h) { const c = { width: w || 300, height: h || 150 }; c.getContext = function () { return mockCtx(c.width, c.height); }; return c; }
sandbox.OffscreenCanvas = function (w, h) { return fakeCanvas(w, h); };
sandbox.document = { createElement: function () { return fakeCanvas(300, 150); } };
vm.createContext(sandbox);
vm.runInContext(utilSrc, sandbox);
vm.runInContext('globalThis.LAB = { demos: [], register: function(d){ this.demos.push(d); } };', sandbox);

const files = fs.readdirSync(demoDir).filter(f => f.endsWith('.js')).sort();
let loadErrors = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(demoDir, f), 'utf8');
  try { vm.runInContext(src, sandbox, { filename: f }); }
  catch (e) { loadErrors.push([f, 'LOAD: ' + e.message]); }
}

const demos = sandbox.LAB.demos;
const theme = { bg: '#0a0b0d', ink: '#e9e6dc', dim: '#6d6b64', accent: '#5247e6', grid: 'rgba(233,230,220,0.07)' };
const W = 320, H = 200;
const TS = [0, 0.016, 0.5, 3.33, 20, 123.4, 999.9];

// mock audio frames (8th draw() arg). Test silence, full-scale, and a NaN-poisoned
// frame so specimens must stay finite no matter what the engine hands them.
function audioFrame(v) {
  return {
    on: v > 0, dt: 0.016, level: v, peak: v, bass: v, mid: v, high: v,
    centroid: v, flux: v, beat: v, pitch: v, flatness: v, spread: v, rolloff: v, zcr: v,
    bands: new Float32Array(32).fill(v),
    chroma: new Float32Array(12).fill(v),
    spectrum: new Float32Array(512).fill(v),
    wave: (function () { const a = new Float32Array(1024); for (let i = 0; i < 1024; i++) a[i] = (v) * Math.sin(i * 0.3) ; return a; })()
  };
}
const AUDIO_SETS = [audioFrame(0), audioFrame(1), audioFrame(0.37)];

function paramSets(def) {
  const d = {}, lo = {}, hi = {}, mid = {};
  (def.params || []).forEach(p => { d[p.key] = p.value; lo[p.key] = p.min; hi[p.key] = p.max; mid[p.key] = (p.min + p.max) / 2; });
  return [d, lo, hi, mid];
}

let pass = 0; const fails = [];
for (const def of demos) {
  let ok = true, msg = '';
  try {
    const sets = paramSets(def);
    for (const ps of sets) {
      for (const af of AUDIO_SETS) {
        const s = {};
        if (def.init) def.init(s, W, H);
        for (const t of TS) { def.draw(mockCtx(W, H), W, H, t, ps, s, theme, af); }
      }
    }
  } catch (e) { ok = false; msg = e.message; }
  if (ok) pass++; else fails.push([def.id, msg]);
}

console.log('VERIFY: ' + pass + '/' + demos.length + ' demos pass. Files: ' + files.length + '.');
if (loadErrors.length) { console.log('\nLOAD ERRORS (' + loadErrors.length + '):'); loadErrors.forEach(x => console.log('  ' + x[0] + ' -> ' + x[1])); }
if (fails.length) { console.log('\nRUNTIME FAILURES (' + fails.length + '):'); fails.forEach(x => console.log('  ' + x[0] + ' -> ' + x[1])); }
else if (!loadErrors.length) console.log('All demos clean.');
// list registered ids for sanity
console.log('\nIDS: ' + demos.map(d => d.id).join(', '));
process.exit(loadErrors.length || fails.length ? 1 : 0);
