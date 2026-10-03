/* Homepage screen switcher: swaps the large capture without reloading. Every capture is also linked full size. */
(function () {
  "use strict";
  var img = document.getElementById("showcase-img");
  if (!img) return;
  var ALT = {
    overview: "The security program overview: posture score, readiness for each framework, next deadlines, priorities and the risk heat map",
    frameworks: "SOC 2 readiness, criterion by criterion, with the safeguards that cover each one",
    incidents: "An open incident with its playbook and notification deadlines counting down",
    vendors: "The vendor register with tiers, data, access and review dates",
    risks: "The risk register with scores, owners and the heat map",
    policies: "The seventeen security policies with approval state and a policy preview",
    vulns: "Scanner findings with severity, fix-by dates and the ones past due",
    evidence: "Evidence files per safeguard with checksums, and the audit package button",
    review: "Review and edit: an answer beside its approved evidence, with an unsupported claim marked At risk"
  };
  var buttons = document.querySelectorAll("[data-shot]");
  Array.prototype.forEach.call(buttons, function (b) {
    var pre = new Image(); pre.src = "assets/app/" + b.dataset.shot + ".webp";
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(buttons, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      img.src = "assets/app/" + b.dataset.shot + ".webp";
      img.alt = ALT[b.dataset.shot] || "";
    });
  });
})();
