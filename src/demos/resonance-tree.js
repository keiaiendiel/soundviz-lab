LAB.register({
  id: "resonance-tree",
  title: "Resonance Tree",
  group: "Fractal and recursion",
  essence: "A branching structure whose angles and lengths are set by a harmonic series, swaying in resonance.",
  blurb: "A recursive structure tuned like an instrument. Each level of the tree branches by an angle and a length ratio taken from a harmonic series, and the whole thing sways as if driven by standing waves, so changing the ratios retunes the silhouette the way changing a frequency retunes a string. It connects the fractal register to the strings-and-vibration theme, growth as frequency made into form.",
  tags: ["line", "fractal", "recursion", "strings", "monochrome", "slow"],
  lineage: "Lindenmayer systems; Barnsley fern; the branching of overtone structure. Scientific anchor: recursive self-similar branching modulated by a harmonic ratio.",
  dialect: "-",
  palette: "monochrome ink",
  paramNotes: "Branch angle and length ratio are the levers that retune the silhouette; depth sets recursion (cost); sway sets the resonant motion amplitude. Worth sliders except depth which is coarse. Colour off. Audio: a.level grows the trunk, a.beat shivers the branches, each recursion level resonates and brightens with its own band of the spectrum, and a.centroid lifts the overall glow.",
  params: [
    { key: "angle", label: "Branch angle", min: 8, max: 60, step: 1, value: 26 },
    { key: "ratio", label: "Length ratio", min: 0.55, max: 0.82, step: 0.01, value: 0.72 },
    { key: "depth", label: "Depth", min: 5, max: 11, step: 1, value: 9 },
    { key: "sway", label: "Sway", min: 0, max: 1, step: 0.05, value: 0.35 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    var maxDepth = Math.round(LABUTIL.clamp(p.depth, 5, 11));
    var branchAngle = LABUTIL.clamp(p.angle, 8, 60) * Math.PI / 180;
    var ratio = LABUTIL.clamp(p.ratio, 0.55, 0.82);
    var sway = LABUTIL.clamp(p.sway, 0, 1);

    // audio: level grows it, beat shivers, bands resonate per level, centroid glows
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = LABUTIL.clamp(a.level, 0, 1);
    var aBeat = LABUTIL.clamp(a.beat, 0, 1);
    var aCent = LABUTIL.clamp(a.centroid, 0, 1);
    var bands = a.bands;
    var nb = bands.length;
    var shiver = 1 + 1.4 * react * aBeat;
    var glow = LABUTIL.clamp(0.7 + 0.5 * react * aCent, 0, 1.4);

    var baseLen = h * 0.26 * (0.75 + 0.5 * react * aLevel);
    var baseX = w / 2;
    var baseY = h * 0.96;

    // node budget guard: depth<=11 -> at most 2^12 nodes, well within cap
    var budget = 6000;

    function branch(x, y, ang, len, d) {
      if (budget <= 0) return;
      if (d <= 0 || len < 1) return;
      if (!isFinite(x) || !isFinite(y) || !isFinite(ang) || !isFinite(len)) return;
      budget--;

      var bidx = LABUTIL.clamp(maxDepth - d, 0, nb - 1) | 0;
      var bandE = LABUTIL.clamp(bands[bidx], 0, 1);
      var swayAmt = sway * (1 + 0.8 * react * bandE) * shiver * Math.sin(t * 1.3 + d * 0.6) * (0.12 * (maxDepth - d + 1));
      var a2 = ang + swayAmt;
      var nx = x + Math.cos(a2) * len;
      var ny = y + Math.sin(a2) * len;
      if (!isFinite(nx) || !isFinite(ny)) return;

      var lw = LABUTIL.clamp(d * 0.4 + 1.2 * react * bandE, 0.4, 3.5);
      var alpha = LABUTIL.clamp((0.25 + 0.06 * d + 0.4 * react * bandE) * glow, 0, 1);

      ctx.strokeStyle = LABUTIL.rgba(theme.ink, alpha);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      var childLen = len * ratio;
      branch(nx, ny, a2 - branchAngle, childLen, d - 1);
      branch(nx, ny, a2 + branchAngle, childLen, d - 1);
    }

    // faint mirrored / scaled twin tree behind for fullness, very dim
    ctx.save();
    // second tree: slightly shorter, phase-shifted sway via different base len
    (function () {
      var b2 = budget;
      budget = 3000;
      branchTwin(baseX, baseY, -Math.PI / 2, baseLen * 0.82, maxDepth - 1);
      budget = b2;
    })();
    ctx.restore();

    function branchTwin(x, y, ang, len, d) {
      if (budget <= 0) return;
      if (d <= 0 || len < 1) return;
      if (!isFinite(x) || !isFinite(y) || !isFinite(ang) || !isFinite(len)) return;
      budget--;
      var bidxT = LABUTIL.clamp(maxDepth - d, 0, nb - 1) | 0;
      var bandT = LABUTIL.clamp(bands[bidxT], 0, 1);
      var swayAmt = sway * (1 + 0.8 * react * bandT) * shiver * Math.sin(t * 1.1 + d * 0.6 + 0.9) * (0.12 * (maxDepth - d + 1));
      var a2 = ang + swayAmt;
      var nx = x + Math.cos(a2) * len;
      var ny = y + Math.sin(a2) * len;
      if (!isFinite(nx) || !isFinite(ny)) return;
      var alpha = LABUTIL.clamp((0.06 + 0.02 * d + 0.18 * react * bandT) * glow, 0, 0.4);
      ctx.strokeStyle = LABUTIL.rgba(theme.dim, alpha);
      ctx.lineWidth = LABUTIL.clamp(d * 0.3, 0.4, 2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      var cl = len * ratio;
      branchTwin(nx, ny, a2 - branchAngle * 1.08, cl, d - 1);
      branchTwin(nx, ny, a2 + branchAngle * 0.92, cl, d - 1);
    }

    // main tree on top
    branch(baseX, baseY, -Math.PI / 2, baseLen, maxDepth);
  }
});
