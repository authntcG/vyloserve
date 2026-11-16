/**
 * Utility functions for tabular data conversion between CSV, JSON, SQL INSERT, and Markdown Table.
 */

export interface SqlInsertOptions {
  tableName?: string;
  quoteIdentifier?: 'backtick' | 'double' | 'none';
  insertMode?: 'single' | 'bulk';
  batchSize?: number;
}

/**
 * Automatically detects whether CSV uses comma, semicolon, or tab as separator.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';';
  return ',';
}

export type CsvCellValue = string | number | boolean | null;

interface CsvParseState {
  rows: CsvCellValue[][];
  currentRow: CsvCellValue[];
  currentField: string;
  insideQuotes: boolean;
}

function flushCsvField(state: CsvParseState): void {
  state.currentRow.push(coerceValue(state.currentField));
  state.currentField = '';
}

function flushCsvRow(state: CsvParseState): void {
  flushCsvField(state);
  if (state.currentRow.some((val) => val !== null && val !== '')) {
    state.rows.push(state.currentRow);
  }
  state.currentRow = [];
}

function handleCsvTokenChar(
  char: string,
  nextChar: string | undefined,
  delimiter: string,
  state: CsvParseState
): boolean {
  if (char === '"') {
    if (state.insideQuotes && nextChar === '"') {
      state.currentField += '"';
      return true;
    }
    state.insideQuotes = !state.insideQuotes;
    return false;
  }
  if (char === delimiter && !state.insideQuotes) {
    flushCsvField(state);
    return false;
  }
  if ((char === '\r' || char === '\n') && !state.insideQuotes) {
    flushCsvRow(state);
    return char === '\r' && nextChar === '\n';
  }
  state.currentField += char;
  return false;
}

function tokenizeCsv(csvText: string, delimiter: string): CsvCellValue[][] {
  const state: CsvParseState = {
    rows: [],
    currentRow: [],
    currentField: '',
    insideQuotes: false,
  };

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    if (handleCsvTokenChar(char, nextChar, delimiter, state)) {
      i++;
    }
  }

  if (state.currentField || state.currentRow.length > 0) {
    flushCsvRow(state);
  }

  return state.rows;
}

/**
 * Coerces raw string value to number, boolean, null, or trimmed string.
 */
export function coerceValue(raw: string): CsvCellValue {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'NULL') {
    return null;
  }
  if (trimmed.toLowerCase() === 'true') {
    return true;
  }
  if (trimmed.toLowerCase() === 'false') {
    return false;
  }
  // Numeric check: only if valid finite number and does not have leading zeroes like zipcodes "0123"
  if (/^-?\d+(\.\d+)?$/.test(trimmed) && (!trimmed.startsWith('0') || trimmed === '0' || trimmed.startsWith('0.'))) {
    const num = Number(trimmed);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      return num;
    }
  }
  return trimmed;
}

/**
 * Robust CSV parser that handles embedded commas, newlines, and escaped quotes ("").
 */
export function parseCsv(
  csvText: string,
  customDelimiter?: string
): { headers: string[]; rows: CsvCellValue[][] } {
  if (!csvText?.trim()) {
    return { headers: [], rows: [] };
  }

  const delimiter = customDelimiter || detectDelimiter(csvText);
  const rows = tokenizeCsv(csvText, delimiter);

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = rows[0].map((h, idx) => (h === null || h === '' ? `column_${idx + 1}` : String(h).trim()));
  const dataRows = rows.slice(1);

  // Normalize column count across data rows
  const normalizedRows = dataRows.map((r) => {
    const padded = [...r];
    while (padded.length < rawHeaders.length) {
      padded.push(null);
    }
    return padded.slice(0, rawHeaders.length);
  });

  return { headers: rawHeaders, rows: normalizedRows };
}

/**
 * Parses JSON into tabular headers and rows.
 * Supports array of objects, single object, or wrapped { data: [...] }.
 */
