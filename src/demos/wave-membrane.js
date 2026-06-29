LAB.register({
  id: "wave-membrane",
  title: "Vibrating Membrane (drum)",
  group: "Vibration and matter",
  essence: "A struck drumhead solves the 2D wave equation; standing waves bloom and decay.",
  blurb: "The wave equation made visible. A grid drumhead is struck and driven at a frequency, and the ripples reflect off the rim into standing-wave patterns whose symmetry depends on the drive frequency. It is the literal physics of a vibrating surface, the membrane sibling of the Chladni plate, and it reads as a living topographic field rather than a diagram. Struck gongs and plates are exactly this surface.",
  tags: ["field", "vibration", "3d", "monochrome", "realtime", "cymatic"],
  lineage: "Helmholtz / Rayleigh membrane modes; Chladni 1787; modal acoustics. Visual kin: Carsten Nicolai milch. Scientific anchor: 2D wave equation, circular/square membrane eigenmodes.",
  dialect: "Modal Coordinate Grid",
  palette: "monochrome ink",
  paramNotes: "Drive frequency is the real lever, it selects which standing pattern forms; damping sets how long ripples live; tension (wave speed) changes the scale of the pattern. Resolution is not worth a slider. Colour off. Audio drive: loudness scales the central drive amplitude, the 32 spectral bands force injection sites spread across the membrane (so the live spectrum selects which standing modes bloom), and a beat strikes the drumhead with an impulse.",
  params: [
    { key: "driveFreq", label: "Drive frequency", min: 0.5, max: 12, step: 0.1, value: 4 },
    { key: "tension", label: "Tension", min: 0.1, max: 0.48, step: 0.01, value: 0.35 },
    { key: "damping", label: "Damping", min: 0, max: 1, step: 0.01, value: 0.25 },
    { key: "react", label: "Audio drive", min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    const GW = 90;
    const GH = LABUTIL.clamp(Math.round(90 * h / Math.max(1, w)), 30, 70);
    s.GW = GW;
    s.GH = GH;
    s.u = new Float32Array(GW * GH);
    s.uPrev = new Float32Array(GW * GH);
    s.uNext = new Float32Array(GW * GH);
    s.buf = null;
    s.bw = 0;
    s.bh = 0;
    // Forcing sites spread across the membrane, each tied to one spectral band.
    // The live band magnitude excites that location, so different parts of the
    // spectrum bloom different standing modes.
    const fr = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7], [0.5, 0.25], [0.5, 0.75], [0.25, 0.5], [0.75, 0.5]];
    s.sites = [];
    for (let si = 0; si < fr.length; si++) {
      const gx = LABUTIL.clamp(Math.round(fr[si][0] * (GW - 1)), 1, GW - 2);
      const gy = LABUTIL.clamp(Math.round(fr[si][1] * (GH - 1)), 1, GH - 2);
      s.sites.push({ idx: gy * GW + gx, band: Math.min(31, si * 3 + 2) });
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    // (re)allocate if dimensions changed materially
    const wantGH = LABUTIL.clamp(Math.round(90 * h / Math.max(1, w)), 30, 70);
    if (!s.u || s.GH !== wantGH || s.GW !== 90) {
      this.init(s, w, h);
    }
    const GW = s.GW, GH = s.GH;
    const u = s.u, uPrev = s.uPrev, uNext = s.uNext;
    const N = GW * GH;

    const c2 = LABUTIL.clamp(p.tension, 0.01, 0.49);
    const damp = 1 - LABUTIL.clamp(p.damping, 0, 1) * 0.03;
    const ci = (GH >> 1) * GW + (GW >> 1);

    // Audio coupling. Loudness scales the central drive; the 32 bands force the
    // spread of injection sites (selecting which standing modes bloom); a beat
    // strikes the membrane with a single impulse.
    const react = (p.react == null ? 0.85 : p.react);
    const lvl = LABUTIL.clamp(a.level, 0, 1);
    const peak = LABUTIL.clamp(a.peak, 0, 1);
    const beat = LABUTIL.clamp(a.beat, 0, 1);
    const bands = a.bands;
    // audio activity: near-zero in silence so the drumhead damps flat and still
    const act = LABUTIL.clamp(Math.max(lvl, peak * 0.7, beat) * react, 0, 1);
    const driveAmp = 0.5 * (0.04 + 1.3 * act);
    const bandOsc = Math.sin(p.driveFreq * t * LABUTIL.TAU);
    const applyBands = (buf) => {
      if (!s.sites || !bands) return;
      for (let si = 0; si < s.sites.length; si++) {
        const st = s.sites[si];
        const bm = LABUTIL.clamp(bands[st.band] || 0, 0, 1);
        const f = react * bm * bandOsc * 0.6;
        if (isFinite(f)) buf[st.idx] += f;
      }
    };
    // Beat strike: a one-shot impulse at the centre before stepping.
    const strike = react * beat * 6;
    if (isFinite(strike) && strike !== 0) u[ci] += strike;

    const substeps = 2;
    for (let step = 0; step < substeps; step++) {
      // inject drive at the centre, plus band-forced sites
      const drive = driveAmp * Math.sin(p.driveFreq * t * LABUTIL.TAU);
      if (isFinite(drive)) u[ci] += drive;
      applyBands(u);

      for (let y = 1; y < GH - 1; y++) {
        const row = y * GW;
        for (let x = 1; x < GW - 1; x++) {
          const i = row + x;
          const c = u[i];
          const lap = u[i - 1] + u[i + 1] + u[i - GW] + u[i + GW] - 4 * c;
          let nx = (2 * c - uPrev[i] + c2 * lap) * damp;
          if (!isFinite(nx)) nx = 0;
          // clamp to keep the simulation bounded under pathological params
          if (nx > 50) nx = 50; else if (nx < -50) nx = -50;
          uNext[i] = nx;
        }
      }
      // fixed (zero) boundary: edges stay 0 in uNext (already zero by default for borders)
      for (let x = 0; x < GW; x++) {
        uNext[x] = 0;
        uNext[(GH - 1) * GW + x] = 0;
      }
      for (let y = 0; y < GH; y++) {
        uNext[y * GW] = 0;
        uNext[y * GW + GW - 1] = 0;
      }
      // swap: uPrev <- u, u <- uNext (reuse old uPrev buffer as next scratch)
      const tmp = uPrev;
      s.uPrev = u;
      s.u = uNext;
      s.uNext = tmp;
      break;
    }

    // Second physics substep using current s.* references (avoids const-reassign issue)
    {
      const u2 = s.u, uPrev2 = s.uPrev, uNext2 = s.uNext;
      const drive = driveAmp * Math.sin((p.driveFreq * t + 0.5 * p.driveFreq / 60) * LABUTIL.TAU);
      if (isFinite(drive)) u2[ci] += drive;
      applyBands(u2);
      for (let y = 1; y < GH - 1; y++) {
        const rrow = y * GW;
        for (let x = 1; x < GW - 1; x++) {
          const i = rrow + x;
          const c = u2[i];
          const lap = u2[i - 1] + u2[i + 1] + u2[i - GW] + u2[i + GW] - 4 * c;
          let nx = (2 * c - uPrev2[i] + c2 * lap) * damp;
          if (!isFinite(nx)) nx = 0;
          if (nx > 50) nx = 50; else if (nx < -50) nx = -50;
          uNext2[i] = nx;
        }
      }
      for (let x = 0; x < GW; x++) { uNext2[x] = 0; uNext2[(GH - 1) * GW + x] = 0; }
      for (let y = 0; y < GH; y++) { uNext2[y * GW] = 0; uNext2[y * GW + GW - 1] = 0; }
      s.uPrev = u2;
      s.u = uNext2;
      s.uNext = uPrev2;
    }

    // parse bg and ink to rgb once
    const parse = (cssRgba) => {
      // cssRgba is 'rgba(r,g,b,a)'
      const m = /rgba?\(([^)]+)\)/.exec(cssRgba);
      if (m) {
        const parts = m[1].split(",");
        return [parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0];
      }
      return [0, 0, 0];
    };
    const bgRGB = parse(LABUTIL.rgba(theme.bg, 1));
    const inkRGB = parse(LABUTIL.rgba(theme.ink, 1));

    // build small ImageData buffer
    if (!s.buf || s.bw !== GW || s.bh !== GH) {
      s.buf = ctx.createImageData(GW, GH);
      s.bw = GW;
      s.bh = GH;
    }
    const img = s.buf;
    const data = img.data;
    const uu = s.u;
    for (let i = 0; i < N; i++) {
      let b = 0.5 + uu[i] * 2.2;
      if (!isFinite(b)) b = 0.5;
      b = LABUTIL.clamp(b, 0, 1);
      b = b * b;
      const r = bgRGB[0] + (inkRGB[0] - bgRGB[0]) * b;
      const g = bgRGB[1] + (inkRGB[1] - bgRGB[1]) * b;
      const bl = bgRGB[2] + (inkRGB[2] - bgRGB[2]) * b;
      const j = i << 2;
      data[j] = r;
      data[j + 1] = g;
      data[j + 2] = bl;
      data[j + 3] = 255;
    }

    // scale up via an OffscreenCanvas so we can use imageSmoothingEnabled
    if (!s.osc || s.oscW !== GW || s.oscH !== GH) {
      try {
        s.osc = new OffscreenCanvas(GW, GH);
        s.octx = s.osc.getContext("2d");
        s.oscW = GW;
        s.oscH = GH;
      } catch (e) {
        s.osc = null;
      }
    }
    if (s.osc && s.octx) {
      s.octx.putImageData(img, 0, 0);
      const prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(s.osc, 0, 0, GW, GH, 0, 0, w, h);
      ctx.imageSmoothingEnabled = prev;
    } else {
      // fallback: draw nearest blocks
      const cw = w / GW, ch = h / GH;
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const j = (y * GW + x) << 2;
          ctx.fillStyle = "rgb(" + (data[j] | 0) + "," + (data[j + 1] | 0) + "," + (data[j + 2] | 0) + ")";
          ctx.fillRect(x * cw, y * ch, cw + 1, ch + 1);
        }
      }
    }
  }
});
