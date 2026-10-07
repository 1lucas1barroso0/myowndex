import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type SqlValue = string | number | Uint8Array | null;
type SqlRow = Record<string, SqlValue>;
type HranaValue = { type: string; value?: string | number; base64?: string };
type HranaResult = {
  cols?: { name: string }[];
  rows?: HranaValue[][];
  affected_row_count?: number;
  last_insert_rowid?: string | null;
};
type QueryResult<T = SqlRow> = {
  success: true;
  results: T[];
  meta: { changes: number; last_row_id: number };
};

export class RuntimeConfigurationError extends Error {
  status = 503;
  code = "RUNTIME_NOT_CONFIGURED";
}

export class RuntimeServiceError extends Error {
  status = 503;
  code = "RUNTIME_UNAVAILABLE";
}

function databaseUrl(value: string) {
  const url = new URL(value.replace(/^libsql:\/\//, "https://"));
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) {
    throw new RuntimeConfigurationError("TURSO_DATABASE_URL deve conter a URL HTTPS ou libsql do seu banco persistente.");
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/v2/pipeline`;
  return url.toString();
}

function encodeValue(value: unknown): HranaValue {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "integer", value: value ? "1" : "0" };
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value)
      ? { type: "integer", value: String(value) }
      : { type: "float", value };
  }
  if (value instanceof Uint8Array) return { type: "blob", base64: Buffer.from(value).toString("base64") };
  if (typeof value === "string") return { type: "text", value };
  throw new TypeError("Parâmetro SQL inválido.");
}

function decodeValue(value: HranaValue): SqlValue {
  if (value.type === "null") return null;
  if (value.type === "integer") {
    const number = Number(value.value);
    return Number.isSafeInteger(number) ? number : String(value.value);
  }
  if (value.type === "float") return Number(value.value);
  if (value.type === "blob") return new Uint8Array(Buffer.from(value.base64 || "", "base64"));
  return String(value.value ?? "");
}

function queryResult<T>(result: HranaResult): QueryResult<T> {
  const columns = result.cols || [];
  return {
    success: true,
    results: (result.rows || []).map(row => Object.fromEntries(columns.map((column, i) => [column.name, decodeValue(row[i])])) as T),
    meta: {
      changes: Number(result.affected_row_count || 0),
      last_row_id: Number(result.last_insert_rowid || 0),
    },
  };
}

export class SqlStatement {
  database: TursoDatabase;
  sql: string;
  values: unknown[];

  constructor(database: TursoDatabase, sql: string, values: unknown[] = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values: unknown[]) {
    return new SqlStatement(this.database, this.sql, values);
  }

  async first<T = SqlRow>(): Promise<T | null> {
    return (await this.all<T>()).results[0] ?? null;
  }

  async all<T = SqlRow>(): Promise<QueryResult<T>> {
    return (await this.database.execute<T>([this], false))[0];
  }

  async run<T = SqlRow>(): Promise<QueryResult<T>> {
    return this.all<T>();
  }

  toStatement() {
    return { sql: this.sql, args: this.values.map(encodeValue), want_rows: true };
  }
}

/** The small SQLite interface used by rooms; no platform bindings or volatile store. */
export class TursoDatabase {
  endpoint: string;
  authToken: string;
  request: typeof fetch;

  constructor(url: string, authToken: string, request: typeof fetch = fetch) {
    try {
      this.endpoint = databaseUrl(url);
    } catch (error) {
      if (error instanceof RuntimeConfigurationError) throw error;
      throw new RuntimeConfigurationError("TURSO_DATABASE_URL está inválida. Confira a URL do seu banco persistente.");
    }
    this.authToken = authToken;
    this.request = request;
  }

  prepare(sql: string) {
    return new SqlStatement(this, sql);
  }

  async batch<T = SqlRow>(statements: SqlStatement[]) {
    return this.execute<T>(statements, true);
  }

  async execute<T>(statements: SqlStatement[], atomic: boolean): Promise<QueryResult<T>[]> {
    if (!statements.length) return [];
    if (statements.some(statement => statement.database !== this)) throw new TypeError("O lote SQL pertence a outro banco.");
    const steps: { stmt: ReturnType<SqlStatement["toStatement"]>; condition?: unknown }[] = [
      { stmt: { sql: "PRAGMA foreign_keys = ON", args: [], want_rows: false } },
    ];
    if (atomic) steps.push({ stmt: { sql: "BEGIN IMMEDIATE", args: [], want_rows: false }, condition: { type: "ok", step: 0 } });
    const offset = steps.length;
    for (const statement of statements) {
      steps.push({ stmt: statement.toStatement(), condition: { type: "ok", step: steps.length - 1 } });
    }
    if (atomic) {
      const commitIndex = steps.length;
      steps.push({ stmt: { sql: "COMMIT", args: [], want_rows: false }, condition: { type: "ok", step: commitIndex - 1 } });
      steps.push({ stmt: { sql: "ROLLBACK", args: [], want_rows: false }, condition: { type: "not", cond: { type: "ok", step: commitIndex } } });
    }
    let response: Response;
    try {
      response = await this.request(this.endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${this.authToken}`, "content-type": "application/json" },
        body: JSON.stringify({ requests: [{ type: "batch", batch: { steps } }, { type: "close" }] }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new RuntimeServiceError("O banco da aventura não respondeu. Confira a conexão e tente novamente.");
    }
    if (!response.ok) throw new RuntimeServiceError(`O banco da aventura recusou a conexão (HTTP ${response.status}). Confira as variáveis TURSO na Vercel.`);
    let payload: { results?: { type: string; response?: { type: string; result?: { step_results: (HranaResult | null)[]; step_errors: (unknown | null)[] } } }[] };
    try {
      payload = await response.json();
    } catch {
      throw new RuntimeServiceError("O banco enviou uma resposta inválida. Tente novamente.");
    }
    const batch = payload.results?.[0];
    const result = batch?.response?.result;
    if (batch?.type !== "ok" || batch.response?.type !== "batch" || !result || !Array.isArray(result.step_errors) || !Array.isArray(result.step_results) || result.step_errors.some(Boolean)) {
      throw new RuntimeServiceError("O banco não confirmou esta ação. Confira o esquema SQLite e tente novamente.");
    }
    return statements.map((_, i) => {
      const row = result.step_results[offset + i];
      if (!row) throw new RuntimeServiceError("O banco interrompeu esta ação antes de confirmá-la. Tente novamente.");
      return queryResult<T>(row);
    });
  }
}

