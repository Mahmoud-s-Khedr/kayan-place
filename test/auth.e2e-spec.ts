import {
  createAuthTestContext,
  runAuthHappyPath,
  runAuthNegativeCases,
} from '../scripts/lib/auth-test-harness';

describe('Auth module e2e (live API)', () => {
  it('runs happy path auth flow end-to-end', async () => {
    const { config, identity, newPassword } = createAuthTestContext({ verbose: false });
    const result = await runAuthHappyPath(config, identity, newPassword);

    expect(result.steps.every((step) => step.ok)).toBe(true);
    expect(typeof result.state.refreshedAccessToken).toBe('string');
    expect(result.state.refreshedAccessToken.length).toBeGreaterThan(20);
  }, 60_000);

  it('covers core auth negative cases', async () => {
    const { config, identity, newPassword } = createAuthTestContext({ verbose: false });
    await runAuthHappyPath(config, identity, newPassword);

    const negative = await runAuthNegativeCases(config, identity);
    expect(negative.steps.every((step) => step.ok)).toBe(true);
  }, 60_000);
});
