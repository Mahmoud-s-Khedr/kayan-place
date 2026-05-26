import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';

type OpenApiSchemaRef = {
  $ref?: string;
};

type OpenApiMediaType = {
  schema?: OpenApiSchemaRef;
};

type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  tags?: string[];
  security?: Array<Record<string, unknown>>;
  requestBody?: {
    content?: Record<string, OpenApiMediaType>;
  };
  responses?: Record<string, { content?: Record<string, OpenApiMediaType> }>;
};

type OpenApiDoc = {
  paths?: Record<string, Record<string, OpenApiOperation>>;
  security?: Array<Record<string, unknown>>;
};

export type RestApiItem = {
  type: 'rest';
  module: string;
  name: string;
  method: string;
  path: string;
  auth: 'bearer' | 'public';
  summary: string;
  requestShapeRef: string;
  responseShapeRef: string;
  notes: string;
};

export type WsApiItem = {
  type: 'ws';
  module: string;
  name: string;
  event: string;
  channel: string;
  auth: 'bearer' | 'public';
  summary: string;
  requestShapeRef: string;
  responseShapeRef: string;
  notes: string;
};

export function parseRestApisFromOpenApi(doc: OpenApiDoc): RestApiItem[] {
  const items: RestApiItem[] = [];
  const dedup = new Set<string>();
  const paths = doc.paths ?? {};

  for (const [apiPath, methods] of Object.entries(paths)) {
    for (const [methodRaw, op] of Object.entries(methods ?? {})) {
      const method = methodRaw.toUpperCase();
      const operationId = op?.operationId ?? '';
      const dedupKey = `${operationId}|${method}|${apiPath}`;
      if (dedup.has(dedupKey)) {
        continue;
      }
      dedup.add(dedupKey);

      const module = op?.tags?.[0] ?? 'Untagged';
      const summary = op?.summary?.trim() || operationId || `${method} ${apiPath}`;
      const requestShapeRef = pickRequestShapeRef(op);
      const responseShapeRef = pickResponseShapeRef(op);
      const security = op?.security;
      const auth: 'bearer' | 'public' =
        (Array.isArray(security) && security.length > 0) ||
        (!security && Array.isArray(doc.security) && doc.security.length > 0)
          ? 'bearer'
          : 'public';

      items.push({
        type: 'rest',
        module,
        name: operationId || `${method} ${apiPath}`,
        method,
        path: apiPath,
        auth,
        summary,
        requestShapeRef,
        responseShapeRef,
        notes: '',
      });
    }
  }

  return items.sort((a, b) =>
    a.module.localeCompare(b.module) ||
    a.path.localeCompare(b.path) ||
    a.method.localeCompare(b.method),
  );
}

