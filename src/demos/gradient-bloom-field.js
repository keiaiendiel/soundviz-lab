LAB.register({
  id: 'gradient-bloom-field',
  title: 'Gradient Field with Bloom',
  group: 'Texture and feedback',
  essence: 'Soft radial gradients summed and bloomed, the warm eyelid-amber moment.',
  blurb: "The one warm breath of the show. A few soft radial gradients drift and sum into a smoky luminance field, then a cheap bloom lifts the bright cores into glow. This is the deliberate gradient-and-blur register and the home of the warm eyelid-amber moment, the single sanctioned warmth against the monochrome spine, motivated as the inside of a closed eyelid rather than colour for its own sake. Slow, soft, it is the rest between the hard dialects.",
  tags: ['gradient', 'blur', 'field', 'accent', 'slow'],
  lineage: 'James Turrell light fields; Mark Rothko colour-field; Memo Akten soft latent fields. Scientific anchor: summed radial luminance fields, Gaussian bloom.',
  dialect: 'Faraday Cymatic Field',
  palette: 'warm amber (eyelid)',
  paramNotes: 'Bloom radius and the number of drifting cores are the levers that set the softness and complexity; the warmth slider is the eyelid-amber control, the one place colour is the point. Drift speed is secondary. This is the one technique where a colour/temperature param is licensed and load-bearing. Audio: loudness and beats lift the bloom intensity; warmth stays the manual eyelid-amber control.',
  params: [
    { key: 'cores', label: 'Light cores', min: 1, max: 6, step: 1, value: 3 },
    { key: 'bloom', label: 'Bloom radius', min: 0.1, max: 0.6, step: 0.02, value: 0.3 },
    { key: 'warmth', label: 'Eyelid warmth', min: 0, max: 1, step: 0.05, value: 0.5 },
    { key: 'drift', label: 'Drift speed', min: 0, max: 1, step: 0.05, value: 0.2 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    // Each core gets a fixed, deterministic personality: phase offsets and
    // drift radii so the field never collapses to a single throb. mulberry32
    // keeps it reproducible, no engine random in draw.
    const rnd = LABUTIL.mulberry32(0x5A4C7);
    s.cores = [];
    for (let i = 0; i < 6; i++) {
      s.cores.push({
        px: rnd(), py: rnd(),            // base position 0..1
        ax: 0.12 + rnd() * 0.18,         // horizontal drift amplitude
        ay: 0.12 + rnd() * 0.18,         // vertical drift amplitude
        sx: 0.55 + rnd() * 0.9,          // drift speed multipliers
        sy: 0.45 + rnd() * 0.8,
        ph: rnd() * LABUTIL.TAU,         // phase
        rp: rnd() * LABUTIL.TAU,         // radius breathing phase
        wob: 0.6 + rnd() * 0.8           // size weight
      });
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    const clamp = LABUTIL.clamp;
    const minD = Math.min(w, h);
    const react = (p.react == null ? 0.85 : p.react);
    // Activity: ~0 in silence, ~1 with sound. Drift, breathing and the smoky wash are
    // integrated on our own clocks and scaled by mo so this rest register barely
    // moves in silence; a slightly higher idle keeps a faint warm breath alive.
    const act = clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    const mo = 0.10 + 1.2 * act;
    // loudness + beats lift the bloom intensity around the slider baseline
    const aud = clamp(0.55 + 1.0 * react * clamp(a.level, 0, 1) + 0.6 * react * clamp(a.beat, 0, 1), 0.3, 2.2);

    // Warm amber for the eyelid moment. The accent in theme is indigo/amber;
    // we mix toward a true warm amber so warmth is unmistakably warm, then let
    // p.warmth interpolate from cool ink to that amber. theme.accent is used as
    // the warm pole when it reads warm, otherwise we provide our own amber.
    const inkCol = theme.ink;
    const amberCol = '#e8a24a';          // eyelid amber, sanctioned warm pole

    // Background. This is the rest register, so a clean near-black base.
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    const n = Math.max(1, Math.min(6, Math.round(p.cores)));
    const drift = p.drift;
    // integrate drift + breathing on our own clocks, scaled by mo, so the cores
    // nearly stop drifting/breathing in silence instead of running off clock t
    s.drph = (s.drph || 0) + a.dt * drift * mo;
    s.brph = (s.brph || 0) + a.dt * 0.3 * mo;
    const ang = s.drph;
    const bloomR = (0.2 + p.bloom) * minD;

    // Compose colour for the cores: blend ink -> amber by warmth.
    // We approximate by drawing two tinted layers and crossfading via alpha,
    // which keeps everything as valid rgba strings and avoids manual hex math.
    const warmA = clamp(p.warmth, 0, 1);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // additive summing -> bloom

    for (let c = 0; c < n; c++) {
      const core = s.cores[c];
      // quasi-periodic drift: two incommensurate frequencies per axis
      const fx = Math.cos(ang * core.sx + core.ph) * 0.6
               + Math.cos(ang * core.sx * 1.7 + core.ph * 1.3) * 0.4;
      const fy = Math.sin(ang * core.sy + core.ph) * 0.6
               + Math.sin(ang * core.sy * 1.9 + core.rp) * 0.4;
      const cx = (core.px + fx * core.ax) * w;
      const cy = (core.py + fy * core.ay) * h;

      // breathing radius, always positive and bounded
      const breathe = 0.7 + 0.3 * Math.sin(s.brph + core.rp);
      const rad = Math.max(2, bloomR * core.wob * breathe);

      // intensity per core falls off as count rises so the sum stays in range
      const coreAlpha = clamp((0.55 / Math.sqrt(n)) * aud, 0.05, 0.9);

      // Two-stop bloom: a tight bright core gradient and a wide soft halo.
      // Cool (ink) layer:
      const coolI = (1 - warmA);
      if (coolI > 0.001) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, LABUTIL.rgba(inkCol, coreAlpha * coolI));
        g.addColorStop(0.35, LABUTIL.rgba(inkCol, coreAlpha * 0.45 * coolI));
        g.addColorStop(1, LABUTIL.rgba(inkCol, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      // Warm (amber) layer:
      if (warmA > 0.001) {
        const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g2.addColorStop(0, LABUTIL.rgba(amberCol, coreAlpha * warmA));
        g2.addColorStop(0.35, LABUTIL.rgba(amberCol, coreAlpha * 0.5 * warmA));
        g2.addColorStop(1, LABUTIL.rgba(amberCol, 0));
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, w, h);

        // also a faint accent rim so the page indigo accent survives at low warmth
        const g3 = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 1.4);
        g3.addColorStop(0, LABUTIL.rgba(theme.accent, 0));
        g3.addColorStop(0.6, LABUTIL.rgba(theme.accent, coreAlpha * 0.12 * warmA));
        g3.addColorStop(1, LABUTIL.rgba(theme.accent, 0));
        ctx.fillStyle = g3;
        ctx.fillRect(0, 0, w, h);
      }

      // bright inner bloom: a small intense core lifts the highlight
      const hot = Math.max(2, rad * (0.10 + 0.05 * breathe));
      const hotCol = warmA > 0.5 ? amberCol : inkCol;
      const gh = ctx.createRadialGradient(cx, cy, 0, cx, cy, hot);
      gh.addColorStop(0, LABUTIL.rgba(hotCol, coreAlpha * (0.6 + 0.4 * warmA)));
      gh.addColorStop(1, LABUTIL.rgba(hotCol, 0));
      ctx.fillStyle = gh;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    // Smoky texture: a very faint fbm wash, multiplicative-ish via low alpha,
    // breaks the clean gradients into something atmospheric. Bounded loop.
    // Draw on a coarse grid so it is cheap (no per-pixel over full canvas).
    const GW = 28, GH = 20;
    const cw = w / GW, ch = h / GH;
    s.txph = (s.txph || 0) + a.dt * 0.05 * mo;
    const ts = s.txph;
    ctx.globalCompositeOperation = 'overlay';
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const nv = LABUTIL.fbm(gx * 0.35 + ts, gy * 0.35 - ts, 3); // -1..1
        const a = clamp(0.04 + nv * 0.04, 0, 0.09);
        if (a <= 0.005) continue;
        // dark grain dims, light grain lifts, subtly
        const col = nv < 0 ? theme.bg : theme.ink;
        ctx.fillStyle = LABUTIL.rgba(col, a);
        ctx.fillRect(gx * cw, gy * ch, cw + 1, ch + 1);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // Gentle vignette to seat the field in the dark, instrument framing.
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.5, minD * 0.2, w * 0.5, h * 0.5, minD * 0.75);
    vg.addColorStop(0, LABUTIL.rgba(theme.bg, 0));
    vg.addColorStop(1, LABUTIL.rgba(theme.bg, 0.55));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
});
