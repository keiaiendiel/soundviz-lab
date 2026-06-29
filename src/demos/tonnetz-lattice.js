LAB.register({
  id: 'tonnetz-lattice',
  title: 'Tonnetz Harmonic Lattice',
  group: 'Frequency synthesis',
  essence: 'The neo-Riemannian Tonnetz drawn as a triangular pitch-class lattice; a moving chord lights the two triangles of its major and minor triads.',
  blurb: "Twelve pitch classes sit on a triangular grid whose horizontal axis is the perfect fifth and whose diagonal is the major third, so any small triangle is a major or minor triad sharing two notes with each neighbour. A clock-driven chord walks the lattice by L, R and P moves; the active triad's triangle fills, its three vertices brighten, and a faint after-glow on recently lit triangles traces the harmonic path across the net.",
  tags: ['glyph', 'line', 'field', 'monochrome', 'slow'],
  lineage: "Euler's Tonnetz (1739); revived in neo-Riemannian theory (Hugo Riemann; Richard Cohn, 1990s). The torus topology and L/R/P parsimonious voice-leading transforms are the modern reading.",
  dialect: 'Modal Coordinate Grid',
  palette: 'Monochrome line net in dim warm grey on near-black; vertices as small open circles. Active triad triangle filled at low warm-white alpha, its three vertices solid; the single amber accent reserved for the chord ROOT vertex. After-glow triangles fade warm-grey to nothing.',
  paramNotes: 'tempo drives how fast the chord steps through transforms. latticeSize sets how many rows/cols of the infinite lattice are drawn. glowDecay sets how long passed triads stay lit. transformMix biases the random walk between Leading-tone, Relative and Parallel moves. showLabels toggles pitch-class numerals. Audio: a.centroid selects the active pitch region (nodes near that pitch class glow), a.bands light individual pitch-class nodes, and a.level sets the overall triad and after-glow brightness.',
  params: [
    { key: 'tempo', label: 'Chord tempo', min: 0.1, max: 3, step: 0.1, value: 0.6 },
    { key: 'lattaceSize', label: 'Lattice extent', min: 3, max: 9, step: 1, value: 6 },
    { key: 'glowDecay', label: 'Glow decay', min: 0.3, max: 6, step: 0.1, value: 2.5 },
    { key: 'transformMix', label: 'L / R / P bias', min: 0, max: 1, step: 0.05, value: 0.5 },
    { key: 'showLabels', label: 'Show pitch labels', min: 0, max: 1, step: 1, value: 1 },
    { key: 'react', label: 'Audio drive', min: 0, max: 1.5, step: 0.05, value: 0.85 }
  ],
  init(s, w, h) {
    // a triad is three lattice nodes; each node {a,b}. Start on C major: (0,0)=C, (1,0)=G, (0,1)=E.
    s.triad = [{ a: 0, b: 0 }, { a: 1, b: 0 }, { a: 0, b: 1 }];
    s.isMajor = true;            // orientation flag
    s.chordPhase = 0;
    s.last = 0;
    s.glow = [];                 // {nodes:[3], life}
    s.rng = LABUTIL.mulberry32(0x7a3b91);
    s.names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  },
  // pitch class of a lattice node
  _pc: function (a, b) { return ((7 * a + 4 * b) % 12 + 12) % 12; },
  // apply one neo-Riemannian transform to current triad in place
  _transform: function (s, kind) {
    var nodes = s.triad;
    var a0 = Math.min(nodes[0].a, nodes[1].a, nodes[2].a);
    var b0 = Math.min(nodes[0].b, nodes[1].b, nodes[2].b);
    var maj = s.isMajor;
    var na, nb, nmaj;
    if (maj) {
      // UP triangle anchored at (a0,b0): pcs p, p+7(fifth), p+4(third)
      if (kind === 'P') { na = a0; nb = b0; nmaj = false; }            // same fifth edge
      else if (kind === 'L') { na = a0; nb = b0 + 1; nmaj = false; }   // pivot on major-third edge upward
      else { na = a0 + 1; nb = b0 - 1; nmaj = false; }                 // R: other major-third edge
    } else {
      if (kind === 'P') { na = a0; nb = b0; nmaj = true; }
      else if (kind === 'L') { na = a0; nb = b0 - 1; nmaj = true; }
      else { na = a0 - 1; nb = b0 + 1; nmaj = true; }
    }
    // wrap the root coords into a window so the chord does not wander off forever
    var span = 7;
    if (na > span) na -= span; else if (na < -span) na += span;
    if (nb > span) nb -= span; else if (nb < -span) nb += span;
    s.isMajor = nmaj;
    if (nmaj) {
      s.triad = [{ a: na, b: nb }, { a: na + 1, b: nb }, { a: na, b: nb + 1 }];
    } else {
      // minor triad: nodes giving {p, p+3, p+7} = (na,nb),(na+1,nb),(na+1,nb-1)
      s.triad = [{ a: na, b: nb }, { a: na + 1, b: nb }, { a: na + 1, b: nb - 1 }];
    }
  },
  draw(ctx, w, h, t, p, s, theme, a) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);

    var tempo = LABUTIL.clamp(p.tempo, 0.1, 3);
    var ext = Math.round(LABUTIL.clamp(p.lattaceSize, 3, 9));
    var glowDecay = LABUTIL.clamp(p.glowDecay, 0.3, 6);
    var mix = LABUTIL.clamp(p.transformMix, 0, 1);
    var showLabels = p.showLabels >= 0.5;

    // audio: centroid selects pitch region, bands light nodes, level sets glow
    var react = (p.react == null ? 0.85 : p.react);
    var aLevel = LABUTIL.clamp(a.level, 0, 1);
    var aCent = LABUTIL.clamp(a.centroid, 0, 1);
    var bands = a.bands;
    var nb = bands.length;
    var centerPc = LABUTIL.clamp(Math.round(aCent * 11), 0, 11) | 0;
    var glowMul = LABUTIL.clamp(0.5 + react * aLevel, 0, 1.5);

    var dt = t - s.last;
    if (!isFinite(dt) || dt < 0) dt = 1 / 60;
    if (dt > 0.25) dt = 0.25;
    s.last = t;

    // advance chord clock; step transforms when crossing integer
    s.chordPhase += tempo * dt;
    var steps = Math.floor(s.chordPhase);
    if (steps > 0) {
      if (steps > 4) steps = 4;
      s.chordPhase -= Math.floor(s.chordPhase);
      for (var st = 0; st < steps; st++) {
        // push current triad to glow
        s.glow.push({ nodes: [{ a: s.triad[0].a, b: s.triad[0].b }, { a: s.triad[1].a, b: s.triad[1].b }, { a: s.triad[2].a, b: s.triad[2].b }], life: 1 });
        // choose transform by transformMix bias: low mix favours L, high favours P, mid R
        var r = s.rng();
        var kind;
        var wL = 0.34 + 0.4 * (1 - mix);
        var wP = 0.34 + 0.4 * mix;
        var wR = 1;
        var sum = wL + wP + wR;
        var pick = r * sum;
        if (pick < wL) kind = 'L';
        else if (pick < wL + wR) kind = 'R';
        else kind = 'P';
        this._transform(s, kind);
      }
    }
    // decay glow
    for (var gi = s.glow.length - 1; gi >= 0; gi--) {
      s.glow[gi].life -= dt / glowDecay;
      if (s.glow[gi].life <= 0) s.glow.splice(gi, 1);
    }
    if (s.glow.length > 40) s.glow.splice(0, s.glow.length - 40);

    // lattice basis
    var cell = Math.min(w, h) / (ext * 2 + 2.5);
    var ox = w * 0.5, oy = h * 0.5;
    function pos(a, b) {
      return {
        x: ox + a * cell + b * cell * 0.5,
        y: oy - b * cell * 0.866
      };
    }

    // draw lattice edges
    ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var a = -ext; a <= ext; a++) {
      for (var b = -ext; b <= ext; b++) {
        var P0 = pos(a, b);
        var nbrs = [[a + 1, b], [a, b + 1], [a + 1, b - 1]];
        for (var e = 0; e < 3; e++) {
          var bb = nbrs[e];
          if (bb[0] < -ext || bb[0] > ext || bb[1] < -ext || bb[1] > ext) continue;
          var P1 = pos(bb[0], bb[1]);
          ctx.moveTo(P0.x, P0.y);
          ctx.lineTo(P1.x, P1.y);
        }
      }
    }
    ctx.stroke();

    // glow triangles
    for (var g = 0; g < s.glow.length; g++) {
      var gl = s.glow[g];
      var q0 = pos(gl.nodes[0].a, gl.nodes[0].b);
      var q1 = pos(gl.nodes[1].a, gl.nodes[1].b);
      var q2 = pos(gl.nodes[2].a, gl.nodes[2].b);
      ctx.fillStyle = LABUTIL.rgba(theme.ink, LABUTIL.clamp(0.15 * LABUTIL.clamp(gl.life, 0, 1) * glowMul, 0, 1));
      ctx.beginPath();
      ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.closePath();
      ctx.fill();
    }

    // active triad fill + edges
    var t0 = pos(s.triad[0].a, s.triad[0].b);
    var t1 = pos(s.triad[1].a, s.triad[1].b);
    var t2 = pos(s.triad[2].a, s.triad[2].b);
    ctx.fillStyle = LABUTIL.rgba(theme.ink, LABUTIL.clamp(0.30 * glowMul, 0, 0.6));
    ctx.beginPath();
    ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = LABUTIL.rgba(theme.ink, 0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // node circles across the lattice
    for (var aa = -ext; aa <= ext; aa++) {
      for (var b2 = -ext; b2 <= ext; b2++) {
        var Pn = pos(aa, b2);
        // node lighting: this pitch class' band energy, raised near the centroid region
        var pc = this._pc(aa, b2);
        var bidx = LABUTIL.clamp(Math.round(pc / 11 * (nb - 1)), 0, nb - 1) | 0;
        var bandE = LABUTIL.clamp(bands[bidx], 0, 1);
        var dpc = Math.abs(pc - centerPc); if (dpc > 6) dpc = 12 - dpc;
        var region = 1 - dpc / 6;
        var nodeGlow = LABUTIL.clamp(react * (0.7 * bandE) * (0.4 + 0.6 * region), 0, 1);
        if (nodeGlow > 0.02) {
          ctx.fillStyle = LABUTIL.rgba(theme.ink, LABUTIL.clamp(0.5 * nodeGlow, 0, 1));
          ctx.beginPath();
          ctx.arc(Pn.x, Pn.y, 2.2 + 2.2 * nodeGlow, 0, LABUTIL.TAU);
          ctx.fill();
        }
        ctx.strokeStyle = LABUTIL.rgba(theme.dim, 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(Pn.x, Pn.y, 2.2, 0, LABUTIL.TAU);
        ctx.stroke();
        if (showLabels) {
          ctx.fillStyle = LABUTIL.rgba(theme.dim, 0.7);
          ctx.font = (cell > 26 ? 10 : 8) + 'px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(s.names[this._pc(aa, b2)], Pn.x, Pn.y - cell * 0.32);
        }
      }
    }

    // active triad vertices solid; root in amber (triad[0] is the chord root)
    var verts = [t0, t1, t2];
    for (var v = 0; v < 3; v++) {
      ctx.fillStyle = (v === 0) ? LABUTIL.rgba(theme.accent, 1) : LABUTIL.rgba(theme.ink, 1);
      ctx.beginPath();
      ctx.arc(verts[v].x, verts[v].y, v === 0 ? 4 : 3.2, 0, LABUTIL.TAU);
      ctx.fill();
    }
  }
});

