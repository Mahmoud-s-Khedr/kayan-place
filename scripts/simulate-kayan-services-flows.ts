/* eslint-disable no-console */
import {
  createKayanServicesTestContext,
  runKayanServicesHappyPath,
  runKayanServicesNegativeCases,
  summarizeServicesResults,
  writeKayanServicesReport,
} from './lib/kayan-services-test-harness';

async function main(): Promise<void> {
  const { config, userA, userB } = createKayanServicesTestContext();

  console.log(`Running Kayan Services simulation against ${config.baseUrl}`);
  console.log(`User A: ${userA.email}`);
  console.log(`User B: ${userB.email}`);

  const happy = await runKayanServicesHappyPath(config, userA, userB);
  const negative = config.negativeTests
    ? await runKayanServicesNegativeCases(config, happy.state)
    : { steps: [] };

  const allSteps = [...happy.steps, ...negative.steps];
  const summary = summarizeServicesResults(allSteps);
  const reportPath = await writeKayanServicesReport(config, allSteps, happy.state);

  console.log('\nKayan Services simulation summary');
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
  console.error(`Kayan Services simulation failed: ${message}`);
  process.exitCode = 1;
});