export type S3Config = { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region?: string };
export type AudioUpload = { code: string; id: string; objectKey: string; title: string; mimeType: string; size: number; expires: number };
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const hmac = (key: string | Uint8Array, value: string) => createHmac("sha256", key).update(value).digest();
const uriEncode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

/** Private S3/R2 objects. All credentials stay in server code. */
export class S3Bucket {
  config: S3Config;
  request: typeof fetch;

  constructor(config: S3Config, request: typeof fetch = fetch) {
    let url: URL;
    try {
      url = new URL(config.endpoint);
    } catch {
      throw new RuntimeConfigurationError("MYOWNDEX_S3_ENDPOINT deve ser um endpoint S3 HTTPS válido.");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new RuntimeConfigurationError("MYOWNDEX_S3_ENDPOINT deve ser um endpoint S3 HTTPS válido.");
    }
    this.config = config;
    this.request = request;
  }

  objectUrl(key: string) {
    if (!key || key.split("/").some(part => part === "." || part === "..")) throw new TypeError("Chave de arquivo inválida.");
    return new URL(`${this.config.endpoint.replace(/\/$/, "")}/${uriEncode(this.config.bucket)}/${key.split("/").map(uriEncode).join("/")}`);
  }

  signingKey(day: string) {
    return hmac(hmac(hmac(hmac(`AWS4${this.config.secretAccessKey}`, day), this.config.region || "auto"), "s3"), "aws4_request");
  }

