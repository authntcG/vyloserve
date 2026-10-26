import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

export interface CompactFileDropzoneProps {
    readonly id?: string;
    readonly label?: string;
    readonly accept?: string;
    readonly currentFileName?: string | null;
    readonly currentFileSize?: number | null;
    readonly currentFileType?: string | null;
    readonly onFileSelected: (file: File, dataUrl: string) => void;
    readonly onClearFile?: () => void;
    readonly compact?: boolean;
    readonly promptText?: string;
    readonly className?: string;
    readonly disabled?: boolean;
}

function formatFileSize(bytes?: number | null): string {
    if (!bytes || bytes <= 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function CompactFileDropzone({
    id = 'file_dropzone',
    label,
    accept,
    currentFileName,
    currentFileSize,
    currentFileType,
    onFileSelected,
    onClearFile,
    compact = false,
    promptText,
    className = '',
    disabled = false,
}: CompactFileDropzoneProps) {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (dataUrl) {
                onFileSelected(file, dataUrl);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (disabled) return;
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const isImage = currentFileType?.startsWith('image/') || /\.(png|jpe?g|svg|webp|gif)$/i.test(currentFileName || '');

    // Render when a file is currently attached
    if (currentFileName) {
        return (
            <div className={`flex items-center justify-between p-2.5 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 ${className}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[20px] text-primary shrink-0">
                        {isImage ? 'image' : 'description'}
                    </span>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate font-mono">
                            {currentFileName}
                        </span>
                        {currentFileSize ? (
                            <span className="text-[10px] text-slate-400 font-mono">
                                {formatFileSize(currentFileSize)} {currentFileType ? `• ${currentFileType}` : ''}
                            </span>
                        ) : null}
                    </div>
                </div>
                {onClearFile && !disabled && (
                    <button
                        type="button"
                        onClick={onClearFile}
                        aria-label={t('common.delete') || 'Remove file'}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                )}
            </div>
        );
    }

    const defaultPrompt = promptText || t('tools.base64.drag_drop_tip') || 'Drag & drop a file here or browse';

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && inputRef.current?.click()}
            className={`transition-all rounded-lg border-2 border-dashed cursor-pointer select-none flex items-center justify-center ${
                isDragging
                    ? 'border-primary bg-primary/10 scale-[0.99]'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:border-primary/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
                compact ? 'py-2 px-3 gap-2' : 'py-5 px-4 flex-col gap-2'
            } ${className}`}
        >
            <input
                ref={inputRef}
                id={id}
                type="file"
                accept={accept}
                onChange={handleInputChange}
                disabled={disabled}
                className="hidden"
                aria-label={label || defaultPrompt}
            />
            <span className={`material-symbols-outlined text-slate-400 shrink-0 ${compact ? 'text-[18px]' : 'text-3xl'}`}>
                upload_file
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center truncate">
                {defaultPrompt}
            </span>
        </div>
    );
}
