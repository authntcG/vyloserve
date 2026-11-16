import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Tabs, { type TabItem } from '../../../components/Tabs';
import Button from '../../../components/Button';
import FieldLabel from '../../../components/FieldLabel';
import InfoBox from '../../../components/InfoBox';
import EmptyState from '../../../components/EmptyState';
import Select, { type SelectOption } from '../../../components/Select';
import { useToast } from '../../../context/ToastContext';
import {
  formatJson,
  validateJson,
  computeJsonDiff,
  computeLineDiff,
  buildSideBySideDiff,
  type IndentOption,
  type JsonDiffEntry,
  type DiffLine,
  type SideBySideRow,
} from '../../../utils/jsonStudio';

const SAMPLE_JSON_A = JSON.stringify(
  {
    app: 'VyloServe',
    version: '1.2.0',
    server: {
      host: '127.0.0.1',
      port: 8080,
      ssl: true,
    },
    services: ['apache', 'php', 'database'],
    metadata: {
      created_at: 1700000000,
      active: true,
    },
  },
  null,
  2
);

const SAMPLE_JSON_B = JSON.stringify(
  {
    app: 'VyloServe',
    version: '1.3.0',
    server: {
      host: 'localhost',
      port: 8443,
      ssl: true,
      workers: 4,
    },
    services: ['apache', 'php', 'database', 'redis'],
    metadata: {
      created_at: 1700000000,
      active: false,
    },
  },
  null,
  2
);

const INDENT_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: '2', label: '2 Spaces' },
  { value: '4', label: '4 Spaces' },
  { value: 'tab', label: 'Tab' },
  { value: 'minify', label: 'Minify' },
];

