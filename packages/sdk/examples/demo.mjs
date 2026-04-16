import {
  Badge,
  enrollAndCacheBadgeToken,
  getCachedBadgeToken,
} from "../dist/index.js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function enrollMerchant(installId, merchant) {
  const token = getCachedBadgeToken(merchant) ?? await enrollAndCacheBadgeToken(merchant);
  if (!token) {
    throw new Error(`Could not enroll or recover badge token for ${merchant}`);
  }
  return Badge.init({ installId, existingToken: token });
}

async function runLeg(badge, merchant, steps) {
  const runId = badge.startRun();
  for (const step of steps) {
    await badge.declareVisit({ merchant, runId, context: step });
  }
  await badge.reportOutcome({ merchant, runId, outcome: "not_denied" });
  return runId;
}

async function main() {
  requireEnv("KYA_API_KEY");
  const seedBadge = await Badge.init();
  const installId = seedBadge.installId;

  const badgeA = await enrollMerchant(installId, "merchant-a.test");
  const badgeB = await enrollMerchant(installId, "merchant-b.test");

  const run1 = await runLeg(badgeA, "merchant-a.test", ["arrival", "addtocart"]);
  const run2 = await runLeg(badgeB, "merchant-b.test", ["arrival", "addtocart"]);
  const run3 = await runLeg(badgeA, "merchant-a.test", ["arrival"]);

  console.log(JSON.stringify({
    installId,
    runs: {
      merchantA1: run1,
      merchantB: run2,
      merchantA2: run3,
    },
    nextStep: "Query badge_events and kya_scores for this installId to verify DC2/DC3.",
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
