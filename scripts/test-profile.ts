/* eslint-disable no-console */
import {
  createProfileTestContext,
  runProfileHappyPath,
  runProfileNegativeCases,
  summarizeResults,
} from './lib/profile-test-harness';

async function main(): Promise<void> {
  if (process.env.OTP_DEV_MODE !== 'true') {
    throw new Error('OTP_DEV_MODE=true is required on the backend for automated profile flow testing.');
  }

  const { config, identity } = createProfileTestContext();

  console.log(`Running profile tests against ${config.baseUrl}`);
  console.log(`Identity: ${identity.email}`);

  const happy = await runProfileHappyPath(config, identity);
  const negative = await runProfileNegativeCases(config, happy.state);

  const allSteps = [...happy.steps, ...negative.steps];
  const summary = summarizeResults(allSteps);

  console.log('\nProfile test summary');
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Total:  ${allSteps.length}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Profile test run failed: ${message}`);
  process.exitCode = 1;
});
