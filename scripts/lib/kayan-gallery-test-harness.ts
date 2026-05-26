/* eslint-disable no-console */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type HeadersMap = Record<string, string>;

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

export type GalleryTestConfig = {
  baseUrl: string;
  timeoutMs: number;
  verbose: boolean;
  negativeTests: boolean;
  continueOnFail: boolean;
  uploadMode: 'real' | 'skip';
  preflightMaxAttempts: number;
  preflightDelayMs: number;
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

type UploadIntentPayload = {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  fields?: Record<string, string>;
  expiresAt?: string;
};

export type GalleryHappyState = {
  user: AuthIdentity;
  userTokens: Tokens;
  adminTokens: Tokens;
  uploadedFileId: number;
  galleryItemId: number;
};

export type GalleryHappyPathResult = {
  steps: StepResult[];
  state: GalleryHappyState;
};

export type GalleryNegativePathResult = {
  steps: StepResult[];
};

type GallerySummary = {
  runId: string;
  startedAt: string;
  baseUrl: string;
  settings: {
    negativeTests: boolean;
    continueOnFail: boolean;
    timeoutMs: number;
  };
  state: {
    userEmail: string;
    galleryItemId: number;
    uploadedFileId: number;
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

function makeIdentity(): AuthIdentity {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const ssn = `K${suffix.slice(-8)}`;
  return {
    name: 'Kayan Gallery Sim User',
    email: `kayan.gallery.sim.${suffix}@example.com`,
    phone: `+2015${suffix.slice(-8)}`,
    ssn,
    password: 'KayanGalleryPass123',
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

function pickNestedId(payload: ApiEnvelope | null, key: string): number {
  const data = payload?.data as Record<string, unknown> | undefined;
  const entity = data?.[key] as Record<string, unknown> | undefined;
  const nested = toNumericId(entity?.id);
  if (nested !== null) return nested;
  const direct = toNumericId(data?.id);
  if (direct !== null) return direct;
  throw new Error(`Missing numeric ${key}.id (or data.id) in response.`);
}

function makeStep(name: string, ok: boolean, status: number, message: string, payload?: unknown): StepResult {
  return { name, ok, status, message, payload };
}

function logStep(config: GalleryTestConfig, step: StepResult): void {
  if (!config.verbose && step.ok) return;
  console.log(`[${step.ok ? 'PASS' : 'FAIL'}] ${step.name} (${step.status}) - ${step.message}`);
}

async function requestJson<T>(
  config: GalleryTestConfig,
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

async function runAndRecord<T>(
  config: GalleryTestConfig,
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
  config: GalleryTestConfig,
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
  config: GalleryTestConfig,
  steps: StepResult[],
  identity: AuthIdentity,
): Promise<Tokens> {
  const register = await runAndRecord(config, steps, 'gallery user register', 201, () =>
    requestJson(config, 'POST', '/api/auth/register', identity),
  );
  const otp = pickOtp(register.body);
  await runAndRecord(config, steps, 'gallery user verify otp', 201, () =>
    requestJson(config, 'POST', '/api/auth/register/verify', { email: identity.email, otp }),
  );

  return loginWithAdaptiveIdentifier(config, steps, 'gallery user', identity.email, identity.phone, identity.password);
}

async function uploadWithSignedIntent(
  config: GalleryTestConfig,
  intent: UploadIntentPayload,
  filename: string,
  mimeType: string,
): Promise<void> {
  const method = (intent.method ?? 'PUT').toUpperCase();
  const url = intent.url;
  if (!url) throw new Error('Upload intent missing URL');

  const pngBytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5uF8QAAAAASUVORK5CYII=', 'base64'));

  if (method === 'POST') {
    const form = new FormData();
    if (intent.fields) {
      for (const [k, v] of Object.entries(intent.fields)) {
        form.append(k, v);
      }
    }
    form.append('file', new Blob([pngBytes], { type: mimeType }), filename);

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

  const headers: HeadersMap = {
    ...(intent.headers ?? {}),
  };
  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = mimeType;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: pngBytes,
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Signed upload failed with ${response.status}: ${text.slice(0, 500)}`);
  }
}

function findGalleryItem(items: unknown, id: number): Record<string, unknown> | null {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (item && typeof item === 'object') {
      const candidate = item as Record<string, unknown>;
      if (toNumericId(candidate.id) === id) return candidate;
    }
  }
  return null;
}

function getEnvelopeData(payload: ApiEnvelope | null): unknown {
  return payload?.data;
}

function extractItems(payload: ApiEnvelope | null): Array<Record<string, unknown>> {
  const data = getEnvelopeData(payload);
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  const items = (data as Record<string, unknown> | undefined)?.items;
  if (!Array.isArray(items)) return [];
  return items as Array<Record<string, unknown>>;
}

function describeItemsShape(payload: ApiEnvelope | null): string {
  const data = getEnvelopeData(payload);
  if (Array.isArray(data)) return `data:Array(${data.length})`;
  if (data && typeof data === 'object') {
    const items = (data as Record<string, unknown>).items;
    if (Array.isArray(items)) return `data.items:Array(${items.length})`;
    return 'data:Object(no items[])';
  }
  return `data:${String(data)}`;
}

function pushAssertion(
  config: GalleryTestConfig,
  steps: StepResult[],
  name: string,
  ok: boolean,
  message: string,
  payload?: unknown,
): void {
  const step = makeStep(name, ok, ok ? 200 : 500, message, payload);
  steps.push(step);
  logStep(config, step);
  if (!ok && !config.continueOnFail) {
    throw new Error(`Assertion failed: ${name}`);
  }
}

function assertHappyState(state: Partial<GalleryHappyState>): asserts state is GalleryHappyState {
  if (
    !state.user ||
    !state.userTokens ||
    !state.adminTokens ||
    typeof state.uploadedFileId !== 'number' ||
    typeof state.galleryItemId !== 'number'
  ) {
    throw new Error('Happy path did not produce a complete gallery simulation state.');
  }
}

export function createGalleryTestContext(overrides?: Partial<GalleryTestConfig>): {
  config: GalleryTestConfig;
  user: AuthIdentity;
} {
  const uploadModeEnv = (process.env.SIM_KAYAN_GALLERY_UPLOAD_MODE ?? 'real').toLowerCase();
  const uploadMode: 'real' | 'skip' = uploadModeEnv === 'skip' ? 'skip' : 'real';

  const config: GalleryTestConfig = {
    baseUrl: sanitizeBaseUrl(overrides?.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:800'),
    timeoutMs: overrides?.timeoutMs ?? parsePositiveInt(process.env.SIM_KAYAN_GALLERY_TIMEOUT_MS, 30000),
    verbose: overrides?.verbose ?? parseBool(process.env.SIM_KAYAN_GALLERY_VERBOSE, true),
    negativeTests: overrides?.negativeTests ?? parseBool(process.env.SIM_KAYAN_GALLERY_NEGATIVE_TESTS, true),
    continueOnFail: overrides?.continueOnFail ?? parseBool(process.env.SIM_KAYAN_GALLERY_CONTINUE_ON_FAIL, true),
    uploadMode,
    preflightMaxAttempts: parsePositiveInt(process.env.SIM_KAYAN_GALLERY_PREFLIGHT_ATTEMPTS, 30),
    preflightDelayMs: parsePositiveInt(process.env.SIM_KAYAN_GALLERY_PREFLIGHT_DELAY_MS, 1000),
    adminEmail: overrides?.adminEmail ?? process.env.ADMIN_EMAIL,
    adminPhone: overrides?.adminPhone ?? process.env.ADMIN_PHONE,
    adminPassword: overrides?.adminPassword ?? process.env.ADMIN_PASSWORD,
  };

  if (!config.baseUrl) throw new Error('BASE_URL is required.');
  if (!config.adminPassword) throw new Error('ADMIN_PASSWORD is required.');
  if (!config.adminEmail && !config.adminPhone) throw new Error('ADMIN_EMAIL or ADMIN_PHONE is required.');

  return {
    config,
    user: makeIdentity(),
  };
}

export async function runGalleryHappyPath(
  config: GalleryTestConfig,
  user: AuthIdentity,
): Promise<GalleryHappyPathResult> {
  const steps: StepResult[] = [];
  const state: Partial<GalleryHappyState> = { user };
  let healthy = false;
  for (let i = 0; i < config.preflightMaxAttempts; i += 1) {
    try {
      const health = await requestJson(config, 'GET', '/api/health/ready');
      if (health.status === 200) {
        healthy = true;
        break;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, config.preflightDelayMs));
  }
  pushAssertion(
    config,
    steps,
    'preflight: /health/ready reachable',
    healthy,
    healthy
      ? `Service ready after preflight checks`
      : `Service not ready after ${config.preflightMaxAttempts} attempts`,
  );
  if (!healthy && !config.continueOnFail) {
    throw new Error('Preflight readiness failed');
  }

  state.adminTokens = await loginWithAdaptiveIdentifier(
    config,
    steps,
    'admin preflight',
    config.adminEmail,
    config.adminPhone,
    config.adminPassword!,
  );
  state.userTokens = await registerAndLoginUser(config, steps, user);

  const adminToken = state.adminTokens.accessToken;
  const userToken = state.userTokens.accessToken;

  await runAndRecord(config, steps, 'public list gallery baseline', 200, () =>
    requestJson(config, 'GET', '/api/gallery'),
  );

  await runAndRecord(config, steps, 'admin list gallery baseline', 200, () =>
    requestJson(config, 'GET', '/api/admin/gallery', undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  const fileName = `gallery-sim-${Date.now()}.png`;
  const intent = await runAndRecord<{ file?: { id?: number }; upload?: UploadIntentPayload }>(
    config,
    steps,
    'admin create upload intent',
    [200, 201],
    () =>
      requestJson(
        config,
        'POST',
        '/api/files/upload-intent',
        {
          ownerType: 'product',
          purpose: 'product_image',
          filename: fileName,
          mimeType: 'image/png',
          fileSizeBytes: 68,
        },
        { Authorization: `Bearer ${adminToken}` },
      ),
  );

  const intentData = intent.body?.data as Record<string, unknown> | undefined;
  const file = (intentData?.file as Record<string, unknown> | undefined) ?? {};
  const upload = (intentData?.upload as UploadIntentPayload | undefined) ?? {};
  const fileId = toNumericId(file.id);
  if (fileId === null) throw new Error('Upload intent missing file.id');
  state.uploadedFileId = fileId;

  if (config.uploadMode === 'skip') {
    pushAssertion(config, steps, 'admin upload binary to signed URL', true, 'Skipped (SIM_KAYAN_GALLERY_UPLOAD_MODE=skip)');
  } else {
    try {
      await uploadWithSignedIntent(config, upload, fileName, 'image/png');
      pushAssertion(config, steps, 'admin upload binary to signed URL', true, 'Signed upload completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushAssertion(config, steps, 'admin upload binary to signed URL', false, message);
    }
  }

  await runAndRecord(config, steps, 'admin mark file uploaded', [200, 201], () =>
    requestJson(
      config,
      'PATCH',
      `/api/files/${fileId}/mark-uploaded`,
      {
        checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      { Authorization: `Bearer ${adminToken}` },
    ),
  );

  const create = await runAndRecord(config, steps, 'admin create gallery item', [200, 201], () =>
    requestJson(
      config,
      'POST',
      '/api/admin/gallery',
      {
        title: `Gallery Sim Item ${Date.now()}`,
        description: 'Gallery simulation item created via CLI client flow.',
        imageFileIds: [fileId],
      },
      { Authorization: `Bearer ${adminToken}` },
    ),
  );
  state.galleryItemId = pickNestedId(create.body, 'item');

  const pubAfterCreate = await runAndRecord(config, steps, 'public list gallery after create', 200, () =>
    requestJson(config, 'GET', '/api/gallery'),
  );
  const createdInPublic = findGalleryItem(extractItems(pubAfterCreate.body), state.galleryItemId);
  pushAssertion(
    config,
    steps,
    'assert created item appears in public list with images',
    !!createdInPublic && Array.isArray(createdInPublic.images) && createdInPublic.images.length > 0,
    createdInPublic
      ? `Created item found with images (${describeItemsShape(pubAfterCreate.body)})`
      : `Created item missing from public list (${describeItemsShape(pubAfterCreate.body)})`,
    {
      createdInPublic,
      extractedCount: extractItems(pubAfterCreate.body).length,
    },
  );

  await runAndRecord(config, steps, 'admin update gallery item inactive', [200, 201], () =>
    requestJson(
      config,
      'PATCH',
      `/api/admin/gallery/${state.galleryItemId}`,
      {
        title: `Gallery Sim Item Updated ${Date.now()}`,
        description: 'Updated and made inactive by simulation.',
        isActive: false,
        imageFileIds: [fileId],
      },
      { Authorization: `Bearer ${adminToken}` },
    ),
  );

  const pubAfterInactive = await runAndRecord(config, steps, 'public list gallery after inactive', 200, () =>
    requestJson(config, 'GET', '/api/gallery'),
  );
  const inactiveInPublic = findGalleryItem(extractItems(pubAfterInactive.body), state.galleryItemId);
  pushAssertion(
    config,
    steps,
    'assert inactive item hidden from public list',
    inactiveInPublic === null,
    inactiveInPublic === null ? 'Inactive item hidden from public' : 'Inactive item unexpectedly visible publicly',
    inactiveInPublic,
  );

  const adminAfterInactive = await runAndRecord(config, steps, 'admin list gallery after inactive', 200, () =>
    requestJson(config, 'GET', '/api/admin/gallery', undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  const inactiveInAdmin = findGalleryItem(extractItems(adminAfterInactive.body), state.galleryItemId);
  pushAssertion(
    config,
    steps,
    'assert inactive item visible in admin list',
    inactiveInAdmin !== null,
    inactiveInAdmin
      ? `Inactive item visible in admin list (${describeItemsShape(adminAfterInactive.body)})`
      : `Inactive item missing in admin list (${describeItemsShape(adminAfterInactive.body)})`,
    {
      inactiveInAdmin,
      extractedCount: extractItems(adminAfterInactive.body).length,
    },
  );

  await runAndRecord(config, steps, 'admin reactivate gallery item', [200, 201], () =>
    requestJson(
      config,
      'PATCH',
      `/api/admin/gallery/${state.galleryItemId}`,
      { isActive: true, imageFileIds: [fileId] },
      { Authorization: `Bearer ${adminToken}` },
    ),
  );

  const pubAfterReactivate = await runAndRecord(config, steps, 'public list gallery after reactivate', 200, () =>
    requestJson(config, 'GET', '/api/gallery'),
  );
  const reactivatedInPublic = findGalleryItem(extractItems(pubAfterReactivate.body), state.galleryItemId);
  pushAssertion(
    config,
    steps,
    'assert reactivated item visible in public list',
    reactivatedInPublic !== null,
    reactivatedInPublic
      ? `Reactivated item visible publicly (${describeItemsShape(pubAfterReactivate.body)})`
      : `Reactivated item still missing publicly (${describeItemsShape(pubAfterReactivate.body)})`,
    {
      reactivatedInPublic,
      extractedCount: extractItems(pubAfterReactivate.body).length,
    },
  );

  await runAndRecord(config, steps, 'admin soft delete gallery item', [200, 201], () =>
    requestJson(config, 'DELETE', `/api/admin/gallery/${state.galleryItemId}`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  const pubAfterDelete = await runAndRecord(config, steps, 'public list gallery after delete', 200, () =>
    requestJson(config, 'GET', '/api/gallery'),
  );
  const deletedInPublic = findGalleryItem(extractItems(pubAfterDelete.body), state.galleryItemId);
  pushAssertion(
    config,
    steps,
    'assert deleted item hidden from public list',
    deletedInPublic === null,
    deletedInPublic === null ? 'Deleted item hidden from public' : 'Deleted item unexpectedly visible publicly',
    deletedInPublic,
  );

  const adminAfterDelete = await runAndRecord(config, steps, 'admin list gallery after delete', 200, () =>
    requestJson(config, 'GET', '/api/admin/gallery', undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  const deletedInAdmin = findGalleryItem(extractItems(adminAfterDelete.body), state.galleryItemId);
  pushAssertion(
    config,
    steps,
    'assert deleted item hidden from admin list',
    deletedInAdmin === null,
    deletedInAdmin === null ? 'Deleted item hidden from admin list' : 'Deleted item unexpectedly visible in admin list',
    deletedInAdmin,
  );

  assertHappyState(state);
  return { steps, state };
}

export async function runGalleryNegativeCases(
  config: GalleryTestConfig,
  state: GalleryHappyState,
): Promise<GalleryNegativePathResult> {
  const steps: StepResult[] = [];
  const adminToken = state.adminTokens.accessToken;
  const userToken = state.userTokens.accessToken;

  await runAndRecord(config, steps, 'negative unauthorized admin create gallery', 401, () =>
    requestJson(config, 'POST', '/api/admin/gallery', {
      title: 'Unauthorized',
      description: 'Should fail',
      imageFileIds: [],
    }),
  );

  await runAndRecord(config, steps, 'negative non-admin create gallery', 403, () =>
    requestJson(config, 'POST', '/api/admin/gallery', {
      title: 'Forbidden',
      description: 'Should fail',
      imageFileIds: [],
    }, { Authorization: `Bearer ${userToken}` }),
  );

  await runAndRecord(config, steps, 'negative admin update invalid gallery id', 404, () =>
    requestJson(config, 'PATCH', '/api/admin/gallery/999999999', { title: 'missing' }, { Authorization: `Bearer ${adminToken}` }),
  );

  await runAndRecord(config, steps, 'negative admin delete invalid gallery id', 404, () =>
    requestJson(config, 'DELETE', '/api/admin/gallery/999999999', undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  await runAndRecord(config, steps, 'negative admin create invalid gallery payload', [400, 422], () =>
    requestJson(config, 'POST', '/api/admin/gallery', {
      title: '',
      description: 'invalid title',
      imageFileIds: [],
    }, { Authorization: `Bearer ${adminToken}` }),
  );

  return { steps };
}

export function summarizeResults(steps: StepResult[]): { passed: number; failed: number; total: number } {
  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  return { passed, failed, total: steps.length };
}

export async function writeGalleryReport(
  config: GalleryTestConfig,
  steps: StepResult[],
  state: GalleryHappyState,
): Promise<string> {
  const now = new Date();
  const startedAt = now.toISOString();
  const runId = `${startedAt.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const totals = summarizeResults(steps);

  const summary: GallerySummary = {
    runId,
    startedAt,
    baseUrl: config.baseUrl,
    settings: {
      negativeTests: config.negativeTests,
      continueOnFail: config.continueOnFail,
      timeoutMs: config.timeoutMs,
    },
    state: {
      userEmail: state.user.email,
      galleryItemId: state.galleryItemId,
      uploadedFileId: state.uploadedFileId,
    },
    totals,
    firstFailure: steps.find((s) => !s.ok) ?? null,
    steps,
  };

  const logDir = path.join(process.cwd(), 'logs');
  const reportFile = path.join(logDir, `kayan-gallery-simulation-${runId}.json`);
  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(reportFile, JSON.stringify(summary, null, 2), 'utf8');
  return reportFile;
}