  prepareUpload(upload: AudioUpload) {
    const url = this.objectUrl(upload.objectKey);
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const day = date.slice(0, 8);
    const scope = `${day}/${this.config.region || "auto"}/s3/aws4_request`;
    const parameters: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.config.accessKeyId}/${scope}`,
      "X-Amz-Date": date,
      "X-Amz-Expires": "900",
      "X-Amz-SignedHeaders": "content-type;host",
    };
    const query = Object.keys(parameters).sort().map(key => `${uriEncode(key)}=${uriEncode(parameters[key])}`).join("&");
    const canonical = ["PUT", url.pathname, query, `content-type:${upload.mimeType.trim()}\nhost:${url.host}\n`, "content-type;host", "UNSIGNED-PAYLOAD"].join("\n");
    const signature = createHmac("sha256", this.signingKey(day)).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).digest("hex");
    url.search = `${query}&X-Amz-Signature=${signature}`;
    const payload = Buffer.from(JSON.stringify(upload)).toString("base64url");
    const proof = createHmac("sha256", this.config.secretAccessKey).update(`myowndex-audio:${payload}`).digest("base64url");
    return { uploadUrl: url.toString(), uploadToken: `${payload}.${proof}`, headers: { "content-type": upload.mimeType } };
  }

  verifyUpload(token: string, code: string): AudioUpload | null {
    if (token.length > 2400) return null;
    const [payload, proof, extra] = token.split(".");
    if (!payload || !proof || extra) return null;
    const expected = createHmac("sha256", this.config.secretAccessKey).update(`myowndex-audio:${payload}`).digest();
    const actual = Buffer.from(proof, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
      const upload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AudioUpload;
      if (upload.code !== code || upload.expires < Date.now() || upload.expires > Date.now() + 16 * 60_000 || upload.objectKey !== `rooms/${code}/audio/${upload.id}`) return null;
      return upload;
    } catch {
      return null;
    }
  }

  async signedRequest(method: string, key: string, body?: Uint8Array, extraHeaders: Record<string, string> = {}) {
    const url = this.objectUrl(key);
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const day = date.slice(0, 8);
    const scope = `${day}/${this.config.region || "auto"}/s3/aws4_request`;
    const payloadHash = hash(body || new Uint8Array());
    const signingHeaders = { ...extraHeaders, host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": date };
    const names = Object.keys(signingHeaders).sort() as (keyof typeof signingHeaders)[];
    const canonicalHeaders = names.map(name => `${name}:${signingHeaders[name].trim()}\n`).join("");
    const signedHeaders = names.join(";");
    const canonical = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const signature = createHmac("sha256", this.signingKey(day)).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).digest("hex");
    const headers = {
      ...extraHeaders,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": date,
      authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    let response: Response;
    try {
      response = await this.request(url, { method, headers, body: body ? new Uint8Array(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    } catch {
      throw new RuntimeServiceError("O armazenamento de trilhas não respondeu. Confira a conexão e tente novamente.");
    }
    if (!response.ok && !(["GET", "HEAD"].includes(method) && response.status === 404)) {
      throw new RuntimeServiceError(`O armazenamento recusou esta ação (HTTP ${response.status}). Confira a configuração S3/R2.`);
    }
    return response;
  }

  async put(key: string, stream: ReadableStream, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
    const body = new Uint8Array(await new Response(stream).arrayBuffer());
    await this.signedRequest("PUT", key, body, { "content-type": options?.httpMetadata?.contentType || "application/octet-stream" });
  }

  async get(key: string) {
    const response = await this.signedRequest("GET", key);
    return response.status === 404 ? null : { body: response.body };
  }

  async head(key: string) {
    const response = await this.signedRequest("HEAD", key);
    if (response.status === 404) return null;
    return { size: Number(response.headers.get("content-length") || 0), contentType: response.headers.get("content-type") || "" };
  }

  async delete(key: string) {
    await this.signedRequest("DELETE", key);
  }
}

let database: TursoDatabase | undefined;
let databaseConfig = "";

export function getRuntimeBindings(environment: Record<string, string | undefined> = process.env) {
  const url = environment.TURSO_DATABASE_URL;
  const token = environment.TURSO_AUTH_TOKEN;
  if (!url || !token) throw new RuntimeConfigurationError("Para usar aventuras compartilhadas, configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN na Vercel. A Pokédex e o PC continuam disponíveis neste dispositivo.");
  const signature = `${url}\n${token}`;
  if (!database || databaseConfig !== signature) {
    database = new TursoDatabase(url, token);
    databaseConfig = signature;
  }
  const endpoint = environment.MYOWNDEX_S3_ENDPOINT;
  const bucket = environment.MYOWNDEX_S3_BUCKET;
  const accessKeyId = environment.MYOWNDEX_S3_ACCESS_KEY_ID;
  const secretAccessKey = environment.MYOWNDEX_S3_SECRET_ACCESS_KEY;
  return {
    db: database,
    get bucket() {
      return endpoint && bucket && accessKeyId && secretAccessKey
        ? new S3Bucket({ endpoint, bucket, accessKeyId, secretAccessKey, region: environment.MYOWNDEX_S3_REGION || "auto" })
        : undefined;
    },
  };
}
