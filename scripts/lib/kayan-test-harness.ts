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

export type KayanTestConfig = {
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

export type KayanHappyState = {
  userA: AuthIdentity;
  userB: AuthIdentity;
  userATokens: Tokens;
  userBTokens: Tokens;
  adminTokens: Tokens;
  productId: number;
  cartItemId: number;
  orderId: number;
};

export type KayanHappyPathResult = {
  steps: StepResult[];
  state: KayanHappyState;
};

export type KayanNegativePathResult = {
  steps: StepResult[];
};

type KayanSummary = {
  runId: string;
  startedAt: string;
  baseUrl: string;
  settings: {
    negativeTests: boolean;
    continueOnFail: boolean;
    timeoutMs: number;
  };
  state: {
    productId: number;
    orderId: number;
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
  const ssn = `K${suffix.slice(-8)}`;
  return {
    name: `Kayan Sim User ${label}`,
    email: `kayan.sim.${label.toLowerCase()}.${suffix}@example.com`,
    phone: `+2015${suffix.slice(-8)}`,
    ssn,
    password: label === 'A' ? 'KayanSimPass123' : 'KayanSimPass456',
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
  config: KayanTestConfig,
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

function logStep(config: KayanTestConfig, step: StepResult): void {
  if (!config.verbose && step.ok) return;
  console.log(`[${step.ok ? 'PASS' : 'FAIL'}] ${step.name} (${step.status}) - ${step.message}`);
}

async function runAndRecord<T>(
  config: KayanTestConfig,
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
  config: KayanTestConfig,
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
  config: KayanTestConfig,
  steps: StepResult[],
  identity: AuthIdentity,
  label: 'A' | 'B',
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

function assertHappyState(state: Partial<KayanHappyState>): asserts state is KayanHappyState {
  if (
    !state.userA ||
    !state.userB ||
    !state.userATokens ||
    !state.userBTokens ||
    !state.adminTokens ||
    typeof state.productId !== 'number' ||
    typeof state.cartItemId !== 'number' ||
    typeof state.orderId !== 'number'
  ) {
    throw new Error('Happy path did not produce a complete simulation state.');
  }
}

export function createKayanTestContext(overrides?: Partial<KayanTestConfig>): {
  config: KayanTestConfig;
  userA: AuthIdentity;
  userB: AuthIdentity;
} {
  const config: KayanTestConfig = {
    baseUrl: sanitizeBaseUrl(overrides?.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:800'),
    timeoutMs: overrides?.timeoutMs ?? parsePositiveInt(process.env.SIM_KAYAN_TIMEOUT_MS, 20000),
    verbose: overrides?.verbose ?? parseBool(process.env.SIM_KAYAN_VERBOSE, true),
    negativeTests: overrides?.negativeTests ?? parseBool(process.env.SIM_KAYAN_NEGATIVE_TESTS, true),
    continueOnFail: overrides?.continueOnFail ?? parseBool(process.env.SIM_KAYAN_CONTINUE_ON_FAIL, false),
    adminEmail: overrides?.adminEmail ?? process.env.ADMIN_EMAIL,
    adminPhone: overrides?.adminPhone ?? process.env.ADMIN_PHONE,
    adminPassword: overrides?.adminPassword ?? process.env.ADMIN_PASSWORD,
  };

  if (!config.baseUrl) throw new Error('BASE_URL is required.');
  if (!config.adminPassword) throw new Error('ADMIN_PASSWORD is required.');
  if (!config.adminEmail && !config.adminPhone) throw new Error('ADMIN_EMAIL or ADMIN_PHONE is required.');

  return {
    config,
    userA: makeIdentity('A'),
    userB: makeIdentity('B'),
  };
}

export async function runKayanHappyPath(
  config: KayanTestConfig,
  userA: AuthIdentity,
  userB: AuthIdentity,
): Promise<KayanHappyPathResult> {
  const steps: StepResult[] = [];
  const state: Partial<KayanHappyState> = { userA, userB };

  state.adminTokens = await loginWithAdaptiveIdentifier(
    config,
    steps,
    'admin preflight',
    config.adminEmail,
    config.adminPhone,
    config.adminPassword!,
  );
  state.userATokens = await registerAndLoginUser(config, steps, userA, 'A');
  state.userBTokens = await registerAndLoginUser(config, steps, userB, 'B');

  const adminToken = state.adminTokens.accessToken;
  const userAToken = state.userATokens.accessToken;

  const createProduct = await runAndRecord(config, steps, 'admin create product', [200, 201], () =>
    requestJson(config, 'POST', '/api/admin/products', {
      title: `Kayan Sim Product ${Date.now()}`,
      description: 'Simulation product for client-like flow.',
      amount: 10,
      price: 120.5,
      details: { source: 'simulate-kayan-flows' },
      imageFileIds: [],
      fileIds: [],
    }, { Authorization: `Bearer ${adminToken}` }),
  );
  state.productId = pickId(createProduct.body, 'product');

  await runAndRecord(config, steps, 'public list products filtered', 200, () =>
    requestJson(config, 'GET', '/api/products?query=Sim&sortBy=price&sortDirection=asc'),
  );
  await runAndRecord(config, steps, 'user list products by date', 200, () =>
    requestJson(config, 'GET', '/api/products?availability=active&sortBy=createdAt&sortDirection=desc'),
  );
  await runAndRecord(config, steps, 'user get product details', 200, () =>
    requestJson(config, 'GET', `/api/products/${state.productId}`),
  );

  const addCart = await runAndRecord(config, steps, 'user add product to cart', [200, 201], () =>
    requestJson(config, 'POST', '/api/cart/items', { productId: state.productId, quantity: 1 }, { Authorization: `Bearer ${userAToken}` }),
  );
  const addData = addCart.body?.data as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  const cartItems = Array.isArray(addData)
    ? addData
    : ((addData?.items as Array<Record<string, unknown>> | undefined) ?? []);
  const added = cartItems.find((item) => Number(item.product_id ?? item.productId) === state.productId) ?? cartItems[0];
  const cartId = toNumericId(added?.id);
  if (!added || cartId === null) throw new Error('Cart item id not found after add.');
  state.cartItemId = cartId;

  await runAndRecord(config, steps, 'user update cart quantity', 200, () =>
    requestJson(config, 'PATCH', `/api/cart/items/${state.cartItemId}`, { quantity: 2 }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user read cart', 200, () =>
    requestJson(config, 'GET', '/api/cart', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user remove cart item', 200, () =>
    requestJson(config, 'DELETE', `/api/cart/items/${state.cartItemId}`, undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user re-add product to cart', [200, 201], () =>
    requestJson(config, 'POST', '/api/cart/items', { productId: state.productId, quantity: 1 }, { Authorization: `Bearer ${userAToken}` }),
  );

  const checkout = await runAndRecord(config, steps, 'user checkout cart', [200, 201], () =>
    requestJson(config, 'POST', '/api/cart/checkout', { deliveryAddress: 'Cairo, Nasr City, Abbas Al Akkad' }, { Authorization: `Bearer ${userAToken}` }),
  );
  state.orderId = pickId(checkout.body, 'order');

  await runAndRecord(config, steps, 'user list my orders sorted', 200, () =>
    requestJson(config, 'GET', '/api/orders/me?sortBy=createdAt&sortDirection=desc', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user get order details', 200, () =>
    requestJson(config, 'GET', `/api/orders/${state.orderId}`, undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user update order address while received', 200, () =>
    requestJson(config, 'PATCH', `/api/orders/${state.orderId}/address`, { deliveryAddress: 'Cairo, New Cairo, Fifth Settlement' }, { Authorization: `Bearer ${userAToken}` }),
  );

  await runAndRecord(config, steps, 'admin list all orders', 200, () =>
    requestJson(config, 'GET', '/api/admin/orders', undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin set order ready_to_ship', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/orders/${state.orderId}/status`, { status: 'ready_to_ship' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin set order on_the_way', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/orders/${state.orderId}/status`, { status: 'on_the_way' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin set order delivered', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/orders/${state.orderId}/status`, { status: 'delivered' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'user rate delivered product', [200, 201], () =>
    requestJson(config, 'POST', '/api/ratings', {
      itemType: 'order',
      orderId: state.orderId,
      productId: state.productId,
      ratingValue: 5,
    }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative duplicate rating', 400, () =>
    requestJson(config, 'POST', '/api/ratings', {
      itemType: 'order',
      orderId: state.orderId,
      productId: state.productId,
      ratingValue: 4,
    }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user B list products', 200, () =>
    requestJson(config, 'GET', '/api/products?query=Product'),
  );

  assertHappyState(state);
  return { steps, state };
}

export async function runKayanNegativeCases(
  config: KayanTestConfig,
  state: KayanHappyState,
): Promise<KayanNegativePathResult> {
  const steps: StepResult[] = [];
  const adminToken = state.adminTokens.accessToken;
  const userAToken = state.userATokens.accessToken;

  await runAndRecord(config, steps, 'negative unauthorized cart read', 401, () =>
    requestJson(config, 'GET', '/api/cart'),
  );
  await runAndRecord(config, steps, 'negative add invalid product to cart', [400, 404], () =>
    requestJson(config, 'POST', '/api/cart/items', { productId: 999999999, quantity: 1 }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative update address after processing', 400, () =>
    requestJson(config, 'PATCH', `/api/orders/${state.orderId}/address`, { deliveryAddress: 'Invalid after processing' }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative rating before delivered', [400, 403], () =>
    requestJson(config, 'POST', '/api/ratings', {
      itemType: 'order',
      orderId: state.orderId,
      productId: state.productId,
      ratingValue: 5,
    }, { Authorization: `Bearer ${state.userBTokens.accessToken}` }),
  );
  await runAndRecord(config, steps, 'negative rating product not in order', 400, () =>
    requestJson(config, 'POST', '/api/ratings', {
      itemType: 'order',
      orderId: state.orderId,
      productId: 99999999,
      ratingValue: 5,
    }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative admin invalid status', [400, 422], () =>
    requestJson(config, 'PATCH', `/api/admin/orders/${state.orderId}/status`, { status: 'bad_status' }, { Authorization: `Bearer ${adminToken}` }),
  );

  return { steps };
}

export function summarizeResults(steps: StepResult[]): { passed: number; failed: number; total: number } {
  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  return { passed, failed, total: steps.length };
}

export async function writeKayanReport(
  config: KayanTestConfig,
  steps: StepResult[],
  state: KayanHappyState,
): Promise<string> {
  const now = new Date();
  const startedAt = now.toISOString();
  const runId = `${startedAt.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const totals = summarizeResults(steps);
  const summary: KayanSummary = {
    runId,
    startedAt,
    baseUrl: config.baseUrl,
    settings: {
      negativeTests: config.negativeTests,
      continueOnFail: config.continueOnFail,
      timeoutMs: config.timeoutMs,
    },
    state: {
      productId: state.productId,
      orderId: state.orderId,
      userAEmail: state.userA.email,
      userBEmail: state.userB.email,
    },
    totals,
    firstFailure: steps.find((s) => !s.ok) ?? null,
    steps,
  };

  const logDir = path.join(process.cwd(), 'logs');
  const reportFile = path.join(logDir, `kayan-simulation-${runId}.json`);
  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(reportFile, JSON.stringify(summary, null, 2), 'utf8');
  return reportFile;
}
