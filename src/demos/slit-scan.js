LAB.register({
  id: 'slit-scan',
  title: 'Slit-Scan Time Displacement',
  group: 'Texture and feedback',
  essence: 'Each screen column shows the signal from a different moment, time bent across space.',
  blurb: "Time spread sideways. Each vertical column of the image samples the signal at a different time offset, so a single waveform is stretched across the width as a frozen-then-flowing surface, the slit-scan of 2001 applied to sound. Motion that happened a second ago is still visible at the right edge while the left edge is now. It is the time-displacement register, slow and strange, good for the introspective inner-exile passages of the score.",
  tags: ['feedback', 'raster', 'field', 'monochrome', 'slow'],
  lineage: 'Slit-scan cinematography (Trumbull, 2001); Golan Levin time-scan works; chronophotography Marey. Scientific anchor: space-time slit-scan, per-column temporal offset.',
  dialect: 'Vector Plume',
  palette: 'monochrome ink',
  paramNotes: 'Time spread (how many seconds across the width) and the source waveform complexity are the levers; scroll vs static-window toggle changes the read. Smear adds softness. No colour; the displacement is the whole effect. Audio: each freshly written column is fed by a.wave so the live waveform time-smears across the width, a.level scales its excursion (react sets how much it overrides the synthetic source).',
  params: [
    { key: 'spread', label: 'Time spread', min: 0.5, max: 6, step: 0.5, value: 3 },
    { key: 'complexity', label: 'Source complexity', min: 1, max: 6, step: 1, value: 3 },
    { key: 'speed', label: 'Scan speed', min: 0.2, max: 3, step: 0.1, value: 1 },
    { key: 'smear', label: 'Vertical smear', min: 0, max: 0.4, step: 0.02, value: 0.1 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    // Column-history ring buffer. Each column stores a downsampled luminance
    // profile sampled at the time that column was written. Deterministic:
    // no random, state evolves only from t and params.
    s.COLS = 160;          // logical column count (X = time), bounded raster
    s.ROWS = 110;          // vertical resolution per column
    s.buf = new Float32Array(s.COLS * s.ROWS); // luminance 0..1
    s.head = 0;            // index of the newest written column
    s.lastT = -1;          // last time we advanced
    s.acc = 0;             // sub-step time accumulator
    s.filled = false;
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    const TAU = LABUTIL.TAU, clamp = LABUTIL.clamp;
    const COLS = s.COLS, ROWS = s.ROWS;
    if (!a) a = {};

    // Audio drive: build one column profile from the live waveform; freshly written
    // columns blend it over the synthetic source, so the live signal time-smears
    // across the width. level scales the excursion, react sets the override amount.
    const react = (p.react == null ? 0.85 : p.react);
    const aLevel = clamp(a.level || 0, 0, 1);
    const aBeat = clamp(a.beat || 0, 0, 1);
    // Activity gate: the strip advance crawls when quiet and flows with sound.
    const act = clamp(Math.max(aLevel, (a.peak || 0) * 0.7, aBeat) * react, 0, 1);
    const wv = (a.wave && a.wave.length) ? a.wave : null;
    const WN = wv ? wv.length : 0;
    const mix = clamp(react * 0.9, 0, 1);
    if (!s._aprof) s._aprof = new Float32Array(ROWS);
    const aprof = s._aprof;
    for (let r = 0; r < ROWS; r++) {
      let sv = 0;
      if (wv) {
        const wi = ROWS > 1 ? Math.min(WN - 1, Math.round(r / (ROWS - 1) * (WN - 1))) : 0;
        sv = wv[wi] || 0;
      }
      aprof[r] = clamp(0.5 + 0.5 * sv * (0.45 + 1.1 * aLevel), 0, 1);
    }

    // The signal: a sum of harmonics plus a slow noise wash. tt is the
    // continuous "now" of the source. Higher complexity adds harmonics.
    const comp = Math.max(1, Math.round(p.complexity));
    function sampleColumn(tt, out) {
      for (let r = 0; r < ROWS; r++) {
        const yy = r / (ROWS - 1);          // 0..1 down the column
        let v = 0, norm = 0;
        for (let k = 1; k <= comp; k++) {
          v += Math.sin(yy * TAU * k + tt * (k + 1)) / k;
          norm += 1 / k;
        }
        v /= (norm || 1);                    // keep amplitude bounded
        v += (LABUTIL.noise2(yy * 6.0, tt * 0.6) ) * 0.35;
        let lum = clamp(0.5 + 0.42 * v, 0, 1);
        if (mix > 0) lum = clamp(lum * (1 - mix) + aprof[r] * mix, 0, 1);
        out[r] = lum;
      }
    }

    // Advance the buffer. One new column is written per "scan tick".
    // The number of seconds laid across the whole width is p.spread, so each
    // column advances the source clock by (spread / COLS) of source time,
    // scaled by speed. We advance at a fixed cadence tied to wall time t so
    // motion is smooth and frame-rate independent, and bounded so a huge dt
    // (tab refocus, large t jump) never spins the loop forever.
    if (s.lastT < 0) s.lastT = t;
    let dt = t - s.lastT;
    s.lastT = t;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;               // clamp catch-up burst

    // columns-per-second across the strip. Faster speed = quicker flow.
    // Scaled by activity so silence nearly freezes the strip, sound sets it flowing.
    const advance = 0.05 + 1.1 * act;
    const colsPerSec = (COLS / Math.max(0.5, p.spread)) * p.speed * 0.5 * advance;
    s.acc += dt * colsPerSec;
    let steps = Math.floor(s.acc);
    if (steps > COLS) steps = COLS;          // never redraw more than a full strip
    s.acc -= steps;

    const srcPerCol = (p.spread / COLS) * p.speed; // source seconds per column
    const tmp = new Float32Array(ROWS);
    for (let i = 0; i < steps; i++) {
      s.head = (s.head + 1) % COLS;
      // source time for this freshly written column
      const tt = t * p.speed - (steps - 1 - i) * srcPerCol;
      sampleColumn(tt, tmp);
      const base = s.head * ROWS;
      for (let r = 0; r < ROWS; r++) s.buf[base + r] = tmp[r];
    }
    if (!s.filled && steps > 0) {
      // On first ticks, seed the whole strip so it does not start blank.
      if (s.head === 0 || steps >= COLS - 1) s.filled = true;
    }
    if (!s.filled) {
      // Prime once: fill every column from a static time window.
      for (let c = 0; c < COLS; c++) {
        const tt = t * p.speed - (COLS - 1 - c) * srcPerCol;
        sampleColumn(tt, tmp);
        const base = c * ROWS;
        for (let r = 0; r < ROWS; r++) s.buf[base + r] = tmp[r];
      }
      s.head = COLS - 1;
      s.filled = true;
    }

    // Render into a small ImageData (COLS x ROWS), then scale it up with one
    // drawImage. This keeps per-pixel work bounded to COLS*ROWS (<= ~17600)
    // and lets the shell-sized canvas show a smooth raster, the slit-scan look.
    // Oldest column on the left (x=0), newest on the right.
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    if (!s.img || s.img.width !== COLS || s.img.height !== ROWS) {
      s.img = ctx.createImageData(COLS, ROWS);
    }
    const data = s.img.data;
    // ink and bg as RGB for compositing luminance over the dark base
    const ink = hexRGB(theme.ink), bgc = hexRGB(theme.bg);
    const smear = p.smear;

    for (let xi = 0; xi < COLS; xi++) {
      const ring = (s.head + 1 + xi) % COLS;   // 0 = oldest
      const base = ring * ROWS;
      for (let r = 0; r < ROWS; r++) {
        let lum = s.buf[base + r];
        if (smear > 0) {
          const up = r > 0 ? s.buf[base + r - 1] : lum;
          const dn = r < ROWS - 1 ? s.buf[base + r + 1] : lum;
          lum = lum * (1 - smear) + (up + dn) * 0.5 * smear;
        }
        lum = clamp(lum, 0, 1);
        const idx = (r * COLS + xi) * 4;
        data[idx]     = bgc[0] + (ink[0] - bgc[0]) * lum;
        data[idx + 1] = bgc[1] + (ink[1] - bgc[1]) * lum;
        data[idx + 2] = bgc[2] + (ink[2] - bgc[2]) * lum;
        data[idx + 3] = 255;
      }
    }

    // putImageData ignores transforms and never scales, so place the small
    // raster at the origin, then scale that pixel region up to fill the canvas.
    ctx.putImageData(s.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ctx.canvas, 0, 0, COLS, ROWS, 0, 0, w, h);

    // A faint vertical seam marking "now" at the right edge, instrument feel.
    ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w - 0.5, 0);
    ctx.lineTo(w - 0.5, h);
    ctx.stroke();

    // local hex->rgb helper, no LABUTIL parse needed per pixel
    function hexRGB(c) {
      if (s._cc && s._cc[c]) return s._cc[c];
      let r = 0, g = 0, b = 0;
      if (typeof c === 'string' && c[0] === '#') {
        let hx = c.slice(1);
        if (hx.length === 3) hx = hx[0]+hx[0]+hx[1]+hx[1]+hx[2]+hx[2];
        r = parseInt(hx.slice(0, 2), 16) || 0;
        g = parseInt(hx.slice(2, 4), 16) || 0;
        b = parseInt(hx.slice(4, 6), 16) || 0;
      } else {
        const m = String(c).match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
        if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
      }
      const v = [r, g, b];
      if (!s._cc) s._cc = {};
      s._cc[c] = v;
      return v;
    }
  }
});
