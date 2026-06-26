/* eslint-disable no-console */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

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

export type KayanAdminTestConfig = {
  baseUrl: string;
  timeoutMs: number;
  verbose: boolean;
  negativeTests: boolean;
  continueOnFail: boolean;
  adminEmail?: string;
  adminPhone?: string;
  adminPassword?: string;
};

type AuthIdentity = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

export type KayanAdminHappyState = {
  targetUser: AuthIdentity;
  targetUserTokens: Tokens;
  adminTokens: Tokens;
  targetUserId: number;
};

export type KayanAdminHappyPathResult = {
  steps: StepResult[];
  state: KayanAdminHappyState;
};

export type KayanAdminNegativePathResult = {
  steps: StepResult[];
};

function sanitizeBaseUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/$/, '');
  if (!/^https?:\/\//.test(clean)) {
    throw new Error('BASE_URL must start with http:// or https://');
  }
  return clean;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function makeIdentity(label: 'T'): AuthIdentity {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const ssn = `A${suffix.slice(-8)}`;
  return {
    name: `Kayan Admin Target User ${label}`,
    email: `kayan.admin.sim.${label.toLowerCase()}.${suffix}@example.com`,
    phone: `+2015${suffix.slice(-8)}`,
    password: 'KayanAdminPass123',
  };
}

function getMessage(payload: ApiEnvelope | null): string {
  if (!payload) return 'No JSON payload';
  if (typeof payload.error?.message === 'string') return payload.error.message;
  const data = payload.data as Record<string, unknown> | undefined;
  if (data && typeof data.message === 'string') return data.message;
  return 'OK';
}

function payloadRequiresPhoneOnly(payload: ApiEnvelope | null): boolean {
  const message = payload?.error?.message;
  if (typeof message !== 'string') return false;
  return message.includes('property email should not exist') && message.includes('phone');
}

function pickOtp(payload: ApiEnvelope | null): string {
  const otp = (payload?.data as Record<string, unknown> | undefined)?.otp;
  if (typeof otp !== 'string' || otp.length === 0) {
    throw new Error('OTP not found in response. Ensure OTP_DEV_MODE=true on target server.');
  }
  return otp;
}

function pickTokens(payload: ApiEnvelope | null): Tokens {
  const data = payload?.data as Record<string, unknown> | undefined;
  const accessToken = data?.accessToken;
  const refreshToken = data?.refreshToken;
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new Error('Tokens not found in response payload.');
  }
  return { accessToken, refreshToken };
}

function toNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function pickId(payload: ApiEnvelope | null, key: string): number {
  const data = payload?.data as Record<string, unknown> | undefined;
  const entity = data?.[key] as Record<string, unknown> | undefined;
  const nested = toNumericId(entity?.id);
  if (nested !== null) return nested;
  const direct = toNumericId(data?.id);
  if (direct !== null) return direct;
  throw new Error(`Missing numeric ${key}.id (or data.id) in response.`);
}

