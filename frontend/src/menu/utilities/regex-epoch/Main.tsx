import { useState, useEffect, useMemo } from 'react';
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
  convertTimestamp,
  dateToTimestamp,
  testRegexPattern,
  type TimestampUnit,
} from '../../../utils/regexEpoch';

const UNIT_OPTIONS: ReadonlyArray<SelectOption<TimestampUnit>> = [
  { value: 'seconds', label: 'Seconds (s)' },
  { value: 'milliseconds', label: 'Milliseconds (ms)' },
  { value: 'microseconds', label: 'Microseconds (µs)' },
];

interface RegexPreset {
  name: string;
  pattern: string;
  flags: string;
  sample: string;
}

const REGEX_PRESETS: RegexPreset[] = [
  {
    name: 'Email Address',
    pattern: String.raw`([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})`,
    flags: 'g',
    sample: 'Contact us at support@vyloserve.dev or admin@test.local for info.',
  },
  {
    name: 'URL / Link',
    pattern: String.raw`https?:\/\/([\w.-]+)(:[0-9]+)?(\/[\w./?%&=-]*)?`,
    flags: 'gi',
    sample: 'Visit https://vyloserve.dev:8080/dashboard or http://localhost:3000/api/v1.',
  },
  {
    name: 'IPv4 Address',
    pattern: String.raw`\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b`,
    flags: 'g',
    sample: 'Local bind addresses: 127.0.0.1 and gateway 192.168.1.1.',
  },
  {
    name: 'UUID',
    pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
    flags: 'g',
    sample: 'Entity ID: 5249f701-ed63-4032-b63e-eab4504673ae created successfully.',
  },
  {
    name: 'Date (YYYY-MM-DD)',
    pattern: String.raw`(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])`,
    flags: 'g',
    sample: 'Events scheduled for 2026-11-14 and 2026-12-31.',
  },
];

