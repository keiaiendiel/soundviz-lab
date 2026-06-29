LAB.register({
  id: 'ascii-waveform',
  title: 'ASCII Character Waveform',
  group: 'Raster, glyph, text',
  essence: 'A monospaced character grid where glyph density encodes the signal, terminal-style sound.',
  blurb: 'Sound rendered in a terminal. A monospaced grid maps a local intensity to a character ramp (space . : - = + # at increasing density), so a moving waveform or spectrum is spelled out in ASCII. It is the text-as-raster member, the Henke 8-bit phosphor register in pure form, and it carries a deliberate machine-aware coldness. Green-on-black is a legitimate accent here, the one place a phosphor tint reads as lineage rather than decoration.',
  tags: ['text', 'glyph', 'raster', 'monochrome', 'accent', 'realtime'],
  lineage: 'Robert Henke CBM 8032 AV character grids; teletype / ASCII-art tradition; Vasulka machine-aware signal. Scientific anchor: character-cell raster display, luminance-to-glyph ramp.',
  dialect: 'Brittle Stress Matrix',
  palette: 'monochrome + single accent',
  paramNotes: 'Columns (resolution) and the intensity gain are the levers; a ramp-length slider (how many distinct glyphs) shifts between blocky and smooth. The font is a build choice. The single accent here is the phosphor tint applied to the whole grid, a one-step climax control. Audio drive sets each column height from a.wave, a.level scales amplitude, and a.high raises glyph density.',
  params: [
    { key: 'cols', label: 'Columns', min: 24, max: 120, step: 4, value: 64 },
    { key: 'gain', label: 'Intensity gain', min: 0.3, max: 2, step: 0.1, value: 1 },
    { key: 'speed', label: 'Scroll speed', min: 0.1, max: 3, step: 0.1, value: 1 },
    { key: 'phosphor', label: 'Phosphor accent', min: 0, max: 1, step: 0.05, value: 0 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h){
    s.ramp = ' .:-=+*#@';
  },
  draw(ctx, w, h, t, p, s, theme, a){
    var U = LABUTIL, TAU = U.TAU;
    var react = (p.react == null ? 0.85 : p.react);
    var lvl = U.clamp(a.level || 0, 0, 1);
    var hiF = U.clamp(a.high || 0, 0, 1);
    var act = U.clamp(Math.max(a.level || 0, (a.peak || 0) * 0.7, a.beat || 0) * react, 0, 1);
    var wav = a.wave;
    var wn = wav && wav.length ? wav.length : 1;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    var ramp = s.ramp || ' .:-=+*#@';
    var rampLast = ramp.length - 1;
    var cols = Math.max(8, Math.round(p.cols));
    var fontSize = w / cols;
    if (!(fontSize > 0.5)) fontSize = 0.5;
    var rows = Math.max(1, Math.floor(h / fontSize));
    if (rows > 600) rows = 600;
    if (cols > 240) cols = 240;
    ctx.font = fontSize.toFixed(2) + 'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    // phosphor tint: warm ink at 0, phosphor green at 1
    var phos = U.clamp(p.phosphor, 0, 1);
    var inkCol = theme.ink;
    var greenCol = '#37e06a';
    var sp = p.speed;
    var gain = p.gain;
    // own scroll clock: near-still in silence, scrolls with sound
    s.clk = (s.clk || 0) + (a.dt || 0.016) * sp * (0.07 + 1.0 * act);
    var clk = s.clk;
    for (var rr = 0; rr < rows; rr++){
      var v = rr / rows;
      var rowGlow = 0.55 + 0.45 * Math.sin(v * 9.0 - clk * 0.6);
      for (var c = 0; c < cols; c++){
        var u = c / cols;
        // live waveform sample for this column, plus a faint scroll ripple so silence still breathes
        var wi = Math.round(u * (wn - 1));
        if (wi < 0) wi = 0; else if (wi > wn - 1) wi = wn - 1;
        var samp = wav ? (wav[wi] || 0) : 0;
        samp += (0.02 + 0.12 * act) * Math.sin(u * TAU * 3 - clk * 2);
        // column reach (half-height fraction) from |sample|, scaled by gain and loudness
        var reach = U.clamp(Math.abs(samp) * gain * (0.35 + 1.3 * react * lvl), 0.02, 1);
        var dist = Math.abs(v - 0.5) * 2; // 0 at centre row, 1 at top/bottom edge
        var inside = reach - dist;
        var field = inside > 0 ? U.clamp(inside / reach, 0, 1) : 0;
        // a.high raises glyph density; fbm keeps the terminal texture
        var nz = U.fbm(u * 4, v * 4 + clk, 4);
        field *= (0.65 + 0.7 * react * hiF) * (0.75 + 0.25 * (0.5 + 0.5 * nz));
        field = U.clamp(field, 0, 1);
        var idx = Math.floor(field * rampLast);
        if (idx < 0) idx = 0; else if (idx > rampLast) idx = rampLast;
        if (idx === 0) continue; // skip spaces
        var ch = ramp.charAt(idx);
        // brightness shaping per glyph for depth
        var br = 0.30 + 0.70 * field;
        var alpha = U.clamp(br * (0.6 + 0.4 * rowGlow), 0.06, 1);
        if (phos <= 0.001){
          ctx.fillStyle = U.rgba(inkCol, alpha);
        } else if (phos >= 0.999){
          ctx.fillStyle = U.rgba(greenCol, alpha);
        } else {
          // approximate blend by alternating contribution per glyph deterministically
          var mix = U.hash2(c, rr);
          ctx.fillStyle = U.rgba(mix < phos ? greenCol : inkCol, alpha);
        }
        ctx.fillText(ch, c * fontSize, rr * fontSize);
      }
    }
  }
});
