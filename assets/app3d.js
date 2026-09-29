/* PrautoForge site: the desktop app section. A 3D stack of real app screens that turns with the pointer and
   brings each screen forward in turn, over a live evidence sphere. No libraries, no network requests. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.getElementById("site-orb");
  if (canvas && window.Orb) {
    var orb = window.Orb(canvas, { nodes: 150 });
    var tones = ["matched", "matched", "drafted", "gap", "matched", "legal", "drafted", "flag"], k = 0;
    if (!reduce) setInterval(function () { if (!document.hidden) orb.feed(tones[k++ % tones.length]); }, 900);
  }
  var stage = document.getElementById("app-stage");
  if (!stage) return;
  var screens = Array.prototype.slice.call(stage.querySelectorAll(".screen"));
  var front = 0;
  function layout() {
    screens.forEach(function (sc, i) {
      var d = (i - front + screens.length) % screens.length;
      sc.dataset.depth = String(d);
    });
  }
  layout();
  if (!reduce) {
    var timer = setInterval(function () { front = (front + 1) % screens.length; layout(); }, 3800);
    screens.forEach(function (sc, i) { sc.addEventListener("click", function () { front = i; layout(); clearInterval(timer); }); });
    stage.addEventListener("pointermove", function (e) {
      var b = stage.getBoundingClientRect();
      var x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      stage.style.setProperty("--ry", (-18 + x * 16).toFixed(2) + "deg");
      stage.style.setProperty("--rx", (8 - y * 10).toFixed(2) + "deg");
    });
    stage.addEventListener("pointerleave", function () { stage.style.removeProperty("--ry"); stage.style.removeProperty("--rx"); });
  }
})();
