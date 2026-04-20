import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './urls.utils';

describe('normalizeUrl', () => {
  it('returns null for non-strings, empty, or whitespace-only input', () => {
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
    expect(normalizeUrl(42)).toBeNull();
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
  });

  it('returns http(s) URLs verbatim (case-insensitive scheme)', () => {
    expect(normalizeUrl('https://foo.com')).toBe('https://foo.com');
    expect(normalizeUrl('http://foo.com/bar')).toBe('http://foo.com/bar');
    expect(normalizeUrl('HTTPS://FOO.COM')).toBe('HTTPS://FOO.COM');
  });

  it('prepends https:// for bare domains', () => {
    expect(normalizeUrl('seznam.cz')).toBe('https://seznam.cz');
    expect(normalizeUrl('www.seznam.cz')).toBe('https://www.seznam.cz');
    expect(normalizeUrl('jira.acme.com/FOO-123')).toBe('https://jira.acme.com/FOO-123');
  });

  it('trims leading/trailing whitespace before normalizing', () => {
    expect(normalizeUrl('  seznam.cz  ')).toBe('https://seznam.cz');
    expect(normalizeUrl('  https://foo.com  ')).toBe('https://foo.com');
  });

  it('preserves a port in a bare domain (does not treat `:` as scheme)', () => {
    expect(normalizeUrl('localhost:5173')).toBeNull(); // no dot → still rejected
    expect(normalizeUrl('foo.com:8080/path')).toBe('https://foo.com:8080/path');
  });

  it('rejects dangerous or unsupported schemes', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('JavaScript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,<script>x()</script>')).toBeNull();
    expect(normalizeUrl('mailto:a@b.com')).toBeNull();
    expect(normalizeUrl('ftp://foo.com')).toBeNull();
    expect(normalizeUrl('vbscript:msgbox')).toBeNull();
    expect(normalizeUrl('file:///etc/passwd')).toBeNull();
  });

  it('rejects input without a dot or with embedded whitespace', () => {
    expect(normalizeUrl('localhost')).toBeNull();
    expect(normalizeUrl('just words')).toBeNull();
    expect(normalizeUrl('foo bar.com')).toBeNull();
    expect(normalizeUrl('foo.com\twithtab')).toBeNull();
  });
});
