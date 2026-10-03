import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { getRuntimeBindings, RuntimeConfigurationError, RuntimeServiceError, TursoDatabase } from "./runtime";
import { normalizeAccountXpDocument } from "../src/core/accountXp.js";

export const ACCOUNT_DOCUMENT_LIMIT = 4 * 1024 * 1024;
export const ACCOUNT_DATABASE_BUDGET = 256 * 1024 * 1024;
const DATABASE_RESERVE = 8 * 1024 * 1024;
export const ACCOUNT_COOKIE_NAME = "myowndex_account";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const PASSWORD_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const RECOVERY_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const encoder = new TextEncoder();
type JsonObject = Record<string, unknown>;
type AccountRow = { id: string; username: string; display_name: string; password_hash: string; created_at: string };
type SessionRow = AccountRow & { session_hash: string; expires_at: number };
type DocumentRow = { document_json: string | null; revision: number; updated_at: string | null; previous_json: string | null; previous_revision: number | null };
export type AccountIdentity = { id: string; username: string; displayName: string };

export class AccountError extends Error {
  status: number;
  code: string;
  retryAfter?: number;
  constructor(message: string, status = 400, code = "ACCOUNT_INVALID", retryAfter?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const nowSeconds = () => Math.floor(Date.now() / 1000);
const isObject = (value: unknown): value is JsonObject => !!value && typeof value === "object" && !Array.isArray(value);
const identity = (row: AccountRow): AccountIdentity => ({ id: row.id, username: row.username, displayName: row.display_name });
let schemaDatabase: TursoDatabase | null = null;
let schemaPromise: Promise<void> | null = null;

export function accountDatabase() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new AccountError("A conexão das contas está indisponível. Seus dados neste dispositivo continuam preservados.", 503, "ACCOUNT_NOT_CONFIGURED");
  }
  return getRuntimeBindings().db;
}

