/* Library atlas: a real-time 3D map of an approved answer library. Each node is one approved answer, grouped by
   topic into bands around the sphere. Hover to identify an answer, click to open it, filter by topic, search, and
   zoom. During a run each question flies to the exact answers it used, in the colour of its status.
   Canvas 2D with a perspective projection. Pauses when off screen. No libraries, no network requests. */
(function (root) {
  "use strict";
  var TONES = { matched: "88,212,154", drafted: "241,195,90", gap: "255,154,107", legal: "183,163,255",
    flag: "182,196,191", reviewed: "122,179,255", lime: "198,242,107" };
  var PALETTE = ["198,242,107", "88,212,154", "122,179,255", "183,163,255", "241,195,90", "255,154,107", "110,214,214",
    "240,150,200", "170,200,120", "150,170,255", "230,210,140", "140,220,180"];

  function Orb(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var data = opts.data && opts.data.nodes && opts.data.nodes.length ? opts.data : null;
    var topics = [], topicColor = {}, nodes = [], edges = [], particles = [], pulses = [], byId = {};
    var golden = Math.PI * (3 - Math.sqrt(5));

    if (data) {
      (data.topics || []).forEach(function (t, i) { topics.push(t.name); topicColor[t.name] = PALETTE[i % PALETTE.length]; });
      var order = data.nodes.slice().sort(function (a, b) { return topics.indexOf(a.topic) - topics.indexOf(b.topic) || String(a.id).localeCompare(String(b.id)); });
      order.forEach(function (d) { nodes.push({ d: d, topic: d.topic, glow: 0, tone: "lime", seed: Math.random() * 6.28 }); });
    } else {
      for (var q = 0; q < (opts.nodes || 130); q++) nodes.push({ d: null, topic: "", glow: 0, tone: "lime", seed: Math.random() * 6.28 });
    }
    var N = nodes.length;
    nodes.forEach(function (n, i) {  /* golden spiral in topic order: each topic becomes a band */
      var y = N > 1 ? 1 - (i / (N - 1)) * 2 : 0, r = Math.sqrt(1 - y * y), th = golden * i;
      n.x = Math.cos(th) * r; n.y = y; n.z = Math.sin(th) * r;
      if (n.d) byId[n.d.id] = i;
    });
    for (var a = 0; a < N; a++) {  /* each node links to its nearest neighbours */
      var near = [];
      for (var b = 0; b < N; b++) {
        if (a === b) continue;
        var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y, dz = nodes[a].z - nodes[b].z;
        near.push([dx * dx + dy * dy + dz * dz, b]);
      }
      near.sort(function (p, s) { return p[0] - s[0]; });
      for (var k = 0; k < Math.min(3, near.length); k++) if (near[k][1] > a) edges.push([a, near[k][1]]);
    }
    var centroids = topics.map(function (t) {
      var sx = 0, sy = 0, sz = 0, c = 0;
      nodes.forEach(function (n) { if (n.topic === t) { sx += n.x; sy += n.y; sz += n.z; c++; } });
      var len = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      return { topic: t, x: sx / len, y: sy / len, z: sz / len, n: c };
    });
    var rings = [0, 1].map(function (j) {
      var pts = []; for (var t = 0; t < 96; t++) pts.push(t / 96 * Math.PI * 2);
      return { pts: pts, tilt: j ? 1.05 : -0.55, spin: j ? -0.0022 : 0.0016, rot: 0, radius: j ? 1.28 : 1.42 };
    });

    var rx = -0.35, ry = 0, vx = 0, vy = reduce ? 0 : 0.0028, drag = null, moved = 0, hover = { x: 0, y: 0 };
    var zoom = 1, zoomTo = 1, target = null, focusTopic = null, matches = null, hot = -1, picked = -1;
    var W = 0, H = 0, dpr = 1, running = false, raf = 0, last = 0, visible = true, P = [];
    var spin = function () { return reduce || picked >= 0 || hot >= 0 ? 0 : 0.0028; };

    function resize() {
      var box = canvas.getBoundingClientRect();
      dpr = Math.min(2, root.devicePixelRatio || 1);
      W = Math.max(1, box.width); H = Math.max(1, box.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw(0);
    }
    function project(p, cx, cy, R) {
      var cy1 = Math.cos(ry), sy1 = Math.sin(ry), cx1 = Math.cos(rx + hover.y * 0.12), sx1 = Math.sin(rx + hover.y * 0.12);
      var x = p.x * cy1 - p.z * sy1, z = p.x * sy1 + p.z * cy1;
      var y = p.y * cx1 - z * sx1; z = p.y * sx1 + z * cx1;
      var s = 3.2 / (3.2 + z);
      return { x: cx + x * R * s, y: cy + y * R * s, z: z, s: s };
    }
    function base(n) { return n.d ? topicColor[n.topic] || PALETTE[0] : TONES.lime; }
    function dimmed(i) {
      var n = nodes[i];
      if (matches) return !matches[i];
      return focusTopic !== null && n.topic !== focusTopic;
    }
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      zoom += (zoomTo - zoom) * 0.15;
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34 * zoom;
      var glowBg = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);
      glowBg.addColorStop(0, "rgba(198,242,107,0.09)"); glowBg.addColorStop(1, "rgba(198,242,107,0)");
      ctx.fillStyle = glowBg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 6.283); ctx.fill();
      rings.forEach(function (ring) {
        ring.rot += ring.spin * (dt || 16) / 16;
        ring.pts.forEach(function (t) {
          var px = Math.cos(t + ring.rot) * ring.radius, pz = Math.sin(t + ring.rot) * ring.radius;
          var p = project({ x: px, y: pz * Math.sin(ring.tilt), z: pz * Math.cos(ring.tilt) }, cx, cy, R);
          ctx.fillStyle = "rgba(198,242,107," + (0.07 + (1 - p.z) * 0.1).toFixed(3) + ")";
          ctx.fillRect(p.x, p.y, 1.4 * p.s, 1.4 * p.s);
        });
      });
      P = nodes.map(function (n) { return project(n, cx, cy, R); });
      ctx.lineWidth = 1;
      edges.forEach(function (e) {
        var p = P[e[0]], q = P[e[1]], depth = (p.z + q.z) / 2, na = nodes[e[0]], nb = nodes[e[1]];
        var same = na.topic === nb.topic;
        var alpha = (0.04 + (1 - depth) * 0.12) * (same ? 1.25 : 0.6);
        if (dimmed(e[0]) || dimmed(e[1])) alpha *= 0.25;
        var g = Math.max(na.glow, nb.glow), rgb = g > 0.05 ? TONES[na.glow >= nb.glow ? na.tone : nb.tone] : (same && na.d ? base(na) : "157,210,190");
        if (e[0] === hot || e[1] === hot || e[0] === picked || e[1] === picked) { alpha += 0.35; rgb = base(nodes[e[0] === hot || e[0] === picked ? e[0] : e[1]]); }
        ctx.strokeStyle = "rgba(" + rgb + "," + Math.min(1, alpha + g * 0.5).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      });
      var order = P.map(function (p, i) { return i; }).sort(function (a2, b2) { return P[b2].z - P[a2].z; });
      var now = performance.now() / 1000;
      order.forEach(function (i) {
        var p = P[i], n = nodes[i], d = n.d || {};
        var tw = 0.78 + 0.22 * Math.sin(now * 1.6 + n.seed);
        var rad = (1.4 + (1 - p.z) * 1.4) * p.s * (n.d ? 1.25 : 1) + n.glow * 3.5 + Math.min(3, (d.used || 0) * 0.6);
        var a = (0.28 + (1 - p.z) * 0.45) * tw + n.glow * 0.6;
        if (dimmed(i)) a *= 0.18;
        if (matches && matches[i]) a = Math.max(a, 0.95);
        var rgb = n.glow > 0.05 ? TONES[n.tone] : base(n);
        if (n.glow > 0.05 || i === hot || i === picked || (matches && matches[i])) {
          var hl = Math.max(n.glow, i === hot || i === picked ? 0.8 : 0.5);
          var halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 5);
          halo.addColorStop(0, "rgba(" + rgb + "," + (hl * 0.5).toFixed(3) + ")"); halo.addColorStop(1, "rgba(" + rgb + ",0)");
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 5, 0, 6.283); ctx.fill();
        }
        if (d.state === "expired") {
          ctx.strokeStyle = "rgba(" + TONES.gap + "," + Math.min(1, a + 0.2).toFixed(3) + ")"; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(p.x, p.y, rad + 0.6, 0, 6.283); ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(" + (d.state === "set aside" ? TONES.flag : rgb) + "," + Math.min(1, a).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(p.x, p.y, d.state === "set aside" ? rad * 0.7 : rad, 0, 6.283); ctx.fill();
        }
        if (i === picked || i === hot) {
          ctx.strokeStyle = "rgba(255,255,255," + (i === picked ? 0.95 : 0.6) + ")"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, rad + 4, 0, 6.283); ctx.stroke();
        }
        n.glow = Math.max(0, n.glow - (dt || 16) / 2200);
      });
      if (data && (opts.labels !== false)) {  /* topic names on the side facing the viewer */
        ctx.font = "600 10.5px 'Geist Mono', Consolas, monospace"; ctx.textAlign = "center";
        centroids.forEach(function (c) {
          var p = project(c, cx, cy, R * 1.06);
          if (p.z > -0.25 || c.n < 2 || p.y < 46 || p.y > H - 60) return;
          var on = focusTopic === null || focusTopic === c.topic;
          ctx.fillStyle = "rgba(" + topicColor[c.topic] + "," + ((on ? 0.9 : 0.25) * Math.min(1, -p.z * 2.2)).toFixed(3) + ")";
          ctx.fillText(c.topic.toUpperCase(), p.x, p.y);
        });
      }
      particles = particles.filter(function (pt) {
        pt.t += (dt || 16) / pt.dur;
        var tg = P[pt.node], e = Math.min(1, pt.t), ease = 1 - Math.pow(1 - e, 3);
        var mx = (pt.sx + tg.x) / 2 + pt.bend, my = (pt.sy + tg.y) / 2 - Math.abs(pt.bend) * 0.6;
        var x = (1 - ease) * (1 - ease) * pt.sx + 2 * (1 - ease) * ease * mx + ease * ease * tg.x;
        var y = (1 - ease) * (1 - ease) * pt.sy + 2 * (1 - ease) * ease * my + ease * ease * tg.y;
        pt.trail.push([x, y]); if (pt.trail.length > 14) pt.trail.shift();
        for (var j = 1; j < pt.trail.length; j++) {
          ctx.strokeStyle = "rgba(" + TONES[pt.tone] + "," + (j / pt.trail.length * 0.8).toFixed(3) + ")";
          ctx.lineWidth = 2 * j / pt.trail.length;
          ctx.beginPath(); ctx.moveTo(pt.trail[j - 1][0], pt.trail[j - 1][1]); ctx.lineTo(pt.trail[j][0], pt.trail[j][1]); ctx.stroke();
        }
        if (e >= 1) { nodes[pt.node].glow = 1; nodes[pt.node].tone = pt.tone; pulses.push({ node: pt.node, tone: pt.tone, t: 0 }); return false; }
        return true;
      });
      pulses = pulses.filter(function (pu) {
        pu.t += (dt || 16) / 900;
        var p = P[pu.node];
        ctx.strokeStyle = "rgba(" + TONES[pu.tone] + "," + (0.7 * (1 - pu.t)).toFixed(3) + ")"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 + pu.t * 26 * p.s, 0, 6.283); ctx.stroke();
        return pu.t < 1;
      });
      if (hot >= 0 && opts.onHover) { var hp = P[hot]; opts.onHover(nodes[hot].d, hp.x, hp.y); }
    }
    function frame(ts) {
      var dt = last ? Math.min(48, ts - last) : 16; last = ts;
      if (target) {  /* turn smoothly until the chosen answer faces the viewer */
        var dy2 = target.ry - ry, dx2 = target.rx - rx;
        dy2 = Math.atan2(Math.sin(dy2), Math.cos(dy2));
        ry += dy2 * 0.12; rx += dx2 * 0.12; vx = 0; vy = 0;
        if (Math.abs(dy2) < 0.002 && Math.abs(dx2) < 0.002) target = null;
      } else if (!drag) { ry += vy * dt / 16; rx += vx * dt / 16; vx *= 0.94; vy += (spin() - vy) * 0.02; }
      rx = Math.max(-1.3, Math.min(1.3, rx));
      draw(dt);
      raf = root.requestAnimationFrame(frame);
    }
    function play() { if (!running && visible && !reduce) { running = true; last = 0; raf = root.requestAnimationFrame(frame); } }
    function stop() { running = false; root.cancelAnimationFrame(raf); }
    function faceNode(i) {  /* rotation that brings node i to the front */
      var n = nodes[i];
      var ty = Math.atan2(-n.x, -n.z);
      var zAfter = n.x * Math.sin(ty) + n.z * Math.cos(ty);
      target = { ry: ty, rx: Math.max(-1.2, Math.min(1.2, Math.atan2(-n.y, -zAfter))) };
      if (reduce) { ry = target.ry; rx = target.rx; target = null; draw(0); }
    }
    function pick(x, y) {
      var best = -1, bd = 14 * 14;
      P.forEach(function (p, i) {
        if (p.z > 0.35 || (dimmed(i) && !matches)) return;
        var d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }

    canvas.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY }; moved = 0; target = null; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", function (e) {
      var box = canvas.getBoundingClientRect(), lx = e.clientX - box.left, ly = e.clientY - box.top;
      hover.x = (lx / box.width - 0.5) * 2; hover.y = (ly / box.height - 0.5) * 2;
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        moved += Math.abs(dx) + Math.abs(dy);
        ry += dx * 0.008 / zoom; rx += dy * 0.008 / zoom; vy = dx * 0.0016; vx = dy * 0.0016;
        drag = { x: e.clientX, y: e.clientY };
      }
      if (data && !drag) {
        var i = pick(lx, ly);
        if (i !== hot) { hot = i; canvas.style.cursor = i >= 0 ? "pointer" : ""; if (i < 0 && opts.onHover) opts.onHover(null); }
      }
      if (!running) draw(0);
    });
    function release(e) {
      if (drag && moved < 6 && data) {
        var box = canvas.getBoundingClientRect(), i = pick(e.clientX - box.left, e.clientY - box.top);
        picked = i;
        if (i >= 0) faceNode(i);
        if (opts.onSelect) opts.onSelect(i >= 0 ? nodes[i].d : null);
      }
      drag = null;
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", function () { drag = null; });
    canvas.addEventListener("pointerleave", function () { hover.x = 0; hover.y = 0; if (hot >= 0) { hot = -1; if (opts.onHover) opts.onHover(null); } });
    canvas.addEventListener("wheel", function (e) {  /* zoom with Ctrl or a trackpad pinch; plain scrolling still scrolls the page */
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); zoomTo = Math.max(0.7, Math.min(2.6, zoomTo * (e.deltaY < 0 ? 1.12 : 0.89)));
    }, { passive: false });
    if (root.ResizeObserver) new ResizeObserver(resize).observe(canvas); else root.addEventListener("resize", resize);
    if (root.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) play(); else stop(); }).observe(canvas);
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
    resize(); play();

    function randomStart() {
      var side = Math.random();
      return [side < 0.5 ? (Math.random() < 0.5 ? -20 : W + 20) : Math.random() * W, side < 0.5 ? Math.random() * H : (Math.random() < 0.5 ? -20 : H + 20)];
    }
    return {
      /* a question arrives and lights the answers it used (or a random node without library data) */
      feed: function (tone, ids) {
        var targets = (ids || []).map(function (id) { return byId[id]; }).filter(function (i) { return i !== undefined; });
        if (!targets.length) targets = [Math.floor(Math.random() * N)];
        var s = randomStart(), bend = (Math.random() - 0.5) * 120;
        targets.forEach(function (i, k) {
          particles.push({ node: i, tone: TONES[tone] ? tone : "lime", t: -k * 0.12, dur: 650 + Math.random() * 400, sx: s[0], sy: s[1], bend: bend, trail: [] });
        });
        if (!running) draw(0);
      },
      light: function (tone) { var n = nodes[Math.floor(Math.random() * N)]; n.glow = 1; n.tone = tone; },
      topics: function () { return topics.map(function (t) { return { name: t, color: "rgb(" + topicColor[t] + ")", n: centroids[topics.indexOf(t)].n }; }); },
      filter: function (topic) {
        focusTopic = topic; matches = null;
        if (topic !== null) { var c = centroids[topics.indexOf(topic)]; if (c) { var i = 0, best = 9; nodes.forEach(function (n, j) { var d = Math.abs(n.x - c.x) + Math.abs(n.y - c.y) + Math.abs(n.z - c.z); if (n.topic === topic && d < best) { best = d; i = j; } }); faceNode(i); } }
        if (!running) draw(0);
      },
      search: function (text) {
        var q = String(text || "").trim().toLowerCase();
        if (!q) { matches = null; if (!running) draw(0); return 0; }
        matches = {}; var first = -1, count = 0;
        nodes.forEach(function (n, i) {
          var d = n.d || {};
          if ((d.id + " " + d.topic + " " + d.q + " " + d.a + " " + d.ref).toLowerCase().indexOf(q) >= 0) { matches[i] = true; count++; if (first < 0) first = i; }
        });
        if (first >= 0) faceNode(first);
        if (!running) draw(0);
        return count;
      },
      where: function (id) { var i = byId[id]; return i === undefined || !P[i] ? null : { x: P[i].x, y: P[i].y, front: P[i].z < 0 }; },
      select: function (id) { var i = byId[id]; picked = i === undefined ? -1 : i; if (picked >= 0) faceNode(picked); if (!running) draw(0); },
      zoom: function (f) { zoomTo = Math.max(0.7, Math.min(2.6, zoomTo * f)); if (reduce) { zoom = zoomTo; draw(0); } },
      reset: function () { zoomTo = 1; focusTopic = null; matches = null; picked = -1; target = { ry: 0, rx: -0.35 }; },
      stop: stop, play: play
    };
  }
  root.Orb = Orb;
})(typeof window !== "undefined" ? window : this);
