/* PrautoForge site: the library atlas section. The same atlas as the app, on the fictional sample library.
   Hover, click, filter by topic, search, zoom, and replay the sample run. No libraries, no network requests. */
(function () {
  "use strict";
  var data = window.SAMPLE_LIBRARY, canvas = document.getElementById("atlas-canvas");
  if (!data || !canvas || !window.Orb) return;
  var box = document.getElementById("atlas-box"), tip = document.getElementById("atlas-tip"), card = document.getElementById("atlas-card");
  var legend = document.getElementById("atlas-legend"), search = document.getElementById("atlas-search"), status = document.getElementById("atlas-status");
  var topic = null, timer = 0;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  var orb = window.Orb(canvas, { data: data, onHover: hover, onSelect: select });

  function hover(d, x, y) {
    if (!d) { tip.hidden = true; return; }
    tip.hidden = false; tip.textContent = "";
    tip.appendChild(el("b", "", d.id)); tip.appendChild(el("span", "", d.q));
    tip.style.left = Math.max(8, Math.min(box.clientWidth - 250, x + 14)) + "px"; tip.style.top = Math.max(8, y - 12) + "px";
  }
  function select(d) {
    tip.hidden = true;
    box.classList.toggle("carded", !!d);
    if (!d) { card.hidden = true; return; }
    card.hidden = false; card.textContent = "";
    var head = el("div", "ac-head");
    head.appendChild(el("span", "ac-id", d.id)); head.appendChild(el("span", "ac-state " + d.state.replace(" ", "-"), d.state));
    var x = el("button", "ac-close", "×"); x.type = "button"; x.setAttribute("aria-label", "Close");
    x.addEventListener("click", function () { card.hidden = true; box.classList.remove("carded"); orb.select(null); });
    head.appendChild(x); card.appendChild(head);
    card.appendChild(el("p", "ac-q", d.q)); card.appendChild(el("p", "ac-a", d.a));
    var dl = el("dl");
    [["Topic", d.topic], ["Evidence", d.ref], ["Approved", d.by + (d.on ? ", " + d.on : "")], ["Expires", d.exp || "No expiry"],
      ["Shareable", d.share ? "Yes" : "No"], ["Used in the sample run", d.used ? d.used + (d.used === 1 ? " question" : " questions") : "Not used"]]
      .forEach(function (f) { dl.appendChild(el("dt", "", f[0])); dl.appendChild(el("dd", "", f[1] || "Not recorded")); });
    card.appendChild(dl);
  }
  var panel = document.getElementById("atlas-topics");
  function choose(name) { topic = topic === name ? null : name; orb.filter(topic); panel.hidden = true; drawLegend(); }
  function chip(t, cls) {
    var b = el("button", cls || "atlas-chip"); b.type = "button"; b.setAttribute("aria-pressed", topic === t.name ? "true" : "false");
    var dot = el("i"); dot.style.background = t.color; b.appendChild(dot); b.appendChild(el("span", "", t.name)); b.appendChild(el("b", "", String(t.n)));
    b.addEventListener("click", function () { choose(t.name); });
    return b;
  }
  /* one row of whole chips; the topics that do not fit are listed under "N more" */
  function drawLegend() {
    legend.textContent = "";
    var all = orb.topics();
    var ordered = all.filter(function (t) { return t.name === topic; }).concat(all.filter(function (t) { return t.name !== topic; }));
    var chips = ordered.map(function (t) { return chip(t); }), shown = chips.length, more = null;
    chips.forEach(function (c) { legend.appendChild(c); });
    while (legend.scrollWidth > legend.clientWidth + 1 && shown > 0) {
      legend.removeChild(chips[--shown]);
      if (!more) {
        more = el("button", "atlas-chip more"); more.type = "button";
        more.addEventListener("click", function (e) {
          e.stopPropagation(); panel.textContent = "";
          all.forEach(function (t) { var b = chip(t, "atlas-topic" + (topic === t.name ? " on" : "")); panel.appendChild(b); });
          panel.hidden = !panel.hidden;
        });
        legend.appendChild(more);
      }
      more.textContent = (all.length - shown) + " more";
    }
  }
  document.addEventListener("click", function () { panel.hidden = true; });
  panel.addEventListener("click", function (e) { e.stopPropagation(); });
  if (window.ResizeObserver) { var lastW = 0; new ResizeObserver(function () { if (box.clientWidth !== lastW) { lastW = box.clientWidth; drawLegend(); } }).observe(box); }
  drawLegend();
  search.addEventListener("input", function () { var n = orb.search(search.value); search.classList.toggle("none", !!search.value && !n); });
  document.getElementById("atlas-in").addEventListener("click", function () { orb.zoom(1.25); });
  document.getElementById("atlas-out").addEventListener("click", function () { orb.zoom(0.8); });
  document.getElementById("atlas-reset").addEventListener("click", function () {
    orb.reset(); topic = null; drawLegend(); search.value = ""; card.hidden = true; box.classList.remove("carded");
  });
  var play = document.getElementById("atlas-run");
  play.addEventListener("click", function () {
    clearInterval(timer);
    var i = 0;
    play.disabled = true;
    timer = setInterval(function () {
      var r = data.run[i++];
      if (!r) { clearInterval(timer); play.disabled = false; status.textContent = "Sample run finished: 40 questions, each traced to the answers it used."; return; }
      orb.feed(r.tone, r.ev);
      status.textContent = r.ref + ": " + r.q;
    }, 420);
  });
})();
