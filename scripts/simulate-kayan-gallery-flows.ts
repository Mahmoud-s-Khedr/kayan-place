/* eslint-disable no-console */

import {
  createGalleryTestContext,
  runGalleryHappyPath,
  runGalleryNegativeCases,
  summarizeResults,
  writeGalleryReport,
} from './lib/kayan-gallery-test-harness';

async function main(): Promise<void> {
  const { config, user } = createGalleryTestContext();

  console.log(`Running Kayan Gallery simulation against ${config.baseUrl}`);
  console.log(`Simulation user: ${user.email}`);

  const happy = await runGalleryHappyPath(config, user);
  const negative = config.negativeTests
    ? await runGalleryNegativeCases(config, happy.state)
    : { steps: [] };

  const allSteps = [...happy.steps, ...negative.steps];
  const summary = summarizeResults(allSteps);
  const reportPath = await writeGalleryReport(config, allSteps, happy.state);

  console.log('\nKayan Gallery simulation summary');
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
  console.error(`Kayan Gallery simulation failed: ${message}`);
  process.exitCode = 1;
});
