/* eslint-disable no-console */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { io, Socket } from 'socket.io-client';

type HeadersMap = Record<string, string>;
type ItemType = 'order' | 'fault' | 'service';

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

export type FollowupTestConfig = {
  baseUrl: string;
  timeoutMs: number;
  verbose: boolean;
  negativeTests: boolean;
  continueOnFail: boolean;
  adminEmail?: string;
  adminPhone?: string;
  adminPassword?: string;
  reportDir: string;
  checkDeprecatedAliases: boolean;
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

type ItemContext = {
  itemType: ItemType;
  itemId: number;
  conversationId: number;
  steps: number[];
};

export type FollowupHappyState = {
  userA: AuthIdentity;
  userB: AuthIdentity;
  userATokens: Tokens;
  userBTokens: Tokens;
  adminTokens: Tokens;
  orderId: number;
  faultId: number;
  serviceId: number;
  itemContexts: ItemContext[];
};

export type FollowupHappyPathResult = {
  steps: StepResult[];
  state: FollowupHappyState;
};

export type FollowupNegativePathResult = {
  steps: StepResult[];
};

type FollowupSummary = {
  runId: string;
  startedAt: string;
  baseUrl: string;
  settings: {
    negativeTests: boolean;
    continueOnFail: boolean;
    timeoutMs: number;
  };
  state: {
    orderId: number;
    faultId: number;
    serviceId: number;
    conversationIds: Record<ItemType, number>;
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
  const ssn = `F${suffix.slice(-8)}`;
  return {
    name: `Followup Sim User ${label}`,
    email: `followup.sim.${label.toLowerCase()}.${suffix}@example.com`,
    phone: `+2015${suffix.slice(-8)}`,
    ssn,
    password: label === 'A' ? 'FollowupPass123' : 'FollowupPass456',
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
  config: FollowupTestConfig,
  method: string,
  endpoint: string,
  body?: unknown,
  headers?: HeadersMap,
): Promise<{ status: number; body: ApiEnvelope<T> | null; rawText: string; headers: Headers }> {
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
    return { status: response.status, body: parsed, rawText, headers: response.headers };
  } finally {
    clearTimeout(timer);
  }
}

function makeStep(name: string, ok: boolean, status: number, message: string, payload?: unknown): StepResult {
  return { name, ok, status, message, payload };
}

function logStep(config: FollowupTestConfig, step: StepResult): void {
  if (!config.verbose && step.ok) return;
  console.log(`[${step.ok ? 'PASS' : 'FAIL'}] ${step.name} (${step.status}) - ${step.message}`);
}

async function runAndRecord<T>(
  config: FollowupTestConfig,
  steps: StepResult[],
  name: string,
  expectedStatus: number | number[],
  request: () => Promise<{ status: number; body: ApiEnvelope<T> | null; rawText: string; headers: Headers }>,
): Promise<{ status: number; body: ApiEnvelope<T> | null; rawText: string; headers: Headers }> {
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
  config: FollowupTestConfig,
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
  config: FollowupTestConfig,
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

function assertHappyState(state: Partial<FollowupHappyState>): asserts state is FollowupHappyState {
  if (
    !state.userA ||
    !state.userB ||
    !state.userATokens ||
    !state.userBTokens ||
    !state.adminTokens ||
    typeof state.orderId !== 'number' ||
    typeof state.faultId !== 'number' ||
    typeof state.serviceId !== 'number' ||
    !state.itemContexts
  ) {
    throw new Error('Followup happy path did not produce a complete simulation state.');
  }
}

function ensureSortedBySortThenId(items: Array<Record<string, unknown>>): boolean {
  for (let i = 1; i < items.length; i += 1) {
    const prevSort = Number(items[i - 1].sort_order ?? items[i - 1].sortOrder ?? 0);
    const nextSort = Number(items[i].sort_order ?? items[i].sortOrder ?? 0);
    const prevId = Number(items[i - 1].id);
    const nextId = Number(items[i].id);
    if (nextSort < prevSort) return false;
    if (nextSort === prevSort && nextId < prevId) return false;
  }
  return true;
}

async function connectSocketWithToken(config: FollowupTestConfig, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${config.baseUrl}/chat`, {
      transports: ['websocket'],
      auth: { token: `Bearer ${token}` },
      timeout: config.timeoutMs,
      forceNew: true,
      reconnection: false,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connect timeout'));
    }, config.timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function emitWithAck<T>(
  socket: Socket,
  event: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} ack timeout`)), timeoutMs);
    socket.emit(event, payload, (ack: T) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

async function waitForEventOnce(
  socket: Socket,
  event: string,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload as Record<string, unknown>);
    });
  });
}

