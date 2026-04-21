import pg from 'pg';

const { Pool } = pg;

export const pool = createPool();

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required (Aiven postgres URI)');
  }
  const cleanUrl = stripQuery(url);
  return new Pool({
    connectionString: cleanUrl,
    ssl: buildSsl(url),
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

function stripQuery(url) {
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}

function buildSsl(url) {
  const ca = process.env.PG_CA_CERT;
  if (ca) {
    return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  }
  if (process.env.PG_SSL_INSECURE === '1') {
    return { rejectUnauthorized: false };
  }
  if (/sslmode=(require|verify-full|verify-ca)/.test(url)) {
    return { rejectUnauthorized: false };
  }
  return false;
}

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sc_users (
      handle      TEXT PRIMARY KEY,
      auth_hash   TEXT NOT NULL,
      enc_pub_key JSONB NOT NULL,
      sig_pub_key JSONB NOT NULL,
      created_at  BIGINT NOT NULL,
      seen_at     BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sc_mailbox (
      id          BIGSERIAL PRIMARY KEY,
      to_handle   TEXT NOT NULL,
      envelope    JSONB NOT NULL,
      created_at  BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sc_mailbox_to
    ON sc_mailbox (to_handle, id)
  `);
}

export async function shutdown() {
  try { await pool.end(); } catch {}
}
