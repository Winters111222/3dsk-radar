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

test("ordinary employment is rejected but an explicit external contract remains eligible", () => {
  const employee = {...base, commercial_role:"EMPLOYER", title:"Permanent Character Artist", summary:"Join our internal team as a full-time employee."};
  assert.equal(evaluateCandidateRelevance(employee).rejection, "individual_employment");
  const contractor = {...employee, title:"Contract scan artist", summary:"External freelance vendor contract for a supplied scan batch."};
  assert.equal(evaluateCandidateRelevance(contractor).ok, true);
});
