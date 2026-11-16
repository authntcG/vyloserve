import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Tabs, { type TabItem } from '../../../components/Tabs';
import Button from '../../../components/Button';
import FieldLabel from '../../../components/FieldLabel';
import InfoBox from '../../../components/InfoBox';
import Select, { type SelectOption } from '../../../components/Select';
import { useToast } from '../../../context/ToastContext';
import {
  parseCsv,
  parseJsonTable,
  generateSqlInsert,
  generateMarkdownTable,
  csvToJson,
  jsonToCsv,
  SAMPLE_CSV,
  SAMPLE_JSON,
} from '../../../utils/dataConverter';

type QuoteStyle = 'backtick' | 'double' | 'none';
type InsertMode = 'single' | 'bulk';

const QUOTE_OPTIONS: ReadonlyArray<SelectOption<QuoteStyle>> = [
  { value: 'backtick', label: 'Backticks (`name`) - MySQL / MariaDB / SQLite' },
  { value: 'double', label: 'Double Quotes ("name") - PostgreSQL / ANSI SQL' },
  { value: 'none', label: 'No Quotes (name) - Standard unquoted' },
];

const MODE_OPTIONS: ReadonlyArray<SelectOption<InsertMode>> = [
  { value: 'single', label: 'Single Statement per Row (INSERT INTO ... VALUES (...);)' },
  { value: 'bulk', label: 'Bulk Multi-Row Insert (INSERT INTO ... VALUES (...), (...);)' },
];

const BATCH_SIZE_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: '25', label: '25 Rows per Statement' },
  { value: '50', label: '50 Rows per Statement (Default)' },
  { value: '100', label: '100 Rows per Statement' },
  { value: '500', label: '500 Rows per Statement' },
];

interface ConversionComputationResult {
  output: string;
  error: string | null;
  rowCount: number;
  colCount: number;
}

const executeSqlConversion = (
  inputText: string,
  activeTab: 'csv_to_sql' | 'json_to_sql',
  tableName: string,
  quoteStyle: 'backtick' | 'double' | 'none',
  insertMode: InsertMode,
  batchSize: number
): ConversionComputationResult => {
  const { headers, rows } = activeTab === 'csv_to_sql' ? parseCsv(inputText) : parseJsonTable(inputText);
  if (headers.length === 0) {
    const errorMsg = activeTab === 'csv_to_sql'
      ? 'No valid CSV headers detected.'
      : 'No valid JSON records or keys detected.';
    return { output: '', error: errorMsg, rowCount: 0, colCount: 0 };
  }
  const sql = generateSqlInsert(headers, rows, {
    tableName,
    quoteIdentifier: quoteStyle,
    insertMode,
    batchSize,
  });
  return { output: sql, error: null, rowCount: rows.length, colCount: headers.length };
};

const executeCsvJsonConversion = (
  inputText: string,
  direction: 'csv_to_json' | 'json_to_csv'
): ConversionComputationResult => {
  if (direction === 'csv_to_json') {
    const { headers, rows } = parseCsv(inputText);
    const json = csvToJson(inputText);
    return { output: json, error: null, rowCount: rows.length, colCount: headers.length };
  }
  const { headers, rows } = parseJsonTable(inputText);
  const csv = jsonToCsv(inputText);
  return { output: csv, error: null, rowCount: rows.length, colCount: headers.length };
};

const executeMarkdownConversion = (inputText: string): ConversionComputationResult => {
  const trimmed = inputText.trim();
  const parsed = (trimmed.startsWith('[') || trimmed.startsWith('{'))
    ? parseJsonTable(inputText)
    : parseCsv(inputText);
  const md = generateMarkdownTable(parsed.headers, parsed.rows);
  return { output: md, error: null, rowCount: parsed.rows.length, colCount: parsed.headers.length };
};

