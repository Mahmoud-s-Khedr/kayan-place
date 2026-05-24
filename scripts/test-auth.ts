/* eslint-disable no-console */
import {
  createAuthTestContext,
  runAuthHappyPath,
  runAuthNegativeCases,
  summarizeResults,
} from './lib/auth-test-harness';

async function main(): Promise<void> {
  if (process.env.OTP_DEV_MODE !== 'true') {
    throw new Error('OTP_DEV_MODE=true is required on the backend for automated OTP testing.');
  }

  const { config, identity, newPassword } = createAuthTestContext();

  console.log(`Running auth tests against ${config.baseUrl}`);
  console.log(`Identity: ${identity.email}`);

  const happy = await runAuthHappyPath(config, identity, newPassword);
  const negative = await runAuthNegativeCases(config, identity);

  const allSteps = [...happy.steps, ...negative.steps];
  const summary = summarizeResults(allSteps);

  console.log('\nAuth test summary');
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Total:  ${allSteps.length}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Auth test run failed: ${message}`);
  process.exitCode = 1;
});