async function requestJson<T>(
  config: KayanAdminTestConfig,
  method: string,
  endpoint: string,
  body?: unknown,
  headers?: HeadersMap,
): Promise<{ status: number; body: ApiEnvelope<T> | null; rawText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
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

function makeStep(name: string, ok: boolean, status: number, message: string, payload?: unknown): StepResult {
  return { name, ok, status, message, payload };
}

function logStep(config: KayanAdminTestConfig, step: StepResult): void {
  if (!config.verbose && step.ok) return;
  console.log(`[${step.ok ? 'PASS' : 'FAIL'}] ${step.name} (${step.status}) - ${step.message}`);
}

async function runAndRecord<T>(
  config: KayanAdminTestConfig,
  steps: StepResult[],
  name: string,
  expectedStatus: number | number[],
  request: () => Promise<{ status: number; body: ApiEnvelope<T> | null; rawText: string }>,
): Promise<{ status: number; body: ApiEnvelope<T> | null; rawText: string }> {
  const result = await request();
  const ok = Array.isArray(expectedStatus)
    ? expectedStatus.includes(result.status)
    : result.status === expectedStatus;
  const step = makeStep(name, ok, result.status, getMessage(result.body), result.body);
  steps.push(step);
  logStep(config, step);
  if (!ok && !config.continueOnFail) {
    throw new Error(`Step failed: ${name} status=${result.status}`);
  }
  return result;
}

async function loginWithAdaptiveIdentifier(
  config: KayanAdminTestConfig,
  steps: StepResult[],
  name: string,
  email: string | undefined,
  phone: string | undefined,
  password: string,
): Promise<Tokens> {
  if (!email && !phone) {
    throw new Error(`${name}: missing login identifier (email or phone).`);
  }

  if (email) {
    const byEmail = await requestJson(config, 'POST', '/api/auth/login', { email, password });
    const canFallback = byEmail.status === 400 && payloadRequiresPhoneOnly(byEmail.body);
    const emailOk = byEmail.status === 201 || canFallback;
    const emailStep = makeStep(
      `${name} login (email)`,
      emailOk,
      byEmail.status,
      canFallback ? `${getMessage(byEmail.body)} (falling back to phone login)` : getMessage(byEmail.body),
      byEmail.body,
    );
    steps.push(emailStep);
    logStep(config, emailStep);
    if (byEmail.status === 201) return pickTokens(byEmail.body);
    if (!canFallback) {
      throw new Error(`${name}: login failed with email mode (status=${byEmail.status}).`);
    }
  }

  if (phone) {
    const byPhone = await requestJson(config, 'POST', '/api/auth/login', { phone, password });
    const phoneStep = makeStep(`${name} login (phone)`, byPhone.status === 201, byPhone.status, getMessage(byPhone.body), byPhone.body);
    steps.push(phoneStep);
    logStep(config, phoneStep);
    if (byPhone.status === 201) return pickTokens(byPhone.body);
    throw new Error(`${name}: login failed with phone mode (status=${byPhone.status}).`);
  }

  throw new Error(`${name}: login failed and no phone fallback configured.`);
}

async function registerAndLoginUser(
  config: KayanAdminTestConfig,
  steps: StepResult[],
  identity: AuthIdentity,
  label: 'T',
): Promise<Tokens> {
  const register = await runAndRecord(config, steps, `user ${label} register`, 201, () =>
    requestJson(config, 'POST', '/api/auth/register', identity),
  );
  const otp = pickOtp(register.body);
  await runAndRecord(config, steps, `user ${label} verify otp`, 201, () =>
    requestJson(config, 'POST', '/api/auth/register/verify', { email: identity.email, otp }),
  );

  return loginWithAdaptiveIdentifier(config, steps, `user ${label}`, identity.email, identity.phone, identity.password);
}

export function createKayanAdminTestContext(overrides?: Partial<KayanAdminTestConfig>): {
  config: KayanAdminTestConfig;
  targetUser: AuthIdentity;
} {
  const config: KayanAdminTestConfig = {
    baseUrl: sanitizeBaseUrl(overrides?.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:800'),
    timeoutMs: overrides?.timeoutMs ?? parsePositiveInt(process.env.SIM_KAYAN_ADMIN_TIMEOUT_MS, 20000),
    verbose: overrides?.verbose ?? parseBool(process.env.SIM_KAYAN_ADMIN_VERBOSE, true),
    negativeTests: overrides?.negativeTests ?? parseBool(process.env.SIM_KAYAN_ADMIN_NEGATIVE_TESTS, true),
    continueOnFail: overrides?.continueOnFail ?? parseBool(process.env.SIM_KAYAN_ADMIN_CONTINUE_ON_FAIL, false),
    adminEmail: overrides?.adminEmail ?? process.env.ADMIN_EMAIL,
    adminPhone: overrides?.adminPhone ?? process.env.ADMIN_PHONE,
    adminPassword: overrides?.adminPassword ?? process.env.ADMIN_PASSWORD,
  };

  if (!config.baseUrl) throw new Error('BASE_URL is required.');
  if (!config.adminPassword) throw new Error('ADMIN_PASSWORD is required.');
  if (!config.adminEmail && !config.adminPhone) throw new Error('ADMIN_EMAIL or ADMIN_PHONE is required.');

  return {
    config,
    targetUser: makeIdentity('T'),
  };
}

export async function runKayanAdminHappyPath(
  config: KayanAdminTestConfig,
  targetUser: AuthIdentity,
): Promise<KayanAdminHappyPathResult> {
  const steps: StepResult[] = [];
  const state: Partial<KayanAdminHappyState> = { targetUser };

  state.adminTokens = await loginWithAdaptiveIdentifier(
    config,
    steps,
    'admin preflight',
    config.adminEmail,
    config.adminPhone,
    config.adminPassword!,
  );
  state.targetUserTokens = await registerAndLoginUser(config, steps, targetUser, 'T');

  const adminToken = state.adminTokens.accessToken;
  const userToken = state.targetUserTokens.accessToken;

  // Retrieve user ID
  const meRes = await runAndRecord(config, steps, 'user get profile', 200, () =>
    requestJson(config, 'GET', '/api/me', undefined, { Authorization: `Bearer ${userToken}` }),
  );
  state.targetUserId = pickId(meRes.body, 'user');
  const userId = state.targetUserId;

  // List users
  await runAndRecord(config, steps, 'admin list users', 200, () =>
    requestJson(config, 'GET', '/api/admin/users?limit=10&offset=0', undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin filter users by status', 200, () =>
    requestJson(config, 'GET', '/api/admin/users?status=active', undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin search users by name', 200, () =>
    requestJson(config, 'GET', '/api/admin/users?q=Admin', undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  // User details
  await runAndRecord(config, steps, 'admin get user details', 200, () =>
    requestJson(config, 'GET', `/api/admin/users/${userId}`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin get user listings', 200, () =>
    requestJson(config, 'GET', `/api/admin/users/${userId}/listings`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  // Status updates
  await runAndRecord(config, steps, 'admin pause user', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/users/${userId}/status`, { status: 'paused' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin ban user', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/users/${userId}/status`, { status: 'banned' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin restore user to active', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/users/${userId}/status`, { status: 'active' }, { Authorization: `Bearer ${adminToken}` }),
  );

  // Warnings
  await runAndRecord(config, steps, 'admin issue warning', 201, () =>
    requestJson(config, 'POST', '/api/admin/warnings', { targetUserId: userId, message: 'Test warning' }, { Authorization: `Bearer ${adminToken}` }),
  );

  // Admins
  await runAndRecord(config, steps, 'admin list admins', 200, () =>
    requestJson(config, 'GET', '/api/admin/admins', undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin promote user to admin', 201, () =>
    requestJson(config, 'POST', `/api/admin/admins/${userId}`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin demote user from admin', 200, () =>
    requestJson(config, 'DELETE', `/api/admin/admins/${userId}`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  // Delete user (do this last as it soft deletes)
  await runAndRecord(config, steps, 'admin delete user', 200, () =>
    requestJson(config, 'DELETE', `/api/admin/users/${userId}`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  return { steps, state: state as KayanAdminHappyState };
}

export async function runKayanAdminNegativeCases(
  config: KayanAdminTestConfig,
  state: KayanAdminHappyState,
): Promise<KayanAdminNegativePathResult> {
  const steps: StepResult[] = [];
  const adminToken = state.adminTokens.accessToken;
  const userToken = state.targetUserTokens.accessToken; // Now deleted

  await runAndRecord(config, steps, 'negative unauthorized admin list users', [401, 403], () =>
    requestJson(config, 'GET', '/api/admin/users', undefined, { Authorization: `Bearer ${userToken}` }), // using soft deleted or regular user token
  );
  
  await runAndRecord(config, steps, 'negative issue warning to invalid user', 404, () =>
    requestJson(config, 'POST', '/api/admin/warnings', { targetUserId: 99999999, message: 'Test' }, { Authorization: `Bearer ${adminToken}` }),
  );

  return { steps };
}

export function summarizeResults(steps: StepResult[]): { passed: number; failed: number; total: number } {
  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  return { passed, failed, total: steps.length };
}

export async function writeKayanAdminReport(
  config: KayanAdminTestConfig,
  steps: StepResult[],
  state: KayanAdminHappyState,
): Promise<string> {
  const now = new Date();
  const startedAt = now.toISOString();
  const runId = `${startedAt.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const totals = summarizeResults(steps);
  const summary = {
    runId,
    startedAt,
    baseUrl: config.baseUrl,
    settings: {
      negativeTests: config.negativeTests,
      continueOnFail: config.continueOnFail,
      timeoutMs: config.timeoutMs,
    },
    state: {
      targetUserEmail: state.targetUser.email,
      targetUserId: state.targetUserId,
    },
    totals,
    firstFailure: steps.find((s) => !s.ok) ?? null,
    steps,
  };

  const logDir = path.join(process.cwd(), 'logs');
  const reportFile = path.join(logDir, `kayan-admin-simulation-${runId}.json`);
  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(reportFile, JSON.stringify(summary, null, 2), 'utf8');
  return reportFile;
}