/** Additive migration: no room, Box or existing collection is rewritten. */
export async function ensureAccountSchema() {
  const db = accountDatabase();
  if (schemaDatabase === db && schemaPromise) return schemaPromise;
  schemaDatabase = db;
  schemaPromise = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS myowndex_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT UNIQUE COLLATE NOCASE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS myowndex_account_sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL REFERENCES myowndex_accounts(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS myowndex_account_sessions_account_idx ON myowndex_account_sessions(account_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS myowndex_account_sessions_expiry_idx ON myowndex_account_sessions(expires_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS myowndex_account_recovery (
      code_hash TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL REFERENCES myowndex_accounts(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS myowndex_account_recovery_account_idx ON myowndex_account_recovery(account_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS myowndex_account_documents (
      account_id TEXT PRIMARY KEY NOT NULL REFERENCES myowndex_accounts(id) ON DELETE CASCADE,
      document_json TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT,
      previous_json TEXT,
      previous_revision INTEGER
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS myowndex_account_limits (
      bucket TEXT PRIMARY KEY NOT NULL,
      count INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS myowndex_account_limits_expiry_idx ON myowndex_account_limits(expires_at)"),
  ]).then(() => undefined).catch(error => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

export function accountJson(value: unknown, init: ResponseInit = {}) {
  const response = Response.json(value, init);
  response.headers.set("cache-control", "no-store, private");
  response.headers.set("pragma", "no-cache");
  response.headers.set("vary", "Cookie, Origin");
  response.headers.set("x-content-type-options", "nosniff");
  return response;
}

export function accountRouteError(error: unknown) {
  if (error instanceof AccountError) {
    return accountJson({ error: error.message, code: error.code }, {
      status: error.status,
      headers: error.retryAfter ? { "retry-after": String(error.retryAfter) } : undefined,
    });
  }
  if (error instanceof RuntimeConfigurationError || error instanceof RuntimeServiceError) {
    return accountJson({ error: "Não foi possível confirmar esta ação no banco. Seus dados continuam preservados; tente novamente.", code: "ACCOUNT_UNAVAILABLE" }, { status: 503 });
  }
  return accountJson({ error: "Não foi possível concluir esta ação. Tente novamente.", code: "ACCOUNT_UNAVAILABLE" }, { status: 503 });
}

/** Mutations require an explicit matching Origin; no missing-header exception. */
export function requireAccountOrigin(request: Request, requireJson = true) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const url = new URL(request.url);
  // Next's local listener can use 0.0.0.0 in request.url. Host is the browser's
  // actual destination and cannot be overridden by cross-origin JavaScript.
  const host = request.headers.get("host");
  let expectedOrigin = url.origin;
  if (host && !/[\s/\\?#@]/.test(host)) {
    try { expectedOrigin = new URL(`${url.protocol}//${host}`).origin; } catch { /* Keep the URL origin for malformed hosts. */ }
  }
  if (!origin || origin !== expectedOrigin || (site && site !== "same-origin" && site !== "none")) {
    throw new AccountError("Esta ação precisa ser feita pelo próprio MyOwnDex.", 403, "ACCOUNT_ORIGIN");
  }
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (requireJson && contentType !== "application/json") throw new AccountError("Envie esta ação em JSON.", 415, "ACCOUNT_CONTENT_TYPE");
}

export async function readAccountPayload(request: Request, limit = 4096): Promise<JsonObject> {
  const advertised = request.headers.get("content-length");
  if (advertised && (!/^\d+$/.test(advertised) || Number(advertised) > limit)) {
    throw new AccountError("Este envio excede o espaço disponível. Seus dados atuais não foram alterados.", 413, "ACCOUNT_TOO_LARGE");
  }
  if (!request.body) throw new AccountError("A ação está incompleta.");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AccountError("Este envio excede o espaço disponível. Seus dados atuais não foram alterados.", 413, "ACCOUNT_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new AccountError("Não foi possível ler esta ação. Confira os campos e tente novamente."); }
  if (!isObject(payload)) throw new AccountError("A ação está incompleta.");
  return payload;
}

export function normalizeAccountUsername(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{3,32}$/.test(value.trim())) {
    throw new AccountError("Use de 3 a 32 letras, números, _ ou - no nome de usuário.", 400, "ACCOUNT_USERNAME");
  }
  return value.trim().toLowerCase();
}

export function validateAccountPassword(value: unknown): string {
  if (typeof value !== "string" || [...value].length < 10 || [...value].length > 128 || encoder.encode(value).byteLength > 512) {
    throw new AccountError("A senha precisa ter de 10 a 128 caracteres.", 400, "ACCOUNT_PASSWORD");
  }
  return value;
}

function displayName(value: unknown, username: string) {
  if (value === undefined || value === "") return username;
  if (typeof value !== "string") throw new AccountError("Confira o nome do Treinador.");
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!clean || [...clean].length > 48) throw new AccountError("O nome do Treinador pode ter até 48 caracteres.");
  return clean;
}

// Bound KDF memory/concurrency even before Vercel's per-instance request limit.
let activeKdfs = 0;
const kdfWaiters: (() => void)[] = [];
async function passwordKey(password: string, salt: string) {
  if (activeKdfs >= 2) {
    if (kdfWaiters.length >= 8) throw new AccountError("Muitas tentativas ao mesmo tempo. Aguarde um instante.", 429, "ACCOUNT_RATE_LIMIT", 15);
    await new Promise<void>(resolve => kdfWaiters.push(resolve));
  } else { activeKdfs += 1; }
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, Buffer.from(salt, "hex"), 64, PASSWORD_OPTIONS, (error, key) => error ? reject(error) : resolve(key));
    });
  } finally {
    const next = kdfWaiters.shift();
    if (next) next(); else activeKdfs -= 1;
  }
}

export async function hashAccountPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await passwordKey(password, salt);
  return `scrypt$32768$8$3$${salt}$${key.toString("hex")}`;
}

export async function verifyAccountPassword(password: string, encoded: string | undefined) {
  const match = encoded?.match(/^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/);
  // Missing usernames still perform the same expensive comparison.
  const key = await passwordKey(password, match?.[1] || "00000000000000000000000000000000");
  const expected = Buffer.from(match?.[2] || "0".repeat(128), "hex");
  return !!match && timingSafeEqual(key, expected);
}

function recoveryCodes(accountId: string) {
  const codes = Array.from({ length: 8 }, () => {
    const code = Array.from(randomBytes(16), byte => RECOVERY_ALPHABET[byte & 31]).join("");
    return code.match(/.{4}/g)!.join("-");
  });
  return { codes, hashes: codes.map(code => recoveryHash(accountId, code)) };
}

function recoveryHash(accountId: string, code: string) {
  return digest(`myowndex-recovery:${accountId}:${code.replace(/[\s-]/g, "").toUpperCase()}`);
}

function validRecoveryCode(value: unknown): value is string {
  return typeof value === "string" && value.length <= 32 && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$/.test(value.replace(/[\s-]/g, "").toUpperCase());
}

function readSessionToken(request: Request) {
  const entries = request.headers.get("cookie")?.split(";") || [];
  const tokens = entries.map(part => part.trim().split("=")).filter(([name]) => name === ACCOUNT_COOKIE_NAME);
  if (tokens.length !== 1) return "";
  const value = tokens[0][1] || "";
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
}

function cookie(request: Request, token = "") {
  const secure = new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production";
  return `${ACCOUNT_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? "; Secure" : ""}`;
}

export function withAccountSession(response: Response, request: Request, token = "") {
  response.headers.set("set-cookie", cookie(request, token));
  return response;
}

async function cleanupAccountRows(db: TursoDatabase, now: number) {
  await db.batch([
    db.prepare("DELETE FROM myowndex_account_sessions WHERE token_hash IN (SELECT token_hash FROM myowndex_account_sessions WHERE expires_at <= ? LIMIT 200)").bind(now),
    db.prepare("DELETE FROM myowndex_account_limits WHERE bucket IN (SELECT bucket FROM myowndex_account_limits WHERE expires_at <= ? LIMIT 200)").bind(now),
  ]);
}

function requestIp(request: Request) {
  // Vercel overwrites this header at its edge; never use a client-chosen XFF chain.
  const platformIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return platformIp && /^[a-fA-F0-9:.]{3,64}$/.test(platformIp) ? platformIp : "unknown";
}

/** Persisted atomic counters cannot be bypassed by another serverless instance. */
export async function consumeAccountRate(request: Request, action: string, accountKey = "") {
  const db = accountDatabase();
  const now = nowSeconds();
  const config = action === "signup" ? { span: 3600, ip: 5, account: 5 }
    : action === "login" ? { span: 900, ip: 40, account: 12 }
    : action === "recover" ? { span: 3600, ip: 15, account: 6 }
    : action === "password" ? { span: 3600, ip: 30, account: 12 }
    : action === "invite" ? { span: 60, ip: 30, account: 10 }
    : { span: 60, ip: 360, account: 180 };
  const slot = Math.floor(now / config.span);
  const expires = (slot + 1) * config.span;
  const keys = [
    { key: digest(`myowndex-rate:ip:${action}:${requestIp(request)}:${slot}`), maximum: config.ip },
    ...(accountKey ? [{ key: digest(`myowndex-rate:account:${action}:${accountKey}:${slot}`), maximum: config.account }] : []),
  ];
  const results = await db.batch(keys.map(({ key }) => db.prepare(`INSERT INTO myowndex_account_limits(bucket, count, expires_at)
    VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1`).bind(key, expires)));
  if (!results.length) return;
  const counts = await Promise.all(keys.map(({ key }) => db.prepare("SELECT count FROM myowndex_account_limits WHERE bucket = ?").bind(key).first<{ count: number }>()));
  if (counts.some((value, index) => !value || value.count > keys[index].maximum)) {
    throw new AccountError("Muitas tentativas. Aguarde antes de tentar novamente.", 429, "ACCOUNT_RATE_LIMIT", Math.max(1, expires - now));
  }
  await cleanupAccountRows(db, now);
}

export async function getAccountSession(request: Request): Promise<SessionRow | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const db = accountDatabase();
  const row = await db.prepare(`SELECT a.id, a.username, a.display_name, a.password_hash, a.created_at,
    s.token_hash AS session_hash, s.expires_at FROM myowndex_account_sessions s
    JOIN myowndex_accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(digest(token), nowSeconds()).first<SessionRow>();
  return row;
}

export async function requireAccountSession(request: Request) {
  const account = await getAccountSession(request);
  if (!account) throw new AccountError("Entre na sua conta para continuar.", 401, "ACCOUNT_AUTH_REQUIRED");
  if (request.headers.get("x-myowndex-account") !== account.id) {
    throw new AccountError("A conta mudou em outra aba. Atualize esta tela antes de continuar.", 409, "ACCOUNT_SCOPE_CHANGED");
  }
  return account;
}

export async function accountSessionResponse(request: Request) {
  await ensureAccountSchema();
  const row = await getAccountSession(request);
  const response = accountJson({ account: row ? identity(row) : null, limitBytes: ACCOUNT_DOCUMENT_LIMIT });
  return !row && request.headers.get("cookie")?.includes(`${ACCOUNT_COOKIE_NAME}=`) ? withAccountSession(response, request) : response;
}

function newSession() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: digest(token), now: nowSeconds(), createdAt: Date.now() };
}

function databaseBudget() {
  const configured = Number(process.env.MYOWNDEX_DATABASE_LIMIT_BYTES);
  return Number.isSafeInteger(configured) && configured >= 32 * 1024 * 1024 ? configured : ACCOUNT_DATABASE_BUDGET;
}

// SQLite's actual pages plus a conservative write allowance; no plan/usage guess.
const DATABASE_USED_SQL = "((SELECT page_count FROM pragma_page_count) - (SELECT freelist_count FROM pragma_freelist_count)) * (SELECT page_size FROM pragma_page_size)";
const databaseFull = () => new AccountError("O espaço reservado para o banco está próximo do limite. O backup anterior continua preservado; exporte suas Boxes enquanto a capacidade é ajustada.", 507, "ACCOUNT_STORAGE_FULL");

async function requireDatabaseSpace(db: TursoDatabase, allowance: number) {
  const row = await db.prepare(`SELECT ${DATABASE_USED_SQL} AS used_bytes`).first<{ used_bytes: number }>();
  if (!row || row.used_bytes + allowance > databaseBudget() - DATABASE_RESERVE) throw databaseFull();
}

export async function signupAccount(request: Request) {
  requireAccountOrigin(request);
  const payload = await readAccountPayload(request);
  const username = normalizeAccountUsername(payload.username);
  const password = validateAccountPassword(payload.password);
  const name = displayName(payload.displayName, username);
  await ensureAccountSchema();
  await consumeAccountRate(request, "signup", username);
  const db = accountDatabase();
  if (await db.prepare("SELECT id FROM myowndex_accounts WHERE username = ?").bind(username).first()) {
    throw new AccountError("Este nome de usuário já está em uso. Escolha outro.", 409, "ACCOUNT_USERNAME_TAKEN");
  }
  const id = randomUUID();
  await requireDatabaseSpace(db, 64 * 1024);
  const passwordHash = await hashAccountPassword(password);
  const recovery = recoveryCodes(id);
  const session = newSession();
  const results = await db.batch([
    db.prepare(`INSERT OR IGNORE INTO myowndex_accounts(id, username, display_name, password_hash)
      SELECT ?, ?, ?, ? WHERE ${DATABASE_USED_SQL} + ? <= ?`).bind(id, username, name, passwordHash, 64 * 1024, databaseBudget() - DATABASE_RESERVE),
    db.prepare("INSERT INTO myowndex_account_documents(account_id) SELECT id FROM myowndex_accounts WHERE id = ?").bind(id),
    db.prepare("INSERT INTO myowndex_account_sessions(token_hash, account_id, created_at, expires_at) SELECT ?, id, ?, ? FROM myowndex_accounts WHERE id = ?").bind(session.hash, session.createdAt, session.now + SESSION_SECONDS, id),
    ...recovery.hashes.map(hash => db.prepare("INSERT INTO myowndex_account_recovery(code_hash, account_id) SELECT ?, id FROM myowndex_accounts WHERE id = ?").bind(hash, id)),
  ]);
  if (!results[0].meta.changes) {
    if (await db.prepare("SELECT id FROM myowndex_accounts WHERE username = ?").bind(username).first()) throw new AccountError("Este nome de usuário já está em uso. Escolha outro.", 409, "ACCOUNT_USERNAME_TAKEN");
    throw databaseFull();
  }
  return withAccountSession(accountJson({ account: { id, username, displayName: name }, recoveryCodes: recovery.codes }, { status: 201 }), request, session.token);
}

export async function loginAccount(request: Request) {
  requireAccountOrigin(request);
  const payload = await readAccountPayload(request);
  const username = normalizeAccountUsername(payload.username);
  const password = validateAccountPassword(payload.password);
  await ensureAccountSchema();
  await consumeAccountRate(request, "login", username);
  const db = accountDatabase();
  const account = await db.prepare("SELECT * FROM myowndex_accounts WHERE username = ?").bind(username).first<AccountRow>();
  if (!await verifyAccountPassword(password, account?.password_hash) || !account) {
    throw new AccountError("Nome de usuário ou senha incorretos.", 401, "ACCOUNT_CREDENTIALS");
  }
  // Recheck the password hash after scrypt so a concurrent recovery cannot mint a stale session.
  const session = newSession();
  const inserted = await db.prepare(`INSERT INTO myowndex_account_sessions(token_hash, account_id, created_at, expires_at)
    SELECT ?, id, ?, ? FROM myowndex_accounts WHERE id = ? AND password_hash = ?`).bind(session.hash, session.createdAt, session.now + SESSION_SECONDS, account.id, account.password_hash).run();
  if (!inserted.meta.changes) throw new AccountError("Nome de usuário ou senha incorretos.", 401, "ACCOUNT_CREDENTIALS");
  await db.prepare("DELETE FROM myowndex_account_sessions WHERE account_id = ? AND token_hash <> ? AND token_hash NOT IN (SELECT token_hash FROM myowndex_account_sessions WHERE account_id = ? AND token_hash <> ? ORDER BY created_at DESC, token_hash DESC LIMIT 19)").bind(account.id, session.hash, account.id, session.hash).run();
  return withAccountSession(accountJson({ account: identity(account) }), request, session.token);
}

export async function logoutAccount(request: Request) {
  requireAccountOrigin(request);
  await readAccountPayload(request);
  await ensureAccountSchema();
  const account = await requireAccountSession(request);
  await accountDatabase().prepare("DELETE FROM myowndex_account_sessions WHERE token_hash = ?").bind(account.session_hash).run();
  return withAccountSession(accountJson({ account: null }), request);
}

async function rotatePassword(db: TursoDatabase, account: AccountRow, nextPassword: string, recoveryProof?: string) {
  const passwordHash = await hashAccountPassword(nextPassword);
  const recovery = recoveryCodes(account.id);
  const session = newSession();
  const proof = recoveryProof ? " AND EXISTS (SELECT 1 FROM myowndex_account_recovery WHERE account_id = ? AND code_hash = ?)" : "";
  const args = recoveryProof ? [passwordHash, account.id, account.password_hash, account.id, recoveryProof] : [passwordHash, account.id, account.password_hash];
  const matches = "EXISTS (SELECT 1 FROM myowndex_accounts WHERE id = ? AND password_hash = ?)";
  const results = await db.batch([
    db.prepare(`UPDATE myowndex_accounts SET password_hash = ? WHERE id = ? AND password_hash = ?${proof}`).bind(...args),
    db.prepare(`DELETE FROM myowndex_account_sessions WHERE account_id = ? AND ${matches}`).bind(account.id, account.id, passwordHash),
    db.prepare(`DELETE FROM myowndex_account_recovery WHERE account_id = ? AND ${matches}`).bind(account.id, account.id, passwordHash),
    ...recovery.hashes.map(hash => db.prepare(`INSERT INTO myowndex_account_recovery(code_hash, account_id)
      SELECT ?, id FROM myowndex_accounts WHERE id = ? AND password_hash = ?`).bind(hash, account.id, passwordHash)),
    db.prepare(`INSERT INTO myowndex_account_sessions(token_hash, account_id, created_at, expires_at)
      SELECT ?, id, ?, ? FROM myowndex_accounts WHERE id = ? AND password_hash = ?`).bind(session.hash, session.createdAt, session.now + SESSION_SECONDS, account.id, passwordHash),
  ]);
  if (!results[0].meta.changes) throw new AccountError("A credencial já mudou. Entre novamente ou use um código de recuperação válido.", 401, "ACCOUNT_CREDENTIALS");
  return { token: session.token, recoveryCodes: recovery.codes };
}

export async function changeAccountPassword(request: Request) {
  requireAccountOrigin(request);
  const payload = await readAccountPayload(request);
  const password = validateAccountPassword(payload.password);
  const nextPassword = validateAccountPassword(payload.newPassword);
  await ensureAccountSchema();
  const account = await requireAccountSession(request);
  await consumeAccountRate(request, "password", account.id);
  if (!await verifyAccountPassword(password, account.password_hash)) throw new AccountError("A senha atual está incorreta.", 401, "ACCOUNT_CREDENTIALS");
  const rotated = await rotatePassword(accountDatabase(), account, nextPassword);
  return withAccountSession(accountJson({ account: identity(account), recoveryCodes: rotated.recoveryCodes }), request, rotated.token);
}

export async function recoverAccount(request: Request) {
  requireAccountOrigin(request);
  const payload = await readAccountPayload(request);
  const username = normalizeAccountUsername(payload.username);
  const nextPassword = validateAccountPassword(payload.newPassword);
  await ensureAccountSchema();
  await consumeAccountRate(request, "recover", username);
  const db = accountDatabase();
  const account = await db.prepare("SELECT * FROM myowndex_accounts WHERE username = ?").bind(username).first<AccountRow>();
  const invalid = new AccountError("Nome de usuário ou código de recuperação incorretos.", 401, "ACCOUNT_CREDENTIALS");
  if (!account || !validRecoveryCode(payload.recoveryCode)) throw invalid;
  const proof = recoveryHash(account.id, payload.recoveryCode);
  if (!await db.prepare("SELECT code_hash FROM myowndex_account_recovery WHERE account_id = ? AND code_hash = ?").bind(account.id, proof).first()) throw invalid;
  const rotated = await rotatePassword(db, account, nextPassword, proof);
  return withAccountSession(accountJson({ account: identity(account), recoveryCodes: rotated.recoveryCodes }), request, rotated.token);
}

export async function deleteAccount(request: Request) {
  requireAccountOrigin(request);
  const payload = await readAccountPayload(request);
  const password = validateAccountPassword(payload.password);
  await ensureAccountSchema();
  const account = await requireAccountSession(request);
  await consumeAccountRate(request, "password", account.id);
  if (!await verifyAccountPassword(password, account.password_hash)) throw new AccountError("A senha atual está incorreta.", 401, "ACCOUNT_CREDENTIALS");
  const result = await accountDatabase().prepare("DELETE FROM myowndex_accounts WHERE id = ? AND password_hash = ?").bind(account.id, account.password_hash).run();
  if (!result.meta.changes) throw new AccountError("A conta mudou enquanto você confirmava. Entre novamente antes de tentar.", 409, "ACCOUNT_SCOPE_CHANGED");
  // All account-owned documents, sessions and recovery proofs cascade together.
  // Shared room ownership uses separate credentials and remains intact.
  return withAccountSession(accountJson({ account: null, deleted: true }), request);
}

/** Opaque application document, bounded and validated before touching the saved revision. */
export function validateAccountDocument(value: unknown): JsonObject {
  if (!isObject(value) || value.schema !== 1) throw new AccountError("Não foi possível reconhecer estes dados da conta.", 400, "ACCOUNT_DOCUMENT");
  const allowed = new Set(["schema", "boxes", "dex", "preferences", "localAdventure", "localTools", "roomSession", "clocks", "tombstones", "favoriteClocks", "rollClocks"]);
  if (Object.keys(value).some(key => !allowed.has(key))) throw new AccountError("Estes dados usam um formato não reconhecido.", 400, "ACCOUNT_DOCUMENT");
  if (!Array.isArray(value.boxes) || value.boxes.length > 5000 || !value.boxes.every(isObject) || !isObject(value.dex) || !isObject(value.preferences)) {
    throw new AccountError("Confira as Boxes e preferências antes de sincronizar.", 400, "ACCOUNT_DOCUMENT");
  }
  if (value.localAdventure !== null && value.localAdventure !== undefined && !isObject(value.localAdventure)) throw new AccountError("A aventura local está em um formato inválido.", 400, "ACCOUNT_DOCUMENT");
  if (value.localTools !== null && value.localTools !== undefined && !isObject(value.localTools)) throw new AccountError("As ferramentas locais estão em um formato inválido.", 400, "ACCOUNT_DOCUMENT");
  if (isObject(value.localTools)) {
    const tools = value.localTools;
    if (Object.keys(tools).some(key => !["dicePreferences", "diceRoom", "generatorDraft", "rollHistory"].includes(key))) {
      throw new AccountError("As ferramentas locais usam um formato não reconhecido.", 400, "ACCOUNT_DOCUMENT");
    }
    for (const key of ["dicePreferences", "diceRoom", "generatorDraft"]) {
      if (tools[key] !== null && tools[key] !== undefined && !isObject(tools[key])) {
        throw new AccountError("Confira as ferramentas locais antes de sincronizar.", 400, "ACCOUNT_DOCUMENT");
      }
    }
    if (isObject(tools.diceRoom)) {
      const field = tools.diceRoom;
      if (!Array.isArray(field.tokens) || !Array.isArray(field.benchTokens)
        || field.tokens.length + field.benchTokens.length > 24 || ![...field.tokens, ...field.benchTokens].every(isObject)) {
        throw new AccountError("O campo dos dados locais comporta até 24 Pokémon.", 400, "ACCOUNT_DOCUMENT");
      }
    }
    if (isObject(tools.generatorDraft) && (!Array.isArray(tools.generatorDraft.results)
      || tools.generatorDraft.results.length > 6 || !tools.generatorDraft.results.every(isObject))) {
      throw new AccountError("A prévia do gerador comporta até seis Pokémon.", 400, "ACCOUNT_DOCUMENT");
    }
    if (tools.rollHistory !== undefined && (!Array.isArray(tools.rollHistory) || tools.rollHistory.length > 100 || !tools.rollHistory.every(isObject))) {
      throw new AccountError("O histórico dos dados locais comporta até 100 resultados.", 400, "ACCOUNT_DOCUMENT");
    }
  }
  // Room bearer credentials stay on their originating device, never in account backups.
  if (value.roomSession !== null && value.roomSession !== undefined) throw new AccountError("Credenciais de salas não fazem parte do backup da conta.", 400, "ACCOUNT_DOCUMENT");
  for (const key of ["clocks", "tombstones", "favoriteClocks", "rollClocks"]) {
    if (value[key] !== undefined && !isObject(value[key])) throw new AccountError("Os dados de sincronização estão em um formato inválido.", 400, "ACCOUNT_DOCUMENT");
  }
  let nodes = 0;
  const walk = (item: unknown, depth: number) => {
    nodes += 1;
    if (nodes > 200_000 || depth > 40) throw new AccountError("Estes dados têm elementos demais para uma única sincronização.", 413, "ACCOUNT_TOO_LARGE");
    if (typeof item === "number" && !Number.isFinite(item)) throw new AccountError("Os dados contêm um valor inválido.", 400, "ACCOUNT_DOCUMENT");
    if (Array.isArray(item)) { for (const child of item) walk(child, depth + 1); }
    else if (isObject(item)) {
      for (const [key, child] of Object.entries(item)) {
        if (["__proto__", "prototype", "constructor"].includes(key) || key.length > 200) throw new AccountError("Os dados contêm um campo inválido.", 400, "ACCOUNT_DOCUMENT");
        walk(child, depth + 1);
      }
    } else if (item !== null && !["string", "number", "boolean"].includes(typeof item)) {
      throw new AccountError("Os dados contêm um valor inválido.", 400, "ACCOUNT_DOCUMENT");
    }
  };
  walk(value, 0);
  if (encoder.encode(JSON.stringify(value)).byteLength > ACCOUNT_DOCUMENT_LIMIT) {
    throw new AccountError("O backup ultrapassou 4 MiB. Exporte as Boxes que quiser arquivar; o backup anterior continua preservado.", 413, "ACCOUNT_TOO_LARGE");
  }
  return normalizeAccountXpDocument(value);
}

async function accountDocument(db: TursoDatabase, accountId: string, previous = false) {
  const row = await db.prepare("SELECT document_json, revision, updated_at, previous_json, previous_revision FROM myowndex_account_documents WHERE account_id = ?").bind(accountId).first<DocumentRow>();
  const raw = previous ? row?.previous_json : row?.document_json;
  let document: unknown = null;
  if (raw) {
    try { document = JSON.parse(raw); } catch { throw new AccountError("O backup precisa ser recuperado. Os dados deste dispositivo continuam preservados.", 503, "ACCOUNT_DOCUMENT_UNAVAILABLE"); }
  }
  const updatedAt = row?.updated_at || null;
  return {
    document,
    revision: previous ? row?.previous_revision ?? 0 : row?.revision ?? 0,
    // SQLite CURRENT_TIMESTAMP is UTC, even on devices in another time zone.
    updatedAt: updatedAt && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(updatedAt)
      ? `${updatedAt.replace(" ", "T")}Z` : updatedAt,
    previousRevision: row?.previous_revision ?? null,
    limitBytes: ACCOUNT_DOCUMENT_LIMIT,
  };
}

export async function getAccountDocument(request: Request) {
  await ensureAccountSchema();
  const account = await requireAccountSession(request);
  await consumeAccountRate(request, "read", account.id);
  return accountJson(await accountDocument(accountDatabase(), account.id, new URL(request.url).searchParams.get("previous") === "1"));
}

export async function putAccountDocument(request: Request) {
  requireAccountOrigin(request);
  await ensureAccountSchema();
  const account = await requireAccountSession(request);
  await consumeAccountRate(request, "write", account.id);
  const payload = await readAccountPayload(request, ACCOUNT_DOCUMENT_LIMIT + 8192);
  const document = validateAccountDocument(payload.document);
  const revision = payload.expectedRevision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 0) throw new AccountError("Atualize o backup antes de enviar estas mudanças.", 400, "ACCOUNT_REVISION");
  const db = accountDatabase();
  // One bounded previous document protects against a mistakenly cleared import;
  // the revision predicate makes the backup and replacement one atomic write.
  const json = JSON.stringify(document);
  const allowance = encoder.encode(json).byteLength + 64 * 1024;
  await requireDatabaseSpace(db, allowance);
  const updated = await db.prepare(`UPDATE myowndex_account_documents
    SET previous_json = document_json, previous_revision = revision,
      document_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ? AND revision = ? AND ${DATABASE_USED_SQL} + ? <= ?`).bind(json, account.id, revision, allowance, databaseBudget() - DATABASE_RESERVE).run();
  const current = await accountDocument(db, account.id);
  if (!updated.meta.changes && current.revision === revision) throw databaseFull();
  if (!updated.meta.changes) return accountJson({ ...current, conflict: true, code: "ACCOUNT_REVISION_CONFLICT", error: "Outra mudança chegou primeiro. Os dois conjuntos de dados continuam disponíveis para reunir com segurança." }, { status: 409 });
  return accountJson(current);
}

/** Clear the previous cloud copy without replacing the current document. */
export async function deletePreviousAccountDocument(request: Request) {
  requireAccountOrigin(request);
  await ensureAccountSchema();
  const account = await requireAccountSession(request);
  await consumeAccountRate(request, "write", account.id);
  const payload = await readAccountPayload(request);
  const revision = payload.expectedRevision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 0 || Object.keys(payload).some(key => key !== "expectedRevision")) {
    throw new AccountError("Atualize a conta antes de apagar a cópia anterior.", 400, "ACCOUNT_REVISION");
  }
  const db = accountDatabase();
  const updated = await db.prepare(`UPDATE myowndex_account_documents
    SET previous_json = NULL, previous_revision = NULL
    WHERE account_id = ? AND revision = ?`).bind(account.id, revision).run();
  const current = await accountDocument(db, account.id);
  if (!updated.meta.changes) return accountJson({
    ...current, conflict: true, code: "ACCOUNT_REVISION_CONFLICT",
    error: "Outra mudança chegou primeiro. Atualize a conta e confirme novamente.",
  }, { status: 409 });
  return accountJson({ ...current, previousDeleted: true });
}
