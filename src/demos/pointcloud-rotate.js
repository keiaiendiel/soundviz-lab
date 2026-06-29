LAB.register({
  id: 'pointcloud-rotate',
  title: 'Rotating 3D Point Cloud',
  group: 'Particle and attractor',
  essence: 'A scanned point cloud rotating in manual 3D projection, fragments of a body.',
  blurb: 'The body as data, turning. A set of 3D points (a sampled instrument shape or a generated lattice) rotates on Y and is hand-projected to 2D, points nearer the camera brighter and larger. This is the Kurokawa point-cloud register, now a motion-graphics cliche on its own, so the discipline is to keep it sparse, monochrome and slow, a LiDAR scan of one object rather than a particle storm. The 3D anchor of the catalog.',
  tags: ['3d','particle','monochrome','slow'],
  lineage: 'Ryoichi Kurokawa subassemblies LiDAR fragments; Tarik Barri Versum navigable space. Scientific anchor: 3D point-cloud scanning, perspective projection.',
  dialect: 'Modal Coordinate Grid',
  palette: 'monochrome ink',
  paramNotes: 'Rotation speed and point count set the read; a jitter/dissolve slider that scatters points along their normals is the lever that ties it to sound (a strike scatters the cloud). Focal length changes the perspective drama. Colour stays off; depth is shown by alpha and size only. Audio: a.level speeds the rotation, a.centroid widens the dissolve spread, and a.beat scatters the cloud outward along the point normals (the strike).',
  params: [
    { key: 'rotSpeed', label: 'Rotation speed', min: 0, max: 1.5, step: 0.05, value: 0.4 },
    { key: 'points', label: 'Point count', min: 500, max: 6000, step: 100, value: 2500 },
    { key: 'jitter', label: 'Dissolve', min: 0, max: 1, step: 0.05, value: 0.15 },
    { key: 'focal', label: 'Focal length', min: 200, max: 900, step: 20, value: 500 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h){
    s.cloud = null;
    s.cloudKey = -1;
    s.proj = [];
    s.ang = 0;
    s.lastT = null;
  },
  draw(ctx, w, h, t, p, s, theme, a){
    var TAU = LABUTIL.TAU;
    var clamp = LABUTIL.clamp;
    var react = (p.react == null ? 0.85 : p.react);

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var want = Math.max(500, Math.min(6000, Math.round(p.points)));
    if (s.cloud === null || s.cloudKey !== want) {
      var rng = LABUTIL.mulberry32(0x5eed01 ^ want);
      var pts = new Array(want);
      // A sampled torso/instrument body: ellipsoidal shell plus a torus collar.
      for (var i = 0; i < want; i++) {
        var px, py, pz;
        var u = rng();
        if (u < 0.62) {
          // ellipsoid shell (the body)
          var th = rng() * TAU;
          var ph = Math.acos(2 * rng() - 1);
          var sp = Math.sin(ph);
          px = 0.62 * sp * Math.cos(th);
          py = 0.92 * Math.cos(ph);
          pz = 0.55 * sp * Math.sin(th);
        } else if (u < 0.86) {
          // torus collar around the upper third
          var a2 = rng() * TAU;
          var b2 = rng() * TAU;
          var R = 0.45, rr = 0.12;
          px = (R + rr * Math.cos(b2)) * Math.cos(a2);
          pz = (R + rr * Math.cos(b2)) * Math.sin(a2);
          py = 0.55 + rr * Math.sin(b2);
        } else {
          // sparse interior lattice points (scan dust)
          px = (rng() - 0.5) * 1.1;
          py = (rng() - 0.5) * 1.9;
          pz = (rng() - 0.5) * 1.0;
        }
        var r = Math.sqrt(px * px + py * py + pz * pz) || 1e-6;
        pts[i] = { x: px, y: py, z: pz, nx: px / r, ny: py / r, nz: pz / r };
      }
      s.cloud = pts;
      s.cloudKey = want;
    }

    var cloud = s.cloud;
    var cx = w * 0.5, cy = h * 0.5;
    var scale = Math.min(w, h) * 0.42;
    var focal = clamp(p.focal, 200, 900);
    // integrate angle so audio can change rotation speed without jumps
    if (s.lastT == null) s.lastT = t;
    var dt = t - s.lastT; if (!(dt > 0) || dt > 0.1) dt = 0.016; s.lastT = t;
    var act = clamp(Math.max(a.level, a.peak * 0.7, a.beat) * react, 0, 1);
    // silence nearly stops rotation and dissolve; sound spins and scatters
    var rotEff = p.rotSpeed * (0.06 + 1.5 * act);
    s.ang += rotEff * dt;
    var ang = s.ang;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    // own dissolve phase, gated by audio so points do not wiggle in silence
    s.dph = (s.dph || 0) + dt * 0.6 * (0.06 + 1.4 * act);
    // centroid widens the dissolve spread; beat scatters the cloud outward (the strike)
    var spread = 0.5 + 1.2 * react * a.centroid;
    var jit = clamp(p.jitter * spread + react * a.beat * 0.9, 0, 3);

    // Render at most 4000 points for the loop guard.
    var n = Math.min(cloud.length, 4000);
    var step = cloud.length / n;

    var proj = s.proj;
    var count = 0;
    for (var k = 0; k < n; k++) {
      var idx = (k * step) | 0;
      var pt = cloud[idx];
      // dissolve outward along normal, deterministic per point
      var d = jit * LABUTIL.noise2(idx * 0.137, s.dph + idx * 0.011) * 0.35;
      var x = pt.x + pt.nx * d;
      var y = pt.y + pt.ny * d;
      var z = pt.z + pt.nz * d;
      // rotate about Y
      var xr = x * ca + z * sa;
      var zr = -x * sa + z * ca;
      var yr = y;
      var denom = focal + zr * scale * 0.5;
      if (denom < 1) denom = 1;
      var sp2 = focal / denom;
      var sx = cx + xr * scale * sp2;
      var sy = cy + yr * scale * sp2;
      var depth = clamp((zr + 1) * 0.5, 0.08, 1);
      if (!proj[count]) proj[count] = { x: 0, y: 0, z: 0, d: 0, s: 0 };
      var rec = proj[count];
      rec.x = sx; rec.y = sy; rec.z = zr; rec.d = depth; rec.s = sp2;
      count++;
    }

    // sort back to front by z (nearer points drawn last, on top)
    var view = proj.slice(0, count);
    view.sort(function (m, n2) { return m.z - n2.z; });

    for (var j = 0; j < count; j++) {
      var v = view[j];
      var size = 1 + 1.7 * v.s * v.d;
      ctx.fillStyle = LABUTIL.rgba(theme.ink, 0.18 + 0.7 * v.d);
      ctx.fillRect(v.x - size * 0.5, v.y - size * 0.5, size, size);
    }
  }
});
