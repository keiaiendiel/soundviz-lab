LAB.register({
  id: "vibrating-strings",
  title: "Vibrating Strings (harmonics)",
  group: "Vibration and matter",
  essence: "A rack of strings, each plucked into a different harmonic, the overtone series as motion.",
  blurb: "The monochord made into an image. A stack of strings each vibrates in a standing-wave mode, the nth string in the nth harmonic, plucked and decaying then re-struck. You see the harmonic series directly, the same series the overtone flutes and a long monochord string are built from. Clean ink lines on black, the nodes sitting still while the antinodes breathe.",
  tags: ["line", "strings", "vibration", "monochrome", "realtime", "spectral"],
  lineage: "Pythagorean monochord; Helmholtz On the Sensations of Tone; the monochord and overtone flutes. Scientific anchor: standing waves on a fixed-fixed string, harmonic series f_n = n f_1.",
  dialect: "Modal Coordinate Grid",
  palette: "monochrome ink",
  paramNotes: "String count sets how much of the harmonic series you see; decay sets the pluck envelope length; pluck rate sets retrigger; amplitude scales the swing. All four read instantly and are worth sliders. No colour. Audio: string k swells and brightens with band k of the live spectrum, a.level lifts the whole rack, and a.beat re-plucks every string, so singing a pitch lights its matching harmonic.",
  params: [
    { key: "strings", label: "Strings", min: 3, max: 16, step: 1, value: 8 },
    { key: "decay", label: "Pluck decay", min: 0.2, max: 4, step: 0.1, value: 1.6 },
    { key: "pluckRate", label: "Pluck rate", min: 0.2, max: 3, step: 0.1, value: 0.8 },
    { key: "amp", label: "Amplitude", min: 0.2, max: 1.2, step: 0.05, value: 0.7 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    const N = LABUTIL.clamp(Math.round(p.strings), 3, 16);
    const margin = Math.min(h, w) * 0.08 + 18;
    const usable = Math.max(1, h - 2 * margin);
    const rowH = usable / N;
    const decay = LABUTIL.clamp(p.decay, 0.05, 8);
    const pluckRate = LABUTIL.clamp(p.pluckRate, 0.05, 6);
    const amp = LABUTIL.clamp(p.amp, 0.1, 1.5);

    // audio: per-band excitation per string, level lifts all, beat re-plucks
    const react = (p.react == null ? 0.85 : p.react);
    const aLevel = LABUTIL.clamp(a.level, 0, 1);
    const aBeat = LABUTIL.clamp(a.beat, 0, 1);
    const nb = a.bands.length;

    const stepX = 4;

    for (let k = 0; k < N; k++) {
      const y0 = margin + (k + 0.5) * rowH;
      const n = k + 1;

      // band k feeds harmonic k; clamp index into the 32-band frame
      const bi = LABUTIL.clamp(k, 0, nb - 1) | 0;
      const band = LABUTIL.clamp(a.bands[bi], 0, 1);
      const excite = 0.5 + 1.3 * react * (0.6 * band + 0.4 * aLevel);
      const A = amp * rowH * 0.42 * excite;

      // per-string retrigger period
      const rate = pluckRate * (0.6 + 0.4 * k / N);
      const T = 1 / Math.max(0.05, rate);
      let te = t % T;
      if (!isFinite(te) || te < 0) te = 0;
      const env = Math.exp(-te * decay);

      // a.beat re-plucks: a transient flash on top of the running envelope
      const beatBoost = 1 + 1.0 * react * aBeat;

      // standing-wave temporal amplitude (oscillates while it decays)
      let amplitude = A * env * beatBoost * Math.sin(2 * Math.PI * (1.0 + n * 0.6) * te);
      if (!isFinite(amplitude)) amplitude = 0;
      amplitude = LABUTIL.clamp(amplitude, -rowH * 0.95, rowH * 0.95);

      // how lit this string reads: its band energy plus the pluck envelope
      const lit = LABUTIL.clamp(react * (0.6 * band + 0.4 * aLevel), 0, 1);

      // faint baseline
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(w, y0);
      ctx.stroke();

      // the vibrating string polyline; brightness tracks env and band energy
      ctx.strokeStyle = LABUTIL.rgba(theme.ink, LABUTIL.clamp(0.3 + 0.45 * env + 0.4 * lit, 0, 1));
      ctx.lineWidth = 1 + 0.8 * lit;
      ctx.beginPath();
      let first = true;
      for (let x = 0; x <= w; x += stepX) {
        let yy = y0 + amplitude * Math.sin(n * Math.PI * x / Math.max(1, w));
        if (!isFinite(yy)) yy = y0;
        if (first) { ctx.moveTo(x, yy); first = false; }
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();

      // node markers: x where sin(n*pi*x/w) = 0 -> x = j*w/n, j=0..n
      ctx.fillStyle = LABUTIL.rgba(theme.dim, 0.7);
      for (let j = 0; j <= n; j++) {
        const xn = j * w / n;
        ctx.beginPath();
        ctx.arc(xn, y0, 1.5, 0, LABUTIL.TAU);
        ctx.fill();
      }
    }
  }
});
