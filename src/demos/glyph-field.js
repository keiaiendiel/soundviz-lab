LAB.register({
  id: 'glyph-field',
  title: 'Rotating Glyph Field',
  group: 'Raster, glyph, text',
  essence: 'A grid of identical marks each rotating and scaling by a local field, a typographic weather.',
  blurb: 'A field of marks reading the wind. A grid of identical glyphs (a tick, a slash, a small bar) each rotates to a local noise-field angle and scales to a local magnitude, so the grid as a whole shows flow the way iron filings show a magnet. It is the glyph register, between vector-field arrows and typography, and it carries motion beautifully at scale. Restrained and monochrome it reads as a coded instrument panel.',
  tags: ['glyph','field','raster','line','monochrome','realtime'],
  lineage: 'Iron-filing field visualisation; Casey Reas Process drawings; ASCII-art field tradition. Scientific anchor: direction-field / glyph-based flow visualisation.',
  dialect: 'Modal Coordinate Grid',
  palette: 'monochrome ink',
  paramNotes: 'Glyph spacing and the angle-field scale are the levers; a scale-response slider (how strongly magnitude grows the glyph) ties it to dynamics. The choice of glyph is a build decision, not a runtime slider. No colour. Audio drive (react): spectral flux sets the churn rate, loudness grows the glyphs, peaks brighten the field, and each beat scatters the marks before they settle.',
  params: [
    { key: 'spacing', label: 'Glyph spacing', min: 14, max: 60, step: 2, value: 28 },
    { key: 'fieldScale', label: 'Field scale', min: 0.5, max: 4, step: 0.1, value: 1.6 },
    { key: 'response', label: 'Scale response', min: 0, max: 1.5, step: 0.05, value: 0.7 },
    { key: 'speed', label: 'Field speed', min: 0.1, max: 2, step: 0.1, value: 0.5 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a){
    var clamp = LABUTIL.clamp;
    var TWO_PI = LABUTIL.TAU;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    a = a || {};
    var react = (p.react == null ? 0.85 : clamp(p.react, 0, 1.5));
    var lvl = clamp(a.level || 0, 0, 1);
    var flux = clamp(a.flux || 0, 0, 1);
    var beat = clamp(a.beat || 0, 0, 1);
    var peak = clamp(a.peak || 0, 0, 1);

    var spacing = clamp(p.spacing, 14, 60);
    var fs = p.fieldScale;
    var resp = p.response;
    var dt = clamp(a.dt == null ? 0.016 : a.dt, 0, 0.1);
    // churn activity, led by spectral flux: ~0 in silence so the field is near-still
    var churn = clamp(Math.max(flux, lvl * 0.7, beat) * react, 0, 1);
    var IDLE = 0.05, GAIN = 1.6;
    // integrate phase so the glyph flicker freezes when quiet, churns with sound
    s.ph = (s.ph || 0) + dt * p.speed * (IDLE + GAIN * churn);
    if (!isFinite(s.ph)) s.ph = 0;
    var ph = s.ph;
    var scatter = react * beat * Math.PI; // beat scatters the marks
    var lift = react * lvl;               // loudness grows the glyphs

    ctx.lineCap = 'round';
    ctx.strokeStyle = theme.ink;

    var startX = spacing * 0.5;
    var startY = spacing * 0.5;

    for (var y = startY; y < h; y += spacing) {
      for (var x = startX; x < w; x += spacing) {
        var ang = LABUTIL.noise2(x * 0.004 * fs, y * 0.004 * fs + ph) * TWO_PI * 2;
        // a.beat throws each glyph off its field angle, then it settles as beat decays
        ang += (LABUTIL.hash2(x * 0.13, y * 0.13) * 2 - 1) * scatter;
        var mraw = LABUTIL.fbm(x * 0.005, y * 0.005 - ph);
        var mag = clamp(0.5 + resp * mraw + 0.7 * lift, 0.05, 2.6);
        var len = spacing * 0.45 * mag;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.lineWidth = clamp(0.8 + mag * 0.6, 0.6, 2.2);
        ctx.globalAlpha = clamp((0.4 + 0.45 * (mag - 0.5)) * (0.7 + 0.55 * react * peak), 0.18, 1);
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(len, 0);
        // short cross-tick for a richer glyph
        ctx.moveTo(len * 0.55, 0);
        ctx.lineTo(len * 0.55, -len * 0.3);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
});