export function parseWsApisFromGatewaySource(source: string, filePath: string): WsApiItem[] {
  const classMatch = source.match(/export\s+class\s+(\w+)/);
  const className = classMatch?.[1] ?? basename(filePath, '.ts');
  const namespaceMatch = source.match(/@WebSocketGateway\(([^)]*)\)/s);
  const namespace = namespaceMatch?.[1].match(/namespace\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? '/';

  const items: WsApiItem[] = [];
  const dedup = new Set<string>();
  const subscribePattern =
    /@SubscribeMessage\(\s*['"]([^'"]+)['"]\s*\)\s*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?(\w+)\s*\(/g;

  let match: RegExpExecArray | null;
  while ((match = subscribePattern.exec(source)) !== null) {
    const event = match[1];
    const methodName = match[2];
    const requestShapeRef = extractBodyDtoFromMethodSignature(source, match.index, methodName);
    const responseShapeRef = extractEmitEventFromMethodBody(source, methodName) || 'ack payload';
    const dedupKey = `${className}|${event}`;
    if (dedup.has(dedupKey)) {
      continue;
    }
    dedup.add(dedupKey);

    items.push({
      type: 'ws',
      module: className,
      name: methodName,
      event,
      channel: namespace,
      auth: 'bearer',
      summary: `Handle ${event}`,
      requestShapeRef,
      responseShapeRef,
      notes: 'JWT required in Socket auth/header during connection.',
    });
  }

  return items.sort((a, b) =>
    a.module.localeCompare(b.module) ||
    a.event.localeCompare(b.event) ||
    a.name.localeCompare(b.name),
  );
}

export function renderApiListMarkdown(restItems: RestApiItem[], wsItems: WsApiItem[]): string {
  const lines: string[] = [];
  lines.push('# API List');
  lines.push('');
  lines.push('Generated from `openapi.json` (REST) and `src/**/*.gateway.ts` (WebSocket).');
  lines.push('');
  lines.push('## REST APIs');
  lines.push('');

  const restGroups = groupBy(restItems, (item) => item.module);
  if (restGroups.size === 0) {
    lines.push('_No REST APIs found._');
    lines.push('');
  } else {
    for (const [module, items] of [...restGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`### ${module}`);
      lines.push('');
      lines.push('| Method | Path | Auth | Name | Summary | Request | Response | Notes |');
      lines.push('|---|---|---|---|---|---|---|---|');
      for (const item of items) {
        lines.push(
          `| ${item.method} | ${escapePipes(item.path)} | ${item.auth} | ${escapePipes(item.name)} | ${escapePipes(item.summary)} | ${escapePipes(item.requestShapeRef)} | ${escapePipes(item.responseShapeRef)} | ${escapePipes(item.notes)} |`,
        );
      }
      lines.push('');
    }
  }

  lines.push('## WebSocket APIs');
  lines.push('');
  const wsGroups = groupBy(wsItems, (item) => item.module);
  if (wsGroups.size === 0) {
    lines.push('_No WebSocket APIs found._');
    lines.push('');
  } else {
    for (const [module, items] of [...wsGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`### ${module}`);
      lines.push('');
      lines.push('| Event | Channel | Auth | Handler | Summary | Request | Response | Notes |');
      lines.push('|---|---|---|---|---|---|---|---|');
      for (const item of items) {
        lines.push(
          `| ${escapePipes(item.event)} | ${escapePipes(item.channel)} | ${item.auth} | ${escapePipes(item.name)} | ${escapePipes(item.summary)} | ${escapePipes(item.requestShapeRef)} | ${escapePipes(item.responseShapeRef)} | ${escapePipes(item.notes)} |`,
        );
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

export function generateApiList(args?: {
  openApiPath?: string;
  sourceDir?: string;
  outputPath?: string;
}): void {
  const openApiPath = resolve(args?.openApiPath ?? 'openapi.json');
  const sourceDir = resolve(args?.sourceDir ?? 'src');
  const outputPath = resolve(args?.outputPath ?? 'docs/api-list.md');

  let openApiRaw: string;
  try {
    openApiRaw = readFileSync(openApiPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to read ${relative(process.cwd(), openApiPath)}. Generate Swagger first so openapi.json exists. Original error: ${message}`,
    );
  }

  const doc = JSON.parse(openApiRaw) as OpenApiDoc;
  const restItems = parseRestApisFromOpenApi(doc);

  const gatewayFiles = listGatewayFiles(sourceDir);
  const wsItems = gatewayFiles.flatMap((gatewayFile) => {
    const source = readFileSync(gatewayFile, 'utf8');
    return parseWsApisFromGatewaySource(source, gatewayFile);
  });

  const markdown = renderApiListMarkdown(restItems, wsItems);
  writeFileSync(outputPath, markdown, 'utf8');
}

function listGatewayFiles(sourceDir: string): string[] {
  const output = execSync(`rg --files "${sourceDir}" -g "*.gateway.ts"`, {
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => resolve(line))
    .sort((a, b) => a.localeCompare(b));
}

function pickRequestShapeRef(operation: OpenApiOperation): string {
  const content = operation?.requestBody?.content;
  if (!content) {
    return '-';
  }
  for (const mediaType of ['application/json', ...Object.keys(content)]) {
    const schemaRef = content[mediaType]?.schema?.$ref;
    if (schemaRef) {
      return refName(schemaRef);
    }
  }
  return 'inline/unknown';
}

function pickResponseShapeRef(operation: OpenApiOperation): string {
  const responses = operation?.responses ?? {};
  const orderedStatus = Object.keys(responses).sort((a, b) => {
    const aScore = isSuccessStatus(a) ? 0 : 1;
    const bScore = isSuccessStatus(b) ? 0 : 1;
    if (aScore !== bScore) {
      return aScore - bScore;
    }
    return a.localeCompare(b);
  });

  for (const status of orderedStatus) {
    const content = responses[status]?.content;
    if (!content) {
      continue;
    }
    for (const mediaType of ['application/json', ...Object.keys(content)]) {
      const schemaRef = content[mediaType]?.schema?.$ref;
      if (schemaRef) {
        return `${status}:${refName(schemaRef)}`;
      }
    }
  }

  return '-';
}

function refName(schemaRef: string): string {
  const parts = schemaRef.split('/');
  return parts[parts.length - 1] || schemaRef;
}

function isSuccessStatus(status: string): boolean {
  return /^2\d\d$/.test(status) || status === 'default';
}

function extractBodyDtoFromMethodSignature(
  source: string,
  subscribeDecoratorStartIdx: number,
  methodName: string,
): string {
  const methodPattern = new RegExp(`(?:async\\s+)?${methodName}\\s*\\(`);
  const methodMatch = methodPattern.exec(source.slice(subscribeDecoratorStartIdx));
  if (!methodMatch) {
    return '-';
  }

  const methodStart = subscribeDecoratorStartIdx + methodMatch.index;
  const signatureStart = source.indexOf('(', methodStart);
  if (signatureStart < 0) {
    return '-';
  }

  const signatureEnd = findMatchingParen(source, signatureStart);
  if (signatureEnd < 0) {
    return '-';
  }

  const params = source.slice(signatureStart + 1, signatureEnd);
  const match = params.match(/@MessageBody\(\)\s*\w+\s*:\s*([\w.]+)/);
  return match?.[1] ?? '-';
}

function extractEmitEventFromMethodBody(source: string, methodName: string): string | null {
  const startPattern = new RegExp(`(?:async\\s+)?${methodName}\\s*\\(`);
  const startMatch = startPattern.exec(source);
  if (!startMatch) {
    return null;
  }

  const startIdx = startMatch.index;
  const signatureStart = source.indexOf('(', startIdx);
  if (signatureStart < 0) {
    return null;
  }
  const signatureEnd = findMatchingParen(source, signatureStart);
  if (signatureEnd < 0) {
    return null;
  }

  const braceStart = findMethodBodyBrace(source, signatureEnd + 1);
  if (braceStart < 0) {
    return null;
  }

  const endIdx = findMatchingBrace(source, braceStart);

  if (endIdx < 0) {
    return null;
  }

  const methodBody = source.slice(braceStart, endIdx + 1);
  const emitMatches = [...methodBody.matchAll(/\.emit\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  if (emitMatches.length === 0) {
    return 'ack payload';
  }

  const unique = [...new Set(emitMatches)];
  return unique.join(', ');
}

function findMatchingParen(source: string, openParenIndex: number): number {
  let depth = 0;
  for (let i = openParenIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function findMethodBodyBrace(source: string, fromIndex: number): number {
  let angleDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let inString: '"' | "'" | '`' | null = null;

  for (let i = fromIndex; i < source.length; i += 1) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : '';

    if (inString) {
      if (ch === inString && prev !== '\\') {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '<') {
      angleDepth += 1;
      continue;
    }
    if (ch === '>') {
      angleDepth = Math.max(0, angleDepth - 1);
      continue;
    }
    if (ch === '(') {
      parenDepth += 1;
      continue;
    }
    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (ch === '[') {
      bracketDepth += 1;
      continue;
    }
    if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (ch === '{') {
      if (angleDepth === 0 && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
        return i;
      }
      braceDepth += 1;
      continue;
    }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
    }
  }

  return -1;
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }
  return grouped;
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, '\\|');
}