async function runSocketFlow(
  config: FollowupTestConfig,
  steps: StepResult[],
  itemType: ItemType,
  conversationId: number,
  ownerToken: string,
  adminToken: string,
): Promise<void> {
  let ownerSocket: Socket | null = null;
  let adminSocket: Socket | null = null;

  try {
    ownerSocket = await connectSocketWithToken(config, ownerToken);
    adminSocket = await connectSocketWithToken(config, adminToken);

    const joinedEventOwnerPromise = waitForEventOnce(ownerSocket, 'conversation.joined', Math.min(config.timeoutMs, 5000));

    const joinAckOwner = await emitWithAck<Record<string, unknown>>(
      ownerSocket,
      'conversation.join',
      { conversationId },
      config.timeoutMs,
    );

    const joinedPayload = await joinedEventOwnerPromise;
    steps.push(makeStep(`socket ${itemType} owner join ack`, Boolean((joinAckOwner as any)?.success), 200, 'Owner joined conversation room', joinAckOwner));
    steps.push(makeStep(
      `socket ${itemType} owner joined event`,
      true,
      joinedPayload !== null ? 200 : 204,
      joinedPayload !== null ? 'Owner received conversation.joined' : 'No conversation.joined event observed in timeout window',
      joinedPayload,
    ));

    const joinAckAdmin = await emitWithAck<Record<string, unknown>>(
      adminSocket,
      'conversation.join',
      { conversationId },
      config.timeoutMs,
    );
    steps.push(makeStep(`socket ${itemType} admin join ack`, Boolean((joinAckAdmin as any)?.success), 200, 'Admin joined conversation room', joinAckAdmin));

    const ownerRecvMessage = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('message.received timeout at owner')), config.timeoutMs);
      ownerSocket!.once('message.received', (payload) => {
        clearTimeout(timer);
        resolve(payload as Record<string, unknown>);
      });
    });

    const sendAckAdmin = await emitWithAck<Record<string, unknown>>(
      adminSocket,
      'message.send',
      { conversationId, text: `ws-admin-${itemType}-${Date.now()}` },
      config.timeoutMs,
    );
    const ownerMessageEvent = await ownerRecvMessage;
    const wsMessage = (ownerMessageEvent.message as Record<string, unknown> | undefined) ?? (sendAckAdmin as any)?.message;
    const wsMessageId = Number(wsMessage?.id);

    steps.push(makeStep(`socket ${itemType} admin send ack`, Boolean((sendAckAdmin as any)?.success), 200, 'Admin sent websocket message', sendAckAdmin));
    steps.push(makeStep(`socket ${itemType} owner receive message event`, Boolean((ownerMessageEvent as any)?.success), 200, 'Owner received websocket message.received', ownerMessageEvent));

    const readEventAdmin = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('message.read timeout at admin')), config.timeoutMs);
      adminSocket!.once('message.read', (payload) => {
        clearTimeout(timer);
        resolve(payload as Record<string, unknown>);
      });
    });

    const readAckOwner = await emitWithAck<Record<string, unknown>>(
      ownerSocket,
      'message.read',
      { messageId: wsMessageId },
      config.timeoutMs,
    );
    const readEvent = await readEventAdmin;

    steps.push(makeStep(`socket ${itemType} owner read ack`, Boolean((readAckOwner as any)?.success), 200, 'Owner marked message read via websocket', readAckOwner));
    steps.push(makeStep(`socket ${itemType} admin read event`, Boolean((readEvent as any)?.success), 200, 'Admin received websocket message.read', readEvent));

    for (const s of steps.slice(-7)) logStep(config, s);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const step = makeStep(`socket ${itemType} flow`, false, 500, message);
    steps.push(step);
    logStep(config, step);
    if (!config.continueOnFail) throw error;
  } finally {
    ownerSocket?.disconnect();
    adminSocket?.disconnect();
  }
}

