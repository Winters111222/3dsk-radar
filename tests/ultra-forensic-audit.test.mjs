import test from "node:test";
import assert from "node:assert/strict";
import { buildUltraForensicAudit } from "../src/server/ultra-forensic-audit.mjs";

const phase = (phaseId, seen, records, rejectionReasons = {}) => ({
  usage:{candidates_seen:seen,results_accepted:records.length},
  payload:{phase_id:phaseId,search_status:"COMPLETE",records,diagnostics:{rejection_reasons:rejectionReasons,source_yield:[]}}
});

test("forensic audit accounts for pre-truth rejection, cross-phase duplicates and detail rejection", () => {
  const repeated={id:"candidate-a",record_kind:"SALES_OPPORTUNITY",title:"A",source_url:"https://www.freelancer.com/projects/3d-modelling/a",discovery_source_id:"freelancer"};
  const second={id:"candidate-b",record_kind:"SALES_OPPORTUNITY",title:"B",source_url:"https://www.upwork.com/freelance-jobs/apply/b_~022000000000000000000",discovery_source_id:"upwork"};
  const outputs=[
    phase("CORE_DISCOVERY",4,[repeated,second],{individual_employment:2}),
    phase("PROCUREMENT_FUNDING",2,[],{out_of_scope:2}),
    phase("MULTILINGUAL_LONG_TAIL",2,[repeated],{inactive_notice:1}),
    phase("SIGNAL_EXPANSION",1,[],{partner_without_buyer_signal:1}),
    phase("ADAPTIVE_FOLLOWUP",1,[repeated])
  ];
  const audit=buildUltraForensicAudit({
    run:{run_id:"542a342a-1b95-4777-bcac-057d28ad23fc"},
    phaseOutputs:outputs,
    detailOutput:{payload:{verification:{selected_candidates:2,verified_candidates:1,candidate_results:[
      {candidate_id:"candidate-a",source_url:repeated.source_url,status:"VERIFIED"},
      {candidate_id:"candidate-b",source_url:second.source_url,status:"REJECTED"}
    ]}}},
    persistence:{new_count:1,updated_count:0}
  });
  assert.deepEqual(audit.funnel,{
    candidates_seen:10,
    accepted_occurrences:4,
    rejected_before_detail:6,
    detail_candidates_selected:2,
    duplicate_accepted_occurrences:2,
    detail_candidates_rejected:1,
    detail_candidates_verified:1,
    final_new_sales:1,
    final_updated_sales:0,
    verified_not_persisted:0,
    non_final_candidates_accounted:9,
    accounting_complete:true
  });
  assert.equal(audit.accepted_candidate_ledger.length,2);
  assert.equal(audit.accepted_candidate_ledger[0].accepted_occurrences,3);
  assert.deepEqual(audit.rejection_reasons,{detail_verification_failed:1,inactive_notice:1,individual_employment:2,out_of_scope:2,partner_without_buyer_signal:1});
});

test("forensic audit reports candidate-level availability only for the new retained schema",()=>{
  const outputs=["CORE_DISCOVERY","PROCUREMENT_FUNDING","MULTILINGUAL_LONG_TAIL","SIGNAL_EXPANSION","ADAPTIVE_FOLLOWUP"].map((phaseId)=>({payload:{phase_id:phaseId,records:[],rejected_candidates:[],diagnostics:{rejection_reasons:{},source_yield:[]}},usage:{}}));
  const audit=buildUltraForensicAudit({run:{run_id:"retained-run"},phaseOutputs:outputs,detailOutput:{payload:{verification:{candidate_results:[]}}}});
  assert.equal(audit.exact_candidate_level_rejections_available,true);
  assert.equal(audit.privacy,"PUBLIC_CANDIDATE_REVIEW_RECORDS_NO_CONTACT_DATA");
});

test("forensic audit labels missing historical operation evidence without inventing candidates", () => {
  const audit=buildUltraForensicAudit({run:{run_id:"historical-run"},phaseOutputs:[],detailOutput:{payload:{verification:{}}}});
  assert.equal(audit.phases.every((item)=>item.search_status==="EVIDENCE_UNAVAILABLE"),true);
  assert.equal(audit.exact_candidate_level_rejections_available,false);
  assert.equal(audit.accepted_candidate_ledger.length,0);
});
