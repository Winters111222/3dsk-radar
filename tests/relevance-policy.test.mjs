import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCandidateRelevance, freshnessConfidence } from "../src/server/relevance-policy.mjs";

const base = {
  title:"Human photogrammetry capture vendor",
  summary:"External supplier needed for a multi-person scan campaign.",
  location:"Worldwide",
  categories:["HUMAN_DATA_CAPTURE", "CAPTURE"],
  remote_scope:"WORLDWIDE_VENDOR",
  why_it_fits:[], risks:[], missing_requirements:[]
};

test("mandatory pipeline remains broad while Reallusion and Daz workflows fail closed", () => {
  assert.equal(evaluateCandidateRelevance(base).ok, true);
  for (const term of ["Reallusion", "Character Creator 4", "iClone", "Daz3D", "Daz Studio"]) {
    assert.deepEqual(evaluateCandidateRelevance({...base, summary:`${term} character production needed.`}), {
      ok:false,
      rejection:"excluded_workflow"
    });
  }
});

test("a brief replacing an excluded workflow is not rejected merely for naming it", () => {
  const replacement = {...base, summary:"Replace the supplied Daz Studio character with a custom scan-derived production-ready human."};
  assert.equal(evaluateCandidateRelevance(replacement).ok, true);
  const prohibition = {...base, summary:"Do not use Character Creator; deliver a custom realistic human mesh."};
  assert.equal(evaluateCandidateRelevance(prohibition).ok, true);
});

test("an explicit replacement does not hide a separate excluded workflow requirement", () => {
  const result = evaluateCandidateRelevance({
    ...base,
    title:"Replace the Daz export step but retain Character Creator production",
    description:"We need an external studio to replace Daz while the required Character Creator character workflow remains in use."
  });
  assert.deepEqual(result, {ok:false,rejection:"excluded_workflow"});
});

test("latent production deliverables preserve a mixed software brief for truth evaluation", () => {
  const latent = {...base, summary:"Build a small batch tool and deliver deformation-ready heads with consistent topology and repaired fused fingers."};
  assert.equal(evaluateCandidateRelevance(latent).ok, true);
});

test("multilingual closed evidence and supplier intent are distinguished", () => {
  const closed = {...base, commercial_role:"BUYER", summary:"L'offerta è chiusa e archiviata."};
  assert.equal(evaluateCandidateRelevance(closed).rejection, "inactive_source_evidence");
  const external = {...base, commercial_role:"BUYER", title:"3D Character Artist", summary:"Szukamy podwykonawcy do produkcji partii realistycznych postaci 3D."};
  assert.equal(evaluateCandidateRelevance(external).ok, true);
});

test("physical museum capture is CZ/SK only", () => {
  const museum = {...base, title:"Museum object 3D scanning", summary:"Onsite photogrammetry of collection artefacts.", categories:["CULTURAL_HERITAGE_3D","CAPTURE"]};
  assert.equal(evaluateCandidateRelevance({...museum,location:"Germany"}).rejection, "heritage_capture_outside_cz_sk");
  assert.equal(evaluateCandidateRelevance({...museum,location:"Brno, Czech Republic"}).ok, true);
  assert.equal(evaluateCandidateRelevance({...museum,location:"Bratislava, Slovakia"}).ok, true);
});

test("buyer-supplied heritage data may be processed remotely worldwide", () => {
  const remote = {
    ...base,
    title:"Museum photogrammetry post-processing",
    summary:"Remote cleanup and texturing from buyer-provided photos and existing scans.",
    location:"Worldwide",
    categories:["CULTURAL_HERITAGE_3D","PHOTOGRAMMETRY_PROCESSING","HERITAGE_POSTPROCESSING"],
    remote_scope:"GLOBAL_REMOTE"
  };
  assert.equal(evaluateCandidateRelevance(remote).ok, true);
});

test("freshness confidence is deterministic and undated active evidence stays low", () => {
  assert.equal(freshnessConfidence("PUBLISHED_DATE"), "high");
  assert.equal(freshnessConfidence("SOURCE_UPDATED_DATE"), "medium");
  assert.equal(freshnessConfidence("ACTIVE_ACCEPTANCE_EVIDENCE"), "low");
  assert.equal(freshnessConfidence(null), null);
});

test("every employer vacancy is rejected even when it mentions an external contract", () => {
  const employee = {...base, commercial_role:"EMPLOYER", title:"Permanent Character Artist", summary:"Join our internal team as a full-time employee."};
  assert.equal(evaluateCandidateRelevance(employee).rejection, "individual_employment");
  const contractor = {...employee, title:"Contract scan artist", summary:"External freelance vendor contract for a supplied scan batch."};
  assert.equal(evaluateCandidateRelevance(contractor).rejection, "individual_employment");
});

test("individual track still rejects fixed-term, payroll and contract-to-hire recruitment", () => {
  for (const summary of [
    "Fixed-term role on payroll for a senior character artist.",
    "Contract-to-hire position with a salary range and benefits."
  ]) {
    const result = evaluateCandidateRelevance({...base,commercial_role:"BUYER",engagement_track:"INDIVIDUAL_FREELANCE",summary});
    assert.equal(result.rejection, "individual_employment");
  }
});

test("source evidence that says closed wins over model labels", () => {
  const inactive = {...base, commercial_role:"BUYER", summary:"This job is no longer accepting applications."};
  assert.equal(evaluateCandidateRelevance(inactive).rejection, "inactive_source_evidence");
});

test("individual job language is rejected unless the brief buys studio production", () => {
  const leadRole = {...base, commercial_role:"BUYER", title:"Lead 3D Character Artist", summary:"Submit your resume for this permanent role."};
  assert.equal(evaluateCandidateRelevance(leadRole).rejection, "individual_employment");
  const batch = {...base, commercial_role:"BUYER", title:"Human scan cleanup batch", summary:"A buyer seeks an external studio for recurring batches of 50 body scans."};
  assert.equal(evaluateCandidateRelevance(batch).ok, true);
});
