// Local-only integration fixture. It executes the application's real SQL against
// Node SQLite and exposes the same Hrana batch transport used by Turso.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

const encode = value => value === null ? { type: 'null' }
    : typeof value === 'number' || typeof value === 'bigint'
        ? { type: Number.isInteger(Number(value)) ? 'integer' : 'float', value: String(value) }
        : value instanceof Uint8Array ? { type: 'blob', base64: Buffer.from(value).toString('base64') }
            : { type: 'text', value: String(value) };

const decode = value => value.type === 'null' ? null
    : value.type === 'integer' || value.type === 'float' ? Number(value.value)
        : value.type === 'blob' ? Buffer.from(value.base64, 'base64') : value.value;

export async function createHranaFixture({ port = 8097, filename = ':memory:', token = 'qa-only' } = {}) {
    const sqlite = new DatabaseSync(filename);
    sqlite.exec('PRAGMA foreign_keys = ON');
    const server = createServer(async (request, response) => {
        const json = (status, body) => {
            response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
            response.end(JSON.stringify(body));
        };
        if (request.method === 'GET' && request.url === '/health') return json(200, { fixture: 'real-sqlite-hrana', ready: true });
        if (request.method !== 'POST' || request.url !== '/v2/pipeline') return json(404, { error: 'Fixture route not found' });
        if (request.headers.authorization !== `Bearer ${token}`) return json(401, { error: 'Fixture token mismatch' });
        try {
            const chunks = [];
            let size = 0;
            for await (const chunk of request) {
                size += chunk.length;
                if (size > 32 * 1024 * 1024) return json(413, { error: 'Fixture request too large' });
                chunks.push(chunk);
            }
            const pipeline = JSON.parse(Buffer.concat(chunks).toString());
            const results = [];
            // Every batch is executed synchronously: no other HTTP request can
            // enter the SQLite transaction between BEGIN and COMMIT/ROLLBACK.
            for (const pipelineRequest of pipeline.requests) {
                if (pipelineRequest.type === 'close') {
                    results.push({ type: 'ok', response: { type: 'close' } });
                    continue;
                }
                if (pipelineRequest.type !== 'batch') throw new Error('Unsupported Hrana operation');
                const stepResults = [], stepErrors = [];
                const condition = value => !value || (value.type === 'ok' ? Boolean(stepResults[value.step])
                    : value.type === 'error' ? Boolean(stepErrors[value.step])
                        : value.type === 'not' ? !condition(value.cond)
                            : value.type === 'and' ? value.conds.every(condition)
                                : value.type === 'or' ? value.conds.some(condition) : false);
                for (const step of pipelineRequest.batch.steps) {
                    if (!condition(step.condition)) { stepResults.push(null); stepErrors.push(null); continue; }
                    try {
                        const statement = sqlite.prepare(step.stmt.sql);
                        const columns = statement.columns();
                        const args = (step.stmt.args || []).map(decode);
                        const rows = columns.length ? statement.all(...args) : [];
                        const meta = columns.length ? { changes: 0, lastInsertRowid: 0 } : statement.run(...args);
                        stepResults.push({
                            cols: columns.map(column => ({ name: column.name })),
                            rows: rows.map(row => columns.map(column => encode(row[column.name]))),
                            affected_row_count: Number(meta.changes),
                            last_insert_rowid: String(meta.lastInsertRowid),
                        });
                        stepErrors.push(null);
                    } catch (error) {
                        stepResults.push(null);
                        stepErrors.push({ message: error.message, code: error.code || 'SQLITE_ERROR' });
                    }
                }
                results.push({ type: 'ok', response: { type: 'batch', result: { step_results: stepResults, step_errors: stepErrors } } });
            }
            json(200, { results });
        } catch (error) { json(400, { error: error.message }); }
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
    });
    return {
        url: `http://127.0.0.1:${server.address().port}`,
        sqlite,
        async close() {
            await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            sqlite.close();
        },
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const fixture = await createHranaFixture({ port: Number(process.env.MYOWNDEX_HRANA_PORT || 8097), filename: process.env.MYOWNDEX_HRANA_FILE || ':memory:' });
    console.log(`Real SQLite Hrana fixture ready at ${fixture.url}`);
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await fixture.close(); process.exit(0); });
}