export default function RegexEpochMain() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('epoch');

  // Tab 1: Epoch State
  const [currentNowMs, setCurrentNowMs] = useState<number>(Date.now());
  const [isLiveClockPaused, setIsLiveClockPaused] = useState<boolean>(false);

  const [epochInput, setEpochInput] = useState<string>(String(Math.floor(Date.now() / 1000)));
  const [epochUnit, setEpochUnit] = useState<TimestampUnit>('seconds');

  const [dateInput, setDateInput] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });

  // Tab 2: Regex State
  const [regexPattern, setRegexPattern] = useState<string>(String.raw`([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})`);
  const [flagGlobal, setFlagGlobal] = useState<boolean>(true);
  const [flagIgnoreCase, setFlagIgnoreCase] = useState<boolean>(false);
  const [flagMultiline, setFlagMultiline] = useState<boolean>(false);
  const [flagDotAll, setFlagDotAll] = useState<boolean>(false);
  const [regexTestText, setRegexTestText] = useState<string>(
    'Contact support@vyloserve.dev or developer.team@corp.local for inquiries.'
  );

  const tabs: TabItem[] = [
    { value: 'epoch', label: t('utilities.regex_epoch.tab_epoch', 'Unix Epoch & Time') },
    { value: 'regex', label: t('utilities.regex_epoch.tab_regex', 'Regex Tester') },
  ];

  // Live Clock Tick
  useEffect(() => {
    if (isLiveClockPaused) return;
    const interval = setInterval(() => {
      setCurrentNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isLiveClockPaused]);

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(t('common.copied_to_clipboard', 'Copied to clipboard'), 'success');
  };

  // Epoch to Date conversion
  const epochToDateResult = useMemo(() => {
    return convertTimestamp(epochInput, epochUnit);
  }, [epochInput, epochUnit]);

  // Date to Epoch conversion
  const dateToEpochResult = useMemo(() => {
    return dateToTimestamp(dateInput);
  }, [dateInput]);

  // Combined Regex Flags
  const activeFlags = useMemo(() => {
    let f = '';
    if (flagGlobal) f += 'g';
    if (flagIgnoreCase) f += 'i';
    if (flagMultiline) f += 'm';
    if (flagDotAll) f += 's';
    return f;
  }, [flagGlobal, flagIgnoreCase, flagMultiline, flagDotAll]);

  // Regex Execution Result
  const regexResult = useMemo(() => {
    return testRegexPattern(regexPattern, activeFlags, regexTestText);
  }, [regexPattern, activeFlags, regexTestText]);

  // Apply Preset
  const handleApplyPreset = (preset: RegexPreset) => {
    setRegexPattern(preset.pattern);
    setFlagGlobal(preset.flags.includes('g'));
    setFlagIgnoreCase(preset.flags.includes('i'));
    setFlagMultiline(preset.flags.includes('m'));
    setFlagDotAll(preset.flags.includes('s'));
    setRegexTestText(preset.sample);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('utilities.regex_epoch.title', 'Regex Tester & Epoch Converter')}
        subtitle={t(
          'utilities.regex_epoch.subtitle',
          'Test regular expressions with visual match highlights and convert Unix timestamps across timezones.'
        )}
        icon="schedule"
      />

      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />

      {/* TAB 1: UNIX EPOCH & TIME */}
      {activeTab === 'epoch' && (
        <div className="flex flex-col gap-6">
          {/* Live Ticker Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[28px] animate-pulse">
                timer
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {t('utilities.regex_epoch.current_epoch', 'Current Unix Timestamp')}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl md:text-2xl font-mono font-bold text-slate-900 dark:text-white">
                    {Math.floor(currentNowMs / 1000)}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ({currentNowMs} ms)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEpochInput(String(Math.floor(currentNowMs / 1000)))}
              >
                Use in Converter
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsLiveClockPaused(!isLiveClockPaused)}
              >
                <span className="material-symbols-outlined text-[16px] mr-1">
                  {isLiveClockPaused ? 'play_arrow' : 'pause'}
                </span>
                {isLiveClockPaused
                  ? t('utilities.regex_epoch.btn_resume', 'Resume')
                  : t('utilities.regex_epoch.btn_pause', 'Pause')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Timestamp to Date Card */}
            <Card
              title={t('utilities.regex_epoch.epoch_to_date_title', 'Timestamp to Human Date')}
              gridCols="grid-cols-1"
            >
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <FieldLabel htmlFor="epoch-input-value">
                      {t('utilities.regex_epoch.label_epoch_input', 'Unix Timestamp')}
                    </FieldLabel>
                    <input
                      id="epoch-input-value"
                      type="number"
                      value={epochInput}
                      onChange={(e) => setEpochInput(e.target.value)}
                      placeholder="1700000000"
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="epoch-unit-select">Unit</FieldLabel>
                    <Select
                      id="epoch-unit-select"
                      size="sm"
                      searchable={false}
                      options={UNIT_OPTIONS}
                      value={epochUnit}
                      onChange={setEpochUnit}
                    />
                  </div>
                </div>

                {epochToDateResult.isValid ? (
                  <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">
                        {t('utilities.regex_epoch.out_utc', 'UTC Time')}:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {epochToDateResult.utc}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(epochToDateResult.utc || '')}
                          className="p-1 text-slate-400 hover:text-primary cursor-pointer"
                          title="Copy UTC"
                        >
                          <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">
                        {t('utilities.regex_epoch.out_local', 'Local Time')}:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {epochToDateResult.local}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(epochToDateResult.local || '')}
                          className="p-1 text-slate-400 hover:text-primary cursor-pointer"
                          title="Copy Local"
                        >
                          <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">
                        {t('utilities.regex_epoch.out_iso', 'ISO 8601')}:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-primary">
                          {epochToDateResult.iso}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(epochToDateResult.iso || '')}
                          className="p-1 text-slate-400 hover:text-primary cursor-pointer"
                          title="Copy ISO"
                        >
                          <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">
                        {t('utilities.regex_epoch.out_relative', 'Relative Time')}:
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {epochToDateResult.relative}
                      </span>
                    </div>
                  </div>
                ) : (
                  <InfoBox tone="danger" icon="error">
                    {epochToDateResult.error}
                  </InfoBox>
                )}
              </div>
            </Card>

            {/* Human Date to Timestamp Card */}
            <Card
              title={t('utilities.regex_epoch.date_to_epoch_title', 'Human Date to Timestamp')}
              gridCols="grid-cols-1"
            >
              <div className="flex flex-col gap-4">
                <div>
                  <FieldLabel htmlFor="human-date-input">
                    {t('utilities.regex_epoch.label_date_input', 'Date & Time (Local)')}
                  </FieldLabel>
                  <input
                    id="human-date-input"
                    type="datetime-local"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                </div>

                {dateToEpochResult.isValid ? (
                  <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">Epoch Seconds (s):</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {dateToEpochResult.seconds}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(String(dateToEpochResult.seconds || ''))}
                          className="p-1 text-slate-400 hover:text-primary cursor-pointer"
                          title="Copy seconds"
                        >
                          <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-500 font-medium">Epoch Milliseconds (ms):</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {dateToEpochResult.milliseconds}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(String(dateToEpochResult.milliseconds || ''))}
                          className="p-1 text-slate-400 hover:text-primary cursor-pointer"
                          title="Copy ms"
                        >
                          <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <InfoBox tone="danger" icon="error">
                    {dateToEpochResult.error}
                  </InfoBox>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: REGEX TESTER */}
      {activeTab === 'regex' && (
        <Card
          title={t('utilities.regex_epoch.tab_regex', 'Regular Expression Tester')}
          gridCols="grid-cols-1"
        >
          <div className="flex flex-col gap-4">
            {/* Presets Bar */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 mr-1">
                {t('utilities.regex_epoch.presets', 'Presets')}:
              </span>
              {REGEX_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2 py-0.5 rounded text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Pattern Input & Flags */}
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="regex-pattern-input">
                {t('utilities.regex_epoch.regex_pattern', 'Regular Expression')}
              </FieldLabel>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400 font-bold text-sm">/</span>
                <input
                  id="regex-pattern-input"
                  type="text"
                  value={regexPattern}
                  onChange={(e) => setRegexPattern(e.target.value)}
                  placeholder="e.g. ([a-z]+)@([a-z]+)"
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold"
                />
                <span className="font-mono text-slate-400 font-bold text-sm">/</span>
                <span className="font-mono text-xs text-primary font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                  {activeFlags || '-'}
                </span>
              </div>

              {/* Flags Toggles */}
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-600 dark:text-slate-400">
                <label htmlFor="flag-global" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="flag-global"
                    type="checkbox"
                    checked={flagGlobal}
                    onChange={(e) => setFlagGlobal(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>{t('utilities.regex_epoch.flag_global', 'g (Global)')}</span>
                </label>

                <label htmlFor="flag-ignore-case" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="flag-ignore-case"
                    type="checkbox"
                    checked={flagIgnoreCase}
                    onChange={(e) => setFlagIgnoreCase(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>{t('utilities.regex_epoch.flag_ignore_case', 'i (Case-insensitive)')}</span>
                </label>

                <label htmlFor="flag-multiline" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="flag-multiline"
                    type="checkbox"
                    checked={flagMultiline}
                    onChange={(e) => setFlagMultiline(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>{t('utilities.regex_epoch.flag_multiline', 'm (Multiline)')}</span>
                </label>

                <label htmlFor="flag-dot-all" className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    id="flag-dot-all"
                    type="checkbox"
                    checked={flagDotAll}
                    onChange={(e) => setFlagDotAll(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>{t('utilities.regex_epoch.flag_dot_all', 's (DotAll)')}</span>
                </label>
              </div>
            </div>

            {/* Test String */}
            <div>
              <FieldLabel htmlFor="regex-test-text">
                {t('utilities.regex_epoch.test_string', 'Test String')}
              </FieldLabel>
              <textarea
                id="regex-test-text"
                rows={5}
                value={regexTestText}
                onChange={(e) => setRegexTestText(e.target.value)}
                placeholder="Paste test string here..."
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 resize-y leading-5"
              />
            </div>

            {/* Syntax Error if any */}
            {!regexResult.isValid && (
              <InfoBox tone="danger" icon="error">
                {regexResult.error}
              </InfoBox>
            )}

            {/* Matches Breakdown */}
            {regexResult.isValid && (
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      regexResult.totalMatches > 0
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {regexResult.totalMatches > 0
                      ? `${regexResult.totalMatches} ${t('utilities.regex_epoch.matches_found', 'Matches Found')}`
                      : t('utilities.regex_epoch.no_matches', 'No matches found')}
                  </span>
                </div>

                {regexResult.matches.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-[350px] overflow-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                        <tr>
                          <th className="py-2 px-3 w-12 text-right">#</th>
                          <th className="py-2 px-3 w-20">Index</th>
                          <th className="py-2 px-3">Matched Text</th>
                          <th className="py-2 px-3">Capture Groups</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {regexResult.matches.map((item, idx) => (
                          <tr key={`match-${item.index}-${item.match}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-right text-slate-400 select-none">{idx + 1}</td>
                            <td className="py-2 px-3 text-slate-500">pos {item.index}</td>
                            <td className="py-2 px-3 font-semibold text-primary">
                              <span className="bg-primary/10 dark:bg-primary/20 px-1 py-0.5 rounded">
                                {item.match}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              {item.groups.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {item.groups.map((g, gIdx) => (
                                    <span
                                      key={`group-${item.index}-${gIdx}-${g}`}
                                      className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                    >
                                      ${gIdx + 1}: <strong className="font-semibold">{g}</strong>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
