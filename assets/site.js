/* PrautoForge site: hero replay + claim guard demo. No tracking, no network requests. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- sticky header hairline ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- hero: replay the real sample run ---------- */
  var rowsEl = document.getElementById("rows");
  var dataEl = document.getElementById("run-data");
  if (rowsEl && dataEl) {
    var statuses = JSON.parse(dataEl.textContent || "[]");
    var rows = Array.prototype.slice.call(rowsEl.querySelectorAll(".row"));
    var tallies = {};
    Array.prototype.forEach.call(document.querySelectorAll(".tally b"), function (b) { tallies[b.dataset.k] = b; });
    var progress = document.getElementById("progress");
    var replay = document.getElementById("replay");
    var timer = null;

    var reset = function () {
      Object.keys(tallies).forEach(function (k) { tallies[k].textContent = "0"; });
      rows.forEach(function (r) { r.classList.add("pending"); r.classList.remove("active"); });
      rowsEl.style.transform = "translateY(0)";
      if (progress) progress.parentElement.style.setProperty("--p", "0%"), progress.style.width = "0%";
    };
    var step = function (i) {
      if (i > 0) rows[i - 1].classList.remove("active");
      if (i >= rows.length) {
        if (progress) progress.style.width = "100%";
        if (replay) replay.hidden = false;
        return;
      }
      var r = rows[i];
      r.classList.remove("pending");
      r.classList.add("active");
      var k = statuses[i];
      if (tallies[k]) tallies[k].textContent = String(Number(tallies[k].textContent) + 1);
      if (progress) progress.style.width = ((i + 1) / rows.length * 100).toFixed(1) + "%";
      var viewport = rowsEl.parentElement.clientHeight;
      var target = Math.max(0, r.offsetTop - viewport * 0.55);
      var max = Math.max(0, rowsEl.scrollHeight - viewport);
      rowsEl.style.transform = "translateY(" + (-Math.min(target, max)) + "px)";
      timer = window.setTimeout(function () { step(i + 1); }, i < 3 ? 520 : 300);
    };
    var play = function () {
      window.clearTimeout(timer);
      if (replay) replay.hidden = true;
      reset();
      timer = window.setTimeout(function () { step(0); }, 450);
    };
    if (replay) replay.addEventListener("click", play);
    if (!reduce) {
      if ("IntersectionObserver" in window) {
        var started = false;
        var io = new IntersectionObserver(function (entries) {
          if (!started && entries[0].isIntersecting) { started = true; io.disconnect(); play(); }
        }, { threshold: 0.3 });
        io.observe(rowsEl);
      } else { play(); }
    } else if (replay) { replay.hidden = false; }
  }

  /* ---------- claim guard demo: rules come from assets/guard.js (parity-tested with the product) ---------- */
  var G = window.PFGuard;
  if (!G) return;

  var EVIDENCE = [
    { id: "ENC-001", text: "Examplify encrypts customer data at rest using AES-256 via the cloud provider's managed key service (KMS).",
      presets: [["Accurate", "Customer data is encrypted at rest with AES-256 using the cloud provider's KMS."],
                ["Adds a certification", "Customer data is encrypted at rest with AES-256 using the cloud provider's KMS, and Examplify is ISO 27001 certified."],
                ["Adds \u201cin transit\u201d", "Customer data is encrypted in transit and at rest with AES-256 using the cloud provider's KMS."]] },
    { id: "CMP-001", text: "Examplify has completed a SOC 2 Type II examination covering the Security criterion for the period 2025-04-01 to 2026-03-31. The report is available under NDA.",
      presets: [["Accurate", "Examplify has a SOC 2 Type II report covering the Security criterion, available under NDA."],
                ["Adds FedRAMP", "Examplify is SOC 2 Type II and FedRAMP authorized."],
                ["Adds history", "Examplify passed a clean audit and has had no security incidents."]] },
    { id: "CMP-002", text: "Examplify is not ISO 27001 certified. Its security program is aligned to the SOC 2 Security criterion.",
      presets: [["Accurate", "Examplify is not ISO 27001 certified; its program is aligned to the SOC 2 Security criterion."],
                ["Drops the \u201cnot\u201d", "Examplify is ISO 27001 certified and aligned to the SOC 2 Security criterion."],
                ["Adds a scope", "Examplify is not ISO 27001 certified, and all systems are covered by its SOC 2 program."]] },
    { id: "BCP-002", text: "The documented recovery time objective is 8 hours and the recovery point objective is 24 hours for the production service.",
      presets: [["Accurate", "Our recovery time objective is 8 hours and our recovery point objective is 24 hours."],
                ["Wrong number", "Our recovery time objective is four hours and our recovery point objective is 24 hours."],
                ["Promises too much", "We guarantee 100% uptime, with recovery in under 8 hours."]] }
  ];

  var tabs = document.getElementById("ev-tabs");
  var evText = document.getElementById("ev-text");
  var evId = document.getElementById("ev-id");
  var draft = document.getElementById("draft");
  var presets = document.getElementById("presets");
  var verdict = document.getElementById("verdict");
  var list = document.getElementById("claims");
  if (!tabs || !draft) return;
  var current = EVIDENCE[0];

  var check = function () {
    var text = draft.value;
    var r = G.check(text, current.text);
    verdict.className = "verdict " + (r.ok ? "ok" : "blocked");
    verdict.querySelector(".stamp").textContent = r.ok ? "Allowed" : "Blocked";
    var msg;
    if (!text.trim()) msg = "An empty draft is never used.";
    else if (!r.ok) msg = "Discarded: it " + r.findings.join("; it ") + ". Your reviewer never sees it.";
    else msg = r.claims.length ? "Every claim in the draft is backed by " + current.id + "." : "No specific claims; the draft stays within the evidence.";
    verdict.querySelector("p").textContent = msg;
    list.innerHTML = "";
    var bad = {};
    r.unsupported.concat(r.flipped).forEach(function (k) { bad[k] = true; });
    var add = function (label, ok, name) {
      var li = document.createElement("li");
      li.className = ok ? "ok" : "bad";
      var b = document.createElement("b");
      b.textContent = label;
      li.appendChild(b);
      li.appendChild(document.createTextNode(" " + name));
      list.appendChild(li);
    };
    (r.claims || []).forEach(function (k) {
      add(bad[k] ? (r.flipped.indexOf(k) >= 0 ? "\u2715 opposite of evidence" : "\u2715 not in evidence") : "\u2713 in evidence", !bad[k], G.describe(k));
    });
    r.flipped.forEach(function (k) { if (!(r.claims || []).length || (r.claims.indexOf(k) < 0)) add("\u2715 opposite of evidence", false, G.describe(k)); });
    r.widened.forEach(function (k) { add("\u2715 wider than evidence", false, k); });
  };

  var choose = function (ev, presetIndex) {
    current = ev;
    evText.textContent = ev.text;
    evId.textContent = ev.id;
    Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.id === ev.id)); });
    presets.innerHTML = "";
    ev.presets.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = p[0];
      b.addEventListener("click", function () { draft.value = p[1]; check(); });
      presets.appendChild(b);
    });
    draft.value = ev.presets[presetIndex][1];
    check();
  };

  EVIDENCE.forEach(function (ev) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = ev.id;
    b.dataset.id = ev.id;
    b.addEventListener("click", function () { choose(ev, 1); });
    tabs.appendChild(b);
  });
  draft.addEventListener("input", check);
  choose(EVIDENCE[0], 1);
})();
