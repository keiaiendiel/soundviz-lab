/* AUDIO - live microphone analysis for the Sound / Image Lab.
   One shared engine. Exposes globalThis.LABAUDIO:
     .frame        the current audio frame (ALWAYS valid + finite, see fields below)
     .on           true when the mic is live and streaming
     .enable()     async, requests the mic (MUST be called from a user gesture)
     .disable()    stops the mic, falls back to the synthetic frame
     .toggle()     enable/disable
     .update(dt)   called once per rAF by the engine BEFORE drawing; refreshes .frame
     .sensitivity  user input gain (default 1), bump with [ ]
     .error        last error string, or ''
     .onchange     optional callback(on) the UI sets to reflect state

   The frame is the whole contract every specimen reads as its 8th draw() arg `a`:
     a.on        bool   mic live (false => synthetic idle signal below)
     a.level     0..1   smoothed perceptual loudness (the main "how loud" lever)
     a.peak      0..1   fast envelope, snappier than level (transients)
     a.bass      0..1   ~20-160 Hz energy
     a.mid       0..1   ~160-2000 Hz energy
     a.high      0..1   ~2-10 kHz energy
     a.centroid  0..1   spectral centroid, "brightness" / rough pitch
     a.flux      0..1   spectral flux, onset strength
     a.beat      0..1   percussive pulse, spikes to ~1 on onset then decays
     a.bands     Float32Array(32)  log-spaced band magnitudes 0..1 (bars / strings)
     a.spectrum  Float32Array(512) linear magnitude bins 0..~11 kHz, 0..1 (spectrogram)
     a.wave      Float32Array(1024) time-domain waveform -1..1 (oscilloscope / XY)

   When the mic is off, update() fills the frame with a gentle drifting synthetic
   signal so audio-aware specimens still breathe in the catalogue. Turning the mic
   on swaps the synthetic source for the real one with no per-specimen branching. */
