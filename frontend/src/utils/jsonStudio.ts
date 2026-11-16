export interface JsonValidationResult {
  isValid: boolean;
  error?: string;
  line?: number;
  column?: number;
  parsed?: any;
}

export type IndentOption = 2 | 4 | 'tab' | 'minify';

export interface JsonFormatResult {
  success: boolean;
  result?: string;
  error?: string;
}

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

export interface JsonDiffEntry {
  path: string;
  type: DiffType;
  valA?: any;
  valB?: any;
}

export interface JsonDiffResult {
  isValid: boolean;
  error?: string;
  diffs: JsonDiffEntry[];
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
}

/**
 * Validates a JSON string and extracts error line and column if invalid.
 */
export function validateJson(raw: string): JsonValidationResult {
  if (!raw?.trim()) {
    return { isValid: false, error: 'Empty JSON input' };
  }

  try {
    const parsed = JSON.parse(raw);
    return { isValid: true, parsed };
  } catch (err: any) {
    const msg: string = err?.message || 'Invalid JSON syntax';
    let line: number | undefined;
    let column: number | undefined;

    // Pattern 1: "... at line 2 column 5"
    const lineColMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(msg);
    if (lineColMatch) {
      line = Number.parseInt(lineColMatch[1], 10);
      column = Number.parseInt(lineColMatch[2], 10);
    } else {
      // Pattern 2: "... at position 42"
      const posMatch = /position\s+(\d+)/i.exec(msg);
      if (posMatch) {
        const pos = Number.parseInt(posMatch[1], 10);
        const prefix = raw.slice(0, pos);
        const lines = prefix.split('\n');
        line = lines.length;
        column = (lines.at(-1)?.length ?? 0) + 1;
      }
    }

    return {
      isValid: false,
      error: msg,
      line,
      column,
    };
  }
}

/**
 * Recursively sort keys of an object alphabetically.
 */
export function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc: Record<string, any>, key: string) => {
        acc[key] = sortObjectKeys(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

/**
 * Formats a JSON string with indentation and optional key sorting.
 */
export function formatJson(
  raw: string,
  indent: IndentOption = 2,
  sortKeys: boolean = false
): JsonFormatResult {
  const validation = validateJson(raw);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error || 'Failed to parse JSON',
    };
  }

  let data = validation.parsed;
  if (sortKeys) {
    data = sortObjectKeys(data);
  }

  try {
    let result: string;
    if (indent === 'minify') {
      result = JSON.stringify(data);
    } else if (indent === 'tab') {
      result = JSON.stringify(data, null, '\t');
    } else {
      result = JSON.stringify(data, null, indent);
    }
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Stringify failed' };
  }
}

interface DiffCollector {
  diffs: JsonDiffEntry[];
  summary: { added: number; removed: number; changed: number; unchanged: number };
}

function diffObjects(
  a: Record<string, any>,
  b: Record<string, any>,
  path: string,
  collector: DiffCollector,
  traverseFn: (a: any, b: any, path: string) => void
) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  const allKeys = Array.from(new Set([...keysA, ...keysB])).sort((keyA, keyB) => keyA.localeCompare(keyB));

  for (const key of allKeys) {
    const subPath = path ? `${path}.${key}` : key;
    const hasA = key in a;
    const hasB = key in b;

    if (hasA && !hasB) {
      collector.diffs.push({ path: subPath, type: 'removed', valA: a[key] });
      collector.summary.removed++;
    } else if (!hasA && hasB) {
      collector.diffs.push({ path: subPath, type: 'added', valB: b[key] });
      collector.summary.added++;
    } else {
      traverseFn(a[key], b[key], subPath);
    }
  }
}

function diffArrays(
  a: any[],
  b: any[],
  path: string,
  collector: DiffCollector,
  traverseFn: (a: any, b: any, path: string) => void
) {
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const subPath = `${path}[${i}]`;
    if (i >= a.length) {
      collector.diffs.push({ path: subPath, type: 'added', valB: b[i] });
      collector.summary.added++;
    } else if (i >= b.length) {
      collector.diffs.push({ path: subPath, type: 'removed', valA: a[i] });
      collector.summary.removed++;
    } else {
      traverseFn(a[i], b[i], subPath);
    }
  }
}

/**
 * Compares two JSON values recursively and returns differences.
 */
