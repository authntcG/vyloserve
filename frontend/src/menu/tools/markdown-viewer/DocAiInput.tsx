import { useState, useCallback, memo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface DocAiInputProps {
    readonly onSend: (text: string) => void;
    readonly isGenerating: boolean;
    readonly disabled?: boolean;
}

const DocAiInput = memo(function DocAiInput({ onSend, isGenerating, disabled = false }: DocAiInputProps) {
    const { t } = useTranslation();
    const [input, setInput] = useState('');

    const handleSend = useCallback(() => {
        const trimmed = input.trim();
        if (!trimmed || isGenerating || disabled) return;
        onSend(trimmed);
        setInput('');
    }, [input, isGenerating, disabled, onSend]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col gap-1.5 p-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="relative flex items-center">
                <textarea
                    rows={2}
                    value={input}
                    disabled={disabled || isGenerating}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('tools.docs_reader.qa_placeholder')}
                    aria-label={t('tools.docs_reader.qa_placeholder')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 pr-12 text-xs outline-none focus:border-primary text-slate-800 dark:text-slate-200 resize-none custom-scrollbar disabled:opacity-50"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() || isGenerating || disabled}
                    title={t('tools.docs_reader.qa_send')}
                    aria-label={t('tools.docs_reader.qa_send')}
                    className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:hover:bg-primary transition-colors flex items-center justify-center cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                </button>
            </div>
        </div>
    );
});

export default DocAiInput;
