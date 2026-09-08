import test from "node:test";
import assert from "node:assert/strict";
import {
  ULTRA_MAX_PAID_CONFIRMATION,
  ultraMaxPaidConfiguration,
  ultraMaxPaidConfirmationValid,
  ultraMaxPaidState
} from "../src/server/ultra-max-paid-policy.mjs";

function env(overrides={}) {
  const values={
    RADAR_ULTRA_MAX_ENABLED:"true",
    RADAR_ULTRA_MAX_PAID_ENABLED:"true",
    RADAR_LIVE_AI_ENABLED:"true",
    OPENAI_API_KEY:"test-key",
    ...overrides
  };
  return (key)=>values[key]||"";
}

test("ULTRA paid execution is independently locked and production-only", () => {
  const production={deploy:{context:"production"}};
  assert.equal(ultraMaxPaidState({context:production,getEnv:env({RADAR_ULTRA_MAX_PAID_ENABLED:"false"})}),"LOCKED");
  assert.equal(ultraMaxPaidState({context:production,getEnv:env({RADAR_LIVE_AI_ENABLED:"false"})}),"LIVE_AI_LOCKED");
  assert.equal(ultraMaxPaidState({context:{deploy:{context:"deploy-preview"}},getEnv:env()}),"CONTEXT_BLOCKED");
  assert.equal(ultraMaxPaidState({context:production,getEnv:env({OPENAI_API_KEY:""})}),"OPENAI_NOT_CONFIGURED");
});

test("ULTRA paid configuration exposes only the immutable root boundaries", () => {
  const config=ultraMaxPaidConfiguration({context:{deploy:{context:"production"}},getEnv:env()});
  assert.equal(config.ok,true);
  assert.equal(config.cap_microusd,15_000_000);
  assert.equal(config.openai_request_limit,100);
  assert.equal(config.web_search_call_limit,300);
  assert.equal(config.result_limit,100);
  assert.equal(config.retry_allowed,false);
});

test("ULTRA paid continuation requires the exact explicit confirmation", () => {
  assert.equal(ultraMaxPaidConfirmationValid(ULTRA_MAX_PAID_CONFIRMATION),true);
  assert.equal(ultraMaxPaidConfirmationValid("RUN_ULTRA_MAX"),false);
  assert.equal(ultraMaxPaidConfirmationValid(true),false);
});
