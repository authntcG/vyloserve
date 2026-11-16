import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  parseJsonTable,
  generateSqlInsert,
  generateMarkdownTable,
  generateCsv,
  csvToJson,
  jsonToCsv,
  detectDelimiter,
  SAMPLE_CSV,
  SAMPLE_JSON,
} from '../src/utils/dataConverter';

describe('dataConverter Utility', () => {
  describe('detectDelimiter', () => {
    it('detects comma, semicolon, and tab correctly', () => {
      expect(detectDelimiter('id,name,email')).toBe(',');
      expect(detectDelimiter('id;name;email')).toBe(';');
      expect(detectDelimiter('id\tname\temail')).toBe('\t');
    });
  });

  describe('parseCsv', () => {
    it('parses CSV with numbers, booleans, and quoted strings', () => {
      const csv = `id,name,price,in_stock\n1,"Apple, Green",3.50,true\n2,Banana,NULL,false`;
      const { headers, rows } = parseCsv(csv);

      expect(headers).toEqual(['id', 'name', 'price', 'in_stock']);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual([1, 'Apple, Green', 3.5, true]);
      expect(rows[1]).toEqual([2, 'Banana', null, false]);
    });

    it('handles escaped quotes ("")', () => {
      const csv = `id,title\n1,"He said ""Hello"" loudly"`;
      const { headers, rows } = parseCsv(csv);

      expect(headers).toEqual(['id', 'title']);
      expect(rows[0][1]).toBe('He said "Hello" loudly');
    });

    it('returns empty structures for blank input', () => {
      expect(parseCsv('')).toEqual({ headers: [], rows: [] });
      expect(parseCsv('   \n  ')).toEqual({ headers: [], rows: [] });
    });
  });

  describe('parseJsonTable', () => {
    it('parses array of objects into tabular format', () => {
      const json = JSON.stringify([
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
      ]);
      const { headers, rows } = parseJsonTable(json);

      expect(headers).toContain('id');
      expect(headers).toContain('name');
      expect(headers).toContain('active');
      expect(headers).toContain('email');
      expect(rows).toHaveLength(2);
    });

    it('parses wrapped object { data: [...] }', () => {
      const json = JSON.stringify({ data: [{ id: 1, name: 'Item 1' }] });
      const { headers, rows } = parseJsonTable(json);

      expect(headers).toEqual(['id', 'name']);
      expect(rows[0]).toEqual([1, 'Item 1']);
    });

    it('throws error for invalid JSON', () => {
      expect(() => parseJsonTable('{ not json }')).toThrow(/JSON syntax error/i);
    });
  });

  describe('generateSqlInsert', () => {
    it('generates single-row INSERT statements with backticks and SQL escaping', () => {
      const headers = ['id', 'name', 'notes'];
      const rows = [
        [1, "O'Connor", 'Line 1'],
        [2, 'Alice', null],
      ];
      const sql = generateSqlInsert(headers, rows, {
        tableName: 'clients',
        quoteIdentifier: 'backtick',
        insertMode: 'single',
      });

      expect(sql).toContain("INSERT INTO `clients` (`id`, `name`, `notes`) VALUES (1, 'O''Connor', 'Line 1');");
      expect(sql).toContain("INSERT INTO `clients` (`id`, `name`, `notes`) VALUES (2, 'Alice', NULL);");
    });

    it('generates bulk multi-row INSERT statement with double quotes', () => {
      const headers = ['id', 'is_admin'];
      const rows = [
        [1, true],
        [2, false],
      ];
      const sql = generateSqlInsert(headers, rows, {
        tableName: 'users',
        quoteIdentifier: 'double',
        insertMode: 'bulk',
      });

      expect(sql).toContain('INSERT INTO "users" ("id", "is_admin") VALUES');
      expect(sql).toContain('(1, TRUE),');
      expect(sql).toContain('(2, FALSE);');
    });
  });

  describe('generateMarkdownTable', () => {
    it('creates formatted markdown table string', () => {
      const headers = ['Name', 'Role'];
      const rows = [
        ['Alice', 'Admin'],
        ['Bob', 'Editor'],
      ];
      const md = generateMarkdownTable(headers, rows);

      expect(md).toContain('| Name  | Role   |');
      expect(md).toContain('| ---');
      expect(md).toContain('| Alice | Admin  |');
      expect(md).toContain('| Bob   | Editor |');
    });
  });

  describe('generateCsv and Bidirectional Conversion', () => {
    it('converts SAMPLE_CSV to JSON and back to CSV', () => {
      const json = csvToJson(SAMPLE_CSV);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(4);
      expect(parsed[0].name).toBe('Alice Johnson');

      const csv = jsonToCsv(json);
      expect(csv).toContain('Alice Johnson');
      expect(csv).toContain('"O\'Connor, Liam"');
    });
  });
});
