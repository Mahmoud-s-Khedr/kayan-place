/* eslint-disable no-console */

type HeadersMap = Record<string, string>;

type ApiEnvelope<T = any> = {
  success?: boolean;
  statusCode?: number;
  data?: T;
  error?: {
    code?: number;
    message?: string;
  };
};

export type StepResult<T = unknown> = {
  name: string;
  ok: boolean;
  status: number;
  message: string;
  payload?: T;
};

export type ProfileTestConfig = {
  baseUrl: string;
  timeoutMs: number;
  verbose: boolean;
  password: string;
  newPassword: string;
};

export type ProfileIdentity = {
  email: string;
  phone: string;
  ssn: string;
  name: string;
  password: string;
};

export type ProfileHappyState = {
  accessToken: string;
  refreshToken: string;
  email: string;
  phone: string;
  updatedPhone: string;
  name: string;
  updatedName: string;
  updatedContactInfo: string;
  updatedPassword: string;
};

export type ProfileHappyPathResult = {
  steps: StepResult[];
  state: ProfileHappyState;
};

export type ProfileNegativePathResult = {
  steps: StepResult[];
};

function sanitizeBaseUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/$/, '');
  if (!/^https?:\/\//.test(clean)) {
    throw new Error('BASE_URL must start with http:// or https://');
  }
  return clean;
}

function makeIdentity(password: string): ProfileIdentity {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const digits = String(Date.now()).slice(-8);
  return {
    email: `profile.test.${stamp}@example.com`,
    phone: `+2015${String(Date.now()).slice(-8)}`,
    ssn: `P${digits}`,
    name: 'Profile Test User',
    password,
  };
}

function buildAltPhone(basePhone: string): string {
  const head = basePhone.slice(0, -1);
  const tail = basePhone.slice(-1);
  const next = tail === '9' ? '8' : '9';
  return `${head}${next}`;
}

async function requestJson<T>(
  config: ProfileTestConfig,
  method: string,
  path: string,
  body?: unknown,
  headers?: HeadersMap,
): Promise<{ status: number; body: ApiEnvelope<T> | null; rawText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed: ApiEnvelope<T> | null = null;

    try {
      parsed = rawText ? (JSON.parse(rawText) as ApiEnvelope<T>) : null;
    } catch {
      parsed = null;
    }

    return { status: response.status, body: parsed, rawText };
  } finally {
    clearTimeout(timer);
  }
}

function getMessage(payload: ApiEnvelope | null): string {
  if (!payload) return 'No JSON payload';
  if (typeof payload.error?.message === 'string') return payload.error.message;
  const data = payload.data as Record<string, unknown> | undefined;
  if (data && typeof data.message === 'string') return data.message;
  return 'OK';
}

function pickOtp(payload: ApiEnvelope | null): string | null {
  const data = payload?.data as Record<string, unknown> | undefined;
  if (!data) return null;
  return typeof data.otp === 'string' ? data.otp : null;
}

function pickTokens(payload: ApiEnvelope | null): { accessToken: string; refreshToken: string } | null {
  const data = payload?.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const accessToken = data.accessToken;
  const refreshToken = data.refreshToken;
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') return null;
  return { accessToken, refreshToken };
}

function makeStep(name: string, ok: boolean, status: number, message: string, payload?: unknown): StepResult {
  return { name, ok, status, message, payload };
}

function logStep(config: ProfileTestConfig, step: StepResult): void {
  if (!config.verbose && step.ok) return;
  const prefix = step.ok ? 'PASS' : 'FAIL';
  console.log(`[${prefix}] ${step.name} (${step.status}) - ${step.message}`);
}

function pickUser(payload: ApiEnvelope | null): Record<string, unknown> | null {
  const data = payload?.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const user = data.user;
  if (!user || typeof user !== 'object') return null;
  return user as Record<string, unknown>;
}

function validateMeContract(user: Record<string, unknown> | null): boolean {
  if (!user) return false;
  return (
    typeof user.id === 'number' &&
    typeof user.email === 'string' &&
    typeof user.phone === 'string' &&
    typeof user.name === 'string' &&
    (typeof user.contactInfo === 'string' || user.contactInfo === null)
  );
}

