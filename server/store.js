import crypto from 'crypto';
import { pool } from './db.js';

const MAX_MAILBOX = 500;

function hashAuth(authHash) {
  return crypto.createHash('sha256').update(String(authHash)).digest('hex');
}

export async function registerOrLogin(handle, authHash, encPubKey, sigPubKey) {
  if (!handle || !authHash || !encPubKey || !sigPubKey) return false;
  const stored = hashAuth(authHash);
  const now = Date.now();
  const res = await pool.query(
    `INSERT INTO sc_users (handle, auth_hash, enc_pub_key, sig_pub_key, created_at, seen_at)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (handle) DO UPDATE SET
       enc_pub_key = EXCLUDED.enc_pub_key,
       sig_pub_key = EXCLUDED.sig_pub_key,
       seen_at     = EXCLUDED.seen_at
     WHERE sc_users.auth_hash = EXCLUDED.auth_hash
     RETURNING handle`,
    [handle, stored, encPubKey, sigPubKey, now]
  );
  return res.rowCount === 1;
}

export async function verifyAuth(handle, authHash) {
  if (!handle || !authHash) return false;
  const stored = hashAuth(authHash);
  const res = await pool.query(
    'SELECT 1 FROM sc_users WHERE handle = $1 AND auth_hash = $2 LIMIT 1',
    [handle, stored]
  );
  return res.rowCount === 1;
}

export async function lookupUser(handle) {
  if (!handle) return null;
  const res = await pool.query(
    'SELECT handle, enc_pub_key, sig_pub_key FROM sc_users WHERE handle = $1',
    [handle]
  );
  if (res.rowCount === 0) return null;
  const r = res.rows[0];
  return { handle: r.handle, encPubKey: r.enc_pub_key, sigPubKey: r.sig_pub_key };
}

export async function enqueue(toHandle, envelope) {
  const now = Date.now();
  await pool.query(
    'INSERT INTO sc_mailbox (to_handle, envelope, created_at) VALUES ($1, $2, $3)',
    [toHandle, envelope, now]
  );
  await pool.query(
    `DELETE FROM sc_mailbox
     WHERE id IN (
       SELECT id FROM sc_mailbox
       WHERE to_handle = $1
       ORDER BY id DESC
       OFFSET $2
     )`,
    [toHandle, MAX_MAILBOX]
  );
}

export async function drain(handle) {
  const res = await pool.query(
    `DELETE FROM sc_mailbox
     WHERE to_handle = $1
     RETURNING envelope, created_at`,
    [handle]
  );
  return res.rows
    .sort((a, b) => Number(a.created_at) - Number(b.created_at))
    .map((r) => r.envelope);
}
