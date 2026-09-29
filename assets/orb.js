/* Evidence sphere: a real-time 3D view of an answer library. Each node is an approved answer; questions fly in
   as particles and light the node they matched, in the colour of their status. Canvas 2D with a perspective
   projection, drag to rotate with inertia. Pauses when off screen. No libraries, no network requests. */
(function (root) {
  "use strict";
  var TONES = { matched: "88,212,154", drafted: "241,195,90", gap: "255,154,107", legal: "183,163,255",
    flag: "182,196,191", reviewed: "122,179,255", lime: "198,242,107" };

  function Orb(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var N = opts.nodes || 130;
    var nodes = [], edges = [], particles = [], pulses = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      nodes.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r, glow: 0, tone: "lime", seed: Math.random() * 6.28 });
    }
    for (var a = 0; a < N; a++) {  /* connect each node to its nearest neighbours */
      var near = [];
      for (var b = 0; b < N; b++) {
        if (a === b) continue;
        var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y, dz = nodes[a].z - nodes[b].z;
        near.push([dx * dx + dy * dy + dz * dz, b]);
      }
      near.sort(function (p, q) { return p[0] - q[0]; });
      for (var k = 0; k < 3; k++) if (near[k][1] > a) edges.push([a, near[k][1]]);
    }
    var rings = [0, 1].map(function (j) {  /* two tilted orbits for depth */
      var pts = [];
      for (var t = 0; t < 96; t++) pts.push(t / 96 * Math.PI * 2);
      return { pts: pts, tilt: j ? 1.05 : -0.55, spin: j ? -0.0022 : 0.0016, rot: 0, radius: j ? 1.28 : 1.42 };
    });
    var rx = -0.35, ry = 0, vx = 0, vy = reduce ? 0 : 0.0028, drag = null, hover = { x: 0, y: 0 };
    var W = 0, H = 0, dpr = 1, running = false, raf = 0, last = 0, visible = true;

    function resize() {
      var box = canvas.getBoundingClientRect();
      dpr = Math.min(2, root.devicePixelRatio || 1);
      W = Math.max(1, box.width); H = Math.max(1, box.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw(0);
    }
    function project(p, cx, cy, R) {
      var cy1 = Math.cos(ry), sy1 = Math.sin(ry), cx1 = Math.cos(rx + hover.y * 0.25), sx1 = Math.sin(rx + hover.y * 0.25);
      var x = p.x * cy1 - p.z * sy1, z = p.x * sy1 + p.z * cy1;
      var y = p.y * cx1 - z * sx1; z = p.y * sx1 + z * cx1;
      var s = 3.2 / (3.2 + z);
      return { x: cx + (x + hover.x * 0.08) * R * s, y: cy + y * R * s, z: z, s: s };
    }
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34;
      var glowBg = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);
      glowBg.addColorStop(0, "rgba(198,242,107,0.10)"); glowBg.addColorStop(1, "rgba(198,242,107,0)");
      ctx.fillStyle = glowBg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 6.283); ctx.fill();
      rings.forEach(function (ring) {  /* orbits drawn as depth-faded dotted ellipses */
        ring.rot += ring.spin * (dt || 16) / 16;
        ring.pts.forEach(function (t) {
          var px = Math.cos(t + ring.rot) * ring.radius, pz = Math.sin(t + ring.rot) * ring.radius;
          var p = project({ x: px, y: pz * Math.sin(ring.tilt), z: pz * Math.cos(ring.tilt) }, cx, cy, R);
          ctx.fillStyle = "rgba(198,242,107," + (0.08 + (1 - p.z) * 0.12).toFixed(3) + ")";
          ctx.fillRect(p.x, p.y, 1.4 * p.s, 1.4 * p.s);
        });
      });
      var P = nodes.map(function (n) { return project(n, cx, cy, R); });
      ctx.lineWidth = 1;
      edges.forEach(function (e) {
        var p = P[e[0]], q = P[e[1]], depth = (p.z + q.z) / 2;
        var alpha = 0.05 + (1 - depth) * 0.13;
        var g = Math.max(nodes[e[0]].glow, nodes[e[1]].glow);
        ctx.strokeStyle = g > 0.05 ? "rgba(" + TONES[nodes[e[0]].glow >= nodes[e[1]].glow ? nodes[e[0]].tone : nodes[e[1]].tone] + "," + (alpha + g * 0.5).toFixed(3) + ")"
          : "rgba(157,210,190," + alpha.toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      });
      var order = P.map(function (p, i) { return i; }).sort(function (a, b) { return P[b].z - P[a].z; });
      var now = performance.now() / 1000;
      order.forEach(function (i) {
        var p = P[i], n = nodes[i];
        var tw = 0.75 + 0.25 * Math.sin(now * 1.6 + n.seed);
        var rad = (1.3 + (1 - p.z) * 1.3) * p.s + n.glow * 3.5;
        var a = (0.25 + (1 - p.z) * 0.45) * tw + n.glow * 0.6;
        if (n.glow > 0.05) {
          var halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 5);
          halo.addColorStop(0, "rgba(" + TONES[n.tone] + "," + (n.glow * 0.55).toFixed(3) + ")");
          halo.addColorStop(1, "rgba(" + TONES[n.tone] + ",0)");
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 5, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = "rgba(" + TONES[n.glow > 0.05 ? n.tone : "lime"] + "," + Math.min(1, a).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.283); ctx.fill();
        n.glow = Math.max(0, n.glow - (dt || 16) / 1800);
      });
      particles = particles.filter(function (pt) {  /* incoming questions */
        pt.t += (dt || 16) / pt.dur;
        var target = P[pt.node], e = Math.min(1, pt.t), ease = 1 - Math.pow(1 - e, 3);
        var mx = (pt.sx + target.x) / 2 + pt.bend, my = (pt.sy + target.y) / 2 - Math.abs(pt.bend) * 0.6;
        var x = (1 - ease) * (1 - ease) * pt.sx + 2 * (1 - ease) * ease * mx + ease * ease * target.x;
        var y = (1 - ease) * (1 - ease) * pt.sy + 2 * (1 - ease) * ease * my + ease * ease * target.y;
        pt.trail.push([x, y]); if (pt.trail.length > 14) pt.trail.shift();
        for (var j = 1; j < pt.trail.length; j++) {
          ctx.strokeStyle = "rgba(" + TONES[pt.tone] + "," + (j / pt.trail.length * 0.8).toFixed(3) + ")";
          ctx.lineWidth = 2 * j / pt.trail.length;
          ctx.beginPath(); ctx.moveTo(pt.trail[j - 1][0], pt.trail[j - 1][1]); ctx.lineTo(pt.trail[j][0], pt.trail[j][1]); ctx.stroke();
        }
        if (e >= 1) {
          nodes[pt.node].glow = 1; nodes[pt.node].tone = pt.tone;
          pulses.push({ node: pt.node, tone: pt.tone, t: 0 });
          return false;
        }
        return true;
      });
      pulses = pulses.filter(function (pu) {
        pu.t += (dt || 16) / 900;
        var p = P[pu.node];
        ctx.strokeStyle = "rgba(" + TONES[pu.tone] + "," + (0.7 * (1 - pu.t)).toFixed(3) + ")";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 + pu.t * 26 * p.s, 0, 6.283); ctx.stroke();
        return pu.t < 1;
      });
    }
    function frame(ts) {
      var dt = last ? Math.min(48, ts - last) : 16; last = ts;
      if (!drag) { ry += vy * dt / 16; rx += vx * dt / 16; vx *= 0.94; vy += ((reduce ? 0 : 0.0028) - vy) * 0.02; }
      rx = Math.max(-1.3, Math.min(1.3, rx));
      draw(dt);
      raf = root.requestAnimationFrame(frame);
    }
    function play() { if (!running && visible && !reduce) { running = true; last = 0; raf = root.requestAnimationFrame(frame); } }
    function stop() { running = false; root.cancelAnimationFrame(raf); }

    canvas.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", function (e) {
      var box = canvas.getBoundingClientRect();
      hover.x = ((e.clientX - box.left) / box.width - 0.5) * 2; hover.y = ((e.clientY - box.top) / box.height - 0.5) * 2;
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      ry += dx * 0.008; rx += dy * 0.008; vy = dx * 0.0016; vx = dy * 0.0016;
      drag = { x: e.clientX, y: e.clientY };
      if (!running) draw(0);
    });
    function release() { drag = null; }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", function () { hover.x = 0; hover.y = 0; });
    if (root.ResizeObserver) new ResizeObserver(resize).observe(canvas); else root.addEventListener("resize", resize);
    if (root.IntersectionObserver) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) play(); else stop(); }).observe(canvas);
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
    resize(); play();

    return {
      /* a question arrives: particle flies in and lights a node in the status colour */
      feed: function (tone) {
        var box = { w: W, h: H }, side = Math.random();
        var sx = side < 0.5 ? (Math.random() < 0.5 ? -20 : box.w + 20) : Math.random() * box.w;
        var sy = side < 0.5 ? Math.random() * box.h : (Math.random() < 0.5 ? -20 : box.h + 20);
        particles.push({ node: Math.floor(Math.random() * N), tone: TONES[tone] ? tone : "lime", t: 0, dur: 650 + Math.random() * 400,
          sx: sx, sy: sy, bend: (Math.random() - 0.5) * 120, trail: [] });
        if (!running) draw(0);
      },
      light: function (tone) { var n = nodes[Math.floor(Math.random() * N)]; n.glow = 1; n.tone = tone; },
      stop: stop, play: play
    };
  }
  root.Orb = Orb;
})(typeof window !== "undefined" ? window : this);
