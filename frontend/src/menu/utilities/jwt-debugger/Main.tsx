import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import FieldLabel from '../../../components/FieldLabel';
import InfoBox from '../../../components/InfoBox';
import StatusBadge from '../../../components/StatusBadge';
import EmptyState from '../../../components/EmptyState';
import Select, { type SelectOption } from '../../../components/Select';
import { useToast } from '../../../context/ToastContext';
import {
  decodeJwt,
  verifyJwtHmac,
  type HmacAlgorithm,
} from '../../../utils/jwtDebugger';

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5OTk5OTk5OTksInJvbGUiOiJhZG1pbiJ9.71N6i4oJ_l0T8xQ8XW7k-gTj1g9fF7q0i4U8tT1y5wE';

const SAMPLE_SECRET = 'your-256-bit-secret';

const ALGO_OPTIONS: ReadonlyArray<SelectOption<HmacAlgorithm>> = [
  { value: 'HS256', label: 'HS256 (SHA-256)' },
  { value: 'HS384', label: 'HS384 (SHA-384)' },
  { value: 'HS512', label: 'HS512 (SHA-512)' },
];

const formatClaimValue = (val: unknown): string => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') return val.toString();
  if (typeof val === 'symbol') return val.toString();
  return JSON.stringify(val) ?? '';
};

