/* PrautoForge site: evidence map. Draws the thread from each sample question to the approved answer it came
   from (or the person it was routed to). Pure SVG, no libraries, no network requests. */
(function () {
  "use strict";
  var map = document.getElementById("evmap");
  var svg = document.getElementById("map-lines");
  if (!map || !svg) return;
  var NS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var qs = Array.prototype.slice.call(map.querySelectorAll(".mq"));
  var es = {};
  Array.prototype.forEach.call(map.querySelectorAll(".me"), function (e) { es[e.dataset.id] = e; });
  var threads = [];
  var drawn = false;

  var draw = function () {
    svg.innerHTML = "";
    threads = [];
    if (window.getComputedStyle(svg).display === "none") return;
    var box = svg.getBoundingClientRect();
    svg.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
    qs.forEach(function (q, i) {
      var e = es[q.dataset.to];
      if (!e) return;
      var a = q.getBoundingClientRect(), b = e.getBoundingClientRect();
      var x1 = 0, y1 = a.top + a.height / 2 - box.top;
      var x2 = box.width, y2 = b.top + b.height / 2 - box.top;
      var mx = box.width / 2;
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2);
      path.setAttribute("class", "thread t-" + q.dataset.kind);
      svg.appendChild(path);
      var start = document.createElementNS(NS, "circle");
      start.setAttribute("cx", x1 + 3); start.setAttribute("cy", y1); start.setAttribute("r", 3.5);
      start.setAttribute("class", "node t-" + q.dataset.kind);
      svg.appendChild(start);
      var marker = null;
      if (q.dataset.kind === "drafted") {  // the claim guard checkpoint, half way along the thread
        var len = path.getTotalLength(), mid = path.getPointAtLength(len / 2);
        marker = document.createElementNS(NS, "g");
        marker.setAttribute("class", "guard");
        marker.setAttribute("transform", "translate(" + mid.x + "," + mid.y + ")");
        marker.innerHTML = '<circle r="9"></circle><path d="M-4,0 L-1,3 L4,-3"></path>';
        svg.appendChild(marker);
      }
      var len2 = path.getTotalLength();
      path.style.strokeDasharray = q.dataset.kind === "drafted" ? "6 5" : len2 + " " + len2;
      if (!reduce && !drawn) {
        path.style.setProperty("--len", len2);
        path.style.animationDelay = (0.15 + i * 0.12) + "s";
        path.classList.add(q.dataset.kind === "drafted" ? "fade" : "grow");
        if (marker) { marker.style.animationDelay = (0.6 + i * 0.12) + "s"; marker.classList.add("pop"); }
      }
      threads.push({ q: q, e: e, path: path, node: start, marker: marker });
    });
  };

  var focus = function (q) {
    map.classList.toggle("focused", !!q);
    threads.forEach(function (t) {
      var on = !q || t.q === q || t.e === q;
      t.path.classList.toggle("on", !!q && on);
      t.path.classList.toggle("off", !!q && !on);
      t.node.classList.toggle("off", !!q && !on);
      if (t.marker) t.marker.classList.toggle("off", !!q && !on);
      t.q.classList.toggle("on", !!q && on);
      t.e.classList.toggle("on", !!q && on);
    });
  };
  qs.forEach(function (q) {
    q.addEventListener("mouseenter", function () { focus(q); });
    q.addEventListener("focus", function () { focus(q); });
    q.addEventListener("mouseleave", function () { focus(null); });
    q.addEventListener("blur", function () { focus(null); });
  });
  Object.keys(es).forEach(function (k) {
    es[k].addEventListener("mouseenter", function () { focus(es[k]); });
    es[k].addEventListener("mouseleave", function () { focus(null); });
  });

  var start = function () { draw(); drawn = true; map.classList.add("drawn"); };
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); start(); }
    }, { threshold: 0.35 });
    io.observe(map);
    draw();  /* static threads are visible immediately; the animation replays when the map is reached */
    drawn = false;
  } else { start(); }
  var t = null;
  window.addEventListener("resize", function () { window.clearTimeout(t); t = window.setTimeout(function () { drawn = true; draw(); }, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { var d = drawn; drawn = true; draw(); drawn = d; });
})();
