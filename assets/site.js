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

  /* ---------- claim guard: the same rules as sqautopilot/guard.py ---------- */
  var CERTS = {
    "SOC 2": /\bsoc\s*-?\s*2\b|\bsoc2\b/i, "SOC 1": /\bsoc\s*-?\s*1\b/i, "Type II": /\btype\s*(?:ii|2)\b/i,
    "Type I": /\btype\s*(?:i|1)\b(?!i)/i, "ISO 27001": /\biso(?:\/iec)?\s*27001\b/i, "ISO 27701": /\biso(?:\/iec)?\s*27701\b/i,
    "ISO 42001": /\biso(?:\/iec)?\s*42001\b/i, "ISO 9001": /\biso\s*9001\b/i, "FedRAMP": /\bfedramp\b/i,
    "HITRUST": /\bhitrust\b/i, "PCI DSS": /\bpci(?:[\s-]*dss)?\b/i, "HIPAA": /\bhipaa\b/i,
    "CSA STAR": /\bcsa\s*star\b|\bstar\s*level\b/i, "CMMC": /\bcmmc\b/i, "NIST 800-53": /\b800-53\b/i,
    "NIST 800-171": /\b800-171\b/i, "GDPR": /\bgdpr\b/i, "CCPA": /\bccpa\b/i, "TISAX": /\btisax\b/i,
    "Cyber Essentials": /\bcyber\s*essentials\b/i, "StateRAMP": /\bstateramp\b/i
  };
  var TECH = {
    "AES-256": /\baes[\s-]*256\b/i, "AES-128": /\baes[\s-]*128\b/i, "TLS 1.3": /\btls\s*v?1\.3\b/i,
    "TLS 1.2": /\btls\s*v?1\.2\b/i, "FIPS 140": /\bfips[\s-]*140(?:-[23])?\b/i, "HSM": /\bhsm\b|hardware security module/i,
    "KMS": /\bkms\b/i, "BYOK": /\bbyok\b/i, "SHA-256": /\bsha[\s-]*256\b/i, "RSA": /\brsa[\s-]*\d{4}\b/i
  };
  var EVENTS = {
    "no incidents": /\b(?:no|zero|never\s+(?:had|experienced))\b.{0,30}\b(?:incident|breach)(?:es|s)?\b/i,
    "breach": /\bbreach(?:es|ed)?\b/i, "audit passed": /\b(?:passed|clean|unqualified)\b.{0,20}\baudit\b/i,
    "penetration test": /\bpen(?:etration)?[\s-]*test/i, "certified": /\bcertified\b|\bcertification\b/i,
    "compliant": /\bcompliant\b|\bcompliance with\b/i, "attested": /\battest(?:ed|ation)\b/i
  };
  var ATTEST = /\bwe (?:hereby )?(?:certify|guarantee|warrant|attest|represent)\b|\bguaranteed\b|\b100\s*%\s*(?:secure|uptime|compliant)\b/i;
  var NUM = /\b\d+(?:\.\d+)?\s*(?:%|percent|days?|hours?|minutes?|years?|months?|bits?)(?![a-z])/gi;

  var claims = function (text) {
    var found = {};
    [CERTS, TECH, EVENTS].forEach(function (group) {
      Object.keys(group).forEach(function (k) { if (group[k].test(text)) found[k] = true; });
    });
    var m; NUM.lastIndex = 0;
    while ((m = NUM.exec(text))) found[m[0].toLowerCase().replace(/\s+/g, "")] = true;
    return found;
  };

  var EVIDENCE = [
    { id: "ENC-001", text: "Examplify encrypts customer data at rest using AES-256 via the cloud provider's managed key service (KMS).",
      presets: [["Accurate", "Customer data is encrypted at rest with AES-256 using the cloud provider's KMS."],
                ["Adds a certification", "Customer data is encrypted at rest with AES-256 using the cloud provider's KMS, and Examplify is ISO 27001 certified."],
                ["Adds a detail", "Customer data is encrypted at rest with AES-256 and keys are held in a FIPS 140-3 HSM."]] },
    { id: "CMP-001", text: "Examplify has completed a SOC 2 Type II examination covering the Security criterion for the period 2025-04-01 to 2026-03-31. The report is available under NDA.",
      presets: [["Accurate", "Examplify has a SOC 2 Type II report covering the Security criterion, available under NDA."],
                ["Adds FedRAMP", "Examplify is SOC 2 Type II and FedRAMP authorized."],
                ["Adds history", "Examplify passed a clean audit and has had no security incidents."]] },
    { id: "BCP-002", text: "The documented recovery time objective is 8 hours and the recovery point objective is 24 hours for the production service.",
      presets: [["Accurate", "Our recovery time objective is 8 hours and our recovery point objective is 24 hours."],
                ["Wrong number", "Our recovery time objective is 4 hours and our recovery point objective is 24 hours."],
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
    var ev = claims(current.text);
    var got = claims(text);
    var keys = Object.keys(got);
    var bad = keys.filter(function (k) { return !ev[k]; });
    var attest = ATTEST.test(text);
    var blocked = !text.trim() || bad.length > 0 || attest;
    verdict.className = "verdict " + (blocked ? "blocked" : "ok");
    verdict.querySelector(".stamp").textContent = blocked ? "Blocked" : "Allowed";
    var msg;
    if (!text.trim()) msg = "An empty draft is never used.";
    else if (blocked) {
      var parts = [];
      if (bad.length) parts.push("mentions " + bad.join(", ") + ", which the approved evidence does not say");
      if (attest) parts.push("uses guarantee or attestation language");
      msg = "Discarded: it " + parts.join(" and ") + ". Your reviewer never sees it.";
    } else msg = keys.length ? "Every claim in the draft is backed by " + current.id + "." : "No specific claims; the draft stays within the evidence.";
    verdict.querySelector("p").textContent = msg;
    list.innerHTML = "";
    keys.forEach(function (k) {
      var li = document.createElement("li");
      var ok = !!ev[k];
      li.className = ok ? "ok" : "bad";
      var b = document.createElement("b");
      b.textContent = ok ? "✓ in evidence" : "✕ not in evidence";
      li.appendChild(b);
      li.appendChild(document.createTextNode(" " + k));
      list.appendChild(li);
    });
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
