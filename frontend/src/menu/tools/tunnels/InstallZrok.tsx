import { useState, forwardRef, useImperativeHandle, useEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/ToastContext';
import { onEnterOrSpace } from '../../../utils/a11y';

export interface InstallZrokRef { submit: () => Promise<boolean>; }

interface OnlineVersion {
    id: string;
    name: string;
    version: string;
}

interface VersionDropdownProps {
    readonly availableVersions: OnlineVersion[];
    readonly filteredVersions: OnlineVersion[];
    readonly selectedVersion: string;
    readonly isFetchingVersions: boolean;
    readonly isDropdownOpen: boolean;
    readonly onToggleDropdown: () => void;
    readonly isInstalling: boolean;
    readonly searchQuery: string;
    readonly onSearchChange: (q: string) => void;
    readonly onSelectVersion: (version: string) => void;
    readonly dropdownRef: RefObject<HTMLDivElement | null>;
    readonly searchInputRef: RefObject<HTMLInputElement | null>;
    readonly t: any;
}

function VersionDropdown({ availableVersions, filteredVersions, selectedVersion, isFetchingVersions, isDropdownOpen, onToggleDropdown, isInstalling, searchQuery, onSearchChange, onSelectVersion, dropdownRef, searchInputRef, t }: VersionDropdownProps) {
    return (
        <div className="flex flex-col gap-2 relative" ref={dropdownRef}>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('tools.zrok.version', 'Zrok Version')}</label>
            {isFetchingVersions ? (
                <div className="h-[42px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg flex items-center px-3 gap-2">
                    <span className="material-symbols-outlined animate-spin text-slate-400 text-sm">sync</span>
                    <span className="text-sm text-slate-500">{t('tools.zrok.retrieving', 'Retrieving versions...')}</span>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={onToggleDropdown}
                    className={`w-full h-[42px] px-3 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm rounded-lg outline-none transition-colors border flex justify-between items-center ${isDropdownOpen ? 'border-primary ring-1 ring-primary' : 'border-slate-300 dark:border-slate-700'} ${availableVersions.length === 0 || isInstalling ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' : 'cursor-pointer'}`}
                >
                    <span className="truncate pr-2">
                        {availableVersions.length === 0 ? t('tools.zrok.fetch_versions_failed') : availableVersions.find(v => v.version === selectedVersion)?.name || t('tools.zrok.select')}
                    </span>
                    <span className={`material-symbols-outlined text-[20px] text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-primary' : ''}`}>
                        expand_more
                    </span>
                </button>
            )}

            {isDropdownOpen && !isInstalling && (
                <div className="absolute top-[70px] left-0 z-50 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">search</span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={t('tools.zrok.find')}
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary transition-colors text-slate-700 dark:text-slate-300"
                            />
                        </div>
                    </div>
                    <div className="max-h-[180px] overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                        {filteredVersions.length > 0 ? (
                            filteredVersions.map(ver => {
                                const isSelected = selectedVersion === ver.version;
                                return (
                                    <div // NOSONAR typescript:S6819
                                        key={ver.version}
                                        onClick={() => onSelectVersion(ver.version)}
                                        onKeyDown={onEnterOrSpace(() => onSelectVersion(ver.version))}
                                        role="option"
                                        aria-selected={isSelected}
                                        tabIndex={0}
                                        className={`px-3 py-2 text-sm rounded-md cursor-pointer transition-colors flex items-center justify-between group ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                    >
                                        <span>{ver.name}</span>
                                        {isSelected && <span className="material-symbols-outlined text-[16px] text-primary">check</span>}
                                    </div>
                                )
                            })
                        ) : (
                            <div className="p-4 text-center text-slate-500 text-sm">
                                {t('tools.zrok.no_versions')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const InstallZrok = forwardRef<InstallZrokRef, any>((_, ref) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    
    const [version, setVersion] = useState('');
    const [versionsList, setVersionsList] = useState<OnlineVersion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const res = await window.pywebview?.api?.get_available_zrok_versions();
                if (res?.status === 'success' && res.data.length > 0) {
                    const mappedVersions = res.data.map((d: any) => ({
                        id: d.id,
                        name: d.label,
                        version: d.value
                    }));
                    setVersionsList(mappedVersions);
                    setVersion(mappedVersions[0].version);
                } else {
                    setVersionsList([]);
                }
            } catch {
                setVersionsList([]);
                showToast(t('tools.zrok.fetch_versions_failed'), 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchVersions();
    }, []);

    useEffect(() => {
        if (isDropdownOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isDropdownOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    useImperativeHandle(ref, () => ({
        submit: async () => {
            if (!version) return false;
            try {
                const res = await window.pywebview?.api?.install_zrok(version);
                if (res?.status === 'success') {
                    showToast((res.message ? t(res.message, res.args || {}) : t('tools.zrok.install_success')) as string, 'success');
                    return true;
                } else {
                    showToast((res?.message ? t(res.message, res.args || {}) : t('tools.zrok.install_failed')) as string, 'error');
                    return false;
                }
            } catch {
                showToast(t('backend.error.unexpected'), 'error');
                return false;
            }
        }
    }));

    const filteredVersions = versionsList.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="flex flex-col gap-4">
            <p className="text-slate-600 dark:text-slate-400">
                Zrok will be downloaded directly from the official openziti/zrok GitHub repository.
            </p>
            <VersionDropdown
                availableVersions={versionsList}
                filteredVersions={filteredVersions}
                selectedVersion={version}
                isFetchingVersions={isLoading}
                isDropdownOpen={isDropdownOpen}
                onToggleDropdown={() => setIsDropdownOpen(!isDropdownOpen)}
                isInstalling={false}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelectVersion={(v) => { setVersion(v); setIsDropdownOpen(false); }}
                dropdownRef={dropdownRef}
                searchInputRef={searchInputRef}
                t={t}
            />
            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 p-4 rounded-lg flex gap-3 text-sm">
                <span className="material-symbols-outlined shrink-0 text-[20px]">info</span>
                <div>{t('tools.zrok.install_info_2')}</div>
            </div>
        </div>
    );
});

export default InstallZrok;
