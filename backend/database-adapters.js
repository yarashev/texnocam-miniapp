import { AsyncLocalStorage } from 'node:async_hooks';

export function postgresSql(sql) {
  let index = 0;
  let result = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|\?/g, value => value === '?' ? '$' + (++index) : value);
  if (/^\s*INSERT OR IGNORE\b/i.test(result)) result = result.replace(/INSERT OR IGNORE/i, 'INSERT').replace(/;\s*$/, '') + ' ON CONFLICT DO NOTHING';
  return result;
}

export function createPostgresDatabase(pool) {
  const context = new AsyncLocalStorage();
  const query = (sql, params) => (context.getStore() || pool).query(postgresSql(sql), params.map(value => value === undefined ? null : value));
  return {
    kind: 'postgres',
    async get(sql, ...params) { return (await query(sql, params)).rows[0]; },
    async all(sql, ...params) { return (await query(sql, params)).rows; },
    async run(sql, ...params) {
      const result = await query(sql, params);
      return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
    },
    async exec(sql) { return (context.getStore() || pool).query(sql); },
    async transaction(callback) {
      if (context.getStore()) return callback();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await context.run(client, callback);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        throw error;
      } finally { client.release(); }
    },
    async close() { await pool.end(); }
  };
}

export function createSqliteDatabase(sqlite) {
  const context = new AsyncLocalStorage();
  let queue = Promise.resolve();
  const exclusive = callback => {
    if (context.getStore()) return Promise.resolve().then(callback);
    const result = queue.then(() => context.run(true, callback));
    queue = result.catch(() => {});
    return result;
  };
  return {
    kind: 'sqlite',
    get: (sql, ...params) => exclusive(() => sqlite.prepare(sql).get(...params)),
    all: (sql, ...params) => exclusive(() => sqlite.prepare(sql).all(...params)),
    run: (sql, ...params) => exclusive(() => /\bRETURNING\s+id\s*$/i.test(sql)
      ? { changes: 1, lastInsertRowid: sqlite.prepare(sql).get(...params)?.id }
      : sqlite.prepare(sql).run(...params)),
    exec: sql => exclusive(() => sqlite.exec(sql)),
    transaction: callback => exclusive(async () => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const result = await callback(); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }),
    close: () => exclusive(() => sqlite.close())
  };
}
