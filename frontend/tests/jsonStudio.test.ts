import { describe, it, expect } from 'vitest';
import {
  validateJson,
  sortObjectKeys,
  formatJson,
  computeJsonDiff,
  computeLineDiff,
  buildSideBySideDiff,
} from '../src/utils/jsonStudio';

describe('jsonStudio utility', () => {
  it('validates correct JSON and returns parsed object', () => {
    const raw = '{"name": "VyloServe", "version": 1}';
    const res = validateJson(raw);
    expect(res.isValid).toBe(true);
    expect(res.parsed).toEqual({ name: 'VyloServe', version: 1 });
    expect(res.error).toBeUndefined();
  });

  it('catches syntax error and extracts line/column if possible', () => {
    const raw = '{\n  "name": "VyloServe",\n  "invalid": ,\n}';
    const res = validateJson(raw);
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('handles empty input gracefully', () => {
    const res = validateJson('   ');
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Empty JSON input');
  });

  it('sorts object keys alphabetically including nested objects', () => {
    const input = {
      z: 1,
      a: {
        d: 4,
        b: 2,
      },
      m: [ { y: 2, x: 1 } ]
    };
    const sorted = sortObjectKeys(input);
    const keys = Object.keys(sorted);
    expect(keys).toEqual(['a', 'm', 'z']);
    expect(Object.keys(sorted.a)).toEqual(['b', 'd']);
    expect(Object.keys(sorted.m[0])).toEqual(['x', 'y']);
  });

  it('formats json with 2 spaces, 4 spaces, tab, and minify', () => {
    const raw = '{"b":2,"a":1}';
    const f2 = formatJson(raw, 2);
    expect(f2.success).toBe(true);
    expect(f2.result).toContain('  "b": 2');

    const f4 = formatJson(raw, 4);
    expect(f4.success).toBe(true);
    expect(f4.result).toContain('    "b": 2');

    const fTab = formatJson(raw, 'tab');
    expect(fTab.success).toBe(true);
    expect(fTab.result).toContain('\t"b": 2');

    const fMin = formatJson(raw, 'minify');
    expect(fMin.success).toBe(true);
    expect(fMin.result).toBe('{"b":2,"a":1}');

    const fSorted = formatJson(raw, 'minify', true);
    expect(fSorted.success).toBe(true);
    expect(fSorted.result).toBe('{"a":1,"b":2}');
  });

  it('computes diff between two JSON objects correctly', () => {
    const a = JSON.stringify({
      port: 8080,
      host: 'localhost',
      debug: true,
      features: ['auth', 'cache'],
    });

    const b = JSON.stringify({
      port: 8081,
      host: 'localhost',
      env: 'production',
      features: ['auth', 'cache', 'audit'],
    });

    const diff = computeJsonDiff(a, b);
    expect(diff.isValid).toBe(true);
    expect(diff.summary.changed).toBeGreaterThanOrEqual(1); // port changed
    expect(diff.summary.added).toBeGreaterThanOrEqual(2); // env added, features[2] added
    expect(diff.summary.removed).toBeGreaterThanOrEqual(1); // debug removed
  });

  it('returns invalid diff when input JSON is broken', () => {
    const diff = computeJsonDiff('{broken}', '{"valid": true}');
    expect(diff.isValid).toBe(false);
    expect(diff.error).toContain('JSON A is invalid');
  });

  it('computes line-by-line diff and builds side-by-side aligned rows', () => {
    const textA = 'line1\nline2_old\nline3';
    const textB = 'line1\nline2_new\nline3\nline4_added';

    const diffLines = computeLineDiff(textA, textB);
    expect(diffLines.length).toBeGreaterThanOrEqual(4);

    const sbs = buildSideBySideDiff(diffLines);
    expect(sbs.length).toBeGreaterThanOrEqual(4);

    // Row 0 should be equal ('line1')
    expect(sbs[0].typeA).toBe('equal');
    expect(sbs[0].typeB).toBe('equal');
    expect(sbs[0].textA).toBe('line1');

    // Row 1 should be modify ('line2_old' vs 'line2_new')
    expect(sbs[1].typeA).toBe('modify');
    expect(sbs[1].typeB).toBe('modify');
    expect(sbs[1].textA).toBe('line2_old');
    expect(sbs[1].textB).toBe('line2_new');

    // Row 2 should be equal ('line3')
    expect(sbs[2].typeA).toBe('equal');
    expect(sbs[2].textA).toBe('line3');

    // Row 3 should be insert ('line4_added')
    expect(sbs[3].typeA).toBe('empty');
    expect(sbs[3].typeB).toBe('insert');
    expect(sbs[3].textB).toBe('line4_added');
  });
});