export default function JsonStudioMain() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('formatter');

  // Formatter State
  const [rawInput, setRawInput] = useState<string>(SAMPLE_JSON_A);
  const [formattedOutput, setFormattedOutput] = useState<string>('');
  const [indentOption, setIndentOption] = useState<IndentOption>(2);
  const [sortKeys, setSortKeys] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<{
    message: string;
    line?: number;
    column?: number;
  } | null>(null);

  // Tree View State
  const [treeSearch, setTreeSearch] = useState<string>('');

  // Diff State
  const [diffInputA, setDiffInputA] = useState<string>(SAMPLE_JSON_A);
  const [diffInputB, setDiffInputB] = useState<string>(SAMPLE_JSON_B);
  const [diffViewMode, setDiffViewMode] = useState<'split' | 'unified'>('split');
  const [diffAutoFormat, setDiffAutoFormat] = useState<boolean>(true);
  const [diffSortKeys, setDiffSortKeys] = useState<boolean>(false);
  const [showStructuralTable, setShowStructuralTable] = useState<boolean>(false);

  const tabs: TabItem[] = [
    { value: 'formatter', label: t('utilities.json_studio.tab_formatter', 'Formatter & Validator') },
    { value: 'tree', label: t('utilities.json_studio.tab_tree', 'Tree Explorer') },
    { value: 'diff', label: t('utilities.json_studio.tab_diff', 'JSON Diff') },
  ];

  const handleFormat = () => {
    const res = formatJson(rawInput, indentOption, sortKeys);
    if (res.success && res.result !== undefined) {
      setFormattedOutput(res.result);
      setValidationError(null);
      showToast(t('utilities.json_studio.format_success', 'JSON formatted successfully'), 'success');
    } else {
      const val = validateJson(rawInput);
      setValidationError({
        message: val.error || 'Failed to parse JSON',
        line: val.line,
        column: val.column,
      });
      showToast(t('utilities.json_studio.invalid_json', 'Invalid JSON syntax'), 'error');
    }
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(t('common.copied_to_clipboard', 'Copied to clipboard'), 'success');
  };

  // Parsed object for Tree view
  const parsedTreeData = useMemo(() => {
    const val = validateJson(rawInput);
    if (val.isValid) return val.parsed;
    return null;
  }, [rawInput]);

  // Diff result (structural)
  const diffResult = useMemo(() => {
    if (!diffInputA || !diffInputB) return null;
    return computeJsonDiff(diffInputA, diffInputB);
  }, [diffInputA, diffInputB]);

  // Formatted / normalized diff inputs for line comparison
  const processedDiffA = useMemo(() => {
    if (!diffAutoFormat) return diffInputA;
    const res = formatJson(diffInputA, 2, diffSortKeys);
    return res.success && res.result !== undefined ? res.result : diffInputA;
  }, [diffInputA, diffAutoFormat, diffSortKeys]);

  const processedDiffB = useMemo(() => {
    if (!diffAutoFormat) return diffInputB;
    const res = formatJson(diffInputB, 2, diffSortKeys);
    return res.success && res.result !== undefined ? res.result : diffInputB;
  }, [diffInputB, diffAutoFormat, diffSortKeys]);

  // Line diffs
  const diffLines = useMemo<DiffLine[]>(() => {
    if (!processedDiffA && !processedDiffB) return [];
    return computeLineDiff(processedDiffA, processedDiffB);
  }, [processedDiffA, processedDiffB]);

  const sideBySideRows = useMemo<SideBySideRow[]>(() => {
    if (diffLines.length === 0) return [];
    return buildSideBySideDiff(diffLines);
  }, [diffLines]);

  const diffStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let modified = 0;
    let equal = 0;

    for (const row of sideBySideRows) {
      if (row.typeA === 'modify' || row.typeB === 'modify') {
        modified++;
      } else if (row.typeA === 'delete') {
        removed++;
      } else if (row.typeB === 'insert') {
        added++;
      } else if (row.typeA === 'equal') {
        equal++;
      }
    }

    return { added, removed, modified, equal };
  }, [sideBySideRows]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('utilities.json_studio.title', 'JSON Studio')}
        subtitle={t(
          'utilities.json_studio.subtitle',
          'Offline JSON formatter, syntax validator, collapsible tree explorer, and structural diff checker.'
        )}
        icon="data_object"
      />

      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />

      {/* TAB 1: FORMATTER & VALIDATOR */}
      {activeTab === 'formatter' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            title={t('utilities.json_studio.input_title', 'Raw JSON Input')}
            gridCols="grid-cols-1"
            headerActions={
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRawInput(SAMPLE_JSON_A)}
                >
                  {t('utilities.json_studio.btn_sample', 'Sample')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRawInput('');
                    setFormattedOutput('');
                    setValidationError(null);
                  }}
                >
                  {t('common.clear', 'Clear')}
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-3">
              <FieldLabel
                htmlFor="json-studio-raw-input"
                visuallyHidden
              >
                {t('utilities.json_studio.label_input', 'Input JSON')}
              </FieldLabel>
              <textarea
                id="json-studio-raw-input"
                rows={16}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder='{"key": "value"}'
                className="w-full font-mono text-xs p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-primary/40 resize-y"
              />

              {validationError && (
                <InfoBox tone="danger" icon="error">
                  <div className="flex flex-col gap-0.5 text-xs">
                    <span className="font-semibold">
                      {t('utilities.json_studio.error_syntax', 'Syntax Error')}:
                    </span>
                    <span>{validationError.message}</span>
                    {validationError.line !== undefined && (
                      <span className="font-mono text-[11px] mt-1">
                        Line: {validationError.line}, Column: {validationError.column}
                      </span>
                    )}
                  </div>
                </InfoBox>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FieldLabel
                      htmlFor="json-studio-indent-select"
                      className="mb-0 text-xs text-slate-500"
                    >
                      {t('utilities.json_studio.label_indent', 'Indent') + ':'}
                    </FieldLabel>
                    <div className="w-28">
                      <Select
                        id="json-studio-indent-select"
                        size="sm"
                        searchable={false}
                        options={INDENT_OPTIONS}
                        value={String(indentOption)}
                        onChange={(val) => {
                          if (val === 'tab' || val === 'minify') {
                            setIndentOption(val);
                          } else {
                            setIndentOption(Number.parseInt(val, 10) as IndentOption);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      id="json-studio-sort-keys"
                      type="checkbox"
                      checked={sortKeys}
                      onChange={(e) => setSortKeys(e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                    />
                    <FieldLabel
                      htmlFor="json-studio-sort-keys"
                      className="mb-0 text-xs cursor-pointer"
                    >
                      {t('utilities.json_studio.label_sort_keys', 'Sort Keys (A-Z)')}
                    </FieldLabel>
                  </div>
                </div>

                <Button variant="primary" size="sm" onClick={handleFormat}>
                  <span className="material-symbols-outlined text-[16px] mr-1">auto_fix_high</span>
                  {t('utilities.json_studio.btn_format', 'Format & Validate')}
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title={t('utilities.json_studio.output_title', 'Formatted JSON')}
            gridCols="grid-cols-1"
            headerActions={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(formattedOutput || rawInput)}
                disabled={!formattedOutput && !rawInput}
              >
                <span className="material-symbols-outlined text-[16px] mr-1">content_copy</span>
                {t('common.copy', 'Copy')}
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              <FieldLabel
                htmlFor="json-studio-formatted-output"
                visuallyHidden
              >
                {t('utilities.json_studio.label_output', 'Output JSON')}
              </FieldLabel>
              <textarea
                id="json-studio-formatted-output"
                rows={19}
                readOnly
                value={formattedOutput}
                placeholder={t(
                  'utilities.json_studio.output_placeholder',
                  'Click "Format & Validate" to view formatted JSON...'
                )}
                className="w-full font-mono text-xs p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 resize-y"
              />
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: TREE EXPLORER */}
      {activeTab === 'tree' && (
        <Card
          title={t('utilities.json_studio.tree_title', 'Tree Structure Explorer')}
          gridCols="grid-cols-1"
          headerActions={
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor="json-tree-search-input" visuallyHidden>
                {t('utilities.json_studio.search_tree_label', 'Search tree keys')}
              </FieldLabel>
              <input
                id="json-tree-search-input"
                type="text"
                placeholder={t('utilities.json_studio.search_tree_placeholder', 'Filter keys...')}
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
            </div>
          }
        >
          {parsedTreeData ? (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 max-h-[500px] overflow-y-auto">
              <JsonTreeNode
                name="root"
                value={parsedTreeData}
                searchFilter={treeSearch}
                path="$"
                onCopyPath={(path) => handleCopy(path)}
              />
            </div>
          ) : (
            <EmptyState
              icon="account_tree"
              title={t('utilities.json_studio.tree_empty_title', 'No Valid JSON to Render')}
              description={t(
                'utilities.json_studio.tree_empty_desc',
                'Enter valid JSON in the Formatter tab to view the tree hierarchy.'
              )}
            />
          )}
        </Card>
      )}

      {/* TAB 3: JSON DIFF */}
      {activeTab === 'diff' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card
              title={t('utilities.json_studio.diff_a_title', 'Original JSON (A)')}
              gridCols="grid-cols-1"
              headerActions={
                <Button variant="secondary" size="sm" onClick={() => setDiffInputA(SAMPLE_JSON_A)}>
                  {t('utilities.json_studio.btn_sample', 'Sample')}
                </Button>
              }
            >
              <FieldLabel
                htmlFor="diff-json-a"
                visuallyHidden
              >
                {t('utilities.json_studio.label_diff_a', 'JSON A')}
              </FieldLabel>
              <textarea
                id="diff-json-a"
                rows={12}
                value={diffInputA}
                onChange={(e) => setDiffInputA(e.target.value)}
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 resize-y"
              />
            </Card>

            <Card
              title={t('utilities.json_studio.diff_b_title', 'Modified JSON (B)')}
              gridCols="grid-cols-1"
              headerActions={
                <Button variant="secondary" size="sm" onClick={() => setDiffInputB(SAMPLE_JSON_B)}>
                  {t('utilities.json_studio.btn_sample', 'Sample')}
                </Button>
              }
            >
              <FieldLabel
                htmlFor="diff-json-b"
                visuallyHidden
              >
                {t('utilities.json_studio.label_diff_b', 'JSON B')}
              </FieldLabel>
              <textarea
                id="diff-json-b"
                rows={12}
                value={diffInputB}
                onChange={(e) => setDiffInputB(e.target.value)}
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 resize-y"
              />
            </Card>
          </div>

          <Card
            title={t('utilities.json_studio.diff_visual_title', 'Live Visual Diff')}
            gridCols="grid-cols-1"
            headerActions={
              <fieldset
                aria-label={t('utilities.json_studio.diff_visual_title', 'Live Visual Diff')}
                className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setDiffViewMode('split')}
                  aria-pressed={diffViewMode === 'split'}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                    diffViewMode === 'split'
                      ? 'bg-white dark:bg-slate-900 text-primary shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">vertical_split</span>
                  {t('utilities.json_studio.diff_view_split', 'Split View')}
                </button>
                <button
                  type="button"
                  onClick={() => setDiffViewMode('unified')}
                  aria-pressed={diffViewMode === 'unified'}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                    diffViewMode === 'unified'
                      ? 'bg-white dark:bg-slate-900 text-primary shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">view_agenda</span>
                  {t('utilities.json_studio.diff_view_unified', 'Unified View')}
                </button>
              </fieldset>
            }
          >
            {!diffResult && (
              <EmptyState
                icon="difference"
                title={t('utilities.json_studio.diff_empty_title', 'No Diff Computed')}
                description={t(
                  'utilities.json_studio.diff_empty_desc',
                  'Provide valid JSON in both editors to see diff results.'
                )}
              />
            )}

            {diffResult && !diffResult.isValid && (
              <InfoBox tone="danger" icon="error">{diffResult.error}</InfoBox>
            )}

            {diffResult && diffResult.isValid && (
              <div className="flex flex-col gap-4">
                  {/* Toolbar & Diff Options */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        +{diffStats.added} {t('utilities.json_studio.diff_added', 'Added')}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        -{diffStats.removed} {t('utilities.json_studio.diff_removed', 'Removed')}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        ~{diffStats.modified} {t('utilities.json_studio.diff_changed', 'Changed')}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        ={diffStats.equal} {t('utilities.json_studio.diff_identical', 'Identical')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <input
                          id="diff-auto-format"
                          type="checkbox"
                          checked={diffAutoFormat}
                          onChange={(e) => setDiffAutoFormat(e.target.checked)}
                          className="rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                        />
                        <FieldLabel htmlFor="diff-auto-format" className="mb-0 cursor-pointer">
                          {t('utilities.json_studio.diff_auto_format', 'Auto-format before diff')}
                        </FieldLabel>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          id="diff-sort-keys"
                          type="checkbox"
                          checked={diffSortKeys}
                          onChange={(e) => setDiffSortKeys(e.target.checked)}
                          className="rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                        />
                        <FieldLabel htmlFor="diff-sort-keys" className="mb-0 cursor-pointer">
                          {t('utilities.json_studio.diff_sort_keys', 'Sort keys before diff')}
                        </FieldLabel>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowStructuralTable(!showStructuralTable)}
                      >
                        <span className="material-symbols-outlined text-[16px] mr-1">
                          {showStructuralTable ? 'expand_less' : 'table_chart'}
                        </span>
                        {t('utilities.json_studio.diff_structural_toggle', 'Show Structural Path Table')}
                      </Button>
                    </div>
                  </div>

                  {/* VISUAL DIFF CONTAINER */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-[550px] overflow-y-auto bg-white dark:bg-slate-900/90">
                    {diffViewMode === 'split' ? (
                      /* SIDE BY SIDE (SPLIT VIEW) */
                      <table className="w-full border-collapse font-mono text-xs">
                        <thead>
                          <tr className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 select-none">
                            <th className="w-12 py-1.5 px-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
                              #
                            </th>
                            <th className="w-[calc(50%-3rem)] py-1.5 px-3 text-left text-xs font-semibold border-r border-slate-200 dark:border-slate-700">
                              {t('utilities.json_studio.diff_line_a', 'Original (A)')}
                            </th>
                            <th className="w-12 py-1.5 px-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
                              #
                            </th>
                            <th className="w-[calc(50%-3rem)] py-1.5 px-3 text-left text-xs font-semibold">
                              {t('utilities.json_studio.diff_line_b', 'Modified (B)')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sideBySideRows.map((row, idx) => {
                            let bgA = 'text-slate-800 dark:text-slate-200';
                            if (row.typeA === 'delete') {
                              bgA = 'bg-red-500/15 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-medium';
                            } else if (row.typeA === 'modify') {
                              bgA = 'bg-amber-500/15 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 font-medium';
                            } else if (row.typeA === 'empty') {
                              bgA = 'bg-slate-100/50 dark:bg-slate-800/30';
                            }

                            let bgB = 'text-slate-800 dark:text-slate-200';
                            if (row.typeB === 'insert') {
                              bgB = 'bg-emerald-500/15 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium';
                            } else if (row.typeB === 'modify') {
                              bgB = 'bg-amber-500/15 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 font-medium';
                            } else if (row.typeB === 'empty') {
                              bgB = 'bg-slate-100/50 dark:bg-slate-800/30';
                            }

                            return (
                              <tr key={`split-${row.lineA ?? 'x'}-${row.lineB ?? 'y'}-${idx}`} className="border-b border-slate-100/60 dark:border-slate-800/60 leading-5">
                                <td className="w-12 py-0.5 px-2 text-right text-[11px] font-mono text-slate-400 select-none bg-slate-50/60 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800">
                                  {row.lineA ?? ''}
                                </td>
                                <td className={`py-0.5 px-3 whitespace-pre overflow-x-hidden border-r border-slate-200 dark:border-slate-800 ${bgA}`}>
                                  {row.textA ?? ''}
                                </td>
                                <td className="w-12 py-0.5 px-2 text-right text-[11px] font-mono text-slate-400 select-none bg-slate-50/60 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800">
                                  {row.lineB ?? ''}
                                </td>
                                <td className={`py-0.5 px-3 whitespace-pre overflow-x-hidden ${bgB}`}>
                                  {row.textB ?? ''}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      /* UNIFIED VIEW */
                      <table className="w-full border-collapse font-mono text-xs">
                        <thead>
                          <tr className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 select-none">
                            <th className="w-12 py-1.5 px-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
                              A
                            </th>
                            <th className="w-12 py-1.5 px-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
                              B
                            </th>
                            <th className="w-8 py-1.5 px-2 text-center text-xs font-semibold border-r border-slate-200 dark:border-slate-700">
                              +/-
                            </th>
                            <th className="py-1.5 px-3 text-left text-xs font-semibold">Content</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffLines.map((line, idx) => {
                            let lineBg = 'text-slate-800 dark:text-slate-200';
                            let prefix = ' ';
                            if (line.type === 'delete') {
                              lineBg = 'bg-red-500/15 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-medium';
                              prefix = '-';
                            } else if (line.type === 'insert') {
                              lineBg = 'bg-emerald-500/15 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium';
                              prefix = '+';
                            }

                            return (
                              <tr key={`unified-${line.lineA ?? 'x'}-${line.lineB ?? 'y'}-${idx}`} className={`border-b border-slate-100/60 dark:border-slate-800/60 leading-5 ${lineBg}`}>
                                <td className="w-12 py-0.5 px-2 text-right text-[11px] font-mono text-slate-400 select-none bg-slate-50/60 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800">
                                  {line.lineA ?? ''}
                                </td>
                                <td className="w-12 py-0.5 px-2 text-right text-[11px] font-mono text-slate-400 select-none bg-slate-50/60 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800">
                                  {line.lineB ?? ''}
                                </td>
                                <td className="w-8 py-0.5 px-2 text-center font-bold select-none border-r border-slate-200 dark:border-slate-800">
                                  {prefix}
                                </td>
                                <td className="py-0.5 px-3 whitespace-pre overflow-x-hidden">
                                  {line.content}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* OPTIONAL COLLAPSIBLE STRUCTURAL TABLE */}
                  {showStructuralTable && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {t('utilities.json_studio.diff_result_title', 'Structural Comparison')}
                      </span>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="py-2 px-3">{t('utilities.json_studio.th_path', 'JSON Path')}</th>
                              <th className="py-2 px-3">{t('utilities.json_studio.th_diff_type', 'Diff')}</th>
                              <th className="py-2 px-3">{t('utilities.json_studio.th_value_a', 'Value in A')}</th>
                              <th className="py-2 px-3">{t('utilities.json_studio.th_value_b', 'Value in B')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {diffResult.diffs
                              .filter((d) => d.type !== 'unchanged')
                              .map((entry: JsonDiffEntry) => {
                                let badgeClass = 'bg-slate-100 text-slate-600';
                                if (entry.type === 'added') badgeClass = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
                                if (entry.type === 'removed') badgeClass = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
                                if (entry.type === 'changed') badgeClass = 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';

                                return (
                                  <tr key={`diff-${entry.path}-${entry.type}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                      {entry.path}
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${badgeClass}`}>
                                        {entry.type.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-red-600 dark:text-red-400 max-w-xs truncate">
                                      {entry.valA !== undefined ? JSON.stringify(entry.valA) : '-'}
                                    </td>
                                    <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 max-w-xs truncate">
                                      {entry.valB !== undefined ? JSON.stringify(entry.valB) : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </Card>
        </div>
      )}
    </div>
  );
}

interface JsonTreeNodeProps {
  readonly name: string;
  readonly value: unknown;
  readonly searchFilter: string;
  readonly path: string;
  readonly onCopyPath: (path: string) => void;
}

const getJsonValueColorClass = (val: unknown): string => {
  if (typeof val === 'string') return 'text-emerald-600 dark:text-emerald-400';
  if (typeof val === 'number') return 'text-blue-600 dark:text-blue-400';
  if (typeof val === 'boolean') return 'text-purple-600 dark:text-purple-400';
  return 'text-slate-400';
};

function JsonTreeNode({ name, value, searchFilter, path, onCopyPath }: JsonTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isComplex = isObject || isArray;

  const matchesFilter =
    !searchFilter ||
    name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (!isComplex && String(value).toLowerCase().includes(searchFilter.toLowerCase()));

  if (!matchesFilter && !isComplex) {
    return null;
  }

  return (
    <div className="font-mono text-xs pl-3 border-l border-slate-200 dark:border-slate-800 my-0.5">
      <div className="flex items-center gap-1.5 py-0.5 group">
        {isComplex ? (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">
              {isExpanded ? 'expand_more' : 'chevron_right'}
            </span>
          </button>
        ) : (
          <span className="w-3.5 inline-block" />
        )}

        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {name}:
        </span>

        {isComplex ? (
          <span className="text-slate-400 text-[11px]">
            {isArray ? `Array(${(value as any[]).length})` : 'Object'}
          </span>
        ) : (
          <span className={getJsonValueColorClass(value)}>
            {JSON.stringify(value)}
          </span>
        )}

        <button
          type="button"
          onClick={() => onCopyPath(path)}
          title={`Copy path: ${path}`}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-primary transition-opacity cursor-pointer ml-1"
        >
          <span className="material-symbols-outlined text-[12px]">link</span>
        </button>
      </div>

      {isComplex && isExpanded && (
        <div className="flex flex-col">
          {Object.entries(value as Record<string, unknown>).map(([childKey, childVal]) => (
            <JsonTreeNode
              key={childKey}
              name={childKey}
              value={childVal}
              searchFilter={searchFilter}
              path={isArray ? `${path}[${childKey}]` : `${path}.${childKey}`}
              onCopyPath={onCopyPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}
