/* eslint-disable no-console */
import {
  createKayanTestContext,
  runKayanHappyPath,
  runKayanNegativeCases,
  summarizeResults,
  writeKayanReport,
} from './lib/kayan-test-harness';

async function main(): Promise<void> {
  const { config, userA, userB } = createKayanTestContext();

  console.log(`Running Kayan simulation against ${config.baseUrl}`);
  console.log(`User A: ${userA.email}`);
  console.log(`User B: ${userB.email}`);

  const happy = await runKayanHappyPath(config, userA, userB);
  const negative = config.negativeTests
    ? await runKayanNegativeCases(config, happy.state)
    : { steps: [] };

  const allSteps = [...happy.steps, ...negative.steps];
  const summary = summarizeResults(allSteps);
  const reportPath = await writeKayanReport(config, allSteps, happy.state);

  console.log('\nKayan simulation summary');
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
  console.error(`Kayan simulation failed: ${message}`);
  process.exitCode = 1;
});
