LAB.register({
  id: 'walking-droplet',
  title: 'Walking Droplet (pilot wave)',
  group: 'Cymatic and modal',
  essence: 'A droplet bouncing on a vibrated Faraday bath sheds decaying circular standing waves at each impact and walks guided by the slope of its own accumulated wave field.',
  blurb: 'Just below the Faraday threshold a bouncing drop leaves a trail of standing waves that do not fully decay; the drop reads the slope of this memory field and self-propels. This renders the wave field as a memory-weighted sum of J0 Bessel waves at past bounce points, the droplet riding its own pilot wave.',
  tags: ['field', 'cymatic', 'vibration', 'particle', 'monochrome', 'realtime'],
  lineage: 'Couder and Fort 2005-2010 walking droplets; Molacek and Bush 2013 hydrodynamic pilot-wave theory; Oza, Rosales and Bush 2013 stroboscopic trajectory equation. Wave shed per bounce is a Bessel J0(k_F r) Faraday mode with exponential memory decay.',
  dialect: 'Faraday Cymatic Field',
  palette: 'Monochrome. Standing-wave field as warm-amber ridges on black troughs; the droplet a single bright accent point with a faint trail. One accent.',
  paramNotes: 'memory is the Me parameter, how many past bounces persist (proximity to the Faraday threshold): high memory means a long-lived complex field and quantum-like trajectories. wavelength sets the Faraday wavelength lambda_F (Bessel ring spacing). forcing scales the impact amplitude. speed sets the bounce/walk rate. Audio: a.level drives the bath (louder sound raises the Faraday forcing and the walk rate) and a.beat triggers extra bounces, so each onset drops a fresh ring.',
  params: [
    { key: 'memory', label: 'Memory Me', min: 5, max: 120, step: 1, value: 45 },
    { key: 'wavelength', label: 'Faraday lambda', min: 18, max: 70, step: 1, value: 34 },
    { key: 'forcing', label: 'Impact force', min: 0.4, max: 2.5, step: 0.05, value: 1 },
    { key: 'speed', label: 'Bounce rate', min: 0.3, max: 2.5, step: 0.05, value: 1 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    s.GW = 150;
    s.GH = 96;
    s.img = null;
    s.bounces = [];     // {x, y, t} in field-pixel coords
    s.step = 0;         // integer bounce counter (the strobed clock)
    s.xd = 0; s.yd = 0; // droplet position in field coords
    s.vx = 0; s.vy = 0;
    s.trail = [];
    s.Hmax = 1;
    s.lastKey = null;
    // Bessel J0 / J1 via Abramowitz-Stegun: series for small z, asymptote for large z.
    s.J0 = function (z) {
      z = Math.abs(z);
      if (z < 3) {
        var y = (z / 3) * (z / 3);
        return 1 + y * (-2.2499997 + y * (1.2656208 + y * (-0.3163866 + y * (0.0444479 + y * (-0.0039444 + y * 0.0002100)))));
      }
      var ax = z;
      var yz = 3 / ax;
      var f0 = 0.79788456 + yz * (-0.00000077 + yz * (-0.00552740 + yz * (-0.00009512 + yz * (0.00137237 + yz * (-0.00072805 + yz * 0.00014476)))));
      var th = ax - 0.78539816 + yz * (-0.04166397 + yz * (-0.00003954 + yz * (0.00262573 + yz * (-0.00054125 + yz * (-0.00029333 + yz * 0.00013558)))));
      return Math.sqrt(0.636619772 / ax) * Math.cos(th) * f0;
    };
    s.J1 = function (z) {
      var sgn = z < 0 ? -1 : 1;
      z = Math.abs(z);
      if (z < 3) {
        var y = (z / 3) * (z / 3);
        var r = z * (0.5 + y * (-0.56249985 + y * (0.21093573 + y * (-0.03954289 + y * (0.00443319 + y * (-0.00031761 + y * 0.00001109))))));
        return sgn * r;
      }
      var ax = z;
      var yz = 3 / ax;
      var f1 = 0.79788456 + yz * (0.00000156 + yz * (0.01659667 + yz * (0.00017105 + yz * (-0.00249511 + yz * (0.00113653 + yz * -0.00020033)))));
      var th = ax - 2.35619449 + yz * (0.12499612 + yz * (0.00005650 + yz * (-0.00637879 + yz * (0.00074348 + yz * (0.00079824 + yz * -0.00029166)))));
      return sgn * Math.sqrt(0.636619772 / ax) * Math.cos(th) * f1;
    };
  },
  // one strobed bounce: deposit a wave, then accelerate down the field gradient
  bounce(s, p) {
    var kF = LABUTIL.TAU / LABUTIL.clamp(p.wavelength, 18, 70);
    var Me = LABUTIL.clamp(p.memory, 5, 120);
    var forcing = LABUTIL.clamp(p.forcing, 0.4, 2.5) * (s.audForce || 1);
    var J1 = s.J1;
    var bs = s.bounces;
    // gradient of the total field at the droplet
    var gx = 0, gy = 0;
    var now = s.step;
    for (var n = 0; n < bs.length; n++) {
      var b = bs[n];
      var dx = s.xd - b.x, dy = s.yd - b.y;
      var r = Math.sqrt(dx * dx + dy * dy);
      if (r < 1e-3) continue;
      var amp = forcing * Math.exp(-(now - b.t) / Me);
      // d/dr J0(kF r) = -kF J1(kF r)
      var dr = amp * (-kF * J1(kF * r));
      gx += dr * dx / r;
      gy += dr * dy / r;
    }
    if (!isFinite(gx)) gx = 0;
    if (!isFinite(gy)) gy = 0;
    // stroboscopic update: drag + wave force; tuned to a steady walking limit cycle
    var Cf = 9.0, drag = 0.32, dtb = 1.0;
    s.vx += (-Cf * gx - drag * s.vx) * dtb;
    s.vy += (-Cf * gy - drag * s.vy) * dtb;
    // clamp speed so it never diverges
    var sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    var cap = 3.5;
    if (sp > cap) { s.vx *= cap / sp; s.vy *= cap / sp; }
    s.xd += s.vx; s.yd += s.vy;
    // soft circular bath boundary: reflect so the walker stays in the dish
    var cx = s.GW * 0.5, cy = s.GH * 0.5, R = Math.min(s.GW, s.GH) * 0.46;
    var ox = s.xd - cx, oy = s.yd - cy;
    var rr = Math.sqrt(ox * ox + oy * oy);
    if (rr > R) {
      var nx = ox / rr, ny = oy / rr;
      s.xd = cx + nx * R; s.yd = cy + ny * R;
      var dot = s.vx * nx + s.vy * ny;
      s.vx -= 2 * dot * nx; s.vy -= 2 * dot * ny;
      s.vx *= 0.92; s.vy *= 0.92;
    }
    if (!isFinite(s.xd)) s.xd = cx;
    if (!isFinite(s.yd)) s.yd = cy;
    bs.push({ x: s.xd, y: s.yd, t: now });
    var cap2 = Math.ceil(Me) + 6;
    while (bs.length > cap2) bs.shift();
    s.trail.push([s.xd, s.yd]);
    while (s.trail.length > 60) s.trail.shift();
    s.step += 1;
  },
  reset(s, p) {
    var cx = s.GW * 0.5, cy = s.GH * 0.5;
    s.bounces = [{ x: cx, y: cy, t: 0 }];
    s.step = 1;
    s.xd = cx; s.yd = cy;
    // tiny asymmetric kick breaks symmetry so it walks rather than bouncing in place
    s.vx = 0.18; s.vy = 0.05;
    s.trail = [[cx, cy]];
    s.Hmax = 1;
    // pre-warm: silently run many bounces so the field is fully populated
    var warm = 220;
    for (var i = 0; i < warm; i++) this.bounce(s, p);
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    var react = (p.react == null ? 0.85 : p.react);
    // audio drives the bath: louder sound raises the Faraday forcing (does not thrash the reset key)
    s.audForce = LABUTIL.clamp(0.7 + 0.95 * react * a.level, 0.3, 3);
    var key = Math.round(p.memory) + ':' + Math.round(p.wavelength) + ':' + Math.round(p.forcing * 100);
    if (s.lastKey !== key) { this.reset(s, p); s.lastKey = key; }
    // advance bounces at the chosen rate (couple to t for smooth continuous motion)
    var rate = LABUTIL.clamp(p.speed, 0.3, 2.5);
    if (s._acc == null) s._acc = 0;
    // audio drives the walk: silence nearly stops the bounces, loudness and beats inject them
    var act = LABUTIL.clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    s._acc += rate * 0.9 * (0.08 + 1.3 * act) + react * a.beat * 1.8;
    var doB = 0;
    while (s._acc >= 1 && doB < 4) { this.bounce(s, p); s._acc -= 1; doB++; }
    if (s._acc > 1) s._acc = 1;

    var GW = s.GW, GH = s.GH;
    var kF = LABUTIL.TAU / LABUTIL.clamp(p.wavelength, 18, 70);
    var Me = LABUTIL.clamp(p.memory, 5, 120);
    var forcing = LABUTIL.clamp(p.forcing, 0.4, 2.5) * (s.audForce || 1);
    var J0 = s.J0;
    var bs = s.bounces;
    var now = s.step;

    // precompute per-bounce amplitude
    var amps = s._amps || (s._amps = []);
    amps.length = bs.length;
    for (var a = 0; a < bs.length; a++) amps[a] = forcing * Math.exp(-(now - bs[a].t) / Me);

    var img = s.img;
    if (!img || img.width !== GW || img.height !== GH) {
      img = s.img = ctx.createImageData(GW, GH);
      var dd = img.data;
      for (var q = 3; q < dd.length; q += 4) dd[q] = 255;
    }
    var data = img.data;
    // evaluate field H over the grid (bounded: GW*GH*bounces, bounces <= ~126)
    var Hmax = 1e-3;
    var buf = s._field || (s._field = new Float32Array(GW * GH));
    for (var y = 0; y < GH; y++) {
      var row = y * GW;
      for (var x = 0; x < GW; x++) {
        var Hsum = 0;
        for (var n = 0; n < bs.length; n++) {
          var b = bs[n];
          var dx = x - b.x, dy = y - b.y;
          var r = Math.sqrt(dx * dx + dy * dy);
          Hsum += amps[n] * J0(kF * r);
        }
        if (!isFinite(Hsum)) Hsum = 0;
        buf[row + x] = Hsum;
        var ab = Hsum < 0 ? -Hsum : Hsum;
        if (ab > Hmax) Hmax = ab;
      }
    }
    // running normalizer to keep ridges bright but stable
    s.Hmax = s.Hmax * 0.85 + Hmax * 0.15;
    var norm = s.Hmax > 1e-3 ? s.Hmax : 1;

    for (var i = 0; i < GW * GH; i++) {
      var Hv = buf[i] / norm;
      if (Hv < -1) Hv = -1; else if (Hv > 1) Hv = 1;
      var m = 0.5 + 0.5 * Hv;
      var g = LABUTIL.smoothstep(0.5, 0.95, m);
      var o = i * 4;
      data[o] = 255 * g;
      data[o + 1] = 165 * g * g;
      data[o + 2] = 55 * g * g * g;
    }

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    var off = s._off;
    if (!off) {
      try { off = s._off = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(GW, GH) : null; } catch (e) { off = s._off = null; }
      if (off) s._offctx = off.getContext('2d');
    }
    var prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if (off && s._offctx) {
      s._offctx.putImageData(img, 0, 0);
      ctx.drawImage(off, 0, 0, GW, GH, 0, 0, w, h);
    } else {
      ctx.putImageData(img, 0, 0);
      if (ctx.canvas) ctx.drawImage(ctx.canvas, 0, 0, GW, GH, 0, 0, w, h);
    }

    var sxp = w / GW, syp = h / GH;
    // faint bath boundary
    var cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.46;
    ctx.strokeStyle = 'rgba(255,170,70,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, LABUTIL.TAU);
    ctx.stroke();

    // droplet trail (low-alpha amber)
    var tr = s.trail;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (var k = 0; k < tr.length; k++) {
      var px = tr[k][0] * sxp, py = tr[k][1] * syp;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(255,180,80,0.22)';
    ctx.stroke();

    // droplet as one bright accent disc, with smooth sub-bounce interpolation from t
    var dpx = s.xd * sxp, dpy = s.yd * syp;
    ctx.beginPath();
    ctx.arc(dpx, dpy, 3.4, 0, LABUTIL.TAU);
    ctx.fillStyle = 'rgba(255,224,150,0.95)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dpx, dpy, 6.5, 0, LABUTIL.TAU);
    ctx.strokeStyle = 'rgba(255,190,90,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.imageSmoothingEnabled = prevSmooth;
  }
});

