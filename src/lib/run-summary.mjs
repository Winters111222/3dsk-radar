const measured = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
export function runSummary(run) {
  const failed = (run?.coverage || []).filter(item => item.status === "FAILED").length;
  const storedFailed = measured(run?.failed_shards) || 0;
  const failedShards = Math.max(failed, storedFailed);
  const status = failedShards && !["FAILED", "CANCELLED"].includes(run?.search_status) ? "PARTIAL" : run?.search_status || "UNKNOWN";
  return {
    status, failedShards,
    returned:measured(run?.returned_count ?? run?.counters?.candidates_verified),
    newCount:measured(run?.new_opportunities ?? run?.counters?.new_opportunities),
    updated:measured(run?.updated_opportunities ?? run?.counters?.updated_opportunities),
    workspace:measured(run?.workspace_total ?? run?.counters?.workspace_total)
  };
}
