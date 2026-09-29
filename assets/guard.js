/* The claim guard from sqautopilot/guard.py, ported rule for rule so the website demos behave exactly like
   the product. Parity is tested against the Python implementation on every release. No network use. */
(function (root) {
  "use strict";
  var CERTS = {
    "soc 2": "\\bsoc\\s*-?\\s*2\\b|\\bsoc2\\b", "soc 1": "\\bsoc\\s*-?\\s*1\\b", "type ii": "\\btype\\s*(?:ii|2)\\b",
    "type i": "\\btype\\s*(?:i|1)\\b(?!i)", "iso 27001": "\\biso(?:/iec)?\\s*27001\\b",
    "iso 27701": "\\biso(?:/iec)?\\s*27701\\b", "iso 42001": "\\biso(?:/iec)?\\s*42001\\b", "iso 9001": "\\biso\\s*9001\\b",
    "fedramp": "\\bfedramp\\b", "hitrust": "\\bhitrust\\b", "pci dss": "\\bpci(?:[\\s-]*dss)?\\b", "hipaa": "\\bhipaa\\b",
    "csa star": "\\bcsa\\s*star\\b|\\bstar\\s*level\\b", "cmmc": "\\bcmmc\\b", "nist 800-53": "\\b800-53\\b",
    "nist 800-171": "\\b800-171\\b", "gdpr": "\\bgdpr\\b", "ccpa": "\\bccpa\\b", "tisax": "\\btisax\\b",
    "cyber essentials": "\\bcyber\\s*essentials\\b", "stateramp": "\\bstateramp\\b"
  };
  var TECH = {
    "aes-256": "\\baes[\\s-]*256\\b", "aes-128": "\\baes[\\s-]*128\\b", "tls 1.3": "\\btls\\s*v?1\\.3\\b",
    "tls 1.2": "\\btls\\s*v?1\\.2\\b", "fips 140": "\\bfips[\\s-]*140(?:-[23])?\\b",
    "hsm": "\\bhsm\\b|hardware security module", "kms": "\\bkms\\b", "byok": "\\bbyok\\b", "sha-256": "\\bsha[\\s-]*256\\b",
    "rsa": "\\brsa[\\s-]*\\d{4}\\b"
  };
  var EVENTS = {
    "no incidents": "\\b(?:no|zero|never\\s+(?:had|experienced))\\b.{0,30}\\b(?:incident|breach)(?:es|s)?\\b",
    "breach": "\\bbreach(?:es|ed)?\\b", "audit passed": "\\b(?:passed|clean|unqualified)\\b.{0,20}\\baudit\\b",
    "penetration test": "\\bpen(?:etration)?[\\s-]*test", "certified": "\\bcertified\\b|\\bcertification\\b",
    "compliant": "\\bcompliant\\b|\\bcompliance with\\b", "attested": "\\battest(?:ed|ation)\\b"
  };
  var FREQ = {
    "continuous": "\\bcontinuous(?:ly)?\\b|\\breal[\\s-]*time\\b|\\b24\\s*/\\s*7\\b|\\baround the clock\\b",
    "hourly": "\\bhourly\\b|\\bevery hour\\b",
    "daily": "\\bdaily\\b|\\bnightly\\b|\\bevery (?:day|night)\\b|\\bonce a day\\b",
    "weekly": "\\bweekly\\b|\\bevery week\\b|\\bonce a week\\b",
    "monthly": "\\bmonthly\\b|\\bevery month\\b|\\bonce a month\\b",
    "quarterly": "\\bquarterly\\b|\\bevery (?:quarter|3 months)\\b",
    "twice yearly": "\\bsemi[\\s-]*annual(?:ly)?\\b|\\bbi[\\s-]*annual(?:ly)?\\b|\\btwice (?:a|per|each) year\\b|\\bevery 6 months\\b",
    "yearly": "\\bannual(?:ly)?\\b|\\byearly\\b|\\bonce (?:a|per|each) year\\b|\\bevery (?:year|12 months)\\b"
  };
  var SCOPE = {
    "in transit": "\\bin[\\s-]transit\\b|\\bover (?:the )?networks?\\b|\\bon the wire\\b",
    "at rest": "\\bat[\\s-]rest\\b",
    "customers": "\\bcustomers?\\b|\\bclients?\\b|\\bend[\\s-]users?\\b",
    "employees": "\\bemployees?\\b|\\bstaff\\b|\\bpersonnel\\b|\\bworkforce\\b",
    "contractors": "\\bcontractors?\\b|\\bconsultants?\\b",
    "third parties": "\\bthird[\\s-]part(?:y|ies)\\b|\\bvendors?\\b|\\bsuppliers?\\b|\\bsub-?processors?\\b",
    "production": "\\bproduction\\b",
    "non-production": "\\bnon[\\s-]production\\b|\\bstaging\\b|\\bdevelopment environments?\\b|\\btest environments?\\b",
    "backups": "\\bbackups?\\b",
    "endpoints": "\\bendpoints?\\b|\\blaptops?\\b|\\bworkstations?\\b|\\bmobile devices?\\b",
    "everything": "\\b(?:all|every|each|any)\\s+(?:of (?:our|the) )?(?:systems?|data|environments?|services?|" +
      "applications?|assets?|servers?|accounts?|users?|devices?|locations?|regions?)\\b|\\bcompany[\\s-]wide\\b|" +
      "\\borganization[\\s-]wide\\b|\\bwithout exception\\b|\\bin all cases\\b"
  };
  var DISPLAY = {
    "soc 2": "SOC 2", "soc 1": "SOC 1", "type ii": "Type II", "type i": "Type I", "iso 27001": "ISO 27001",
    "iso 27701": "ISO 27701", "iso 42001": "ISO 42001", "iso 9001": "ISO 9001", "fedramp": "FedRAMP",
    "hitrust": "HITRUST", "pci dss": "PCI DSS", "hipaa": "HIPAA", "csa star": "CSA STAR", "cmmc": "CMMC",
    "nist 800-53": "NIST 800-53", "nist 800-171": "NIST 800-171", "gdpr": "GDPR", "ccpa": "CCPA", "tisax": "TISAX",
    "cyber essentials": "Cyber Essentials", "stateramp": "StateRAMP", "aes-256": "AES-256", "aes-128": "AES-128",
    "tls 1.3": "TLS 1.3", "tls 1.2": "TLS 1.2", "fips 140": "FIPS 140", "hsm": "HSM", "kms": "KMS", "byok": "BYOK",
    "sha-256": "SHA-256", "rsa": "RSA key size", "breach": "breach history", "audit passed": "audit result",
    "certified": "certification", "compliant": "compliance", "attested": "attestation"
  };
  var ATTEST = /\bwe (?:hereby )?(?:certify|guarantee|warrant|attest|represent)\b|\bguaranteed\b|\b100\s*%\s*(?:secure|uptime|compliant)\b/i;
  var NUM = /\b\d+(?:\.\d+)?\s*(?:%|percent|days?|hours?|minutes?|years?|months?|bits?)(?![a-z])/gi;
  var NEG = /\b(?:not|no|never|neither|nor|without|none|cannot|lacks?|lacking)\b|n't\b/i;
  var NEG_AFTER = /^[\s,]*(?:(?!(?:and|or|but|while|whereas)\b)[\w-]+\s+){0,3}?(?:(?:is|are|was|were|has|have|had|does|do|did|will|can)\s+(?:not|never)\b|(?:isn't|aren't|wasn't|weren't|hasn't|haven't|doesn't|don't|didn't|won't|cannot)\b)/i;
  var CLAUSE = /[.;!?:\n]+|,\s*(?:and|but|while|whereas|however)\b|\bbut\b|\bhowever\b/i;
  var LEGAL = new RegExp(
    "\\b(indemnif\\w*|limitation of liability|liabilit(?:y|ies)|warrant(?:y|ies)|governing law|" +
    "jurisdiction|legal opinion|legally (?:required|obligated)|interpret\\w*.{0,30}\\b(?:law|regulation|contract)|" +
    "does (?:gdpr|hipaa|ccpa|the law|the regulation) require|contract(?:ual)? (?:terms?|clause)|" +
    "insurance (?:coverage|limits?)|sign(?:ed)? (?:the )?(?:dpa|baa|agreement))\\b", "i");
  var UNITS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
  var TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  var WORDNUM = new RegExp("\\b(?:(" + Object.keys(TENS).join("|") + ")(?:[\\s-](one|two|three|four|five|six|seven|eight|nine))?|(" +
    UNITS.join("|") + "))\\b(?:\\s+hundred\\b)?", "gi");
  var POLAR = {};
  [CERTS, TECH, EVENTS].forEach(function (g) {
    Object.keys(g).forEach(function (k) { if (k !== "no incidents") POLAR[k] = g[k]; });
  });

  function digits(text) {
    return text.replace(WORDNUM, function (m, tens, unit, single) {
      var n = single ? UNITS.indexOf(single.toLowerCase()) : TENS[tens.toLowerCase()] + (unit ? UNITS.indexOf(unit.toLowerCase()) : 0);
      return String(/hundred$/i.test(m) ? n * 100 : n);
    });
  }
  function found(group, text) {
    return Object.keys(group).filter(function (k) { return new RegExp(group[k], "i").test(text); });
  }
  function claims(text) {
    text = digits(text);
    var out = {};
    found(CERTS, text).concat(found(TECH, text), found(EVENTS, text)).forEach(function (k) { out[k] = true; });
    var m; NUM.lastIndex = 0;
    while ((m = NUM.exec(text))) out["num:" + m[0].toLowerCase().replace(/ /g, "")] = true;
    found(FREQ, text).forEach(function (k) { out["freq:" + k] = true; });
    return out;
  }
  function scope(text) {
    var out = {};
    found(SCOPE, digits(text)).forEach(function (k) { out[k] = true; });
    return out;
  }
  function polarity(text) {
    var out = {};
    text.split(CLAUSE).forEach(function (clause) {
      if (!clause) return;
      Object.keys(POLAR).forEach(function (key) {
        var re = new RegExp(POLAR[key], "gi"), m;
        while ((m = re.exec(clause))) {
          var before = clause.slice(Math.max(0, m.index - 60), m.index);
          var after = clause.slice(m.index + m[0].length, m.index + m[0].length + 60);
          out[key + "|" + (NEG.test(before) || NEG_AFTER.test(after) ? "1" : "0")] = true;
          if (m[0] === "") re.lastIndex++;
        }
      });
    });
    return out;
  }
  function describe(key) {
    if (key.indexOf("num:") === 0) return key.slice(4).replace(/^(\d+(?:\.\d+)?)(?=[a-z])/, "$1 ");
    if (key.indexOf("freq:") === 0) return key.slice(5);
    return DISPLAY[key] || key;
  }
  function names(keys) {
    var seen = {}, out = [];
    keys.forEach(function (k) { var d = describe(k); if (!seen[d]) { seen[d] = true; out.push(d); } });
    return out.join(", ");
  }
  /* Same order and wording as check_draft(); evidence is the cited approved text. */
  function check(draft, evidence) {
    var findings = [];
    if (!draft.trim()) return { ok: false, findings: ["empty draft"], unsupported: [], flipped: [], widened: [] };
    if (ATTEST.test(draft)) findings.push("uses guarantee or attestation language");
    var ev = claims(evidence), got = claims(draft);
    var unsupported = Object.keys(got).filter(function (k) { return !ev[k]; }).sort();
    if (unsupported.length) findings.push("claims what the evidence does not say: " + names(unsupported));
    var evPol = polarity(evidence), evKeys = {};
    Object.keys(evPol).forEach(function (p) { evKeys[p.split("|")[0]] = true; });
    var flipped = {};
    Object.keys(polarity(draft)).forEach(function (p) {
      var k = p.split("|")[0];
      if (evKeys[k] && !evPol[p]) flipped[k] = true;
    });
    var flippedKeys = Object.keys(flipped).sort();
    if (flippedKeys.length) findings.push("contradicts the evidence on: " + names(flippedKeys));
    var evScope = scope(evidence);
    var widened = Object.keys(scope(draft)).filter(function (k) { return !evScope[k]; }).sort();
    if (widened.length) findings.push("widens the scope beyond the evidence: " + names(widened));
    return { ok: findings.length === 0, findings: findings, unsupported: unsupported, flipped: flippedKeys,
      widened: widened, claims: Object.keys(got).sort() };
  }
  root.PFGuard = { claims: claims, scope: scope, polarity: polarity, check: check, describe: describe,
    isLegal: function (q) { return LEGAL.test(q); } };
})(typeof window !== "undefined" ? window : globalThis);