export function computeJsonDiff(rawA: string, rawB: string): JsonDiffResult {
  const valA = validateJson(rawA);
  if (!valA.isValid) {
    return {
      isValid: false,
      error: `JSON A is invalid: ${valA.error}`,
      diffs: [],
      summary: { added: 0, removed: 0, changed: 0, unchanged: 0 },
    };
  }

  const valB = validateJson(rawB);
  if (!valB.isValid) {
    return {
      isValid: false,
      error: `JSON B is invalid: ${valB.error}`,
      diffs: [],
      summary: { added: 0, removed: 0, changed: 0, unchanged: 0 },
    };
  }

  const collector: DiffCollector = {
    diffs: [],
    summary: { added: 0, removed: 0, changed: 0, unchanged: 0 },
  };

  function traverse(a: any, b: any, path: string) {
    const isObjectA = a !== null && typeof a === 'object' && !Array.isArray(a);
    const isObjectB = b !== null && typeof b === 'object' && !Array.isArray(b);

    if (isObjectA && isObjectB) {
      diffObjects(a, b, path, collector, traverse);
      return;
    }

    const isArrayA = Array.isArray(a);
    const isArrayB = Array.isArray(b);

    if (isArrayA && isArrayB) {
      diffArrays(a, b, path, collector, traverse);
      return;
    }

    // Primitive comparison
    if (a === b) {
      collector.diffs.push({ path: path || '$', type: 'unchanged', valA: a, valB: b });
      collector.summary.unchanged++;
    } else {
      collector.diffs.push({ path: path || '$', type: 'changed', valA: a, valB: b });
      collector.summary.changed++;
    }
  }

  traverse(valA.parsed, valB.parsed, '');

  return {
    isValid: true,
    diffs: collector.diffs,
    summary: collector.summary,
  };
}

export type LineDiffType = 'equal' | 'delete' | 'insert' | 'modify';

export interface DiffLine {
  type: LineDiffType;
  lineA?: number;
  lineB?: number;
  content: string;
}

export interface SideBySideRow {
  lineA?: number;
  textA?: string;
  typeA: 'equal' | 'delete' | 'empty' | 'modify';
  lineB?: number;
  textB?: string;
  typeB: 'equal' | 'insert' | 'empty' | 'modify';
}

function buildLcsMatrix(linesA: string[], linesB: string[]): number[][] {
  const m = linesA.length;
  const n = linesB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (linesA[i] === linesB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  return dp;
}

function backtrackLcs(linesA: string[], linesB: string[], dp: number[][]): DiffLine[] {
  let i = linesA.length;
  let j = linesB.length;
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      stack.push({
        type: 'equal',
        lineA: i,
        lineB: j,
        content: linesA[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({
        type: 'insert',
        lineB: j,
        content: linesB[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      stack.push({
        type: 'delete',
        lineA: i,
        content: linesA[i - 1],
      });
      i--;
    }
  }

  const result: DiffLine[] = [];
  while (stack.length > 0) {
    result.push(stack.pop()!);
  }
  return result;
}

/**
 * Computes a line-by-line diff between two multiline text strings (LCS algorithm).
 */
export function computeLineDiff(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const dp = buildLcsMatrix(linesA, linesB);
  return backtrackLcs(linesA, linesB, dp);
}

function resolveDiffRowType(
  isModify: boolean,
  entry: DiffLine | undefined,
  fallbackType: 'delete' | 'insert'
): 'equal' | 'delete' | 'insert' | 'empty' | 'modify' {
  if (isModify) return 'modify';
  if (entry) return fallbackType;
  return 'empty';
}

function processDeleteInsertBlock(diffLines: DiffLine[], startIdx: number): { blockRows: SideBySideRow[]; nextIdx: number } {
  let idx = startIdx;
  const deletes: DiffLine[] = [];
  while (idx < diffLines.length && diffLines[idx].type === 'delete') {
    deletes.push(diffLines[idx]);
    idx++;
  }
  const inserts: DiffLine[] = [];
  while (idx < diffLines.length && diffLines[idx].type === 'insert') {
    inserts.push(diffLines[idx]);
    idx++;
  }

  const blockRows: SideBySideRow[] = [];
  const count = Math.max(deletes.length, inserts.length);
  for (let k = 0; k < count; k++) {
    const d = deletes[k];
    const ins = inserts[k];
    const isModify = Boolean(d && ins);

    blockRows.push({
      lineA: d?.lineA,
      textA: d?.content,
      typeA: resolveDiffRowType(isModify, d, 'delete') as 'equal' | 'delete' | 'empty' | 'modify',
      lineB: ins?.lineB,
      textB: ins?.content,
      typeB: resolveDiffRowType(isModify, ins, 'insert') as 'equal' | 'insert' | 'empty' | 'modify',
    });
  }
  return { blockRows, nextIdx: idx };
}

/**
 * Aligns diff lines into paired rows for a side-by-side visual comparison.
 */
export function buildSideBySideDiff(diffLines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let idx = 0;

  while (idx < diffLines.length) {
    const item = diffLines[idx];

    if (item.type === 'equal') {
      rows.push({
        lineA: item.lineA,
        textA: item.content,
        typeA: 'equal',
        lineB: item.lineB,
        textB: item.content,
        typeB: 'equal',
      });
      idx++;
    } else if (item.type === 'delete') {
      const { blockRows, nextIdx } = processDeleteInsertBlock(diffLines, idx);
      rows.push(...blockRows);
      idx = nextIdx;
    } else if (item.type === 'insert') {
      rows.push({
        typeA: 'empty',
        lineB: item.lineB,
        textB: item.content,
        typeB: 'insert',
      });
      idx++;
    }
  }

  return rows;
}
