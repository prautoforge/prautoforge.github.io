/* Theme: the visitor's choice, else the system setting. Runs before first paint. No tracking. */
(function () {
  "use strict";
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem("pf-theme"); } catch (e) { /* storage blocked */ }
  var sys = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  root.dataset.theme = saved || (sys && sys.matches ? "dark" : "light");
  if (sys && sys.addEventListener) sys.addEventListener("change", function (e) { if (!saved) root.dataset.theme = e.matches ? "dark" : "light"; });
  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll(".theme-switch"), function (b) {
      b.addEventListener("click", function () {
        saved = root.dataset.theme === "dark" ? "light" : "dark";
        root.dataset.theme = saved;
        try { localStorage.setItem("pf-theme", saved); } catch (e) { /* storage blocked */ }
      });
    });
  });
})();
