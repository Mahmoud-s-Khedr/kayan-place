/* eslint-disable no-console */
import {
  createFollowupTestContext,
  runFollowupHappyPath,
  runFollowupNegativeCases,
  summarizeResults,
  writeFollowupReport,
} from './lib/kayan-followup-test-harness';

async function main(): Promise<void> {
  const { config, userA, userB } = createFollowupTestContext();

  console.log(`Running Kayan Follow-Up simulation against ${config.baseUrl}`);
  console.log(`User A: ${userA.email}`);
  console.log(`User B: ${userB.email}`);

  const happy = await runFollowupHappyPath(config, userA, userB);
  const negative = await runFollowupNegativeCases(config, happy.state);

  const allSteps = [...happy.steps, ...negative.steps];
  const summary = summarizeResults(allSteps);
  const reportPath = await writeFollowupReport(config, allSteps, happy.state);

  console.log('\nKayan Follow-Up simulation summary');
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Total:  ${summary.total}`);
  console.log(`Report: ${reportPath}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Kayan Follow-Up simulation failed: ${message}`);
  process.exitCode = 1;
});
