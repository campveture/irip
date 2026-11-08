'use strict';
/**
 * Small, dependency-free input guards shared by operations-panel services.
 * Services throw `HttpError`; routes translate it with `handle()`. Anything
 * that is not an HttpError becomes a generic 500 so internals never leak.
 */

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (message, status = 400) => { throw new HttpError(status, message); };

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/** Reject non-objects and any field not explicitly allowed (mass-assignment guard). */
function body(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Provide a JSON object.');
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) fail(`Unsupported field(s): ${unknown.join(', ')}.`);
  return value;
}

/**
 * Trimmed text of min–max characters. `{ plain: true }` is for titles and names shown
 * as plain text (page/program/course titles, people's names): it also refuses < and >,
 * so markup like <img onerror=…> is never stored there. Body text is not restricted.
 */
function text(value, name, min, max, { plain = false } = {}) {
  if (typeof value !== 'string' || CONTROL_CHARS.test(value)) fail(`${name} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) fail(`${name} must contain ${min}–${max} characters.`);
  if (plain && /[<>]/.test(trimmed)) fail(`${name} cannot contain the characters < or >.`);
  return trimmed;
}

/** `%term%` for a LIKE … ESCAPE '\' clause, with %, _ and \ in the term matched literally. */
const likeContains = term => `%${String(term).replace(/[\\%_]/g, ch => `\\${ch}`)}%`;

/** Every operational decision needs a human-readable reason for the audit trail. */
const reason = value => text(value, 'Reason', 10, 1000);

function id(value, name = 'ID') {
  if (!/^[1-9]\d{0,15}$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail(`Invalid ${name}.`);
  return Number(value);
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) fail(`${name} must be one of: ${allowed.join(', ')}.`);
  return value;
}

/** Route adapter: runs a synchronous service call and maps errors safely. */
const handle = (fn, successStatus = 200) => (req, res) => {
  try {
    res.status(successStatus).json(fn(req));
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.status === 403 ? 'forbidden' : error.status === 404 ? 'not_found' : error.status === 409 ? 'conflict' : 'validation', message: error.message });
    console.error('[admin] unexpected error', error);
    res.status(500).json({ error: 'server', message: 'The request could not be completed.' });
  }
};

module.exports = { HttpError, fail, body, text, reason, id, oneOf, handle, likeContains };
