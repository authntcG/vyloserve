export type TimestampUnit = 'seconds' | 'milliseconds' | 'microseconds';

export interface TimestampConversionResult {
  isValid: boolean;
  error?: string;
  seconds?: number;
  milliseconds?: number;
  microseconds?: number;
  utc?: string;
  local?: string;
  iso?: string;
  relative?: string;
}

export interface DateToEpochResult {
  isValid: boolean;
  error?: string;
  seconds?: number;
  milliseconds?: number;
  iso?: string;
}

export interface RegexMatchItem {
  index: number;
  match: string;
  length: number;
  groups: string[];
  namedGroups: Record<string, string>;
}

export interface RegexTestResult {
  isValid: boolean;
  error?: string;
  matches: RegexMatchItem[];
  totalMatches: number;
}

/**
 * Formats a delta between timestamp ms and now into human readable relative time.
 */
export function formatRelativeTime(targetMs: number, nowMs: number = Date.now()): string {
  const diffSec = Math.round((targetMs - nowMs) / 1000);
  const absDiff = Math.abs(diffSec);
  const isFuture = diffSec > 0;

  if (absDiff < 5) return 'just now';

  let unit = '';
  let count = 0;

  if (absDiff < 60) {
    unit = 'second';
    count = absDiff;
  } else if (absDiff < 3600) {
    unit = 'minute';
    count = Math.floor(absDiff / 60);
  } else if (absDiff < 86400) {
    unit = 'hour';
    count = Math.floor(absDiff / 3600);
  } else if (absDiff < 2592000) {
    unit = 'day';
    count = Math.floor(absDiff / 86400);
  } else if (absDiff < 31536000) {
    unit = 'month';
    count = Math.floor(absDiff / 2592000);
  } else {
    unit = 'year';
    count = Math.floor(absDiff / 31536000);
  }

  const plural = count === 1 ? unit : `${unit}s`;
  return isFuture ? `in ${count} ${plural}` : `${count} ${plural} ago`;
}

/**
 * Converts a Unix epoch timestamp (seconds, ms, or µs) into formatted representations.
 */
export function convertTimestamp(
  rawInput: number | string,
  unit: TimestampUnit = 'seconds'
): TimestampConversionResult {
  if (rawInput === '' || rawInput === null || rawInput === undefined) {
    return { isValid: false, error: 'Empty timestamp input' };
  }

  const num = typeof rawInput === 'number' ? rawInput : Number(String(rawInput).trim());
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { isValid: false, error: 'Invalid numeric timestamp' };
  }

  let ms = 0;
  if (unit === 'seconds') {
    ms = Math.round(num * 1000);
  } else if (unit === 'microseconds') {
    ms = Math.round(num / 1000);
  } else {
    ms = Math.round(num);
  }

  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return { isValid: false, error: 'Timestamp out of range for Date' };
  }

  const seconds = Math.floor(ms / 1000);
  const microseconds = ms * 1000;

  return {
    isValid: true,
    seconds,
    milliseconds: ms,
    microseconds,
    utc: date.toUTCString(),
    local: date.toLocaleString(),
    iso: date.toISOString(),
    relative: formatRelativeTime(ms),
  };
}

/**
 * Converts a date string or local datetime value into Unix timestamps.
 */
export function dateToTimestamp(dateStr: string): DateToEpochResult {
  if (!dateStr?.trim()) {
    return { isValid: false, error: 'Empty date string' };
  }

  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) {
    return { isValid: false, error: 'Failed to parse date string' };
  }

  const date = new Date(parsed);
  return {
    isValid: true,
    milliseconds: parsed,
    seconds: Math.floor(parsed / 1000),
    iso: date.toISOString(),
  };
}

function buildMatchItem(match: RegExpExecArray): RegexMatchItem {
  return {
    index: match.index,
    match: match[0],
    length: match[0].length,
    groups: match.slice(1),
    namedGroups: match.groups ? { ...match.groups } : {},
  };
}

function collectGlobalMatches(
  regex: RegExp,
  safeText: string,
  maxMatches: number
): RegexMatchItem[] {
  const matches: RegexMatchItem[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(safeText)) !== null) {
    matches.push(buildMatchItem(match));
    if (matches.length >= maxMatches) break;

    // Prevent infinite loops on zero-length matches
    if (match[0].length === 0) {
      regex.lastIndex++;
    }
  }
  return matches;
}

/**
 * Tests a regular expression pattern against a test string with ReDoS limits.
 */
export function testRegexPattern(
  pattern: string,
  flags: string = 'g',
  testText: string = '',
  maxMatches: number = 200
): RegexTestResult {
  if (!pattern) {
    return { isValid: true, matches: [], totalMatches: 0 };
  }

  // Safety length limit: 100,000 characters
  const MAX_INPUT_LEN = 100000;
  const safeText = testText.length > MAX_INPUT_LEN ? testText.slice(0, MAX_INPUT_LEN) : testText;

  try {
    // Ensure flags are valid and sanitized
    const cleanFlags = Array.from(new Set(flags.split(''))).filter((f) => 'gimsuy'.includes(f)).join('');
    const hasGlobal = cleanFlags.includes('g');
    const regex = new RegExp(pattern, cleanFlags);

    const matches: RegexMatchItem[] = [];

    if (!hasGlobal) {
      const match = regex.exec(safeText);
      if (match) {
        matches.push(buildMatchItem(match));
      }
    } else {
      matches.push(...collectGlobalMatches(regex, safeText, maxMatches));
    }

    return {
      isValid: true,
      matches,
      totalMatches: matches.length,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err?.message || 'Invalid regular expression syntax',
      matches: [],
      totalMatches: 0,
    };
  }
}
