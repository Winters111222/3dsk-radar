import test from "node:test";
import assert from "node:assert/strict";
import { buildCompetitorAuditReport } from "../scripts/competitor-audit-report.mjs";

test("audit report classifies without mutating the provided snapshot", () => {
  const payload = { opportunities:[
    { id:"sales",company:"Buyer Studio",source_url:"https://buyer.example/rfp",commercial_role:"BUYER",summary:"Request for proposal for an external vendor.",title:"RFP" },
    { id:"seller",company:"Synthetic Seller",source_url:"https://seller.example/services",commercial_role:"SELLER",summary:"Our studio provides character services.",title:"Services" },
    { id:"platform",company:"Synthetic Index",source_url:"https://index.example/archive",commercial_role:"UNKNOWN",summary:"Archived job aggregator and ATS dataset.",title:"Jobs index" }
  ] };
  const before = structuredClone(payload);
  const report = buildCompetitorAuditReport(payload);
  assert.deepEqual(payload, before);
  assert.equal(report.mode, "READ_ONLY");
  assert.equal(report.writes_performed, 0);
  assert.deepEqual(report.proposed_counts, {sales_opportunities:1,competitors:1,source_platforms:1,manual_review:0});
  assert.equal(report.rows.find((row) => row.id === "seller").sales_actions_locked, true);
});

test("audit report catches legacy seller records carrying a false buyer label", () => {
  const report = buildCompetitorAuditReport({ opportunities:[
    {
      id:"legacy-game-services",
      company:"Synthetic Game Services",
      source_url:"https://seller.example/game",
      commercial_role:"BUYER",
      summary:"An outsourcing company publicly offering game-art services. Potential subcontracting or reciprocal overflow lead.",
      title:"Game-art partnership signal"
    },
    {
      id:"legacy-marketplace-product",
      company:"Synthetic Digital Human Vendor",
      source_url:"https://aws.amazon.com/marketplace/pp/prodview-synthetic",
      commercial_role:"BUYER",
      summary:"Enterprise digital-human product offering for customer-facing experiences.",
      title:"Digital-human services"
    }
  ] });
  assert.equal(report.proposed_counts.competitors, 2);
  assert.equal(report.proposed_counts.sales_opportunities, 0);
  assert.equal(report.rows.every((row) => row.sales_actions_locked), true);
});
