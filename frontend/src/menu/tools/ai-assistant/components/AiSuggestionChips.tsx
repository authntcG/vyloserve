import { useTranslation } from 'react-i18next';

export interface AiSuggestionChipsProps {
    readonly suggestions: readonly string[];
    readonly onSelectSuggestion: (suggestion: string) => void;
    readonly disabled?: boolean;
    readonly className?: string;
}

export default function AiSuggestionChips({
    suggestions,
    onSelectSuggestion,
    disabled = false,
    className = '',
}: AiSuggestionChipsProps) {
    const { t } = useTranslation();

    if (!suggestions || suggestions.length === 0) {
        return null;
    }

    return (
        <section
            className={`flex flex-col gap-1.5 animate-in fade-in duration-200 ${className}`}
            aria-label={t('ai.suggestions_label', 'Suggested follow-up questions')}
        >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 px-1">
                <span className="material-symbols-outlined text-[14px] text-amber-500">lightbulb</span>
                <span>{t('ai.suggested_questions', 'Suggested follow-ups:')}</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-0.5">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelectSuggestion(suggestion)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 hover:bg-primary/5 hover:border-primary/40 dark:hover:bg-primary/10 dark:hover:border-primary/40 text-slate-700 dark:text-slate-200 text-xs font-normal transition-all text-left whitespace-nowrap cursor-pointer shadow-2xs group shrink-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-primary group-hover:scale-110 transition-transform text-[13px]">
                            &rsaquo;
                        </span>
                        <span className="truncate max-w-[280px] md:max-w-[360px]">{suggestion}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