export function createProfileTestContext(overrides?: Partial<ProfileTestConfig>): {
  config: ProfileTestConfig;
  identity: ProfileIdentity;
} {
  const config: ProfileTestConfig = {
    baseUrl: sanitizeBaseUrl(overrides?.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:800'),
    timeoutMs: overrides?.timeoutMs ?? Number(process.env.PROFILE_TEST_TIMEOUT_MS ?? 15000),
    verbose: overrides?.verbose ?? (process.argv.includes('--verbose') || process.argv.includes('-v')),
    password: overrides?.password ?? process.env.PROFILE_TEST_PASSWORD ?? 'ProfilePass123',
    newPassword: overrides?.newPassword ?? process.env.PROFILE_TEST_NEW_PASSWORD ?? 'ProfilePass456',
  };

  return {
    config,
    identity: makeIdentity(config.password),
  };
}

async function bootstrapUser(
  config: ProfileTestConfig,
  identity: ProfileIdentity,
  steps: StepResult[],
): Promise<{ accessToken: string; refreshToken: string }> {
  const register = await requestJson(config, 'POST', '/api/auth/register', {
    name: identity.name,
    ssn: identity.ssn,
    email: identity.email,
    phone: identity.phone,
    password: identity.password,
  });
  const registerOtp = pickOtp(register.body);
  const registerStep = makeStep('bootstrap: register request OTP', register.status === 201 && !!registerOtp, register.status, getMessage(register.body), register.body);
  steps.push(registerStep);
  logStep(config, registerStep);
  if (!registerStep.ok) throw new Error('Bootstrap failed at register');

  const verify = await requestJson(config, 'POST', '/api/auth/register/verify', {
    email: identity.email,
    otp: registerOtp,
  });
  const verifyTokens = pickTokens(verify.body);
  const verifyStep = makeStep('bootstrap: register verify OTP', verify.status === 201 && !!verifyTokens, verify.status, getMessage(verify.body), verify.body);
  steps.push(verifyStep);
  logStep(config, verifyStep);
  if (!verifyStep.ok || !verifyTokens) throw new Error('Bootstrap failed at verify');

  return verifyTokens;
}

export async function runProfileHappyPath(
  config: ProfileTestConfig,
  identity: ProfileIdentity,
): Promise<ProfileHappyPathResult> {
  const steps: StepResult[] = [];
  const tokens = await bootstrapUser(config, identity, steps);

  const meBefore = await requestJson(config, 'GET', '/api/me', undefined, {
    Authorization: `Bearer ${tokens.accessToken}`,
  });
  const meBeforeUser = pickUser(meBefore.body);
  const meBeforeOk = meBefore.status === 200 && validateMeContract(meBeforeUser);
  const meBeforeStep = makeStep('profile: GET /me baseline', meBeforeOk, meBefore.status, getMessage(meBefore.body), meBefore.body);
  steps.push(meBeforeStep);
  logStep(config, meBeforeStep);
  if (!meBeforeStep.ok) throw new Error('Happy path failed at GET /me baseline');

  const updatedName = `${identity.name} Updated`;
  const updatedPhone = buildAltPhone(identity.phone);
  const updatedContactInfo = '+201000000777';

  const patchProfile = await requestJson(config, 'PATCH', '/api/me', {
    name: updatedName,
    phone: updatedPhone,
    contactInfo: updatedContactInfo,
  }, {
    Authorization: `Bearer ${tokens.accessToken}`,
  });
  const patchUser = pickUser(patchProfile.body);
  const patchOk = patchProfile.status === 200
    && patchUser?.name === updatedName
    && patchUser?.phone === updatedPhone
    && patchUser?.contactInfo === updatedContactInfo;
  const patchStep = makeStep('profile: PATCH /me update name+phone+contact', patchOk, patchProfile.status, getMessage(patchProfile.body), patchProfile.body);
  steps.push(patchStep);
  logStep(config, patchStep);
  if (!patchStep.ok) throw new Error('Happy path failed at PATCH /me');

  const meAfter = await requestJson(config, 'GET', '/api/me', undefined, {
    Authorization: `Bearer ${tokens.accessToken}`,
  });
  const meAfterUser = pickUser(meAfter.body);
  const meAfterOk = meAfter.status === 200
    && meAfterUser?.name === updatedName
    && meAfterUser?.phone === updatedPhone
    && meAfterUser?.contactInfo === updatedContactInfo;
  const meAfterStep = makeStep('profile: GET /me verify updates', meAfterOk, meAfter.status, getMessage(meAfter.body), meAfter.body);
  steps.push(meAfterStep);
  logStep(config, meAfterStep);
  if (!meAfterStep.ok) throw new Error('Happy path failed at GET /me verify');

  const changePassword = await requestJson(config, 'PATCH', '/api/me/password', {
    oldPassword: identity.password,
    newPassword: config.newPassword,
  }, {
    Authorization: `Bearer ${tokens.accessToken}`,
  });
  const changePasswordStep = makeStep('profile: PATCH /me/password', changePassword.status === 200, changePassword.status, getMessage(changePassword.body), changePassword.body);
  steps.push(changePasswordStep);
  logStep(config, changePasswordStep);
  if (!changePasswordStep.ok) throw new Error('Happy path failed at PATCH /me/password');

  const loginNewPassword = await requestJson(config, 'POST', '/api/auth/login', {
    email: identity.email,
    password: config.newPassword,
  });
  const reloginTokens = pickTokens(loginNewPassword.body);
  const loginStep = makeStep('profile: login with new password', loginNewPassword.status === 201 && !!reloginTokens, loginNewPassword.status, getMessage(loginNewPassword.body), loginNewPassword.body);
  steps.push(loginStep);
  logStep(config, loginStep);
  if (!loginStep.ok || !reloginTokens) throw new Error('Happy path failed at login with new password');

  return {
    steps,
    state: {
      accessToken: reloginTokens.accessToken,
      refreshToken: reloginTokens.refreshToken,
      email: identity.email,
      phone: identity.phone,
      updatedPhone,
      name: identity.name,
      updatedName,
      updatedContactInfo,
      updatedPassword: config.newPassword,
    },
  };
}

export async function runProfileNegativeCases(
  config: ProfileTestConfig,
  state: ProfileHappyState,
): Promise<ProfileNegativePathResult> {
  const steps: StepResult[] = [];

  const emptyPatch = await requestJson(config, 'PATCH', '/api/me', {}, {
    Authorization: `Bearer ${state.accessToken}`,
  });
  const emptyStep = makeStep('negative: PATCH /me empty payload', emptyPatch.status === 400, emptyPatch.status, getMessage(emptyPatch.body), emptyPatch.body);
  steps.push(emptyStep);
  logStep(config, emptyStep);

  const invalidPhonePatch = await requestJson(config, 'PATCH', '/api/me', {
    phone: '123',
  }, {
    Authorization: `Bearer ${state.accessToken}`,
  });
  const invalidPhoneStep = makeStep('negative: PATCH /me invalid phone', invalidPhonePatch.status === 400, invalidPhonePatch.status, getMessage(invalidPhonePatch.body), invalidPhonePatch.body);
  steps.push(invalidPhoneStep);
  logStep(config, invalidPhoneStep);

  const wrongOldPassword = await requestJson(config, 'PATCH', '/api/me/password', {
    oldPassword: 'WrongPass123',
    newPassword: 'AnotherPass123',
  }, {
    Authorization: `Bearer ${state.accessToken}`,
  });
  const wrongOldPasswordAccepted = wrongOldPassword.status === 400 || wrongOldPassword.status === 401;
  const wrongOldPasswordStep = makeStep('negative: PATCH /me/password wrong old password', wrongOldPasswordAccepted, wrongOldPassword.status, getMessage(wrongOldPassword.body), wrongOldPassword.body);
  steps.push(wrongOldPasswordStep);
  logStep(config, wrongOldPasswordStep);

  const otherIdentity = makeIdentity('ProfilePass999');
  const bootstrapSteps: StepResult[] = [];
  const otherTokens = await bootstrapUser(config, otherIdentity, bootstrapSteps);
  steps.push(...bootstrapSteps);

  const phoneConflict = await requestJson(config, 'PATCH', '/api/me', {
    phone: state.updatedPhone,
  }, {
    Authorization: `Bearer ${otherTokens.accessToken}`,
  });
  const conflictStep = makeStep('negative: PATCH /me duplicate phone', phoneConflict.status === 409, phoneConflict.status, getMessage(phoneConflict.body), phoneConflict.body);
  steps.push(conflictStep);
  logStep(config, conflictStep);

  return { steps };
}

export function summarizeResults(results: StepResult[]): { passed: number; failed: number } {
  const passed = results.filter((step) => step.ok).length;
  return { passed, failed: results.length - passed };
}