async function createOrder(config: FollowupTestConfig, steps: StepResult[], adminToken: string, userToken: string): Promise<number> {
  const createProduct = await runAndRecord(config, steps, 'setup order: admin create product', [200, 201], () =>
    requestJson(config, 'POST', '/api/admin/products', {
      title: `Followup Sim Product ${Date.now()}`,
      description: 'Followup simulation product.',
      amount: 5,
      price: 99,
      details: { source: 'simulate-kayan-followup-flows' },
      imageFileIds: [],
      fileIds: [],
    }, { Authorization: `Bearer ${adminToken}` }),
  );
  const productId = pickId(createProduct.body, 'product');

  await runAndRecord(config, steps, 'setup order: user add cart item', [200, 201], () =>
    requestJson(config, 'POST', '/api/cart/items', { productId, quantity: 1 }, { Authorization: `Bearer ${userToken}` }),
  );

  const checkout = await runAndRecord(config, steps, 'setup order: user checkout', [200, 201], () =>
    requestJson(config, 'POST', '/api/cart/checkout', { deliveryAddress: 'Cairo, Maadi, Street 1' }, { Authorization: `Bearer ${userToken}` }),
  );
  return pickId(checkout.body, 'order');
}

async function createFault(config: FollowupTestConfig, steps: StepResult[], userToken: string): Promise<number> {
  const created = await runAndRecord(config, steps, 'setup fault: user report fault', [200, 201], () =>
    requestJson(config, 'POST', '/api/faults', {
      title: `Followup Fault ${Date.now()}`,
      description: 'Fault for followup simulation',
      severity: 'normal',
      address: 'Cairo, Heliopolis',
      imageFileIds: [],
    }, { Authorization: `Bearer ${userToken}` }),
  );
  return pickId(created.body, 'report');
}

async function createService(config: FollowupTestConfig, steps: StepResult[], userToken: string): Promise<number> {
  const created = await runAndRecord(config, steps, 'setup service: user create service order', [200, 201], () =>
    requestJson(config, 'POST', '/api/services', {
      serviceType: 'maintenance',
      description: 'Service for followup simulation',
      address: 'Cairo, Nasr City',
    }, { Authorization: `Bearer ${userToken}` }),
  );
  return pickId(created.body, 'serviceOrder');
}

async function getCurrentUserId(config: FollowupTestConfig, token: string): Promise<number> {
  const me = await requestJson(config, 'GET', '/api/me', undefined, { Authorization: `Bearer ${token}` });
  if (me.status !== 200) throw new Error(`Failed to fetch /me (status=${me.status})`);
  const data = me.body?.data as Record<string, unknown> | undefined;
  const id = toNumericId(data?.id);
  if (id === null) throw new Error('Unable to resolve current user id from /me');
  return id;
}

async function createGenericChatConversation(
  config: FollowupTestConfig,
  steps: StepResult[],
  ownerToken: string,
  participantId: number,
): Promise<number> {
  const created = await runAndRecord(config, steps, 'setup socket: create generic chat conversation', [200, 201], () =>
    requestJson(config, 'POST', '/api/chat/conversations', { participantId }, { Authorization: `Bearer ${ownerToken}` }),
  );
  return pickId(created.body, 'conversation');
}

