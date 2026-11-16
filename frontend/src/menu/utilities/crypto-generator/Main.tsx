import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Tabs, { type TabItem } from '../../../components/Tabs';
import Button from '../../../components/Button';
import FieldLabel from '../../../components/FieldLabel';
import InfoBox from '../../../components/InfoBox';
import Select, { type SelectOption } from '../../../components/Select';
import { useToast } from '../../../context/ToastContext';

const ROUNDS_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: '4', label: '4 (Fastest - Test only)' },
  { value: '8', label: '8 (Fast)' },
  { value: '10', label: '10 (Default - Standard)' },
  { value: '12', label: '12 (High Security)' },
  { value: '14', label: '14 (Very High Security - Slow)' },
];

const PREFIX_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: '2y', label: '$2y$ (PHP & Laravel Compatible)' },
  { value: '2b', label: '$2b$ (Standard Modular Crypt)' },
];

const ID_KIND_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: 'uuid4', label: 'UUID v4 (Random / Cryptographically Secure)' },
  { value: 'uuid7', label: 'UUID v7 (Time-Ordered RFC 9562)' },
  { value: 'ulid', label: 'ULID (26-char Crockford Base32 Time-Ordered)' },
];

const COUNT_OPTIONS: ReadonlyArray<SelectOption<string>> = [
  { value: '1', label: '1 ID' },
  { value: '5', label: '5 IDs' },
  { value: '10', label: '10 IDs' },
  { value: '25', label: '25 IDs' },
  { value: '50', label: '50 IDs' },
];

