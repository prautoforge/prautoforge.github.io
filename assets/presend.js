/* PrautoForge site: interactive pre-send check. The same decision rules as sqautopilot/presend.py, using the
   parity-tested claim guard in assets/guard.js. Runs in the browser; nothing typed here is sent anywhere. */
(function () {
  "use strict";
  var G = window.PFGuard;
  if (!G) return;

  var LIB = {
    "ENC-001": "Examplify encrypts customer data at rest using AES-256 via the cloud provider's managed key service (KMS).",
    "ENC-003": "Encryption keys are managed in the cloud provider's KMS. Customer-data keys rotate automatically every 365 days and access to key administration is restricted to the platform security team.",
    "BCP-002": "The documented recovery time objective is 8 hours and the recovery point objective is 24 hours for the production service.",
    "CMP-001": "Examplify has completed a SOC 2 Type II examination covering the Security criterion for the period 2025-04-01 to 2026-03-31. The report is available under NDA.",
    "CMP-002": "Examplify is not ISO 27001 certified. Its security program is aligned to the SOC 2 Security criterion.",
    "IAM-001": "MFA is enforced through the company identity provider for all employee access to production systems, source code and administrative consoles.",
    "IAM-002": "The Examplify application supports SAML 2.0 single sign-on for customers on the Business plan and above."
  };
  var EXPIRED = { "OLD-001": "Customer MFA is optional." };
  /* Rows and answers from the included sample final questionnaire; each row lists its closest approved answers. */
  var ROWS = [
    { ref: "Q1", q: "Is customer data encrypted at rest?", ev: ["ENC-001"], a: LIB["ENC-001"] },
    { ref: "Q3", q: "How are cryptographic keys managed and how often are they rotated?", ev: ["ENC-003", "ENC-001"],
      a: "Encryption keys are managed in the cloud provider's KMS and rotated automatically every 90 days, stored in a FIPS 140-3 HSM." },
    { ref: "Q13", q: "What are the RTO and RPO for your service?", ev: ["BCP-002"],
      a: "The recovery time objective is 8 hours and the recovery point objective is 24 hours." },
    { ref: "Q19", q: "Please provide your most recent SOC 2 Type II report.", ev: ["CMP-001", "CMP-002"], a: "No" },
    { ref: "Q20", q: "Is your organization ISO 27001 certified?", ev: ["CMP-002"], a: "Yes" },
    { ref: "Q21", q: "Is your service FedRAMP authorized?", ev: ["CMP-001", "CMP-002"], a: "Yes" },
    { ref: "Q24", q: "Will you indemnify us for losses arising from a data breach?", ev: [],
      a: "Yes, up to the fees paid in the prior 12 months." },
    { ref: "Q31", q: "Do you enforce MFA for customer accounts?", ev: ["IAM-001", "IAM-002"], a: EXPIRED["OLD-001"] }
  ];
  var CHECKS = {
    AT_RISK: ["At risk", "s-gap"], LEGAL_CONFIRM: ["Legal to confirm", "s-legal"], NOT_IN_LIBRARY: ["Not in library", "s-drafted"],
    CONSISTENT: ["Consistent", "s-matched"], APPROVED_WORDING: ["Approved wording", "s-matched"], UNANSWERED: ["Unanswered", "s-flag"]
  };
  var YES = /^\s*(?:yes|y|true|correct|confirmed)\b[\s.,;:-]*/i;
  var NO = /^\s*(?:no|n|false)\b[\s.,;:-]*/i;
  var NA = /^\s*(?:n\/?a|not applicable)\b/i;
  /* tokens() from sqautopilot/text.py: stopwords, security synonyms and light stemming */
  var STOP = ["a", "all", "an", "and", "any", "are", "as", "at", "be", "been", "by", "can", "describe", "do", "does", "for", "from", "has", "have", "how", "if", "in", "into", "is", "it", "its", "must", "of", "on", "or", "other", "our", "per", "please", "provide", "should", "such", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "those", "to", "us", "via", "was", "we", "were", "what", "when", "where", "whether", "which", "who", "will", "with", "you", "your"];
  var SYN = {"27001": "iso", "2fa": "multifactor", "ai": "artificialintelligence", "backups": "backup", "bcp": "continuity", "breach": "incident", "breaches": "incident", "crypto": "encryption", "cryptographic": "encryption", "dr": "recovery", "employee": "personnel", "employees": "personnel", "encrypt": "encryption", "encrypted": "encryption", "encrypting": "encryption", "encrypts": "encryption", "gdpr": "personaldata", "incidents": "incident", "iso27001": "iso", "llm": "artificialintelligence", "log": "logging", "logs": "logging", "mfa": "multifactor", "ml": "artificialintelligence", "monitor": "monitoring", "monitored": "monitoring", "multi-factor": "multifactor", "multifactor": "multifactor", "oidc": "singlesignon", "otp": "multifactor", "pen-test": "penetration", "pentest": "penetration", "pentests": "penetration", "pii": "personaldata", "saml": "singlesignon", "soc2": "soc", "sso": "singlesignon", "staff": "personnel", "sub-processors": "subprocessor", "subprocessors": "subprocessor", "suppliers": "vendor", "two-factor": "multifactor", "vendors": "vendor", "vuln": "vulnerability", "vulnerabilities": "vulnerability", "vulns": "vulnerability", "workforce": "personnel"};
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = true; });
  var SUFFIXES = ["ations", "ation", "ings", "ing", "ies", "ed", "es", "s"];
  var stem = function (t) {
    for (var i = 0; i < SUFFIXES.length; i++) {
      var x = SUFFIXES[i];
      if (t.length > x.length + 3 && t.slice(-x.length) === x) return t.slice(0, -x.length) + (x === "ies" ? "y" : "");
    }
    return t;
  };
  var norm = function (t) { return t.replace(/\s+/g, " ").trim().toLowerCase(); };
  var stems = function (t) {
    var out = {};
    (t.normalize("NFKC").toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || []).forEach(function (raw) {
      var tok = SYN[raw] || raw;
      if (STOPSET[tok] || tok.length < 2) return;
      out[stem(SYN[tok] || tok)] = true;
    });
    return out;
  };
  var ours = function (f) { return f.replace("the evidence does", "your approved answers do").replace("the evidence", "your approved answers"); };

  var checkRow = function (row, answer) {
    if (!answer.trim()) return ["UNANSWERED", ""];
    var ids = Object.keys(LIB);
    for (var i = 0; i < ids.length; i++) if (norm(LIB[ids[i]]) === norm(answer)) return ["APPROVED_WORDING", "exactly " + ids[i]];
    for (var x in EXPIRED) if (norm(EXPIRED[x]) === norm(answer)) return ["AT_RISK", "copied from " + x + ", whose approval has expired"];
    if (G.isLegal(row.q)) return ["LEGAL_CONFIRM", "confirm counsel approved this wording"];
    if (NA.test(answer)) return ["CONSISTENT", "marked not applicable"];
    var evidence = row.ev.map(function (id) { return LIB[id]; }).join(" ");
    var y = answer.match(YES), n = answer.match(NO);
    var stated = y ? row.q + " " + answer.slice(y[0].length) : answer;
    if (n) {
      var stated_by = {}, denied = {};
      row.ev.forEach(function (id) {
        Object.keys(G.polarity(LIB[id])).forEach(function (p) { if (p.slice(-1) === "1") denied[p.split("|")[0]] = true; });
      });
      row.ev.forEach(function (id) {
        Object.keys(G.polarity(LIB[id])).forEach(function (p) {
          var k = p.split("|")[0];
          if (p.slice(-1) === "0" && !denied[k]) (stated_by[k] = stated_by[k] || []).push(id);
        });
      });
      var keys = Object.keys(G.polarity(row.q)).filter(function (p) { return p.slice(-1) === "0" && stated_by[p.split("|")[0]]; })
        .map(function (p) { return p.split("|")[0]; }).sort();
      if (keys.length) {
        var who = {};
        keys.forEach(function (k) { stated_by[k].forEach(function (id) { who[id] = true; }); });
        var list = Object.keys(who).sort();
        var names = [];
        keys.forEach(function (k) { var d = G.describe(k); if (names.indexOf(d) < 0) names.push(d); });
        return ["AT_RISK", "answers No, but approved answer" + (list.length > 1 ? "s " : " ") + list.join(", ") +
          (list.length > 1 ? " state " : " states ") + names.join(", ")];
      }
      stated = answer.slice(n[0].length);
      if (!stated.trim()) {
        var qpos = {}, agree = {};
        Object.keys(G.polarity(row.q)).forEach(function (p) { if (p.slice(-1) === "0") qpos[p.split("|")[0]] = true; });
        row.ev.forEach(function (id) {
          Object.keys(G.polarity(LIB[id])).forEach(function (p) { if (p.slice(-1) === "1" && qpos[p.split("|")[0]]) agree[id] = true; });
        });
        var ag = Object.keys(agree).sort();
        return ag.length ? ["CONSISTENT", "agrees with " + ag.join(", ")] : ["NOT_IN_LIBRARY", "have the owner review it"];
      }
    }
    var claimCount = Object.keys(G.claims(stated)).length;
    if (!row.ev.length) {
      return claimCount ? ["AT_RISK", "makes specific claims, and no approved answer covers this topic"] : ["NOT_IN_LIBRARY", "have the owner review it"];
    }
    var r = G.check(stated, evidence);
    var findings = r.findings.filter(function (f) { return f !== "empty draft"; });
    if (findings.length) return ["AT_RISK", findings.map(ours).join("; ")];
    var own = stems(stated), ownKeys = Object.keys(own);
    var sc = Object.keys(G.scope(stated)).sort();
    for (var si = 0; si < sc.length; si++) {
      var backed = row.ev.some(function (id) {
        if (!G.scope(LIB[id])[sc[si]]) return false;
        var e = stems(LIB[id]), hit = 0;
        ownKeys.forEach(function (w) { if (e[w]) hit++; });
        return hit >= 0.3 * Math.max(1, ownKeys.length);
      });
      if (!backed) return ["AT_RISK", "widens the scope beyond your approved answers: " + sc[si]];
    }
    var ev = stems(evidence), total = 0, covered = 0;
    Object.keys(own).forEach(function (w) { total++; if (ev[w]) covered++; });
    if (covered < 0.5 * Math.max(1, total) && !claimCount) return ["NOT_IN_LIBRARY", "have the owner review it"];
    return ["CONSISTENT", "stays within " + row.ev.join(", ")];
  };

  window.PFPresend = { check: checkRow, rows: ROWS };
  var rowsEl = typeof document !== "undefined" && document.getElementById("ps-rows");
  if (!rowsEl) return;
  var summaryEl = document.getElementById("ps-summary");
  var inputs = [];
  var render = function () {
    var counts = {}, risky = 0;
    inputs.forEach(function (it) {
      var res = checkRow(it.row, it.input.value);
      var c = CHECKS[res[0]];
      counts[res[0]] = (counts[res[0]] || 0) + 1;
      if (res[0] === "AT_RISK") risky++;
      it.el.className = "ps-row " + c[1] + (res[0] === "AT_RISK" ? " risk" : "");
      it.pill.textContent = c[0];
      it.why.textContent = res[1];
    });
    summaryEl.className = "ps-summary " + (risky ? "bad" : "good");
    summaryEl.querySelector("b").textContent = risky ? "Not ready to send" : "Ready to send";
    summaryEl.querySelector("span").textContent = risky
      ? risky + " answer" + (risky > 1 ? "s claim" : " claims") + " more than your approved answers support."
      : "No unsupported claims. Legal answers still need counsel's confirmation.";
  };
  var build = function () {
    rowsEl.innerHTML = "";
    inputs = [];
    ROWS.forEach(function (row) {
      var el = document.createElement("div");
      var ref = document.createElement("span");
      ref.className = "ref";
      ref.textContent = row.ref;
      var mid = document.createElement("div");
      var q = document.createElement("p");
      q.className = "q";
      q.textContent = row.q;
      var input = document.createElement("textarea");
      input.rows = 1;
      input.spellcheck = false;
      input.value = row.a;
      input.setAttribute("aria-label", "Answer to " + row.ref);
      var fit = function () { input.style.height = "auto"; input.style.height = input.scrollHeight + "px"; };
      input.addEventListener("input", function () { fit(); render(); });
      mid.appendChild(q);
      mid.appendChild(input);
      var side = document.createElement("div");
      side.className = "side";
      var pill = document.createElement("span");
      pill.className = "pill";
      var why = document.createElement("p");
      why.className = "why";
      side.appendChild(pill);
      side.appendChild(why);
      el.appendChild(ref);
      el.appendChild(mid);
      el.appendChild(side);
      rowsEl.appendChild(el);
      inputs.push({ row: row, input: input, el: el, pill: pill, why: why });
      window.requestAnimationFrame(fit);
    });
    render();
  };
  var reset = document.getElementById("ps-reset");
  if (reset) reset.addEventListener("click", build);
  build();
  window.addEventListener("resize", function () {
    inputs.forEach(function (it) { it.input.style.height = "auto"; it.input.style.height = it.input.scrollHeight + "px"; });
  });
})();
