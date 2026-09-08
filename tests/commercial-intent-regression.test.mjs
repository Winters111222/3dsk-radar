import test from "node:test";
import assert from "node:assert/strict";
import { classifyRecordCandidate } from "../src/server/record-classification.mjs";
import { evaluateCandidateRelevance } from "../src/server/relevance-policy.mjs";

const buyer = (overrides = {}) => ({
  title:"Human scan production batch",
  company:"Buyer",
  summary:"A buyer seeks an external studio for recurring batches of full-body photogrammetry scan cleanup.",
  commercial_role:"BUYER",
  notice_status:"OPEN",
  studio_eligibility:"YES",
  location:"Worldwide",
  categories:["HUMAN_DATA_CAPTURE","SCAN_CLEANUP"],
  why_it_fits:[],
  risks:[],
  missing_requirements:[],
  ...overrides
});

test("audited WIDE_MAX results keep only the real full-body scan buyer brief", () => {
  const cases = [
    {
      name:"full-body human photogrammetry cleanup",
      candidate:buyer({summary:"A US 3D scanning business needs an external team for ongoing batches of 20–50 RealityCapture body scans and offers a paid test."}),
      rejection:null
    },
    {
      name:"360 video to bust software pipeline",
      candidate:buyer({title:"360 video to 3D-printable bust",summary:"Develop a Python application and adapt our automated photo-to-3D software pipeline.",categories:["PIPELINE_CONSULTING"]}),
      rejection:"software_pipeline_project"
    },
    {
      name:"archived Reddit cleanup request",
      candidate:buyer({title:"Low-poly photogrammetry cleanup",summary:"This archived opportunity is no longer accepting applications."}),
      rejection:"inactive_source_evidence"
    },
    {
      name:"Beffio permanent lead artist",
      candidate:buyer({title:"Lead 3D Character Artist",summary:"Submit your resume for this permanent employee role.",commercial_role:"EMPLOYER"}),
      rejection:"individual_employment"
    },
    {
      name:"Zynga external-development producer employee",
      candidate:buyer({title:"Producer, External Development",summary:"Full-time employee position with annual salary and benefits.",commercial_role:"EMPLOYER"}),
      rejection:"individual_employment"
    },
    {
      name:"Reallusion Character Creator role",
      candidate:buyer({title:"Character Artist",summary:"Mandatory Reallusion Character Creator 4 and Unity workflow."}),
      rejection:"excluded_workflow"
    },
    {
      name:"Maruko realtime technical artist",
      candidate:buyer({title:"Technical 3D Artist",summary:"Full-time realtime animation systems employee role.",commercial_role:"EMPLOYER"}),
      rejection:"individual_employment"
    },
    {
      name:"Emerald Wizard closed individual role",
      candidate:buyer({title:"3D Artist and Animator",summary:"This entry-level six-month employee role is no longer accepting applications.",commercial_role:"EMPLOYER"}),
      rejection:"inactive_source_evidence"
    }
  ];

  for (const item of cases) {
    const result = evaluateCandidateRelevance(item.candidate);
    assert.equal(result.rejection, item.rejection, item.name);
  }
});

test("audited EEN Technology Offer is competitor intelligence, not a sales opportunity", () => {
  const result = classifyRecordCandidate({
    source_url:"https://een.ec.europa.eu/partnering-opportunities/b2b-search-and-technology-offer-3d-art-photogrammetry-pipeline-specialist",
    title:"Photogrammetry pipeline specialist",
    company:"Italian 3D art developer",
    commercial_role:"SELLER",
    summary:"The company offers RealityCapture, ZBrush, Blender and Substance Painter services and seeks general partners."
  });
  assert.equal(result.record_kind, "COMPETITOR");
});
