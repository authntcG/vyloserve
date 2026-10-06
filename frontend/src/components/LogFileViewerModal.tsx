import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import Button from './Button';

interface LogFileViewerModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly title: string;
    readonly fetchContent: () => Promise<any>;
}

// Modal generik untuk menampilkan isi (tail) sebuah file log secara langsung di dalam
// aplikasi -- dipakai oleh Apache (error_log/access_log) dan Database (db_startup.log/
// native error log). `fetchContent` memanggil API pywebview terkait; response mengikuti
// kontrak {status, data?, message?, args?} yang sama seperti API lain di aplikasi ini.
export default function LogFileViewerModal({ isOpen, onClose, title, fetchContent }: LogFileViewerModalProps) {
    const { t } = useTranslation();
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const loadContent = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const res = await fetchContent();
            if (res?.status === 'success') {
                setContent(res.data || '');
            } else {
                setError(res?.message ? (t(res.message, res.args || {}) as string) : t('settings.log_file_fetch_error'));
            }
        } catch (e){ console.error(e);
            setError(t('settings.log_file_fetch_error'));
        } finally {
            setIsLoading(false);
        }
        // 't' sengaja tidak dimasukkan ke deps -- referensinya baru setiap render (lihat mock
        // useTranslation() di tests/setup.ts), sehingga kalau diikutkan efek pemicu-di-bawah akan
        // fetch berulang-ulang setiap render alih-alih hanya sekali saat modal dibuka/refresh ditekan.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchContent]);

    useEffect(() => {
        if (isOpen) loadContent();
    }, [isOpen, loadContent]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            icon="description"
            maxWidthClass="sm:w-[700px]"
            customFooter={
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
                    <Button variant="secondary" icon="refresh" onClick={loadContent} loading={isLoading}>
                        {t('settings.refresh')}
                    </Button>
                    <Button variant="primary" onClick={onClose}>
                        {t('common.close', 'Close')}
                    </Button>
                </div>
            }
        >
            <div className="bg-slate-950 rounded-md p-3 font-mono text-xs leading-relaxed border border-slate-800 shadow-inner overflow-auto max-h-[50vh] min-h-[200px] whitespace-pre-wrap break-all text-slate-300 select-text">
                {isLoading && <div className="text-slate-500 italic select-none">{t('settings.log_file_loading')}</div>}
                {!isLoading && error && <div className="text-red-400">{error}</div>}
                {!isLoading && !error && !content && <div className="text-slate-600 italic select-none">{t('settings.log_file_empty')}</div>}
                {!isLoading && !error && content}
            </div>
        </Modal>
    );
}
