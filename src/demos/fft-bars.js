LAB.register({
  id: 'fft-bars',
  title: 'FFT Bar Spectrum (stock baseline)',
  group: 'Spectral',
  essence: 'Vertical bars per frequency band, the default sound visualiser, included on purpose.',
  blurb: 'The stock baseline. This is the bar-graph EQ that every plugin ships and every undergraduate reaches for first; it is here precisely so the deck can name it and then refuse it. Drawn with monochrome restraint and slow falloff it is still legible, but its job in the lab is to be the thing the five dialects are NOT. Show it, label it stock, move on. Naming the cliche is the strongest defence against a make-it-more-spectacular client note.',
  tags: ['spectral','raster','monochrome','realtime'],
  lineage: 'Generic Resolume/Winamp visualiser; the FFT-bin-to-bar logic flagged in the artistic memo as the illiterate end of mapping. Scientific anchor: discrete Fourier transform magnitude bins.',
  dialect: '-',
  palette: 'monochrome ink',
  paramNotes: 'Bar count and falloff speed are the only honest levers and they barely change the read, which is the point of including it. Do not over-invest sliders here. The deliberate lesson is that parametric control cannot rescue a weak mapping; the technique is flat no matter how you tune it. Audio drive feeds a.bands straight into the bars (band index mapped across the bar count), so this is now the honest live FFT.',
  params: [
    { key: 'bars',    label: 'Band count',   min: 8,    max: 64,   step: 2,    value: 32 },
    { key: 'falloff', label: 'Peak falloff', min: 0.85, max: 0.99, step: 0.01, value: 0.94 },
    { key: 'gain',    label: 'Gain',         min: 0.2,  max: 1,    step: 0.05, value: 0.6 },
    { key: 'react',   label: 'Audio drive',  min: 0,    max: 1.5,  step: 0.05, value: 0.85 }
  ],
  init(s, w, h){
    s.peaks = [];
  },
  draw(ctx, w, h, t, p, s, theme, a){
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var bars = Math.max(2, Math.round(p.bars));
    if (!s.peaks || s.peaks.length !== bars){
      s.peaks = new Array(bars).fill(0);
    }

    var bw = w / bars;
    var baseY = h - 6;
    var usable = h * 0.8;

    var react = (p.react == null ? 0.85 : p.react);
    var aw = LABUTIL.clamp(react, 0, 1.5);
    var ab = a ? a.bands : null;
    var nb = (ab && ab.length) ? ab.length : 1;

    for (var b = 0; b < bars; b++){
      var cf = b / bars; // 0..1 across the spectrum
      // honest FFT: this bar reads the live band magnitude from a.bands
      var bi = Math.round(cf * (nb - 1));
      if (bi < 0) bi = 0; else if (bi > nb - 1) bi = nb - 1;
      var av = ab ? ab[bi] : 0; if (!isFinite(av)) av = 0;
      // faint synthetic floor so the bars never freeze flat in silence
      var syn = LABUTIL.clamp(0.5 + 0.5 * Math.sin(t * (1 + cf * 4) + b) * LABUTIL.noise2(cf * 5, t * 1.5), 0, 1);
      var mag = av * (0.4 + 1.1 * aw) + syn * (1 - 0.6 * aw / 1.5);
      mag *= p.gain * (1 - cf * 0.4); // pink tilt, highs sit lower
      mag = LABUTIL.clamp(mag, 0, 1);

      // peak hold with slow decay
      var pk = s.peaks[b] * p.falloff;
      if (mag > pk) pk = mag;
      s.peaks[b] = pk;

      var x = b * bw;
      var barH = mag * usable;
      var pkH  = pk  * usable;

      // bar body
      ctx.fillStyle = LABUTIL.rgba(theme.ink, 0.85);
      ctx.fillRect(x + 1, baseY - barH, Math.max(1, bw - 2), barH);

      // peak-hold cap, 2px line
      ctx.fillStyle = LABUTIL.rgba(theme.ink, 1);
      ctx.fillRect(x + 1, baseY - pkH - 1, Math.max(1, bw - 2), 2);
    }

    // baseline
    ctx.strokeStyle = LABUTIL.rgba(theme.grid, 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 0.5);
    ctx.lineTo(w, baseY + 0.5);
    ctx.stroke();

    // anti-reference label
    ctx.fillStyle = LABUTIL.rgba(theme.dim, 0.6);
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('STOCK', 10, 10);
  }
});
