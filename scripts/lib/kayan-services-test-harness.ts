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

export type KayanServicesTestConfig = {
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
  ssn: string;
  password: string;
};

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

export type KayanServicesHappyState = {
  userA: AuthIdentity;
  userB: AuthIdentity;
  userATokens: Tokens;
  userBTokens: Tokens;
  adminTokens: Tokens;
  serviceId: number;
};

export type KayanServicesHappyPathResult = {
  steps: StepResult[];
  state: KayanServicesHappyState;
};

export type KayanServicesNegativePathResult = {
  steps: StepResult[];
};

type KayanServicesSummary = {
  runId: string;
  startedAt: string;
  baseUrl: string;
  settings: {
    negativeTests: boolean;
    continueOnFail: boolean;
    timeoutMs: number;
  };
  state: {
    serviceId: number;
    userAEmail: string;
    userBEmail: string;
  };
  totals: {
    total: number;
    passed: number;
    failed: number;
  };
  firstFailure: StepResult | null;
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

function makeIdentity(label: 'A' | 'B'): AuthIdentity {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const ssn = `S${suffix.slice(-8)}`;
  return {
    name: `Kayan Services Sim User ${label}`,
    email: `kayan.services.sim.${label.toLowerCase()}.${suffix}@example.com`,
    phone: `+2015${suffix.slice(-8)}`,
    ssn,
    password: label === 'A' ? 'KayanServicesPass123' : 'KayanServicesPass456',
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

function pickEntityId(payload: ApiEnvelope | null, key: string): number {
  const data = payload?.data as Record<string, unknown> | undefined;
  const entity = data?.[key] as Record<string, unknown> | undefined;
  const nested = toNumericId(entity?.id);
  if (nested !== null) return nested;
  const direct = toNumericId(data?.id);
  if (direct !== null) return direct;
  throw new Error(`Missing numeric ${key}.id (or data.id) in response.`);
}

function pickLatestServiceIdFromMyList(payload: ApiEnvelope | null): number {
  const data = payload?.data as Record<string, unknown> | undefined;
  const items = (data?.items ?? []) as Array<Record<string, unknown>>;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Could not resolve service id from services/me: empty list.');
  }
  const firstId = toNumericId(items[0]?.id);
  if (firstId === null) {
    throw new Error('Could not resolve service id from services/me: invalid id.');
  }
  return firstId;
}

function extractItems(payload: ApiEnvelope | null): Array<Record<string, unknown>> {
  const data = payload?.data;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  const items = (data as Record<string, unknown> | undefined)?.items;
  if (!Array.isArray(items)) return [];
  return items as Array<Record<string, unknown>>;
}

async function requestJson<T>(
  config: KayanServicesTestConfig,
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

function logStep(config: KayanServicesTestConfig, step: StepResult): void {
  if (!config.verbose && step.ok) return;
  console.log(`[${step.ok ? 'PASS' : 'FAIL'}] ${step.name} (${step.status}) - ${step.message}`);
}

async function runAndRecord<T>(
  config: KayanServicesTestConfig,
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
  config: KayanServicesTestConfig,
  steps: StepResult[],
  name: string,
  email: string | undefined,
  phone: string | undefined,
  password: string,
): Promise<Tokens> {
  if (!email && !phone) throw new Error(`${name}: missing login identifier (email or phone).`);

  if (email) {
    const byEmail = await requestJson(config, 'POST', '/auth/login', { email, password });
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
    if (!canFallback) throw new Error(`${name}: login failed with email mode (status=${byEmail.status}).`);
  }

  if (phone) {
    const byPhone = await requestJson(config, 'POST', '/auth/login', { phone, password });
    const phoneStep = makeStep(`${name} login (phone)`, byPhone.status === 201, byPhone.status, getMessage(byPhone.body), byPhone.body);
    steps.push(phoneStep);
    logStep(config, phoneStep);
    if (byPhone.status === 201) return pickTokens(byPhone.body);
    throw new Error(`${name}: login failed with phone mode (status=${byPhone.status}).`);
  }

  throw new Error(`${name}: login failed and no phone fallback configured.`);
}

async function registerAndLoginUser(
  config: KayanServicesTestConfig,
  steps: StepResult[],
  identity: AuthIdentity,
  label: 'A' | 'B',
): Promise<Tokens> {
  const register = await runAndRecord(config, steps, `user ${label} register`, 201, () =>
    requestJson(config, 'POST', '/auth/register', identity),
  );
  const otp = pickOtp(register.body);
  await runAndRecord(config, steps, `user ${label} verify otp`, 201, () =>
    requestJson(config, 'POST', '/auth/register/verify', { email: identity.email, otp }),
  );
  return loginWithAdaptiveIdentifier(config, steps, `user ${label}`, identity.email, identity.phone, identity.password);
}

function assertHappyState(state: Partial<KayanServicesHappyState>): asserts state is KayanServicesHappyState {
  if (
    !state.userA ||
    !state.userB ||
    !state.userATokens ||
    !state.userBTokens ||
    !state.adminTokens ||
    typeof state.serviceId !== 'number'
  ) {
    throw new Error('Happy path did not produce a complete simulation state.');
  }
}

export function createKayanServicesTestContext(overrides?: Partial<KayanServicesTestConfig>): {
  config: KayanServicesTestConfig;
  userA: AuthIdentity;
  userB: AuthIdentity;
} {
  const config: KayanServicesTestConfig = {
    baseUrl: sanitizeBaseUrl(overrides?.baseUrl ?? process.env.BASE_URL ?? ''),
    timeoutMs: overrides?.timeoutMs ?? parsePositiveInt(process.env.SIM_KAYAN_SERVICES_TIMEOUT_MS, 20000),
    verbose: overrides?.verbose ?? parseBool(process.env.SIM_KAYAN_SERVICES_VERBOSE, true),
    negativeTests: overrides?.negativeTests ?? parseBool(process.env.SIM_KAYAN_SERVICES_NEGATIVE_TESTS, true),
    continueOnFail: overrides?.continueOnFail ?? parseBool(process.env.SIM_KAYAN_SERVICES_CONTINUE_ON_FAIL, false),
    adminEmail: overrides?.adminEmail ?? process.env.ADMIN_EMAIL,
    adminPhone: overrides?.adminPhone ?? process.env.ADMIN_PHONE,
    adminPassword: overrides?.adminPassword ?? process.env.ADMIN_PASSWORD,
  };

  if (!config.baseUrl) throw new Error('BASE_URL is required.');
  if (!config.adminPassword) throw new Error('ADMIN_PASSWORD is required.');
  if (!config.adminEmail && !config.adminPhone) throw new Error('ADMIN_EMAIL or ADMIN_PHONE is required.');

  return { config, userA: makeIdentity('A'), userB: makeIdentity('B') };
}

export async function runKayanServicesHappyPath(
  config: KayanServicesTestConfig,
  userA: AuthIdentity,
  userB: AuthIdentity,
): Promise<KayanServicesHappyPathResult> {
  const steps: StepResult[] = [];
  const state: Partial<KayanServicesHappyState> = { userA, userB };

  state.adminTokens = await loginWithAdaptiveIdentifier(config, steps, 'admin preflight', config.adminEmail, config.adminPhone, config.adminPassword!);
  state.userATokens = await registerAndLoginUser(config, steps, userA, 'A');
  state.userBTokens = await registerAndLoginUser(config, steps, userB, 'B');

  const userAToken = state.userATokens.accessToken;
  const adminToken = state.adminTokens.accessToken;

  const createService = await runAndRecord(config, steps, 'user A create service order', [200, 201, 404], () =>
    requestJson(config, 'POST', '/api/services', {
      serviceType: 'maintenance',
      description: 'Fix AC noise issue in bedroom.',
      address: 'Cairo, Nasr City',
    }, { Authorization: `Bearer ${userAToken}` }),
  );

  if (createService.status === 404) {
    const recoverList = await runAndRecord(config, steps, 'user A recover created service id from my services list', 200, () =>
      requestJson(config, 'GET', '/api/services/me?sortBy=createdAt&sortDirection=desc', undefined, { Authorization: `Bearer ${userAToken}` }),
    );
    state.serviceId = pickLatestServiceIdFromMyList(recoverList.body);
  } else {
    state.serviceId = pickEntityId(createService.body, 'service');
  }

  await runAndRecord(config, steps, 'user A update service while not_started', 200, () =>
    requestJson(config, 'PATCH', `/api/services/${state.serviceId}`, {
      description: 'Updated: AC noise issue plus weak cooling in living room.',
    }, { Authorization: `Bearer ${userAToken}` }),
  );

  await runAndRecord(config, steps, 'user A list my services default', 200, () =>
    requestJson(config, 'GET', '/api/services/me', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user A list my services by type', 200, () =>
    requestJson(config, 'GET', '/api/services/me?serviceType=maintenance', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user A list my services by date range', 200, () =>
    requestJson(config, 'GET', '/api/services/me?fromDate=2026-01-01&toDate=2026-12-31', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user A list my services sorted asc', 200, () =>
    requestJson(config, 'GET', '/api/services/me?sortBy=createdAt&sortDirection=asc', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user A list my services sorted desc', 200, () =>
    requestJson(config, 'GET', '/api/services/me?sortBy=createdAt&sortDirection=desc', undefined, { Authorization: `Bearer ${userAToken}` }),
  );

  const adminList = await runAndRecord(config, steps, 'admin list all services default', 200, () =>
    requestJson(config, 'GET', '/api/admin/services', undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin list services by type', 200, () =>
    requestJson(config, 'GET', '/api/admin/services?serviceType=maintenance', undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin list services by date range', 200, () =>
    requestJson(config, 'GET', '/api/admin/services?fromDate=2026-01-01&toDate=2026-12-31', undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin list services sorted asc', 200, () =>
    requestJson(config, 'GET', '/api/admin/services?sortBy=createdAt&sortDirection=asc', undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  const adminItems = extractItems(adminList.body);
  const listedService = adminItems.find((item) => Number(item.id) === state.serviceId);
  if (!listedService || !listedService.user || typeof listedService.user !== 'object') {
    throw new Error('Admin services list did not include related user payload.');
  }

  await runAndRecord(config, steps, 'admin update service status to in_progress', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/services/${state.serviceId}/status`, { status: 'in_progress' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin update service status to finished', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/services/${state.serviceId}/status`, { status: 'finished' }, { Authorization: `Bearer ${adminToken}` }),
  );

  await runAndRecord(config, steps, 'user A rate finished service', [200, 201], () =>
    requestJson(config, 'POST', '/api/ratings', {
      itemType: 'service',
      itemId: state.serviceId,
      ratingValue: 5,
    }, { Authorization: `Bearer ${userAToken}` }),
  );

  assertHappyState(state);
  return { steps, state };
}

export async function runKayanServicesNegativeCases(
  config: KayanServicesTestConfig,
  state: KayanServicesHappyState,
): Promise<KayanServicesNegativePathResult> {
  const steps: StepResult[] = [];
  const adminToken = state.adminTokens.accessToken;
  const userAToken = state.userATokens.accessToken;
  const userBToken = state.userBTokens.accessToken;

  await runAndRecord(config, steps, 'negative unauthorized list my services', 401, () =>
    requestJson(config, 'GET', '/api/services/me'),
  );
  await runAndRecord(config, steps, 'negative user B update user A service', [403, 404], () =>
    requestJson(config, 'PATCH', `/api/services/${state.serviceId}`, { description: 'Intrusion update' }, { Authorization: `Bearer ${userBToken}` }),
  );
  await runAndRecord(config, steps, 'negative user B cancel user A service', [403, 404], () =>
    requestJson(config, 'POST', `/api/services/${state.serviceId}/cancel`, {}, { Authorization: `Bearer ${userBToken}` }),
  );
  await runAndRecord(config, steps, 'negative user B rate user A service', [403, 404], () =>
    requestJson(config, 'POST', '/api/ratings', { itemType: 'service', itemId: state.serviceId, ratingValue: 5 }, { Authorization: `Bearer ${userBToken}` }),
  );
  await runAndRecord(config, steps, 'negative user A duplicate service rating', 400, () =>
    requestJson(config, 'POST', '/api/ratings', { itemType: 'service', itemId: state.serviceId, ratingValue: 4 }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative user A update after processing', 400, () =>
    requestJson(config, 'PATCH', `/api/services/${state.serviceId}`, { description: 'Late update blocked' }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative user A cancel after processing', 400, () =>
    requestJson(config, 'POST', `/api/services/${state.serviceId}/cancel`, {}, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative admin invalid enum status', [400, 422], () =>
    requestJson(config, 'PATCH', `/api/admin/services/${state.serviceId}/status`, { status: 'bad_status' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'negative create service invalid payload', [400, 422], () =>
    requestJson(config, 'POST', '/api/services', { serviceType: 'maintenance' }, { Authorization: `Bearer ${userAToken}` }),
  );

  return { steps };
}

export function summarizeServicesResults(steps: StepResult[]): { passed: number; failed: number; total: number } {
  const passed = steps.filter((step) => step.ok).length;
  const failed = steps.length - passed;
  return { passed, failed, total: steps.length };
}

export async function writeKayanServicesReport(
  config: KayanServicesTestConfig,
  steps: StepResult[],
  state: KayanServicesHappyState,
): Promise<string> {
  const now = new Date();
  const startedAt = now.toISOString();
  const runId = `${startedAt.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const totals = summarizeServicesResults(steps);
  const summary: KayanServicesSummary = {
    runId,
    startedAt,
    baseUrl: config.baseUrl,
    settings: {
      negativeTests: config.negativeTests,
      continueOnFail: config.continueOnFail,
      timeoutMs: config.timeoutMs,
    },
    state: {
      serviceId: state.serviceId,
      userAEmail: state.userA.email,
      userBEmail: state.userB.email,
    },
    totals,
    firstFailure: steps.find((step) => !step.ok) ?? null,
    steps,
  };

  const logDir = path.join(process.cwd(), 'logs');
  const reportFile = path.join(logDir, `kayan-services-simulation-${runId}.json`);
  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(reportFile, JSON.stringify(summary, null, 2), 'utf8');
  return reportFile;
}
