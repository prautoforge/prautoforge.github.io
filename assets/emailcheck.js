/* Email security check: reads a domain's public DNS records through Cloudflare's DNS-over-HTTPS resolver and grades
   them with the same rules as Questionnaire Autopilot's weekly domain check (sqautopilot/domaincheck.py). */
(function () {
  "use strict";
  var form = document.getElementById("ec-form");
  if (!form) return;
  var input = document.getElementById("ec-domain"), status = document.getElementById("ec-status"), out = document.getElementById("ec-result");
  var SELECTORS = ["google", "selector1", "selector2", "default", "k1", "s1", "s2", "mail", "dkim", "smtp", "mandrill"];

  function dns(name, type) {
    return fetch("https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(name) + "&type=" + type, { headers: { accept: "application/dns-json" } })
      .then(function (r) { if (!r.ok) throw new Error("DNS lookup failed (" + r.status + ")"); return r.json(); });
  }
  function txt(name) {
    return dns(name, "TXT").then(function (d) {
      return (d.Answer || []).filter(function (a) { return a.type === 16; }).map(function (a) {
        return a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "");
      });
    }).catch(function () { return []; });
  }
  function clean(v) {
    v = String(v || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[\/?#:@\s]/)[0].replace(/\.$/, "");
    return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(v) ? v : "";
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function check(d) {
    var findings = [];
    function add(area, ok, text, weight, fix) { findings.push({ area: area, ok: ok, text: text, weight: weight, fix: fix || "" }); }
    return Promise.all([dns(d, "MX"), txt(d), txt("_dmarc." + d), txt("_mta-sts." + d), dns(d, "SOA").catch(function () { return {}; }),
                        dns(d, "CAA").catch(function () { return {}; })]).then(function (r) {
      var mx = (r[0].Answer || []).filter(function (a) { return a.type === 15; }).map(function (a) { return a.data.split(" ").pop().replace(/\.$/, ""); });
      var spf = r[1].filter(function (t) { return /^v=spf1/i.test(t); });
      var dmarc = r[2].filter(function (t) { return /^v=dmarc1/i.test(t); });
      if (mx.length) add("Email", true, "Mail servers: " + mx.sort().join(", "), 0);
      else add("Email", null, "No mail servers (MX) published: this domain does not receive email. Spoofing protection still matters.", 0);
      if (!spf.length) add("Email", false, "No SPF record: anyone can send email that claims to be from this domain.", mx.length ? 3 : 1,
        "Publish a TXT record on " + d + " listing your mail services, for example: v=spf1 include:_spf.google.com -all");
      else if (spf.length > 1) add("Email", false, "More than one SPF record; receivers treat this as no SPF.", 3, "Merge them into one TXT record.");
      else {
        var rec = spf[0].toLowerCase().trim(), good = /[-~]all$/.test(rec) || /\bredirect=/.test(rec);  // redirect= hands the rest to another record
        add("Email", good, "SPF: " + spf[0].slice(0, 160), good ? 0 : 2, good ? "" : "End the SPF record with -all (or ~all).");
        if ((rec.match(/\b(include|a|mx|ptr|exists|redirect)[:=]/g) || []).length > 10)
          add("Email", false, "SPF needs more than 10 DNS lookups and fails at receivers.", 2, "Flatten the SPF record (replace includes with the addresses they list).");
      }
      if (!dmarc.length) add("Email", false, "No DMARC record: spoofed email from this domain is not rejected.", mx.length ? 3 : 1,
        "Publish a TXT record on _dmarc." + d + ": v=DMARC1; p=quarantine; rua=mailto:dmarc@" + d + " (then move to p=reject).");
      else {
        var pol = (dmarc[0].toLowerCase().match(/\bp=(\w+)/) || [0, "none"])[1], strong = pol === "reject" || pol === "quarantine";
        add("Email", strong, "DMARC policy: p=" + pol, strong ? 0 : 2, strong ? "" : "Move the DMARC policy from p=none to p=quarantine, then p=reject, once reports show your own mail passes.");
      }
      var mta = r[3].filter(function (t) { return /^v=stsv1/i.test(t); });
      if (mx.length) add("Email", !!mta.length, mta.length ? "MTA-STS published: mail to you is sent over TLS only." : "No MTA-STS: mail to this domain can be downgraded to plain text in transit.",
        mta.length ? 0 : 1, mta.length ? "" : "Publish _mta-sts." + d + " TXT v=STSv1; id=1 and a policy file at https://mta-sts." + d + "/.well-known/mta-sts.txt");
      var signed = !!r[4].AD;
      add("DNS", signed, signed ? "DNSSEC signed." : "DNSSEC is not enabled.", signed ? 0 : 1, signed ? "" : "Turn on DNSSEC at your DNS provider and registrar.");
      var caa = (r[5].Answer || []).filter(function (a) { return a.type === 257; });
      add("DNS", !!caa.length, caa.length ? "CAA limits which authorities can issue certificates." : "No CAA record: any certificate authority may issue certificates for this domain.",
        caa.length ? 0 : 1, caa.length ? "" : "Add a CAA record naming your certificate authority, for example: 0 issue \"letsencrypt.org\"");
      if (!mx.length) return findings;
      return Promise.all(SELECTORS.map(function (s) { return txt(s + "._domainkey." + d).then(function (t) { return t.some(function (x) { return /p=/.test(x); }) ? s : null; }); }))
        .then(function (found) {
          found = found.filter(Boolean);
          add("Email", found.length ? true : null, found.length ? "DKIM keys found for selectors: " + found.join(", ") : "No DKIM key found under common selectors (your provider may use another selector name).", 0);
          return findings;
        });
    });
  }

  function render(d, findings) {
    var lost = findings.reduce(function (n, f) { return n + (f.ok === false ? f.weight : 0); }, 0);
    var score = Math.max(0, 100 - lost * 5);
    var grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
    out.textContent = "";
    var head = el("div", "ec-head");
    var g = el("div", "ec-grade ec-g-" + grade.toLowerCase(), grade);
    var t = el("div", "ec-head-text");
    t.appendChild(el("strong", "", d));
    t.appendChild(el("span", "", score + " out of 100, checked " + new Date().toLocaleString()));
    head.appendChild(g); head.appendChild(t); out.appendChild(head);
    var order = { "false": 0, "null": 1, "true": 2 };
    findings.slice().sort(function (a, b) { return order[String(a.ok)] - order[String(b.ok)]; }).forEach(function (f) {
      var row = el("div", "ec-row " + (f.ok === true ? "ok" : f.ok === false ? "bad" : "info"));
      row.appendChild(el("span", "ec-mark", f.ok === true ? "Pass" : f.ok === false ? "Fix" : "Note"));
      var body = el("div", "ec-body");
      body.appendChild(el("p", "", f.text));
      if (f.fix) { body.appendChild(el("code", "ec-fix", f.fix)); }
      row.appendChild(body);
      out.appendChild(row);
    });
    out.hidden = false;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var d = clean(input.value);
    if (!d) { status.textContent = "Enter a domain name, for example example.com."; return; }
    var b = form.querySelector("button"); b.disabled = true;
    status.textContent = "Checking " + d + "…"; out.hidden = true;
    check(d).then(function (f) { status.textContent = ""; render(d, f); })
      .catch(function (err) { status.textContent = "The check could not finish: " + err.message + ". Try again in a moment."; })
      .then(function () { b.disabled = false; });
  });
  var q = new URLSearchParams(location.search).get("domain");
  if (q) { input.value = q; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit")); }
})();
