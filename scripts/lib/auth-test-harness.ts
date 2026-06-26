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

export type AuthTestConfig = {
  baseUrl: string;
  timeoutMs: number;
  verbose: boolean;
  password: string;
};

export type AuthIdentity = {
  email: string;
  phone: string;
  name: string;
  password: string;
};

export type AuthHappyState = {
  registerOtp: string;
  resetOtp: string;
  verifiedAccessToken: string;
  verifiedRefreshToken: string;
  loginAccessToken: string;
  loginRefreshToken: string;
  resetAccessToken: string;
  resetRefreshToken: string;
  refreshedAccessToken: string;
  refreshedRefreshToken: string;
};

export type AuthHappyPathResult = {
  steps: StepResult[];
  state: AuthHappyState;
};

export type AuthNegativePathResult = {
  steps: StepResult[];
};

function sanitizeBaseUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/$/, '');
  if (!/^https?:\/\//.test(clean)) {
    throw new Error('BASE_URL must start with http:// or https://');
  }
  return clean;
}

function makeIdentity(password: string): AuthIdentity {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `auth.test.${stamp}@example.com`,
    phone: `+2015${String(Date.now()).slice(-8)}`,
    name: 'Auth Test User',
    password,
  };
}

async function requestJson<T>(
  config: AuthTestConfig,
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

function logStep(config: AuthTestConfig, step: StepResult): void {
  if (!config.verbose && step.ok) return;
  const prefix = step.ok ? 'PASS' : 'FAIL';
  console.log(`[${prefix}] ${step.name} (${step.status}) - ${step.message}`);
}

export function createAuthTestContext(overrides?: Partial<AuthTestConfig>): {
  config: AuthTestConfig;
  identity: AuthIdentity;
  newPassword: string;
} {
  const config: AuthTestConfig = {
    baseUrl: sanitizeBaseUrl(overrides?.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:800'),
    timeoutMs: overrides?.timeoutMs ?? Number(process.env.AUTH_TEST_TIMEOUT_MS ?? 15000),
    verbose: overrides?.verbose ?? (process.argv.includes('--verbose') || process.argv.includes('-v')),
    password: overrides?.password ?? process.env.AUTH_TEST_PASSWORD ?? 'AuthPass123',
  };

  const identity = makeIdentity(config.password);
  return {
    config,
    identity,
    newPassword: 'AuthPass456',
  };
}

export async function runAuthHappyPath(
  config: AuthTestConfig,
  identity: AuthIdentity,
  newPassword: string,
): Promise<AuthHappyPathResult> {
  const steps: StepResult[] = [];

  const register = await requestJson(config, 'POST', '/api/auth/register', {
    name: identity.name,
    email: identity.email,
    phone: identity.phone,
    password: identity.password,
  });
  const registerOtp = pickOtp(register.body);
  const registerStep = makeStep('register request OTP', register.status === 201 && !!registerOtp, register.status, getMessage(register.body), register.body);
  steps.push(registerStep);
  logStep(config, registerStep);
  if (!registerStep.ok) throw new Error('Happy path failed at register');

  const resend = await requestJson(config, 'POST', '/api/auth/register/resend-otp', {
    email: identity.email,
  });
  const resendOtp = pickOtp(resend.body);
  const resendStep = makeStep('register resend OTP', resend.status === 201 && !!resendOtp, resend.status, getMessage(resend.body), resend.body);
  steps.push(resendStep);
  logStep(config, resendStep);
  if (!resendStep.ok) throw new Error('Happy path failed at resend OTP');

  const verify = await requestJson(config, 'POST', '/api/auth/register/verify', {
    email: identity.email,
    otp: resendOtp,
  });
  const verifyTokens = pickTokens(verify.body);
  const verifyStep = makeStep('register verify OTP', verify.status === 201 && !!verifyTokens, verify.status, getMessage(verify.body), verify.body);
  steps.push(verifyStep);
  logStep(config, verifyStep);
  if (!verifyStep.ok || !verifyTokens) throw new Error('Happy path failed at verify');

  const login = await requestJson(config, 'POST', '/api/auth/login', {
    email: identity.email,
    password: identity.password,
  });
  const loginTokens = pickTokens(login.body);
  const loginStep = makeStep('login', login.status === 201 && !!loginTokens, login.status, getMessage(login.body), login.body);
  steps.push(loginStep);
  logStep(config, loginStep);
  if (!loginStep.ok || !loginTokens) throw new Error('Happy path failed at login');

  const resetRequest = await requestJson(config, 'POST', '/api/auth/password/request-otp', {
    email: identity.email,
  });
  const resetOtp = pickOtp(resetRequest.body);
  const resetReqStep = makeStep('password request OTP', resetRequest.status === 201 && !!resetOtp, resetRequest.status, getMessage(resetRequest.body), resetRequest.body);
  steps.push(resetReqStep);
  logStep(config, resetReqStep);
  if (!resetReqStep.ok || !resetOtp) throw new Error('Happy path failed at password request OTP');

  const reset = await requestJson(config, 'POST', '/api/auth/password/reset', {
    email: identity.email,
    otp: resetOtp,
    newPassword,
    confirmPassword: newPassword,
  });
  const resetTokens = pickTokens(reset.body);
  const resetStep = makeStep('password reset', reset.status === 201 && !!resetTokens, reset.status, getMessage(reset.body), reset.body);
  steps.push(resetStep);
  logStep(config, resetStep);
  if (!resetStep.ok || !resetTokens) throw new Error('Happy path failed at password reset');

  const loginAfterReset = await requestJson(config, 'POST', '/api/auth/login', {
    email: identity.email,
    password: newPassword,
  });
  const resetLoginTokens = pickTokens(loginAfterReset.body);
  const resetLoginStep = makeStep('login with new password', loginAfterReset.status === 201 && !!resetLoginTokens, loginAfterReset.status, getMessage(loginAfterReset.body), loginAfterReset.body);
  steps.push(resetLoginStep);
  logStep(config, resetLoginStep);
  if (!resetLoginStep.ok || !resetLoginTokens) throw new Error('Happy path failed at login with new password');

  const refresh = await requestJson(config, 'POST', '/api/auth/refresh', {
    refreshToken: resetLoginTokens.refreshToken,
  });
  const refreshTokens = pickTokens(refresh.body);
  const refreshStep = makeStep('refresh token', refresh.status === 201 && !!refreshTokens, refresh.status, getMessage(refresh.body), refresh.body);
  steps.push(refreshStep);
  logStep(config, refreshStep);
  if (!refreshStep.ok || !refreshTokens) throw new Error('Happy path failed at refresh');

  const logout = await requestJson(config, 'POST', '/api/auth/logout', {
    refreshToken: refreshTokens.refreshToken,
  }, {
    Authorization: `Bearer ${refreshTokens.accessToken}`,
  });
  const logoutStep = makeStep('logout', logout.status === 201, logout.status, getMessage(logout.body), logout.body);
  steps.push(logoutStep);
  logStep(config, logoutStep);
  if (!logoutStep.ok) throw new Error('Happy path failed at logout');

  return {
    steps,
    state: {
      registerOtp: resendOtp as string,
      resetOtp: resetOtp as string,
      verifiedAccessToken: verifyTokens.accessToken,
      verifiedRefreshToken: verifyTokens.refreshToken,
      loginAccessToken: loginTokens.accessToken,
      loginRefreshToken: loginTokens.refreshToken,
      resetAccessToken: resetTokens.accessToken,
      resetRefreshToken: resetTokens.refreshToken,
      refreshedAccessToken: refreshTokens.accessToken,
      refreshedRefreshToken: refreshTokens.refreshToken,
    },
  };
}

export async function runAuthNegativeCases(
  config: AuthTestConfig,
  identity: AuthIdentity,
): Promise<AuthNegativePathResult> {
  const steps: StepResult[] = [];

  const duplicateRegistration = await requestJson(config, 'POST', '/api/auth/register', {
    name: identity.name,
    email: identity.email,
    phone: identity.phone,
    password: identity.password,
  });
  const duplicateStep = makeStep('negative: duplicate registration', duplicateRegistration.status === 409, duplicateRegistration.status, getMessage(duplicateRegistration.body), duplicateRegistration.body);
  steps.push(duplicateStep);
  logStep(config, duplicateStep);

  const wrongOtpVerify = await requestJson(config, 'POST', '/api/auth/register/verify', {
    email: identity.email,
    otp: '111111',
  });
  const wrongOtpStep = makeStep('negative: wrong OTP verify', wrongOtpVerify.status === 400, wrongOtpVerify.status, getMessage(wrongOtpVerify.body), wrongOtpVerify.body);
  steps.push(wrongOtpStep);
  logStep(config, wrongOtpStep);

  const badLogin = await requestJson(config, 'POST', '/api/auth/login', {
    email: identity.email,
    password: 'WrongPass123',
  });
  const badLoginStep = makeStep('negative: wrong password login', badLogin.status === 401, badLogin.status, getMessage(badLogin.body), badLogin.body);
  steps.push(badLoginStep);
  logStep(config, badLoginStep);

  const mismatchReset = await requestJson(config, 'POST', '/api/auth/password/reset', {
    email: identity.email,
    otp: '000000',
    newPassword: 'Mismatch123',
    confirmPassword: 'Mismatch456',
  });
  const mismatchStep = makeStep('negative: reset password mismatch', mismatchReset.status === 400, mismatchReset.status, getMessage(mismatchReset.body), mismatchReset.body);
  steps.push(mismatchStep);
  logStep(config, mismatchStep);

  const invalidRefresh = await requestJson(config, 'POST', '/api/auth/refresh', {
    refreshToken: 'invalid.token.value',
  });
  const refreshStep = makeStep('negative: invalid refresh token', invalidRefresh.status === 401, invalidRefresh.status, getMessage(invalidRefresh.body), invalidRefresh.body);
  steps.push(refreshStep);
  logStep(config, refreshStep);

  return { steps };
}

export function summarizeResults(results: StepResult[]): { passed: number; failed: number } {
  const passed = results.filter((step) => step.ok).length;
  return { passed, failed: results.length - passed };
}