export default function CryptoGeneratorMain() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('bcrypt');

  // Tab 1: Bcrypt State
  const [plainPassword, setPlainPassword] = useState<string>('secret123');
  const [showPlainPassword, setShowPlainPassword] = useState<boolean>(false);
  const [rounds, setRounds] = useState<string>('10');
  const [prefix, setPrefix] = useState<string>('2y');
  const [generatedHash, setGeneratedHash] = useState<string>('');
  const [isHashing, setIsHashing] = useState<boolean>(false);

  // Tab 1: Bcrypt Verifier State
  const [verifyPassword, setVerifyPassword] = useState<string>('');
  const [verifyHash, setVerifyHash] = useState<string>('');
  const [verifyResult, setVerifyResult] = useState<{ isMatch?: boolean; message?: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Tab 2: ID Generator State
  const [idKind, setIdKind] = useState<string>('uuid4');
  const [idCount, setIdCount] = useState<string>('5');
  const [isUppercaseIds, setIsUppercaseIds] = useState<boolean>(false);
  const [isHyphenated, setIsHyphenated] = useState<boolean>(true);
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const [isGeneratingIds, setIsGeneratingIds] = useState<boolean>(false);

  // Tab 3: Checksum State
  const [checksumInput, setChecksumInput] = useState<string>('VyloServe Developer Environment');
  const [isUppercaseHashes, setIsUppercaseHashes] = useState<boolean>(false);
  const [hashes, setHashes] = useState<Record<string, string>>({});

  const tabs: TabItem[] = [
    { value: 'bcrypt', label: t('utilities.crypto_generator.tab_bcrypt', 'Bcrypt Password') },
    { value: 'ids', label: t('utilities.crypto_generator.tab_ids', 'UUID & ULID Generator') },
    { value: 'checksum', label: t('utilities.crypto_generator.tab_checksum', 'Text Checksum / Hashes') },
  ];

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(t('common.copied_to_clipboard', 'Copied to clipboard'), 'success');
  };

  // Generate Bcrypt
  const handleGenerateBcrypt = async () => {
    if (!plainPassword) return;
    setIsHashing(true);
    try {
      const api = (window as any).pywebview?.api;
      if (api?.generate_bcrypt_hash) {
        const res = await api.generate_bcrypt_hash(plainPassword, Number.parseInt(rounds, 10), prefix);
        if (res.status === 'success' && res.hash) {
          setGeneratedHash(res.hash);
          showToast(t('common.success', 'Success'), 'success');
        } else {
          showToast(t(res.message || 'backend.crypto.hash_error', res.args || {}) as string, 'error');
        }
      } else {
        // Fallback demo for standalone testing
        setGeneratedHash(`$${prefix}$${rounds}$mockedBcryptHashForTestOnly1234567890`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to hash password', 'error');
    } finally {
      setIsHashing(false);
    }
  };

  // Verify Bcrypt
  const handleVerifyBcrypt = async () => {
    if (!verifyPassword || !verifyHash) return;
    setIsVerifying(true);
    try {
      const api = (window as any).pywebview?.api;
      if (api?.verify_bcrypt_hash) {
        const res = await api.verify_bcrypt_hash(verifyPassword, verifyHash);
        if (res.status === 'success') {
          setVerifyResult({ isMatch: res.is_match, message: res.message });
        } else {
          showToast(t(res.message || 'backend.crypto.verify_error', res.args || {}) as string, 'error');
        }
      } else {
        setVerifyResult({ isMatch: true, message: 'backend.crypto.verify_match' });
      }
    } catch (err: any) {
      showToast(err?.message || 'Verification error', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Generate IDs
  const handleGenerateIds = async () => {
    setIsGeneratingIds(true);
    try {
      const api = (window as any).pywebview?.api;
      if (api?.generate_crypto_ids) {
        const res = await api.generate_crypto_ids(idKind, Number.parseInt(idCount, 10));
        if (res.status === 'success' && res.ids) {
          setGeneratedIds(res.ids);
        }
      } else {
        // Fallback demo
        const demoList = Array.from({ length: Number.parseInt(idCount, 10) }, (_, i) => `018f3a2b-7c4e-4f0a-8d1e-${String(i).padStart(12, '0')}`);
        setGeneratedIds(demoList);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate IDs', 'error');
    } finally {
      setIsGeneratingIds(false);
    }
  };

  // Real-time Text Hashes calculation
  useEffect(() => {
    let isCancelled = false;
    const fetchHashes = async () => {
      if (!checksumInput) {
        setHashes({});
        return;
      }
      try {
        const api = (window as any).pywebview?.api;
        if (api?.generate_text_hashes) {
          const res = await api.generate_text_hashes(checksumInput);
          if (!isCancelled && res.status === 'success' && res.hashes) {
            setHashes(res.hashes);
          }
        }
      } catch {
        // Ignore background tick error
      }
    };

    fetchHashes();
    return () => {
      isCancelled = true;
    };
  }, [checksumInput]);

  // Formatted IDs based on toggles
  const formattedIds = useMemo(() => {
    return generatedIds.map((item) => {
      let str = item;
      if (!isHyphenated && str.includes('-')) {
        str = str.replaceAll('-', '');
      }
      return isUppercaseIds ? str.toUpperCase() : str.toLowerCase();
    });
  }, [generatedIds, isUppercaseIds, isHyphenated]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('utilities.crypto_generator.title', 'Crypto, Bcrypt & Identifier Generator')}
        subtitle={t(
          'utilities.crypto_generator.subtitle',
          'Generate Bcrypt hashes, verify database passwords, bulk generate UUIDs/ULIDs, and calculate checksums offline.'
        )}
        icon="fingerprint"
      />

      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />

      {/* TAB 1: BCRYPT GENERATOR & VERIFIER */}
      {activeTab === 'bcrypt' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bcrypt Generator Card */}
            <Card
              title={t('utilities.crypto_generator.tab_bcrypt', 'Bcrypt Password Generator')}
              gridCols="grid-cols-1"
            >
              <div className="flex flex-col gap-4">
                <div>
                  <FieldLabel htmlFor="bcrypt-plain-input">
                    {t('utilities.crypto_generator.label_password', 'Plain Text Password')}
                  </FieldLabel>
                  <div className="relative">
                    <input
                      id="bcrypt-plain-input"
                      type={showPlainPassword ? 'text' : 'password'}
                      value={plainPassword}
                      onChange={(e) => setPlainPassword(e.target.value)}
                      placeholder="Enter password to hash..."
                      className="w-full text-xs font-mono px-3 py-2 pr-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPlainPassword(!showPlainPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title={showPlainPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {showPlainPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="bcrypt-rounds-select">
                      {t('utilities.crypto_generator.label_rounds', 'Cost Factor (Rounds: 4 - 14)')}
                    </FieldLabel>
                    <Select
                      id="bcrypt-rounds-select"
                      size="sm"
                      searchable={false}
                      options={ROUNDS_OPTIONS}
                      value={rounds}
                      onChange={setRounds}
                    />
                  </div>

                  <div>
                    <FieldLabel htmlFor="bcrypt-prefix-select">
                      {t('utilities.crypto_generator.label_prefix', 'Hash Prefix')}
                    </FieldLabel>
                    <Select
                      id="bcrypt-prefix-select"
                      size="sm"
                      searchable={false}
                      options={PREFIX_OPTIONS}
                      value={prefix}
                      onChange={setPrefix}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateBcrypt}
                    disabled={!plainPassword || isHashing}
                    className="w-full sm:w-auto"
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">lock</span>
                    {isHashing ? 'Hashing...' : t('utilities.crypto_generator.btn_generate_hash', 'Generate Bcrypt Hash')}
                  </Button>
                </div>

                {generatedHash && (
                  <div className="flex flex-col gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <FieldLabel htmlFor="bcrypt-output-hash">
                      {t('utilities.crypto_generator.output_hash', 'Generated Bcrypt Hash')}
                    </FieldLabel>
                    <div className="flex items-center gap-2">
                      <input
                        id="bcrypt-output-hash"
                        type="text"
                        readOnly
                        value={generatedHash}
                        className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-emerald-600 dark:text-emerald-400 font-semibold"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopy(generatedHash)}
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Bcrypt Verifier Card */}
            <Card
              title={t('utilities.crypto_generator.verify_title', 'Verify Password Against Hash')}
              gridCols="grid-cols-1"
            >
              <div className="flex flex-col gap-4">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    'utilities.crypto_generator.verify_subtitle',
                    'Test if a plain password matches an existing Bcrypt hash string.'
                  )}
                </span>

                <div>
                  <FieldLabel htmlFor="verify-plain-input">
                    {t('utilities.crypto_generator.label_password', 'Plain Text Password')}
                  </FieldLabel>
                  <input
                    id="verify-plain-input"
                    type="password"
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    placeholder="Enter password to verify..."
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="verify-hash-input">
                    {t('utilities.crypto_generator.label_hash_to_verify', 'Existing Bcrypt Hash ($2y$, $2b$, $2a$)')}
                  </FieldLabel>
                  <input
                    id="verify-hash-input"
                    type="text"
                    value={verifyHash}
                    onChange={(e) => setVerifyHash(e.target.value)}
                    placeholder="$2y$10$..."
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleVerifyBcrypt}
                    disabled={!verifyPassword || !verifyHash || isVerifying}
                    className="w-full sm:w-auto"
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">check_circle</span>
                    {isVerifying ? 'Verifying...' : t('utilities.crypto_generator.btn_verify_hash', 'Verify Match')}
                  </Button>
                </div>

                {verifyResult && (
                  <div className="pt-2">
                    <InfoBox
                      tone={verifyResult.isMatch ? 'info' : 'danger'}
                      icon={verifyResult.isMatch ? 'verified' : 'error'}
                    >
                      <span className="text-xs font-semibold">
                        {t(verifyResult.message || '', { defaultValue: verifyResult.isMatch ? 'Password matches!' : 'Password does NOT match!' })}
                      </span>
                    </InfoBox>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: UUID & ULID BULK GENERATOR */}
      {activeTab === 'ids' && (
        <Card
          title={t('utilities.crypto_generator.tab_ids', 'UUID & ULID Generator')}
          gridCols="grid-cols-1"
          headerActions={
            formattedIds.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(formattedIds.join('\n'))}
              >
                <span className="material-symbols-outlined text-[16px] mr-1">content_copy</span>
                {t('utilities.crypto_generator.copy_all', 'Copy All')}
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <FieldLabel htmlFor="id-kind-select">
                  {t('utilities.crypto_generator.id_type', 'Identifier Format')}
                </FieldLabel>
                <Select
                  id="id-kind-select"
                  size="sm"
                  searchable={false}
                  options={ID_KIND_OPTIONS}
                  value={idKind}
                  onChange={setIdKind}
                />
              </div>

              <div>
                <FieldLabel htmlFor="id-count-select">
                  {t('utilities.crypto_generator.id_count', 'Quantity (1 - 50)')}
                </FieldLabel>
                <Select
                  id="id-count-select"
                  size="sm"
                  searchable={false}
                  options={COUNT_OPTIONS}
                  value={idCount}
                  onChange={setIdCount}
                />
              </div>

              <div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateIds}
                  disabled={isGeneratingIds}
                  className="w-full"
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">casino</span>
                  {t('utilities.crypto_generator.btn_generate_ids', 'Generate Identifiers')}
                </Button>
              </div>
            </div>

            {/* Options Toggles */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <input
                  id="id-uppercase-toggle"
                  type="checkbox"
                  checked={isUppercaseIds}
                  onChange={(e) => setIsUppercaseIds(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                />
                <FieldLabel htmlFor="id-uppercase-toggle" className="mb-0 cursor-pointer">
                  {t('utilities.crypto_generator.id_uppercase', 'Uppercase (A-Z)')}
                </FieldLabel>
              </div>

              {idKind !== 'ulid' && (
                <div className="flex items-center gap-2">
                  <input
                    id="id-hyphen-toggle"
                    type="checkbox"
                    checked={isHyphenated}
                    onChange={(e) => setIsHyphenated(e.target.checked)}
                    className="rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                  />
                  <FieldLabel htmlFor="id-hyphen-toggle" className="mb-0 cursor-pointer">
                    Include Hyphens (8-4-4-4-12)
                  </FieldLabel>
                </div>
              )}
            </div>

            {/* Results Table */}
            {formattedIds.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden mt-2">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3 w-12 text-right">#</th>
                      <th className="py-2 px-3">Identifier</th>
                      <th className="py-2 px-3 w-16 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {formattedIds.map((val, idx) => (
                      <tr key={`${val}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-3 text-right text-slate-400 select-none">{idx + 1}</td>
                        <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-semibold">{val}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopy(val)}
                            className="p-1 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                            title="Copy ID"
                          >
                            <span className="material-symbols-outlined text-[16px]">content_copy</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* TAB 3: TEXT CHECKSUM / HASHES */}
      {activeTab === 'checksum' && (
        <Card
          title={t('utilities.crypto_generator.tab_checksum', 'Text Checksum & Hash Generator')}
          gridCols="grid-cols-1"
        >
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel htmlFor="checksum-input-text">
                {t('utilities.crypto_generator.input_checksum', 'Input String / Payload')}
              </FieldLabel>
              <textarea
                id="checksum-input-text"
                rows={4}
                value={checksumInput}
                onChange={(e) => setChecksumInput(e.target.value)}
                placeholder="Type or paste plain text here to compute hashes..."
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 resize-y"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="checksum-uppercase-toggle"
                type="checkbox"
                checked={isUppercaseHashes}
                onChange={(e) => setIsUppercaseHashes(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
              />
              <FieldLabel htmlFor="checksum-uppercase-toggle" className="mb-0 cursor-pointer text-xs">
                {t('utilities.crypto_generator.label_uppercase_hash', 'Uppercase Hex (A-F)')}
              </FieldLabel>
            </div>

            {/* Hashes List */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden mt-2">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-28 font-semibold">Algorithm</th>
                    <th className="py-2.5 px-3 font-semibold">Digest</th>
                    <th className="py-2.5 px-3 w-16 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {Object.entries(hashes).map(([algo, rawDigest]) => {
                    const digest = isUppercaseHashes ? rawDigest.toUpperCase() : rawDigest.toLowerCase();
                    return (
                      <tr key={algo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 uppercase">
                          {algo}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 break-all">
                          {digest}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopy(digest)}
                            className="p-1 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                            title={`Copy ${algo} hash`}
                          >
                            <span className="material-symbols-outlined text-[16px]">content_copy</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