export default function JwtDebuggerMain() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [tokenInput, setTokenInput] = useState<string>(SAMPLE_JWT);
  const [secretInput, setSecretInput] = useState<string>(SAMPLE_SECRET);
  const [isSecretVisible, setIsSecretVisible] = useState<boolean>(false);
  const [selectedAlgo, setSelectedAlgo] = useState<HmacAlgorithm>('HS256');
  const [verificationResult, setVerificationResult] = useState<{
    tested: boolean;
    isValid?: boolean;
    error?: string;
  }>({ tested: false });

  const decoded = useMemo(() => {
    return decodeJwt(tokenInput);
  }, [tokenInput]);

  useEffect(() => {
    if (decoded.isValid && decoded.header?.alg) {
      const alg = decoded.header.alg.toUpperCase();
      if (alg === 'HS256' || alg === 'HS384' || alg === 'HS512') {
        setSelectedAlgo(alg as HmacAlgorithm);
      }
    }
    setVerificationResult({ tested: false });
  }, [decoded]);

  const handleVerify = async () => {
    if (!tokenInput.trim()) {
      showToast(t('utilities.jwt_debugger.empty_token', 'Please enter a JWT token'), 'error');
      return;
    }
    if (!secretInput) {
      showToast(t('utilities.jwt_debugger.empty_secret', 'Please enter a secret key'), 'error');
      return;
    }

    const res = await verifyJwtHmac(tokenInput, secretInput, selectedAlgo);
    setVerificationResult({
      tested: true,
      isValid: res.isValid,
      error: res.error,
    });

    if (res.isValid) {
      showToast(t('utilities.jwt_debugger.signature_valid', 'Signature verified successfully!'), 'success');
    } else {
      showToast(t('utilities.jwt_debugger.signature_invalid', 'Signature verification failed'), 'error');
    }
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(t('common.copied_to_clipboard', 'Copied to clipboard'), 'success');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('utilities.jwt_debugger.title', 'JWT Decoder & Inspector')}
        subtitle={t(
          'utilities.jwt_debugger.subtitle',
          'Decode JWT claims, check expiration status, and verify HMAC signatures offline.'
        )}
        icon="vpn_key"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: TOKEN INPUT & HMAC VERIFICATION */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card
            title={t('utilities.jwt_debugger.input_title', 'Encoded JWT Token')}
            gridCols="grid-cols-1"
            headerActions={
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTokenInput(SAMPLE_JWT);
                    setSecretInput(SAMPLE_SECRET);
                  }}
                >
                  {t('utilities.jwt_debugger.btn_sample', 'Sample')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTokenInput('');
                    setVerificationResult({ tested: false });
                  }}
                >
                  {t('common.clear', 'Clear')}
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-3">
              <FieldLabel
                htmlFor="jwt-token-input"
                visuallyHidden
              >
                {t('utilities.jwt_debugger.label_token', 'JWT Token')}
              </FieldLabel>
              <textarea
                id="jwt-token-input"
                rows={9}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 resize-y break-all"
              />

              {!decoded.isValid && tokenInput.trim() && (
                <InfoBox tone="danger" icon="error">{decoded.error}</InfoBox>
              )}
            </div>
          </Card>

          {/* HMAC SIGNATURE VERIFICATION CARD */}
          <Card
            title={t('utilities.jwt_debugger.verify_title', 'Offline HMAC Verification')}
            gridCols="grid-cols-1"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <FieldLabel
                  htmlFor="jwt-secret-input"
                  className="text-xs"
                >
                  {t('utilities.jwt_debugger.label_secret', 'Secret Key / HMAC Passphrase')}
                </FieldLabel>
                <div className="relative flex items-center">
                  <input
                    id="jwt-secret-input"
                    type={isSecretVisible ? 'text' : 'password'}
                    value={secretInput}
                    onChange={(e) => {
                      setSecretInput(e.target.value);
                      setVerificationResult({ tested: false });
                    }}
                    placeholder="your-secret-key"
                    className="w-full text-xs font-mono px-3 py-2 pr-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setIsSecretVisible(!isSecretVisible)}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isSecretVisible ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel
                  htmlFor="jwt-algo-select"
                  className="text-xs"
                >
                  {t('utilities.jwt_debugger.label_algo', 'Algorithm')}
                </FieldLabel>
                <Select
                  id="jwt-algo-select"
                  options={ALGO_OPTIONS}
                  value={selectedAlgo}
                  onChange={(val) => {
                    setSelectedAlgo(val);
                    setVerificationResult({ tested: false });
                  }}
                  size="sm"
                  searchable={false}
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                fullWidth
                icon="verified_user"
                onClick={handleVerify}
              >
                {t('utilities.jwt_debugger.btn_verify', 'Verify Signature')}
              </Button>

              {verificationResult.tested && (
                <div
                  className={`p-3 rounded-lg border flex items-center gap-2.5 text-xs font-medium ${
                    verificationResult.isValid
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {verificationResult.isValid ? 'check_circle' : 'error'}
                  </span>
                  <span>
                    {verificationResult.isValid
                      ? t('utilities.jwt_debugger.status_valid', 'Signature Verified! Secret is valid.')
                      : verificationResult.error ||
                        t('utilities.jwt_debugger.status_invalid', 'Invalid Signature')}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: DECODED CLAIMS & TIMESTAMPS */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {decoded.isValid ? (
            <>
              {/* TIMESTAMPS & EXPIRATION CARD */}
              {decoded.timestamps && (
                <Card
                  title={t('utilities.jwt_debugger.card_timestamps_title', 'Token Lifecycle & Expiration')}
                  gridCols="grid-cols-1"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* EXP */}
                    {decoded.timestamps.exp ? (
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            exp (Expiration)
                          </span>
                          <StatusBadge
                            status={
                              decoded.timestamps.exp.isExpired
                                ? t('utilities.jwt_debugger.status_expired', 'Expired')
                                : t('utilities.jwt_debugger.status_active', 'Active')
                            }
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-800 dark:text-slate-200 font-semibold">
                          {decoded.timestamps.exp.formatted}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {decoded.timestamps.exp.diffText} ({decoded.timestamps.exp.timestamp})
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>exp (Expiration)</span>
                        <span className="italic">{t('utilities.jwt_debugger.no_exp', 'Never expires')}</span>
                      </div>
                    )}

                    {/* IAT */}
                    {decoded.timestamps.iat && (
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          iat (Issued At)
                        </span>
                        <span className="text-xs font-mono text-slate-800 dark:text-slate-200 font-semibold">
                          {decoded.timestamps.iat.formatted}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {decoded.timestamps.iat.diffText} ({decoded.timestamps.iat.timestamp})
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* HEADER CARD */}
              <Card
                title={t('utilities.jwt_debugger.card_header_title', 'Header (JOSE)')}
                gridCols="grid-cols-1"
                headerActions={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopy(JSON.stringify(decoded.header, null, 2))}
                  >
                    <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>
                    {t('common.copy', 'Copy')}
                  </Button>
                }
              >
                <pre className="font-mono text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-red-600 dark:text-red-400 overflow-x-auto">
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
              </Card>

              {/* PAYLOAD CLAIMS CARD */}
              <Card
                title={t('utilities.jwt_debugger.card_payload_title', 'Payload (Claims)')}
                gridCols="grid-cols-1"
                headerActions={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopy(JSON.stringify(decoded.payload, null, 2))}
                  >
                    <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>
                    {t('common.copy', 'Copy')}
                  </Button>
                }
              >
                <div className="flex flex-col gap-4">
                  <pre className="font-mono text-xs p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-purple-600 dark:text-purple-400 overflow-x-auto max-h-72">
                    {JSON.stringify(decoded.payload, null, 2)}
                  </pre>

                  {/* Claims Breakdown Table */}
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-3">{t('utilities.jwt_debugger.th_claim', 'Claim')}</th>
                          <th className="py-2 px-3">{t('utilities.jwt_debugger.th_value', 'Value')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {Object.entries(decoded.payload || {}).map(([key, val]) => (
                          <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-300">
                              {key}
                            </td>
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-200 break-all">
                              {formatClaimValue(val)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <EmptyState
              icon="vpn_key"
              title={t('utilities.jwt_debugger.empty_title', 'No Decoded Token')}
              description={t(
                'utilities.jwt_debugger.empty_desc',
                'Enter or paste a valid JWT token on the left panel to inspect its header, payload claims, and expiration details.'
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
