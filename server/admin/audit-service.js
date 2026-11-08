'use strict';
/**
 * Read-only audit stream with keyset pagination (`before` = last seen id), so
 * paging stays fast and stable while new events are appended.
 * `meta` is returned only when it parses as a JSON object; services already
 * avoid logging payloads (payload_logged:false), and we never echo raw strings.
 */
const { db } = require('../db');
const { fail, id } = require('./validate');

const PAGE_SIZE = 50;

function list(query = {}) {
  const where = [], params = [];
  if (query.action !== undefined && query.action !== '') {
    if (typeof query.action !== 'string' || !/^[a-z0-9_]{1,64}$/.test(query.action)) fail('Invalid action filter.');
    where.push('e.action = ?'); params.push(query.action);
  }
  if (query.actor !== undefined && query.actor !== '') { where.push('e.actor_id = ?'); params.push(id(query.actor, 'actor ID')); }
  if (query.before !== undefined && query.before !== '') { where.push('e.id < ?'); params.push(id(query.before, 'cursor')); }
  const rows = db.prepare(`SELECT e.id, e.action, e.target, e.meta, e.created_at, e.actor_id, u.full_name AS actor_name
    FROM audit_events e LEFT JOIN users u ON u.id = e.actor_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.id DESC LIMIT ?`).all(...params, PAGE_SIZE + 1);
  const page = rows.slice(0, PAGE_SIZE).map(row => {
    let meta = null;
    try { const parsed = JSON.parse(row.meta); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed; } catch { /* not JSON: omit */ }
    return { ...row, meta };
  });
  return {
    events: page,
    next_cursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    actions: db.prepare('SELECT DISTINCT action FROM audit_events ORDER BY action').all().map(r => r.action),
  };
}

module.exports = { list, PAGE_SIZE };
