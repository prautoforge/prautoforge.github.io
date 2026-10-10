/* Platform switcher: preselects the visitor's own system, then keeps the requirements line, the file name and
   every Buy button in step with the chosen platform. */
(function () {
  "use strict";
  var radios = document.querySelectorAll('.platforms input[name="platform"]');
  if (!radios.length) return;
  function detect() {
    var ua = navigator.userAgent.toLowerCase();
    if (/android|iphone|ipad|ipod/.test(ua)) return "";
    var p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ua).toLowerCase();
    if (p.indexOf("win") >= 0) return "windows";
    if (p.indexOf("mac") >= 0) return "macos";
    if (p.indexOf("linux") >= 0 || p.indexOf("x11") >= 0) return "linux";
    return "";
  }
  function set(sel, text) { document.querySelectorAll(sel).forEach(function (el) { el.textContent = text; }); }
  function apply(r) {
    document.querySelectorAll('a[data-action="checkout"]').forEach(function (a) { a.href = r.dataset.url; });
    document.querySelectorAll('a[data-action="trial"]').forEach(function (a) {
      a.hidden = !r.dataset.trial; if (r.dataset.trial) a.href = r.dataset.trial;
    });
    set("[data-plat-name]", r.dataset.name);
    set("[data-plat-req]", r.dataset.req);
    set("[data-plat-file]", r.dataset.file);
  }
  var own = detect();
  radios.forEach(function (r) {
    if (!r.disabled && r.value === own) r.checked = true;
    r.addEventListener("change", function () { if (r.checked) apply(r); });
  });
  var picked = document.querySelector('.platforms input[name="platform"]:checked:not(:disabled)');
  if (picked) apply(picked);
})();
