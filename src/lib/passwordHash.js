// The local password hash. It is the same function the app has always used (existing accounts keep working);
// it lives in its own file so pure helpers and their unit tests can use it without loading the database.
export function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return 'h' + h.toString(36)
}

// Older versions shipped staff accounts with well-known passwords. Only their hashes are kept here (the passwords are
// deliberately not written in the source): the owner/admin default, the manager, pharmacist, cashier and receptionist
// defaults and the old "admin" fallback password.
export const KNOWN_DEFAULT_HASHES = Object.freeze(['hrcgzhv', 'h6quw9w', 'h1f2r9me', 'hh9zx5z', 'hl7s10a', 'h10c8izo'])
const DEFAULT_SET = new Set(KNOWN_DEFAULT_HASHES)

// True when this stored password hash belongs to one of the known defaults.
export function isDefaultHash(passHash) {
  return typeof passHash === 'string' && DEFAULT_SET.has(passHash)
}

// True when the text is one of the known default passwords (used to refuse choosing one again).
export function isKnownDefaultPassword(password) {
  return DEFAULT_SET.has(hash(String(password ?? '')))
}
