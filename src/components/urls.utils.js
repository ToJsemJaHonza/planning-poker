// Shared URL normalizer for user-typed task links. Intentionally permissive:
// a user jotting "seznam.cz", "www.seznam.cz/foo", or "jira.acme.com/FOO-1"
// should get a clickable https:// anchor. The strict half — rejecting
// javascript: / data: / mailto: / ftp: etc — stays so rendered hrefs can't
// execute code or leak into unexpected protocols.
//
// Rules (in order):
//   - trim input; empty → null
//   - already starts with http:// or https:// → returned verbatim
//   - has a scheme (`letters[+-]*:` before a slash) → null
//     This catches javascript:, mailto:, data:, ftp:, etc. We match
//     [a-z0-9+-] so the scheme pattern cannot swallow a domain-with-dot
//     like "foo.com:8080" (which has `.` in the part before `:`).
//   - contains whitespace → null (not a URL)
//   - missing a `.` → null (needs at least domain.tld)
//   - otherwise → 'https://' + trimmed input
//
// This is NOT a full RFC 3986 validator — it's a pragmatic
// "does this look like a link to the user's eyes" gate.

const SCHEME_RE = /^[a-z][a-z0-9+-]*:/i;

export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (SCHEME_RE.test(s)) return null;
  if (/\s/.test(s)) return null;
  if (!s.includes('.')) return null;
  return 'https://' + s;
}
