/* eslint-disable no-console */
import {
  createKayanFaultsTestContext,
  runKayanFaultsHappyPath,
  runKayanFaultsNegativeCases,
  summarizeFaultsResults,
  writeKayanFaultsReport,
} from './lib/kayan-faults-test-harness';

async function main(): Promise<void> {
  const { config, userA, userB } = createKayanFaultsTestContext();

  console.log(`Running Kayan Faults simulation against ${config.baseUrl}`);
  console.log(`User A: ${userA.email}`);
  console.log(`User B: ${userB.email}`);

  const happy = await runKayanFaultsHappyPath(config, userA, userB);
  const negative = config.negativeTests
    ? await runKayanFaultsNegativeCases(config, happy.state)
    : { steps: [] };

  const allSteps = [...happy.steps, ...negative.steps];
  const summary = summarizeFaultsResults(allSteps);
  const reportPath = await writeKayanFaultsReport(config, allSteps, happy.state);

  console.log('\nKayan Faults simulation summary');
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
  console.error(`Kayan Faults simulation failed: ${message}`);
  process.exitCode = 1;
});