async function runPerItemFlow(
  config: FollowupTestConfig,
  steps: StepResult[],
  itemType: ItemType,
  itemId: number,
  wsConversationId: number,
  ownerToken: string,
  nonOwnerToken: string,
  adminToken: string,
): Promise<ItemContext> {
  const stepA = await runAndRecord(config, steps, `${itemType}: admin add step A`, [200, 201], () =>
    requestJson(config, 'POST', `/api/admin/followups/${itemType}/${itemId}/steps`, { title: `${itemType} step A`, sortOrder: 2 }, { Authorization: `Bearer ${adminToken}` }),
  );
  const stepAId = pickId(stepA.body, 'step');

  const stepB = await runAndRecord(config, steps, `${itemType}: admin add step B`, [200, 201], () =>
    requestJson(config, 'POST', `/api/admin/followups/${itemType}/${itemId}/steps`, { title: `${itemType} step B`, sortOrder: 1 }, { Authorization: `Bearer ${adminToken}` }),
  );
  const stepBId = pickId(stepB.body, 'step');

  await runAndRecord(config, steps, `${itemType}: admin update step A`, 200, () =>
    requestJson(config, 'PATCH', `/api/admin/followups/${itemType}/${itemId}/steps/${stepAId}`, { title: `${itemType} step A updated` }, { Authorization: `Bearer ${adminToken}` }),
  );

  const listed = await runAndRecord(config, steps, `${itemType}: owner list followup steps`, 200, () =>
    requestJson(config, 'GET', `/api/followups/${itemType}/${itemId}/steps`, undefined, { Authorization: `Bearer ${ownerToken}` }),
  );

  const listItems = (((listed.body?.data as any)?.items) ?? []) as Array<Record<string, unknown>>;
  const sortedOk = ensureSortedBySortThenId(listItems);
  const sortStep = makeStep(`${itemType}: steps sorted by sort_order then id`, sortedOk, sortedOk ? 200 : 500, sortedOk ? 'Deterministic ordering confirmed' : 'Step ordering mismatch', listItems);
  steps.push(sortStep);
  logStep(config, sortStep);
  if (!sortedOk && !config.continueOnFail) {
    throw new Error(`${itemType}: steps ordering assertion failed.`);
  }

  const convoCreate = await runAndRecord(config, steps, `${itemType}: owner create followup conversation`, [200, 201], () =>
    requestJson(config, 'POST', `/api/followups/${itemType}/${itemId}/chat/conversations`, {}, { Authorization: `Bearer ${ownerToken}` }),
  );
  const conversationId = pickId(convoCreate.body, 'conversation');

  const convoCreateAgain = await runAndRecord(config, steps, `${itemType}: owner create conversation idempotent`, [200, 201], () =>
    requestJson(config, 'POST', `/api/followups/${itemType}/${itemId}/chat/conversations`, {}, { Authorization: `Bearer ${ownerToken}` }),
  );
  const conversationIdAgain = pickId(convoCreateAgain.body, 'conversation');
  const idemOk = conversationId === conversationIdAgain;
  const idemStep = makeStep(`${itemType}: conversation idempotency`, idemOk, idemOk ? 200 : 500, idemOk ? 'Conversation ID stable on repeated create' : 'Repeated create changed conversation ID', {
    conversationId,
    conversationIdAgain,
  });
  steps.push(idemStep);
  logStep(config, idemStep);
  if (!idemOk && !config.continueOnFail) {
    throw new Error(`${itemType}: conversation idempotency assertion failed.`);
  }

  await runAndRecord(config, steps, `${itemType}: owner send rest message`, [200, 201], () =>
    requestJson(config, 'POST', `/api/followups/${itemType}/${itemId}/chat/conversations/${conversationId}/messages`, {
      messageText: `rest-owner-${itemType}-${Date.now()}`,
    }, { Authorization: `Bearer ${ownerToken}` }),
  );
  await runAndRecord(config, steps, `${itemType}: admin send rest message`, [200, 201], () =>
    requestJson(config, 'POST', `/api/followups/${itemType}/${itemId}/chat/conversations/${conversationId}/messages`, {
      messageText: `rest-admin-${itemType}-${Date.now()}`,
    }, { Authorization: `Bearer ${adminToken}` }),
  );

  const messages = await runAndRecord(config, steps, `${itemType}: owner list rest messages`, 200, () =>
    requestJson(config, 'GET', `/api/followups/${itemType}/${itemId}/chat/conversations/${conversationId}/messages`, undefined, { Authorization: `Bearer ${ownerToken}` }),
  );
  const msgItems = (((messages.body?.data as any)?.items) ?? []) as Array<Record<string, unknown>>;
  const ascendingOk = msgItems.every((m, idx) => {
    if (idx === 0) return true;
    const prev = Date.parse(String(msgItems[idx - 1].sent_at ?? msgItems[idx - 1].sentAt));
    const cur = Date.parse(String(m.sent_at ?? m.sentAt));
    return !Number.isNaN(prev) && !Number.isNaN(cur) && cur >= prev;
  });
  const msgSortStep = makeStep(`${itemType}: rest messages ascending by sent_at`, ascendingOk, ascendingOk ? 200 : 500, ascendingOk ? 'Message ordering confirmed' : 'Message ordering mismatch', msgItems);
  steps.push(msgSortStep);
  logStep(config, msgSortStep);
  if (!ascendingOk && !config.continueOnFail) {
    throw new Error(`${itemType}: rest message ordering assertion failed.`);
  }

  await runAndRecord(config, steps, `${itemType}: non-owner forbidden steps list`, 403, () =>
    requestJson(config, 'GET', `/api/followups/${itemType}/${itemId}/steps`, undefined, { Authorization: `Bearer ${nonOwnerToken}` }),
  );
  await runAndRecord(config, steps, `${itemType}: non-owner forbidden conversation create`, 403, () =>
    requestJson(config, 'POST', `/api/followups/${itemType}/${itemId}/chat/conversations`, {}, { Authorization: `Bearer ${nonOwnerToken}` }),
  );
  await runAndRecord(config, steps, `${itemType}: non-participant forbidden list messages`, 403, () =>
    requestJson(config, 'GET', `/api/followups/${itemType}/${itemId}/chat/conversations/${conversationId}/messages`, undefined, { Authorization: `Bearer ${nonOwnerToken}` }),
  );
  await runAndRecord(config, steps, `${itemType}: non-participant forbidden send message`, 403, () =>
    requestJson(config, 'POST', `/api/followups/${itemType}/${itemId}/chat/conversations/${conversationId}/messages`, {
      messageText: `rest-non-participant-${itemType}`,
    }, { Authorization: `Bearer ${nonOwnerToken}` }),
  );

  const wrongType: ItemType = itemType === 'order' ? 'fault' : 'order';
  await runAndRecord(config, steps, `${itemType}: mismatched scope returns not found`, 404, () =>
    requestJson(config, 'GET', `/api/followups/${wrongType}/${itemId}/chat/conversations/${conversationId}/messages`, undefined, { Authorization: `Bearer ${ownerToken}` }),
  );

  await runAndRecord(config, steps, `${itemType}: admin unknown step update 404`, 404, () =>
    requestJson(config, 'PATCH', `/api/admin/followups/${itemType}/${itemId}/steps/999999999`, { title: 'missing' }, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, `${itemType}: admin unknown step delete 404`, 404, () =>
    requestJson(config, 'DELETE', `/api/admin/followups/${itemType}/${itemId}/steps/999999999`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  await runAndRecord(config, steps, `${itemType}: admin delete step A`, 200, () =>
    requestJson(config, 'DELETE', `/api/admin/followups/${itemType}/${itemId}/steps/${stepAId}`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );
  await runAndRecord(config, steps, `${itemType}: admin delete step B`, 200, () =>
    requestJson(config, 'DELETE', `/api/admin/followups/${itemType}/${itemId}/steps/${stepBId}`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  await runSocketFlow(config, steps, itemType, wsConversationId, ownerToken, adminToken);

  return {
    itemType,
    itemId,
    conversationId,
    steps: [stepAId, stepBId],
  };
}

async function runDeprecatedAliasSanity(
  config: FollowupTestConfig,
  steps: StepResult[],
  orderId: number,
  conversationId: number,
  adminToken: string,
  ownerToken: string,
): Promise<void> {
  const aliasRead = await runAndRecord(config, steps, 'alias steps read responds + deprecation header', 200, () =>
    requestJson(config, 'GET', `/api/followup/steps?itemType=order&itemId=${orderId}`, undefined, { Authorization: `Bearer ${ownerToken}` }),
  );
  const aliasReadHeader = aliasRead.headers.get('x-deprecated-route');
  const aliasReadOk = typeof aliasReadHeader === 'string' && aliasReadHeader.length > 0;
  const aliasReadStep = makeStep('alias steps read deprecation header check', aliasReadOk, aliasReadOk ? 200 : 500, aliasReadOk ? 'Deprecation header present' : 'Missing deprecation header', { header: aliasReadHeader });
  steps.push(aliasReadStep);
  logStep(config, aliasReadStep);

  const aliasCreateStep = await runAndRecord(config, steps, 'alias admin step create responds + deprecation header', [200, 201], () =>
    requestJson(config, 'POST', '/api/admin/followup-steps', { itemType: 'order', itemId: orderId, title: 'alias step', sortOrder: 0 }, { Authorization: `Bearer ${adminToken}` }),
  );
  const aliasCreateHeader = aliasCreateStep.headers.get('x-deprecated-route');
  const createdStepId = pickId(aliasCreateStep.body, 'step');
  const aliasCreateOk = typeof aliasCreateHeader === 'string' && aliasCreateHeader.length > 0;
  const aliasCreateHeaderStep = makeStep('alias admin step create deprecation header check', aliasCreateOk, aliasCreateOk ? 200 : 500, aliasCreateOk ? 'Deprecation header present' : 'Missing deprecation header', { header: aliasCreateHeader });
  steps.push(aliasCreateHeaderStep);
  logStep(config, aliasCreateHeaderStep);

  await runAndRecord(config, steps, 'alias admin step delete cleanup', 200, () =>
    requestJson(config, 'DELETE', `/api/admin/followup-steps/${createdStepId}`, undefined, { Authorization: `Bearer ${adminToken}` }),
  );

  const aliasChatRead = await runAndRecord(config, steps, 'alias chat list messages responds + deprecation header', 200, () =>
    requestJson(config, 'GET', `/api/followup/chat/conversations/${conversationId}/messages`, undefined, { Authorization: `Bearer ${ownerToken}` }),
  );
  const aliasChatHeader = aliasChatRead.headers.get('x-deprecated-route');
  const aliasChatOk = typeof aliasChatHeader === 'string' && aliasChatHeader.length > 0;
  const aliasChatStep = makeStep('alias chat read deprecation header check', aliasChatOk, aliasChatOk ? 200 : 500, aliasChatOk ? 'Deprecation header present' : 'Missing deprecation header', { header: aliasChatHeader });
  steps.push(aliasChatStep);
  logStep(config, aliasChatStep);
}

export function createFollowupTestContext(overrides?: Partial<FollowupTestConfig>): {
  config: FollowupTestConfig;
  userA: AuthIdentity;
  userB: AuthIdentity;
} {
  const config: FollowupTestConfig = {
    baseUrl: sanitizeBaseUrl(overrides?.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:800'),
    timeoutMs: overrides?.timeoutMs ?? parsePositiveInt(process.env.KAYAN_FOLLOWUP_TEST_TIMEOUT_MS, 20000),
    verbose: overrides?.verbose ?? parseBool(process.env.KAYAN_FOLLOWUP_TEST_VERBOSE, true),
    negativeTests: overrides?.negativeTests ?? parseBool(process.env.KAYAN_FOLLOWUP_TEST_NEGATIVE, true),
    continueOnFail: overrides?.continueOnFail ?? parseBool(process.env.KAYAN_FOLLOWUP_TEST_CONTINUE_ON_FAIL, false),
    adminEmail: overrides?.adminEmail ?? process.env.ADMIN_EMAIL,
    adminPhone: overrides?.adminPhone ?? process.env.ADMIN_PHONE,
    adminPassword: overrides?.adminPassword ?? process.env.ADMIN_PASSWORD,
    reportDir: overrides?.reportDir ?? path.join(process.cwd(), 'logs', 'kayan-followup-test'),
    checkDeprecatedAliases: overrides?.checkDeprecatedAliases ?? parseBool(process.env.KAYAN_FOLLOWUP_TEST_CHECK_DEPRECATED_ALIASES, false),
  };

  if (!config.adminPassword) throw new Error('ADMIN_PASSWORD is required.');
  if (!config.adminEmail && !config.adminPhone) {
    throw new Error('ADMIN_EMAIL or ADMIN_PHONE is required.');
  }

  return {
    config,
    userA: makeIdentity('A'),
    userB: makeIdentity('B'),
  };
}

export async function runFollowupHappyPath(
  config: FollowupTestConfig,
  userA: AuthIdentity,
  userB: AuthIdentity,
): Promise<FollowupHappyPathResult> {
  const steps: StepResult[] = [];
  const state: Partial<FollowupHappyState> = { userA, userB };

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
  const ownerToken = state.userATokens.accessToken;
  const nonOwnerToken = state.userBTokens.accessToken;
  const adminId = await getCurrentUserId(config, adminToken);
  const wsConversationId = await createGenericChatConversation(config, steps, ownerToken, adminId);

  state.orderId = await createOrder(config, steps, adminToken, ownerToken);
  state.faultId = await createFault(config, steps, ownerToken);
  state.serviceId = await createService(config, steps, ownerToken);

  const orderCtx = await runPerItemFlow(config, steps, 'order', state.orderId, wsConversationId, ownerToken, nonOwnerToken, adminToken);
  const faultCtx = await runPerItemFlow(config, steps, 'fault', state.faultId, wsConversationId, ownerToken, nonOwnerToken, adminToken);
  const serviceCtx = await runPerItemFlow(config, steps, 'service', state.serviceId, wsConversationId, ownerToken, nonOwnerToken, adminToken);
  state.itemContexts = [orderCtx, faultCtx, serviceCtx];

  if (config.checkDeprecatedAliases) {
    await runDeprecatedAliasSanity(config, steps, state.orderId, orderCtx.conversationId, adminToken, ownerToken);
  } else {
    const aliasStep = makeStep(
      'alias route sanity checks skipped',
      true,
      200,
      'Skipped because KAYAN_FOLLOWUP_TEST_CHECK_DEPRECATED_ALIASES=false',
    );
    steps.push(aliasStep);
    logStep(config, aliasStep);
  }

  assertHappyState(state);
  return { steps, state };
}

export async function runFollowupNegativeCases(
  config: FollowupTestConfig,
  state: FollowupHappyState,
): Promise<FollowupNegativePathResult> {
  const steps: StepResult[] = [];
  if (!config.negativeTests) return { steps };

  const ownerToken = state.userATokens.accessToken;

  for (const ctx of state.itemContexts) {
    await runAndRecord(config, steps, `negative ${ctx.itemType}: invalid conversation id list`, 404, () =>
      requestJson(config, 'GET', `/api/followups/${ctx.itemType}/${ctx.itemId}/chat/conversations/999999999/messages`, undefined, { Authorization: `Bearer ${ownerToken}` }),
    );
  }

  return { steps };
}

export function summarizeResults(steps: StepResult[]): { passed: number; failed: number; total: number } {
  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.length - passed;
  return { passed, failed, total: steps.length };
}

export async function writeFollowupReport(
  config: FollowupTestConfig,
  steps: StepResult[],
  state: FollowupHappyState,
): Promise<string> {
  const now = new Date();
  const startedAt = now.toISOString();
  const runId = `${startedAt.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const totals = summarizeResults(steps);

  const conversationIds = {
    order: state.itemContexts.find((i) => i.itemType === 'order')?.conversationId ?? 0,
    fault: state.itemContexts.find((i) => i.itemType === 'fault')?.conversationId ?? 0,
    service: state.itemContexts.find((i) => i.itemType === 'service')?.conversationId ?? 0,
  } satisfies Record<ItemType, number>;

  const summary: FollowupSummary = {
    runId,
    startedAt,
    baseUrl: config.baseUrl,
    settings: {
      negativeTests: config.negativeTests,
      continueOnFail: config.continueOnFail,
      timeoutMs: config.timeoutMs,
    },
    state: {
      orderId: state.orderId,
      faultId: state.faultId,
      serviceId: state.serviceId,
      conversationIds,
      userAEmail: state.userA.email,
      userBEmail: state.userB.email,
    },
    totals,
    firstFailure: steps.find((step) => !step.ok) ?? null,
    steps,
  };

  await fs.mkdir(config.reportDir, { recursive: true });
  const filePath = path.join(config.reportDir, `followup-sim-${runId}.json`);
  await fs.writeFile(filePath, JSON.stringify(summary, null, 2), 'utf8');
  return filePath;
}
