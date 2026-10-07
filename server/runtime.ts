type SqlValue = string | number | null;
type SqlRow = Record<string, SqlValue>;
type HranaValue = { type: string; value?: string | number };
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
  return { db: database };
}
