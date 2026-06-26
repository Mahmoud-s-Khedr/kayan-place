/* eslint-disable no-console */
import {
  createKayanAdminTestContext,
  runKayanAdminHappyPath,
  runKayanAdminNegativeCases,
  summarizeResults,
  writeKayanAdminReport,
} from './lib/kayan-admin-test-harness';

async function main(): Promise<void> {
  const { config, targetUser } = createKayanAdminTestContext();

  console.log(`Running Kayan Admin simulation against ${config.baseUrl}`);
  console.log(`Target User: ${targetUser.email}`);

  const happy = await runKayanAdminHappyPath(config, targetUser);
  const negative = config.negativeTests
    ? await runKayanAdminNegativeCases(config, happy.state)
    : { steps: [] };

  const allSteps = [...happy.steps, ...negative.steps];
  const summary = summarizeResults(allSteps);
  const reportPath = await writeKayanAdminReport(config, allSteps, happy.state);

  console.log('\nKayan Admin simulation summary');
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
  console.error(`Kayan Admin simulation failed: ${message}`);
  process.exitCode = 1;
});