(function () {
  'use strict';
  var U = globalThis.LABUTIL || {
    clamp: function (x, a, b) { return x < a ? a : (x > b ? b : x); },
    noise2: function () { return 0; }, fbm: function () { return 0; }
  };
  var clamp = U.clamp;

  var SPEC = 512;   // exposed spectrum length (covers bin 0..511)
  var WAVE = 1024;  // exposed waveform length
  var BANDS = 32;   // log-spaced bands
  var CHROMA = 12;  // pitch classes

  // ---- the frame (allocated once, mutated in place) ----
  var frame = {
    on: false,
    dt: 0.016,
    level: 0, peak: 0, bass: 0, mid: 0, high: 0,
    centroid: 0.3, flux: 0, beat: 0,
    pitch: 0.3, flatness: 0.6, spread: 0.3, rolloff: 0.5, zcr: 0,
    bands: new Float32Array(BANDS),
    chroma: new Float32Array(CHROMA),
    spectrum: new Float32Array(SPEC),
    wave: new Float32Array(WAVE)
  };

  var ctxAudio = null, analyser = null, source = null, stream = null, gainNode = null;
  var freqBytes = null, timeFloats = null, timeBytes = null, binCount = 0, sampleRate = 44100;
  var prevSpec = new Float32Array(SPEC);

  // smoothed scalars (envelope followers)
  var sLevel = 0, sPeak = 0, sBass = 0, sMid = 0, sHigh = 0, sCentroid = 0.3, sFlux = 0;
  var sPitch = 0.3, sFlat = 0.6, sSpread = 0.3, sRolloff = 0.5, sZcr = 0;
  var fluxAvg = 0.02; // adaptive onset baseline
  var bassFluxAvg = 0.02; // adaptive kick baseline (multi-band onset)
  var prevBass = 0;
  var agcPeak = 0.06; // adaptive-gain running loudness peak
  var synT = 0;       // synthetic clock

  var API = {
    frame: frame,
    on: false,
    error: '',
    sensitivity: 1,
    onchange: null
  };

  // ---------- enable / disable ----------
  API.enable = function () {
    if (API.on) return Promise.resolve(true);
    var md = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      ? navigator.mediaDevices : null;
    if (!md) { API.error = 'no microphone API in this browser'; return Promise.reject(API.error); }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { API.error = 'no Web Audio in this browser'; return Promise.reject(API.error); }
    return md.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false
    }).then(function (s) {
      stream = s;
      if (!ctxAudio) ctxAudio = new AC();
      if (ctxAudio.state === 'suspended') ctxAudio.resume();
      sampleRate = ctxAudio.sampleRate || 44100;
      source = ctxAudio.createMediaStreamSource(stream);
      analyser = ctxAudio.createAnalyser();
      analyser.fftSize = 4096;              // finer frequency resolution (~11.7 Hz/bin @48k)
      analyser.smoothingTimeConstant = 0.6;
      binCount = analyser.frequencyBinCount; // 2048
      freqBytes = new Uint8Array(binCount);
      if (analyser.getFloatTimeDomainData) timeFloats = new Float32Array(analyser.fftSize);
      else timeBytes = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      // analyser does not need to reach the destination; no monitoring (avoid feedback)
      API.on = true; frame.on = true; API.error = '';
      if (typeof API.onchange === 'function') API.onchange(true);
      return true;
    }).catch(function (e) {
      API.error = (e && e.name === 'NotAllowedError') ? 'microphone permission denied'
        : (e && e.message) ? e.message : 'microphone unavailable';
      API.on = false; frame.on = false;
      if (typeof API.onchange === 'function') API.onchange(false);
      throw API.error;
    });
  };

  API.disable = function () {
    if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    if (source) { try { source.disconnect(); } catch (e) {} }
    stream = null; source = null; analyser = null;
    API.on = false; frame.on = false;
    if (typeof API.onchange === 'function') API.onchange(false);
  };

  API.toggle = function () { return API.on ? (API.disable(), Promise.resolve(false)) : API.enable(); };

  // ---------- per-frame update ----------
  function binForHz(hz) { var bw = sampleRate / 2 / Math.max(1, binCount); return clamp(Math.round(hz / bw), 0, binCount - 1); }

  function meanRange(arr, a, b, scale) {
    a = Math.max(0, a | 0); b = Math.min(arr.length - 1, b | 0);
    if (b < a) b = a;
    var s = 0, n = 0;
    for (var i = a; i <= b; i++) { s += arr[i]; n++; }
    return n ? (s / n) * scale : 0;
  }

  function updateLive(dt) {
    if (!analyser) return false;
    try {
      analyser.getByteFrequencyData(freqBytes);
      if (timeFloats) analyser.getFloatTimeDomainData(timeFloats);
      else if (timeBytes) analyser.getByteTimeDomainData(timeBytes);
    } catch (e) { return false; }

    var g = clamp(API.sensitivity, 0.1, 8);
    var src = timeFloats || timeBytes;
    var srcLen = src ? src.length : 0;

    // --- time domain: raw waveform (manual gain only), RMS, peak, zero-crossings ---
    var rmsRaw = 0, pkRaw = 0, zc = 0, prevS = 0;
    for (var i = 0; i < WAVE; i++) {
      var idx = srcLen ? (i * srcLen / WAVE) | 0 : 0;
      var v = timeFloats ? timeFloats[idx] : (timeBytes ? (timeBytes[idx] - 128) / 128 : 0);
      v = v * g;
      if (!isFinite(v)) v = 0;
      v = clamp(v, -1, 1);
      frame.wave[i] = v;
      rmsRaw += v * v;
      var av = v < 0 ? -v : v; if (av > pkRaw) pkRaw = av;
      if (i > 0 && ((v >= 0) !== (prevS >= 0))) zc++;
      prevS = v;
    }
    rmsRaw = Math.sqrt(rmsRaw / WAVE);
    var rawLevel = clamp(Math.pow(clamp(rmsRaw * 1.8, 0, 1), 0.7), 0, 1);
    var zcr = clamp(zc / WAVE / 0.5, 0, 1);

    // --- adaptive gain (AGC): normalise to the room, gated below a noise floor ---
    // rises fast to loud passages, decays slowly; the gate kills hiss so true silence stays still.
    agcPeak = rawLevel > agcPeak ? (agcPeak + (rawLevel - agcPeak) * 0.30)
                                 : (agcPeak + (rawLevel - agcPeak) * 0.02);
    if (agcPeak < 0.02) agcPeak = 0.02;
    var gate = clamp((rmsRaw - 0.004) / 0.02, 0, 1); gate = gate * gate * (3 - 2 * gate);
    var Go = clamp(0.6 / agcPeak, 1, 8) * gate;

    // --- spectrum -> SPEC bins over 0..~12 kHz (flux on raw to avoid AGC-induced onsets) ---
    var binHz = sampleRate / 2 / Math.max(1, binCount);
    var topBin = Math.max(SPEC, Math.min(binCount, Math.round(12000 / binHz)));
    var fluxSum = 0, cNum = 0, cDen = 0, logSum = 0, linSum = 0;
    for (var k = 0; k < SPEC; k++) {
      var bi = Math.min(binCount - 1, (k * topBin / SPEC) | 0);
      var mRaw = clamp((freqBytes[bi] / 255) * g, 0, 1);
      var d = mRaw - prevSpec[k]; if (d > 0) fluxSum += d;
      prevSpec[k] = mRaw;
      var m = clamp(mRaw * Go, 0, 1);
      frame.spectrum[k] = m;
      cNum += k * m; cDen += m;
      logSum += Math.log(m + 1e-6); linSum += m;
    }
    var flux = clamp(fluxSum / 24, 0, 1);
    var centroid = cDen > 0.0001 ? clamp((cNum / cDen) / SPEC, 0, 1) : 0.0;
    var flatness = linSum > 1e-5 ? clamp(Math.exp(logSum / SPEC) / (linSum / SPEC), 0, 1) : 0;
    var cBin = centroid * SPEC, sprAcc = 0;
    if (cDen > 1e-4) { for (var sk = 0; sk < SPEC; sk++) { var dk = sk - cBin; sprAcc += dk * dk * frame.spectrum[sk]; } sprAcc = clamp(Math.sqrt(sprAcc / cDen) / (SPEC * 0.5), 0, 1); }
    // spectral rolloff: lowest bin holding 85% of energy (robust brightness)
    var roll = 0.5; if (linSum > 1e-5) { var acc = 0, thr = linSum * 0.85, rk = 0; for (; rk < SPEC; rk++) { acc += frame.spectrum[rk]; if (acc >= thr) break; } roll = clamp(rk / SPEC, 0, 1); }

    // --- chroma: fold spectrum energy into 12 pitch classes (60..5000 Hz) ---
    var chroma = frame.chroma; for (var cz = 0; cz < CHROMA; cz++) chroma[cz] = 0;
    var cMax = 0;
    for (var ck = 1; ck < SPEC; ck++) {
      var bk = Math.min(binCount - 1, (ck * topBin / SPEC) | 0);
      var fz = bk * binHz; if (fz < 60 || fz > 5000) continue;
      var pcv = Math.round(12 * Math.log(fz / 440) / Math.LN2) % 12; if (pcv < 0) pcv += 12;
      chroma[pcv] += frame.spectrum[ck];
      if (chroma[pcv] > cMax) cMax = chroma[pcv];
    }
    if (cMax > 1e-5) for (var cn = 0; cn < CHROMA; cn++) chroma[cn] = clamp(chroma[cn] / cMax, 0, 1);

    // --- pitch: argmax bin in 60..2000 Hz, log-normalised (dominant tone) ---
    var pLo = Math.max(1, Math.round(60 / binHz)), pHi = Math.min(binCount - 1, Math.round(2000 / binHz));
    var pMax = 0, pIdx = pLo;
    for (var pkk = pLo; pkk <= pHi; pkk++) { if (freqBytes[pkk] > pMax) { pMax = freqBytes[pkk]; pIdx = pkk; } }
    var pitch = pMax > 12 ? clamp(Math.log(pIdx * binHz / 60) / Math.log(2000 / 60), 0, 1) : sPitch;

    // --- log-spaced bands + bass/mid/high (AGC-normalised) ---
    var fMin = 40, fMax = 11000;
    for (var b = 0; b < BANDS; b++) {
      var f0 = fMin * Math.pow(fMax / fMin, b / BANDS);
      var f1 = fMin * Math.pow(fMax / fMin, (b + 1) / BANDS);
      frame.bands[b] = clamp(meanRange(freqBytes, binForHz(f0), binForHz(f1), g * Go / 255), 0, 1);
    }
    var bass = clamp(meanRange(freqBytes, binForHz(20), binForHz(160), g * Go / 255), 0, 1);
    var mid = clamp(meanRange(freqBytes, binForHz(160), binForHz(2000), g * Go / 255), 0, 1);
    var high = clamp(meanRange(freqBytes, binForHz(2000), binForHz(10000), g * Go / 255), 0, 1);

    // apply AGC to the stored waveform so the scope reads even for a quiet voice
    if (Go !== 1) for (var wj = 0; wj < WAVE; wj++) frame.wave[wj] = clamp(frame.wave[wj] * Go, -1, 1);

    var lvl = clamp(rawLevel * Go, 0, 1);
    var pk = clamp(pkRaw * Go, 0, 1);

    // envelope smoothing (fast attack, slower release)
    sLevel = follow(sLevel, lvl, 0.6, 0.12);
    sPeak = follow(sPeak, pk, 0.85, 0.25);
    sBass = follow(sBass, bass, 0.6, 0.15);
    sMid = follow(sMid, mid, 0.6, 0.15);
    sHigh = follow(sHigh, high, 0.6, 0.18);
    sCentroid = follow(sCentroid, centroid, 0.4, 0.2);
    sFlux = follow(sFlux, flux, 0.7, 0.3);
    sPitch = follow(sPitch, pitch, 0.5, 0.25);
    sFlat = follow(sFlat, flatness, 0.3, 0.2);
    sSpread = follow(sSpread, sprAcc, 0.3, 0.2);
    sRolloff = follow(sRolloff, roll, 0.4, 0.2);
    sZcr = follow(sZcr, zcr, 0.5, 0.25);

    // --- beat: full-band flux OR a bass-band (kick) onset, both gated by the noise floor ---
    fluxAvg = fluxAvg * 0.96 + flux * 0.04;
    var bassOnset = clamp(bass - prevBass, 0, 1); prevBass = bass;
    bassFluxAvg = bassFluxAvg * 0.95 + bassOnset * 0.05;
    var hit = flux > fluxAvg * 1.5 + 0.02 ? clamp((flux - fluxAvg) * 4, 0, 1) : 0;
    var kick = bassOnset > bassFluxAvg * 1.6 + 0.02 ? clamp((bassOnset - bassFluxAvg) * 6, 0, 1) : 0;
    frame.beat = Math.max(Math.max(hit, kick) * gate, frame.beat * 0.86);

    frame.level = sLevel; frame.peak = sPeak;
    frame.bass = sBass; frame.mid = sMid; frame.high = sHigh;
    frame.centroid = sCentroid; frame.flux = sFlux;
    frame.pitch = sPitch; frame.flatness = sFlat; frame.spread = sSpread;
    frame.rolloff = sRolloff; frame.zcr = sZcr;
    return true;
  }

  function follow(cur, target, atk, rel) {
    var k = target > cur ? atk : rel;
    var v = cur + (target - cur) * k;
    return isFinite(v) ? v : 0;
  }

  // ---------- synthetic idle frame (mic off) ----------
  // Deliberately NEAR-SILENT: with no mic, the lab should be almost still, only a faint
  // whisper of life. Real sound is what should make things move.
  function updateSynth(dt) {
    synT += dt;
    var t = synT;
    var lvl = clamp(0.018 + 0.018 * (0.5 + 0.5 * Math.sin(t * 0.45)), 0, 1); // a whisper
    var bassV = clamp(0.04 + 0.04 * (0.5 + 0.5 * Math.sin(t * 0.4)), 0, 1);
    var midV = clamp(0.03 + 0.03 * (0.5 + 0.5 * U.noise2(t * 0.5, 3.2)), 0, 1);
    var highV = clamp(0.02 + 0.02 * (0.5 + 0.5 * Math.sin(t * 0.7)), 0, 1);
    var cen = clamp(0.28 + 0.10 * Math.sin(t * 0.15), 0, 1);

    // three slowly drifting formant ghosts, kept very dim
    var f = [0.10 + 0.04 * Math.sin(t * 0.21), 0.30 + 0.10 * Math.sin(t * 0.15 + 1), 0.55 + 0.12 * Math.sin(t * 0.12 + 2)];
    var flux = 0;
    for (var k = 0; k < SPEC; k++) {
      var fy = k / SPEC;
      var e = 0.012 + 0.012 * (0.5 + 0.5 * U.noise2(fy * 9, t * 0.6));
      for (var bb = 0; bb < 3; bb++) {
        var dd = fy - f[bb];
        e += Math.exp(-(dd * dd) / 0.0012) * 0.12 * (1 - fy * 0.4);
      }
      e = clamp(e, 0, 1);
      var d2 = e - prevSpec[k]; if (d2 > 0) flux += d2;
      prevSpec[k] = e;
      frame.spectrum[k] = e;
    }
    for (var b = 0; b < BANDS; b++) {
      var fb = b / BANDS;
      var eb = 0.012;
      for (var c = 0; c < 3; c++) { var d3 = fb - f[c]; eb += Math.exp(-(d3 * d3) / 0.01) * 0.10; }
      frame.bands[b] = clamp(eb * (1 - fb * 0.3), 0, 1);
    }
    // synthetic waveform: tiny amplitude so an oscilloscope reads a near-flat resting line
    for (var i = 0; i < WAVE; i++) {
      var ph = (i / WAVE) * Math.PI * 2 * 3;
      var v = 0.5 * Math.sin(ph + t * 0.9) + 0.2 * Math.sin(ph * 2 + t * 0.6);
      v += U.noise2(i * 0.02, t * 0.5) * 0.15;
      frame.wave[i] = clamp(v * 0.06, -1, 1);
    }

    sLevel = follow(sLevel, lvl, 0.3, 0.2);
    sPeak = follow(sPeak, clamp(lvl * 1.2, 0, 1), 0.5, 0.3);
    sBass = follow(sBass, bassV, 0.3, 0.2);
    sMid = follow(sMid, midV, 0.3, 0.2);
    sHigh = follow(sHigh, highV, 0.3, 0.2);
    sCentroid = cen;
    sFlux = follow(sFlux, clamp(flux / 24, 0, 1), 0.4, 0.3);
    sPitch = follow(sPitch, cen, 0.3, 0.2);
    sFlat = follow(sFlat, 0.55, 0.2, 0.2);
    sSpread = follow(sSpread, 0.3, 0.2, 0.2);
    sRolloff = follow(sRolloff, clamp(cen + 0.1, 0, 1), 0.2, 0.2);
    sZcr = follow(sZcr, 0.05, 0.2, 0.2);
    // faint chroma ghosts so harmonic specimens have something to settle on
    for (var cq = 0; cq < CHROMA; cq++) frame.chroma[cq] = clamp(0.04 + 0.04 * (0.5 + 0.5 * Math.sin(t * 0.2 + cq * 0.7)), 0, 1);

    // no beats when nothing is listening; let any residual decay out
    frame.beat = frame.beat * 0.85;

    frame.level = sLevel; frame.peak = sPeak;
    frame.bass = sBass; frame.mid = sMid; frame.high = sHigh;
    frame.centroid = sCentroid; frame.flux = sFlux;
    frame.pitch = sPitch; frame.flatness = sFlat; frame.spread = sSpread;
    frame.rolloff = sRolloff; frame.zcr = sZcr;
  }

  API.update = function (dt) {
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.1) dt = 0.1;
    frame.dt = dt;
    frame.on = API.on;
    if (API.on) { if (!updateLive(dt)) updateSynth(dt); }
    else updateSynth(dt);
  };

  if (typeof globalThis !== 'undefined') globalThis.LABAUDIO = API;
  else if (typeof window !== 'undefined') window.LABAUDIO = API;
})();