export function parseJsonTable(
  jsonText: string
): { headers: string[]; rows: CsvCellValue[][] } {
  if (!jsonText?.trim()) {
    return { headers: [], rows: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err: any) {
    throw new Error(`JSON syntax error: ${err.message}`);
  }

  let items: Record<string, unknown>[] = [];

  if (Array.isArray(parsed)) {
    items = parsed.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object');
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const firstArrayValue = Object.values(obj).find(Array.isArray);
    if (firstArrayValue) {
      items = firstArrayValue.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object');
    } else {
      items = [obj];
    }
  }

  if (items.length === 0) {
    return { headers: [], rows: [] };
  }

  // Collect all unique keys across all items
  const headerSet = new Set<string>();
  items.forEach((item) => {
    Object.keys(item).forEach((k) => headerSet.add(k));
  });

  const headers = Array.from(headerSet);
  const rows = items.map((item) => {
    return headers.map((key) => {
      const val = item[key];
      if (val === undefined || val === null) return null;
      if (typeof val === 'number' || typeof val === 'boolean') return val;
      if (typeof val === 'string') return coerceValue(val);
      if (typeof val === 'bigint' || typeof val === 'symbol') return coerceValue(val.toString());
      if (typeof val === 'object') return JSON.stringify(val);
      return coerceValue(JSON.stringify(val) ?? '');
    });
  });

  return { headers, rows };
}

/**
 * Quotes SQL identifiers (columns, tables) safely.
 */
export function quoteIdentifierName(name: string, style: 'backtick' | 'double' | 'none' = 'backtick'): string {
  const clean = name.replace(/[`"]/g, '');
  if (style === 'backtick') return `\`${clean}\``;
  if (style === 'double') return `"${clean}"`;
  return clean;
}

/**
 * Formats a single value for SQL INSERT.
 */
export function formatSqlValue(val: CsvCellValue): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const escaped = String(val).replaceAll("'", "''");
  return `'${escaped}'`;
}

/**
 * Generates SQL INSERT statements from tabular headers and rows.
 */
export function generateSqlInsert(
  headers: string[],
  rows: CsvCellValue[][],
  options: SqlInsertOptions = {}
): string {
  if (headers.length === 0 || rows.length === 0) {
    return '-- No data to generate SQL INSERT statements.';
  }

  const rawTable = (options.tableName || 'users').trim() || 'users';
  const quoteStyle = options.quoteIdentifier || 'backtick';
  const insertMode = options.insertMode || 'single';
  const batchSize = Math.max(1, options.batchSize || 50);

  const tableName = quoteIdentifierName(rawTable, quoteStyle);
  const columnList = headers.map((h) => quoteIdentifierName(h, quoteStyle)).join(', ');

  if (insertMode === 'single') {
    const statements = rows.map((row) => {
      const values = row.map(formatSqlValue).join(', ');
      return `INSERT INTO ${tableName} (${columnList}) VALUES (${values});`;
    });
    return statements.join('\n');
  }

  // Bulk Multi-row INSERT mode with batching
  const chunks: string[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunkRows = rows.slice(i, i + batchSize);
    const valueTuples = chunkRows.map((row) => `  (${row.map(formatSqlValue).join(', ')})`).join(',\n');
    chunks.push(`INSERT INTO ${tableName} (${columnList}) VALUES\n${valueTuples};`);
  }

  return chunks.join('\n\n');
}

/**
 * Generates Markdown Table from tabular headers and rows.
 */
export function generateMarkdownTable(
  headers: string[],
  rows: CsvCellValue[][]
): string {
  if (headers.length === 0) return '_Empty table_';

  const colWidths = headers.map((h, idx) => {
    let max = h.length;
    rows.forEach((r) => {
      const valStr = r[idx] === null ? 'NULL' : String(r[idx]);
      if (valStr.length > max) max = valStr.length;
    });
    return Math.max(max, 3);
  });

  const headerRow = `| ${headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ')} |`;
  const separatorRow = `| ${colWidths.map((w) => '-'.repeat(w)).join(' | ')} |`;

  const bodyRows = rows.map((r) => {
    return `| ${r
      .map((val, i) => {
        const str = val === null ? 'NULL' : String(val);
        return str.padEnd(colWidths[i]);
      })
      .join(' | ')} |`;
  });

  return [headerRow, separatorRow, ...bodyRows].join('\n');
}

/**
 * Generates CSV string from tabular headers and rows.
 */
export function generateCsv(
  headers: string[],
  rows: CsvCellValue[][],
  delimiter: string = ','
): string {
  const quoteField = (val: CsvCellValue): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(quoteField).join(delimiter);
  const dataLines = rows.map((r) => r.map(quoteField).join(delimiter));

  return [headerLine, ...dataLines].join('\n');
}

/**
 * CSV to JSON string conversion.
 */
export function csvToJson(csvText: string, indent: number = 2): string {
  const { headers, rows } = parseCsv(csvText);
  if (headers.length === 0) return '[]';

  const list = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx];
    });
    return obj;
  });

  return JSON.stringify(list, null, indent);
}

/**
 * JSON to CSV string conversion.
 */
export function jsonToCsv(jsonText: string, delimiter: string = ','): string {
  const { headers, rows } = parseJsonTable(jsonText);
  return generateCsv(headers, rows, delimiter);
}

export const SAMPLE_CSV = `id,name,email,role,is_active,created_at
1,Alice Johnson,alice@example.com,admin,true,2026-01-15
2,Bob Smith,bob@example.com,developer,true,2026-02-01
3,Charlie Brown,charlie@example.com,guest,false,2026-02-10
4,"O'Connor, Liam",liam@example.com,support,true,2026-02-15`;

export const SAMPLE_JSON = `[
  { "id": 1, "name": "Alice Johnson", "email": "alice@example.com", "role": "admin", "is_active": true },
  { "id": 2, "name": "Bob Smith", "email": "bob@example.com", "role": "developer", "is_active": true },
  { "id": 3, "name": "Charlie Brown", "email": "charlie@example.com", "role": "guest", "is_active": false },
  { "id": 4, "name": "O'Connor, Liam", "email": "liam@example.com", "role": "support", "is_active": true }
]`;
