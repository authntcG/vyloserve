import { describe, it, expect } from 'vitest';
import {
  convertTimestamp,
  dateToTimestamp,
  formatRelativeTime,
  testRegexPattern,
} from '../src/utils/regexEpoch';

describe('regexEpoch utilities', () => {
  describe('convertTimestamp', () => {
    it('converts valid seconds timestamp correctly', () => {
      const res = convertTimestamp(1700000000, 'seconds');
      expect(res.isValid).toBe(true);
      expect(res.seconds).toBe(1700000000);
      expect(res.milliseconds).toBe(1700000000000);
      expect(res.iso).toBe('2023-11-14T22:13:20.000Z');
      expect(res.utc).toContain('2023');
      expect(res.relative).toBeDefined();
    });

    it('converts valid milliseconds timestamp', () => {
      const res = convertTimestamp(1700000000000, 'milliseconds');
      expect(res.isValid).toBe(true);
      expect(res.seconds).toBe(1700000000);
      expect(res.milliseconds).toBe(1700000000000);
    });

    it('handles invalid numeric input gracefully', () => {
      const res = convertTimestamp('not-a-number');
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('handles empty input', () => {
      const res = convertTimestamp('');
      expect(res.isValid).toBe(false);
    });
  });

  describe('dateToTimestamp', () => {
    it('converts ISO date string to seconds and ms', () => {
      const res = dateToTimestamp('2023-11-14T22:13:20.000Z');
      expect(res.isValid).toBe(true);
      expect(res.seconds).toBe(1700000000);
      expect(res.milliseconds).toBe(1700000000000);
    });

    it('returns error on invalid date', () => {
      const res = dateToTimestamp('invalid-date-string');
      expect(res.isValid).toBe(false);
    });
  });

  describe('formatRelativeTime', () => {
    it('formats past and future deltas', () => {
      const now = 1700000000000;
      expect(formatRelativeTime(now - 1000, now)).toBe('just now');
      expect(formatRelativeTime(now - 120000, now)).toBe('2 minutes ago');
      expect(formatRelativeTime(now - 7200000, now)).toBe('2 hours ago');
      expect(formatRelativeTime(now + 180000, now)).toBe('in 3 minutes');
    });
  });

  describe('testRegexPattern', () => {
    it('matches pattern and extracts capture groups', () => {
      const text = 'User: John (id: 42), User: Alice (id: 99)';
      const pattern = 'User:\\s+([A-Za-z]+)\\s+\\(id:\\s+(\\d+)\\)';
      const res = testRegexPattern(pattern, 'g', text);

      expect(res.isValid).toBe(true);
      expect(res.totalMatches).toBe(2);
      expect(res.matches[0].match).toBe('User: John (id: 42)');
      expect(res.matches[0].groups).toEqual(['John', '42']);
      expect(res.matches[1].groups).toEqual(['Alice', '99']);
    });

    it('handles named capture groups', () => {
      const text = 'vyloserve@localhost:8080';
      const pattern = '(?<user>[a-z]+)@(?<host>[a-z]+):(?<port>\\d+)';
      const res = testRegexPattern(pattern, '', text);

      expect(res.isValid).toBe(true);
      expect(res.matches).toHaveLength(1);
      expect(res.matches[0].namedGroups.user).toBe('vyloserve');
      expect(res.matches[0].namedGroups.host).toBe('localhost');
      expect(res.matches[0].namedGroups.port).toBe('8080');
    });

    it('returns error on invalid regex syntax', () => {
      const res = testRegexPattern('([a-z', 'g', 'test');
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('handles zero-length match safely without infinite loops', () => {
      const res = testRegexPattern('\\b', 'g', 'hello world', 20);
      expect(res.isValid).toBe(true);
      expect(res.matches.length).toBeGreaterThan(0);
    });
  });
});
