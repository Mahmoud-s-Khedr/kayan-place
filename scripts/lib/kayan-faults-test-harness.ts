/* eslint-disable no-console */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type HeadersMap = Record<string, string>;
type UploadIntentPayload = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  fields?: Record<string, string>;
};

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

export type KayanFaultsTestConfig = {
  baseUrl: string;
  timeoutMs: number;
  verbose: boolean;
  negativeTests: boolean;
  continueOnFail: boolean;
  adminEmail?: string;
  adminPhone?: string;
  adminPassword?: string;
  imageSeed?: string;
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

export type KayanFaultsHappyState = {
  userA: AuthIdentity;
  userB: AuthIdentity;
  userATokens: Tokens;
  userBTokens: Tokens;
  adminTokens: Tokens;
  imageFileIdA: number;
  imageFileIdB: number;
  invalidPendingFileId: number;
  invalidDocFileId: number;
  faultId: number;
};

export type KayanFaultsHappyPathResult = {
  steps: StepResult[];
  state: KayanFaultsHappyState;
};

export type KayanFaultsNegativePathResult = {
  steps: StepResult[];
};

type KayanFaultsSummary = {
  runId: string;
  startedAt: string;
  baseUrl: string;
  settings: {
    negativeTests: boolean;
    continueOnFail: boolean;
    timeoutMs: number;
  };
  state: {
    faultId: number;
    imageFileIdA: number;
    imageFileIdB: number;
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

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function nextSeeded(seedState: { value: number }): number {
  seedState.value = (Math.imul(seedState.value, 1664525) + 1013904223) >>> 0;
  return seedState.value / 0x100000000;
}

let globalSeedState: { value: number } | null = null;

function mimeTypeFromFileName(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpeg' || ext === '.jpg') return 'image/jpeg';
  return 'application/octet-stream';
}

function makeIdentity(label: 'A' | 'B'): AuthIdentity {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const ssn = `F${suffix.slice(-8)}`;
  return {
    name: `Kayan Faults Sim User ${label}`,
    email: `kayan.faults.sim.${label.toLowerCase()}.${suffix}@example.com`,
    phone: `+2015${suffix.slice(-8)}`,
    ssn,
    password: label === 'A' ? 'KayanFaultsPass123' : 'KayanFaultsPass456',
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

async function requestJson<T>(
  config: KayanFaultsTestConfig,
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

function logStep(config: KayanFaultsTestConfig, step: StepResult): void {
  if (!config.verbose && step.ok) return;
  console.log(`[${step.ok ? 'PASS' : 'FAIL'}] ${step.name} (${step.status}) - ${step.message}`);
}

async function runAndRecord<T>(
  config: KayanFaultsTestConfig,
  steps: StepResult[],
  name: string,
  expectedStatus: number | number[],
  request: () => Promise<{ status: number; body: ApiEnvelope<T> | null; rawText: string }>,
): Promise<{ status: number; body: ApiEnvelope<T> | null; rawText: string }> {
  const result = await request();
  const ok = Array.isArray(expectedStatus) ? expectedStatus.includes(result.status) : result.status === expectedStatus;
  const step = makeStep(name, ok, result.status, getMessage(result.body), result.body);
  steps.push(step);
  logStep(config, step);
  if (!ok && !config.continueOnFail) {
    throw new Error(`Step failed: ${name} status=${result.status}`);
  }
  return result;
}

async function listSimImagePaths(): Promise<string[]> {
  const simDir = path.join(process.cwd(), 'scripts', 'sim-images');
  const entries = await fs.readdir(simDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(jpg|jpeg|png)$/i.test(name))
    .map((name) => path.join(simDir, name))
    .sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    throw new Error(`No supported image files found in ${simDir}. Expected .jpg/.jpeg/.png files.`);
  }
  return files;
}

function pickRandomSimImagePath(paths: string[], seedState?: { value: number }): string {
  if (paths.length === 1) return paths[0];
  const rnd = seedState ? nextSeeded(seedState) : Math.random();
  const idx = Math.floor(rnd * paths.length);
  return paths[idx];
}

async function uploadWithSignedIntent(
  config: KayanFaultsTestConfig,
  intent: UploadIntentPayload,
  filePath: string,
): Promise<void> {
  const method = (intent.method ?? 'PUT').toUpperCase();
  const url = intent.url;
  if (!url) throw new Error('Upload intent missing URL');

  const bytes = await fs.readFile(filePath);
  const mimeType = mimeTypeFromFileName(filePath);
  const filename = path.basename(filePath);

  if (method === 'POST') {
    const form = new FormData();
    if (intent.fields) {
      for (const [k, v] of Object.entries(intent.fields)) {
        form.append(k, v);
      }
    }
    form.append('file', new Blob([bytes], { type: mimeType }), filename);
    const response = await fetch(url, {
      method: 'POST',
      body: form,
      headers: intent.headers,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Signed upload failed with ${response.status}: ${text.slice(0, 500)}`);
    }
    return;
  }

  const headers: HeadersMap = { ...(intent.headers ?? {}) };
  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = mimeType;
  }
  const response = await fetch(url, {
    method,
    headers,
    body: bytes,
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Signed upload failed with ${response.status}: ${text.slice(0, 500)}`);
  }
}

function hasRelatedUserPayload(item: Record<string, unknown>): boolean {
  const user = item.user;
  if (user && typeof user === 'object') return true;
  const userId = item.user_id;
  const hasUserId = typeof userId === 'number' || (typeof userId === 'string' && /^\d+$/.test(userId));
  const hasUserFields = 'user_name' in item || 'user_email' in item || 'user_phone' in item;
  return hasUserId && hasUserFields;
}

async function loginWithAdaptiveIdentifier(
  config: KayanFaultsTestConfig,
  steps: StepResult[],
  name: string,
  email: string | undefined,
  phone: string | undefined,
  password: string,
): Promise<Tokens> {
  if (!email && !phone) throw new Error(`${name}: missing login identifier (email or phone).`);

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
    if (!canFallback) throw new Error(`${name}: login failed with email mode (status=${byEmail.status}).`);
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
  config: KayanFaultsTestConfig,
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

async function createUploadedImageFile(
  config: KayanFaultsTestConfig,
  steps: StepResult[],
  userToken: string,
  name: string,
  mimeType = 'image/jpeg',
): Promise<number> {
  const simImagePaths = await listSimImagePaths();
  if (config.imageSeed && globalSeedState === null) {
    globalSeedState = { value: hashSeed(config.imageSeed) };
  }
  const seeded = config.imageSeed ? globalSeedState ?? undefined : undefined;
  const createIntent = await runAndRecord(config, steps, `${name} create image upload intent`, 201, () =>
    requestJson(config, 'POST', '/api/files/upload-intent', {
      ownerType: 'product',
      purpose: 'product_image',
      filename: `${name.replace(/\s+/g, '-').toLowerCase()}.jpg`,
      mimeType,
      fileSizeBytes: 1024,
    }, { Authorization: `Bearer ${userToken}` }),
  );
  const intentData = createIntent.body?.data as Record<string, unknown> | undefined;
  const upload = (intentData?.upload as UploadIntentPayload | undefined) ?? undefined;
  if (!upload?.url) {
    throw new Error('Upload intent missing upload URL.');
  }

  const simPath = pickRandomSimImagePath(simImagePaths, seeded);
  await runAndRecord(config, steps, `${name} upload binary to signed URL`, [200, 201, 204], async () => {
    await uploadWithSignedIntent(config, upload, simPath);
    return { status: 200, body: { success: true, data: { uploadedFrom: simPath } } as ApiEnvelope, rawText: '' };
  });

  const fileId = pickEntityId(createIntent.body, 'file');
  await runAndRecord(config, steps, `${name} mark image uploaded`, 200, () =>
    requestJson(config, 'PATCH', `/api/files/${fileId}/mark-uploaded`, {}, { Authorization: `Bearer ${userToken}` }),
  );
  return fileId;
}

async function createPendingFile(
  config: KayanFaultsTestConfig,
  steps: StepResult[],
  userToken: string,
  name: string,
): Promise<number> {
  const createIntent = await runAndRecord(config, steps, `${name} create pending image file`, 201, () =>
    requestJson(config, 'POST', '/api/files/upload-intent', {
      ownerType: 'product',
      purpose: 'product_image',
      filename: `${name.replace(/\s+/g, '-').toLowerCase()}-pending.jpg`,
      mimeType: 'image/jpeg',
      fileSizeBytes: 2048,
    }, { Authorization: `Bearer ${userToken}` }),
  );
  return pickEntityId(createIntent.body, 'file');
}

async function createUploadedDocumentFile(
  config: KayanFaultsTestConfig,
  steps: StepResult[],
  userToken: string,
  name: string,
): Promise<number> {
  const createIntent = await runAndRecord(config, steps, `${name} create doc upload intent`, 201, () =>
    requestJson(config, 'POST', '/api/files/upload-intent', {
      ownerType: 'product',
      purpose: 'document',
      filename: `${name.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      mimeType: 'application/pdf',
      fileSizeBytes: 4096,
    }, { Authorization: `Bearer ${userToken}` }),
  );
  const fileId = pickEntityId(createIntent.body, 'file');
  await runAndRecord(config, steps, `${name} mark doc uploaded`, 200, () =>
    requestJson(config, 'PATCH', `/api/files/${fileId}/mark-uploaded`, {}, { Authorization: `Bearer ${userToken}` }),
  );
  return fileId;
}

function pickLatestFaultIdFromMyList(payload: ApiEnvelope | null): number {
  const data = payload?.data as Record<string, unknown> | undefined;
  const items = (data?.items ?? []) as Array<Record<string, unknown>>;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Could not resolve fault id from faults/me: empty list.');
  }
  const firstId = toNumericId(items[0]?.id);
  if (firstId === null) {
    throw new Error('Could not resolve fault id from faults/me: invalid id.');
  }
  return firstId;
}

function assertHappyState(state: Partial<KayanFaultsHappyState>): asserts state is KayanFaultsHappyState {
  if (
    !state.userA ||
    !state.userB ||
    !state.userATokens ||
    !state.userBTokens ||
    !state.adminTokens ||
    typeof state.imageFileIdA !== 'number' ||
    typeof state.imageFileIdB !== 'number' ||
    typeof state.invalidPendingFileId !== 'number' ||
    typeof state.invalidDocFileId !== 'number' ||
    typeof state.faultId !== 'number'
  ) {
    throw new Error('Happy path did not produce a complete simulation state.');
  }
}

export function createKayanFaultsTestContext(overrides?: Partial<KayanFaultsTestConfig>): {
  config: KayanFaultsTestConfig;
  userA: AuthIdentity;
  userB: AuthIdentity;
} {
  const config: KayanFaultsTestConfig = {
    baseUrl: sanitizeBaseUrl(overrides?.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:800'),
    timeoutMs: overrides?.timeoutMs ?? parsePositiveInt(process.env.SIM_KAYAN_FAULTS_TIMEOUT_MS, 20000),
    verbose: overrides?.verbose ?? parseBool(process.env.SIM_KAYAN_FAULTS_VERBOSE, true),
    negativeTests: overrides?.negativeTests ?? parseBool(process.env.SIM_KAYAN_FAULTS_NEGATIVE_TESTS, true),
    continueOnFail: overrides?.continueOnFail ?? parseBool(process.env.SIM_KAYAN_FAULTS_CONTINUE_ON_FAIL, false),
    adminEmail: overrides?.adminEmail ?? process.env.ADMIN_EMAIL,
    adminPhone: overrides?.adminPhone ?? process.env.ADMIN_PHONE,
    adminPassword: overrides?.adminPassword ?? process.env.ADMIN_PASSWORD,
    imageSeed: overrides?.imageSeed ?? process.env.SIM_KAYAN_FAULTS_IMAGE_SEED,
  };
  if (!config.baseUrl) throw new Error('BASE_URL is required.');
  if (!config.adminPassword) throw new Error('ADMIN_PASSWORD is required.');
  if (!config.adminEmail && !config.adminPhone) throw new Error('ADMIN_EMAIL or ADMIN_PHONE is required.');
  return { config, userA: makeIdentity('A'), userB: makeIdentity('B') };
}

export async function runKayanFaultsHappyPath(
  config: KayanFaultsTestConfig,
  userA: AuthIdentity,
  userB: AuthIdentity,
): Promise<KayanFaultsHappyPathResult> {
  const steps: StepResult[] = [];
  const state: Partial<KayanFaultsHappyState> = { userA, userB };

  state.adminTokens = await loginWithAdaptiveIdentifier(config, steps, 'admin preflight', config.adminEmail, config.adminPhone, config.adminPassword!);
  state.userATokens = await registerAndLoginUser(config, steps, userA, 'A');
  state.userBTokens = await registerAndLoginUser(config, steps, userB, 'B');

  const userAToken = state.userATokens.accessToken;
  const adminToken = state.adminTokens.accessToken;

  state.imageFileIdA = await createUploadedImageFile(config, steps, userAToken, 'user A image file #1');
  state.imageFileIdB = await createUploadedImageFile(config, steps, userAToken, 'user A image file #2');
  state.invalidPendingFileId = await createPendingFile(config, steps, userAToken, 'user A pending file');
  state.invalidDocFileId = await createUploadedDocumentFile(config, steps, userAToken, 'user A uploaded document');

  const createFault = await runAndRecord(config, steps, 'user A create fault report', [200, 201, 404], () =>
    requestJson(config, 'POST', '/api/faults', {
      title: `Fault Report ${Date.now()}`,
      description: 'Water leak from ceiling in living room.',
      severity: 'normal',
      address: 'Cairo, Nasr City',
      imageFileIds: [state.imageFileIdA],
    }, { Authorization: `Bearer ${userAToken}` }),
  );
  if (createFault.status === 404) {
    const recoverList = await runAndRecord(config, steps, 'user A recover created fault id from my faults list', 200, () =>
      requestJson(config, 'GET', '/api/faults/me?sortBy=createdAt&sortDirection=desc', undefined, { Authorization: `Bearer ${userAToken}` }),
    );
    state.faultId = pickLatestFaultIdFromMyList(recoverList.body);
  } else {
    state.faultId = pickEntityId(createFault.body, 'fault');
  }

  await runAndRecord(config, steps, 'user A update fault while received', 200, () =>
    requestJson(config, 'PATCH', `/api/faults/${state.faultId}`, {
      description: 'Updated: leak is spreading to hallway.',
      severity: 'high',
      address: 'Cairo, New Cairo',
      imageFileIds: [state.imageFileIdA, state.imageFileIdB],
    }, { Authorization: `Bearer ${userAToken}` }),
  );

  await runAndRecord(config, steps, 'user A list my faults default', 200, () =>
    requestJson(config, 'GET', '/api/faults/me', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user A list my faults filter by status', 200, () =>
    requestJson(config, 'GET', '/api/faults/me?status=received', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user A list my faults filter by severity', 200, () =>
    requestJson(config, 'GET', '/api/faults/me?severity=high', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user A list my faults date range', 200, () =>
    requestJson(config, 'GET', '/api/faults/me?fromDate=2026-01-01&toDate=2026-12-31', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user A list my faults sort by createdAt', 200, () =>
    requestJson(config, 'GET', '/api/faults/me?sortBy=createdAt&sortDirection=desc', undefined, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'user A list my faults sort by severity', 200, () =>
    requestJson(config, 'GET', '/api/faults/me?sortBy=severity&sortDirection=asc', undefined, { Authorization: `Bearer ${userAToken}` }),
  );

  const readAdminFaults = async (): Promise<Array<Record<string, unknown>>> => {
    const adminList = await runAndRecord(config, steps, 'admin list all faults', 200, () =>
      requestJson(config, 'GET', '/api/admin/faults', undefined, { Authorization: `Bearer ${adminToken}` }),
    );
    const data = adminList.body?.data;
    if (Array.isArray(data)) {
      return data as Array<Record<string, unknown>>;
    }
    return (((data as Record<string, unknown> | undefined)?.items ?? []) as Array<Record<string, unknown>>);
  };
  let listItems = await readAdminFaults();
  let listedFault = listItems.find((item) => Number(item.id) === state.faultId);
  if (!listedFault) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    listItems = await readAdminFaults();
    listedFault = listItems.find((item) => Number(item.id) === state.faultId);
  }
  if (!listedFault) {
    throw new Error(`Admin faults list did not include created fault id=${state.faultId}.`);
  }
  if (!hasRelatedUserPayload(listedFault)) {
    throw new Error(`Admin faults list included fault id=${state.faultId} but did not include related user payload.`);
  }

  await runAndRecord(config, steps, 'admin update fault status to assigned', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/faults/${state.faultId}/status`, { status: 'assigned' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin update fault status to on_the_way', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/faults/${state.faultId}/status`, { status: 'on_the_way' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin update fault status to in_progress', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/faults/${state.faultId}/status`, { status: 'in_progress' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'admin update fault status to finished', 200, () =>
    requestJson(config, 'PATCH', `/api/admin/faults/${state.faultId}/status`, { status: 'finished' }, { Authorization: `Bearer ${adminToken}` }),
  );

  await runAndRecord(config, steps, 'user A rate finished fault', [200, 201], () =>
    requestJson(config, 'POST', '/api/ratings', {
      itemType: 'fault',
      itemId: state.faultId,
      ratingValue: 5,
    }, { Authorization: `Bearer ${userAToken}` }),
  );

  assertHappyState(state);
  return { steps, state };
}

export async function runKayanFaultsNegativeCases(
  config: KayanFaultsTestConfig,
  state: KayanFaultsHappyState,
): Promise<KayanFaultsNegativePathResult> {
  const steps: StepResult[] = [];
  const adminToken = state.adminTokens.accessToken;
  const userAToken = state.userATokens.accessToken;
  const userBToken = state.userBTokens.accessToken;

  await runAndRecord(config, steps, 'negative unauthorized list my faults', 401, () =>
    requestJson(config, 'GET', '/api/faults/me'),
  );
  await runAndRecord(config, steps, 'negative user B update user A fault', [403, 404], () =>
    requestJson(config, 'PATCH', `/api/faults/${state.faultId}`, { description: 'Intrusion update' }, { Authorization: `Bearer ${userBToken}` }),
  );
  await runAndRecord(config, steps, 'negative user B cancel user A fault', [403, 404], () =>
    requestJson(config, 'POST', `/api/faults/${state.faultId}/cancel`, {}, { Authorization: `Bearer ${userBToken}` }),
  );
  await runAndRecord(config, steps, 'negative user B rate user A fault', [403, 404], () =>
    requestJson(config, 'POST', '/api/ratings', { itemType: 'fault', itemId: state.faultId, ratingValue: 5 }, { Authorization: `Bearer ${userBToken}` }),
  );
  await runAndRecord(config, steps, 'negative user A duplicate fault rating', 400, () =>
    requestJson(config, 'POST', '/api/ratings', { itemType: 'fault', itemId: state.faultId, ratingValue: 4 }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative user A update after processing', 400, () =>
    requestJson(config, 'PATCH', `/api/faults/${state.faultId}`, { description: 'Late update blocked' }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative user A cancel after processing', 400, () =>
    requestJson(config, 'POST', `/api/faults/${state.faultId}/cancel`, {}, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative admin invalid backward transition', 400, () =>
    requestJson(config, 'PATCH', `/api/admin/faults/${state.faultId}/status`, { status: 'received' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, 'negative create fault with missing image file id', 400, () =>
    requestJson(config, 'POST', '/api/faults', {
      title: 'Missing image file',
      description: 'Should fail',
      severity: 'normal',
      address: 'Cairo',
      imageFileIds: [999999999],
    }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative create fault with pending image file', 400, () =>
    requestJson(config, 'POST', '/api/faults', {
      title: 'Pending image file',
      description: 'Should fail',
      severity: 'normal',
      address: 'Cairo',
      imageFileIds: [state.invalidPendingFileId],
    }, { Authorization: `Bearer ${userAToken}` }),
  );
  await runAndRecord(config, steps, 'negative create fault with document file', 400, () =>
    requestJson(config, 'POST', '/api/faults', {
      title: 'Document file',
      description: 'Should fail',
      severity: 'normal',
      address: 'Cairo',
      imageFileIds: [state.invalidDocFileId],
    }, { Authorization: `Bearer ${userAToken}` }),
  );

  return { steps };
}

export function summarizeFaultsResults(steps: StepResult[]): { passed: number; failed: number; total: number } {
  const passed = steps.filter((step) => step.ok).length;
  const failed = steps.length - passed;
  return { passed, failed, total: steps.length };
}

export async function writeKayanFaultsReport(
  config: KayanFaultsTestConfig,
  steps: StepResult[],
  state: KayanFaultsHappyState,
): Promise<string> {
  const now = new Date();
  const startedAt = now.toISOString();
  const runId = `${startedAt.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const totals = summarizeFaultsResults(steps);
  const summary: KayanFaultsSummary = {
    runId,
    startedAt,
    baseUrl: config.baseUrl,
    settings: {
      negativeTests: config.negativeTests,
      continueOnFail: config.continueOnFail,
      timeoutMs: config.timeoutMs,
    },
    state: {
      faultId: state.faultId,
      imageFileIdA: state.imageFileIdA,
      imageFileIdB: state.imageFileIdB,
      userAEmail: state.userA.email,
      userBEmail: state.userB.email,
    },
    totals,
    firstFailure: steps.find((step) => !step.ok) ?? null,
    steps,
  };

  const logDir = path.join(process.cwd(), 'logs');
  const reportFile = path.join(logDir, `kayan-faults-simulation-${runId}.json`);
  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(reportFile, JSON.stringify(summary, null, 2), 'utf8');
  return reportFile;
}