export default function DataConverterMain() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('csv_to_sql');

  // Input State
  const [inputText, setInputText] = useState<string>(SAMPLE_CSV);

  // Options State
  const [tableName, setTableName] = useState<string>('users');
  const [quoteStyle, setQuoteStyle] = useState<QuoteStyle>('backtick');
  const [insertMode, setInsertMode] = useState<InsertMode>('single');
  const [batchSize, setBatchSize] = useState<string>('50');

  // CSV <-> JSON direction
  const [conversionDirection, setConversionDirection] = useState<'csv_to_json' | 'json_to_csv'>('csv_to_json');

  const tabs: TabItem[] = [
    { value: 'csv_to_sql', label: t('utilities.data_converter.tab_csv_to_sql', 'CSV to SQL') },
    { value: 'json_to_sql', label: t('utilities.data_converter.tab_json_to_sql', 'JSON to SQL') },
    { value: 'csv_json', label: t('utilities.data_converter.tab_csv_json', 'CSV ↔ JSON') },
    { value: 'markdown', label: t('utilities.data_converter.tab_markdown', 'Markdown Table') },
  ];

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(t('common.copied_to_clipboard', 'Copied to clipboard'), 'success');
  };

  const handleLoadSample = () => {
    if (activeTab === 'json_to_sql' || (activeTab === 'csv_json' && conversionDirection === 'json_to_csv')) {
      setInputText(SAMPLE_JSON);
    } else {
      setInputText(SAMPLE_CSV);
    }
    showToast(t('common.success', 'Sample loaded'), 'success');
  };

  const handleClear = () => {
    setInputText('');
  };

  // Convert computation
  const conversionResult = useMemo(() => {
    if (!inputText.trim()) {
      return { output: '', error: null, rowCount: 0, colCount: 0 };
    }

    try {
      if (activeTab === 'csv_to_sql' || activeTab === 'json_to_sql') {
        return executeSqlConversion(
          inputText,
          activeTab,
          tableName,
          quoteStyle,
          insertMode,
          Number.parseInt(batchSize, 10)
        );
      }
      if (activeTab === 'csv_json') {
        return executeCsvJsonConversion(inputText, conversionDirection);
      }
      if (activeTab === 'markdown') {
        return executeMarkdownConversion(inputText);
      }
      return { output: '', error: null, rowCount: 0, colCount: 0 };
    } catch (err: any) {
      return { output: '', error: err.message || 'Conversion failed', rowCount: 0, colCount: 0 };
    }
  }, [inputText, activeTab, tableName, quoteStyle, insertMode, batchSize, conversionDirection]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('utilities.data_converter.title', 'Data & SQL Converter')}
        subtitle={t(
          'utilities.data_converter.subtitle',
          'Convert CSV, JSON, and tabular data into SQL INSERT statements, Markdown tables, or CSV.'
        )}
        icon="dataset"
      />

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        value={activeTab}
        onChange={(val) => {
          setActiveTab(val);
          if (val === 'json_to_sql' && inputText === SAMPLE_CSV) {
            setInputText(SAMPLE_JSON);
          } else if (val === 'csv_to_sql' && inputText === SAMPLE_JSON) {
            setInputText(SAMPLE_CSV);
          }
        }}
      />

      {/* Settings Bar */}
      <Card
        title={t('common.settings', 'Conversion Settings')}
        gridCols="grid-cols-1"
        headerActions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleLoadSample}>
              <span className="material-symbols-outlined text-[16px] mr-1">data_object</span>
              {t('utilities.data_converter.btn_load_sample', 'Load Sample')}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClear} disabled={!inputText}>
              <span className="material-symbols-outlined text-[16px] mr-1">backspace</span>
              {t('common.clear', 'Clear')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* SQL Specific Options */}
          {(activeTab === 'csv_to_sql' || activeTab === 'json_to_sql') && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="target-table-name">
                  {t('utilities.data_converter.table_name', 'Target Table Name')}
                </FieldLabel>
                <input
                  id="target-table-name"
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="e.g. users"
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="quote-style-select">
                  {t('utilities.data_converter.quote_identifier', 'Identifier Quotes')}
                </FieldLabel>
                <Select
                  id="quote-style-select"
                  options={QUOTE_OPTIONS}
                  value={quoteStyle}
                  onChange={setQuoteStyle}
                  size="sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="insert-mode-select">
                  {t('utilities.data_converter.insert_mode', 'Insert Mode')}
                </FieldLabel>
                <Select
                  id="insert-mode-select"
                  options={MODE_OPTIONS}
                  value={insertMode}
                  onChange={setInsertMode}
                  size="sm"
                />
              </div>

              {insertMode === 'bulk' && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="batch-size-select">
                    {t('utilities.data_converter.batch_size', 'Batch Size')}
                  </FieldLabel>
                  <Select
                    id="batch-size-select"
                    options={BATCH_SIZE_OPTIONS}
                    value={batchSize}
                    onChange={setBatchSize}
                    size="sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* CSV <-> JSON Toggle */}
          {activeTab === 'csv_json' && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Direction:
              </span>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setConversionDirection('csv_to_json')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    conversionDirection === 'csv_to_json'
                      ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  CSV → JSON
                </button>
                <button
                  type="button"
                  onClick={() => setConversionDirection('json_to_csv')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    conversionDirection === 'json_to_csv'
                      ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  JSON → CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Error Message if any */}
      {conversionResult.error && (
        <InfoBox tone="danger" icon="error">
          {conversionResult.error}
        </InfoBox>
      )}

      {/* Dual Pane Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Input Pane */}
        <Card
          title={t('utilities.data_converter.input_data', 'Input Data')}
          gridCols="grid-cols-1"
          headerActions={
            <span className="text-xs font-mono text-slate-500">
              {inputText.length} chars
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="data-input-textarea" visuallyHidden>
              {t('utilities.data_converter.input_data', 'Input Data')}
            </FieldLabel>
            <textarea
              id="data-input-textarea"
              rows={16}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste CSV or JSON here..."
              className="w-full font-mono text-xs p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-y leading-5 font-medium"
            />
          </div>
        </Card>

        {/* Right: Output Pane */}
        <Card
          title={t('utilities.data_converter.output_result', 'Output Result')}
          gridCols="grid-cols-1"
          headerActions={
            <div className="flex items-center gap-3">
              {conversionResult.rowCount > 0 && (
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {conversionResult.rowCount} rows ({conversionResult.colCount} cols)
                </span>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleCopy(conversionResult.output)}
                disabled={!conversionResult.output}
              >
                <span className="material-symbols-outlined text-[16px] mr-1">content_copy</span>
                {t('utilities.data_converter.btn_copy', 'Copy Output')}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="data-output-textarea" visuallyHidden>
              {t('utilities.data_converter.output_result', 'Output Result')}
            </FieldLabel>
            <textarea
              id="data-output-textarea"
              readOnly
              rows={16}
              value={conversionResult.output}
              placeholder="Converted output will appear here..."
              className="w-full font-mono text-xs p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 resize-y leading-5 selection:bg-primary/20"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
