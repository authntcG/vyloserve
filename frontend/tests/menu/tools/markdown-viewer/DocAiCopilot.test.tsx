import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ToastProvider } from '../../../../src/context/ToastContext';
import PrivacyConsentModal from '../../../../src/menu/tools/markdown-viewer/PrivacyConsentModal';
import DocAiInput from '../../../../src/menu/tools/markdown-viewer/DocAiInput';
import DocAiDrawer from '../../../../src/menu/tools/markdown-viewer/DocAiDrawer';

const renderWithToast = (ui: React.ReactElement) => render(ui, { wrapper: ToastProvider });

describe('DocAiCopilot & Privacy Guard Suite', () => {
    describe('PrivacyConsentModal', () => {
        it('renders modal with warning and offline local badge for Ollama', () => {
            const onConfirm = vi.fn();
            const onClose = vi.fn();

            render(
                <PrivacyConsentModal
                    isOpen={true}
                    onClose={onClose}
                    onConfirm={onConfirm}
                    providerInfo={{
                        provider: 'ollama',
                        model: 'llama3:latest',
                        is_local: true,
                        is_configured: true,
                    }}
                />
            );

            expect(screen.getByText('tools.docs_reader.privacy_title')).toBeInTheDocument();
            expect(screen.getByText('tools.docs_reader.privacy_desc')).toBeInTheDocument();
            expect(screen.getByText('tools.docs_reader.privacy_warning')).toBeInTheDocument();
            expect(screen.getByText('tools.docs_reader.privacy_local_badge')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'tools.docs_reader.privacy_btn_cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);

            fireEvent.click(screen.getByRole('button', { name: 'tools.docs_reader.privacy_btn_enable' }));
            expect(onConfirm).toHaveBeenCalledTimes(1);
        });

        it('renders cloud badge when provider is non-local (e.g. Gemini/OpenAI)', () => {
            render(
                <PrivacyConsentModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onConfirm={vi.fn()}
                    providerInfo={{
                        provider: 'gemini',
                        model: 'gemini-3.5-flash-lite',
                        is_local: false,
                        is_configured: true,
                    }}
                />
            );

            expect(screen.getByText('tools.docs_reader.privacy_cloud_badge')).toBeInTheDocument();
        });

        it('renders disable button when isAiEnabled is true', () => {
            const onDisable = vi.fn();
            render(
                <PrivacyConsentModal
                    isOpen={true}
                    onClose={vi.fn()}
                    onConfirm={vi.fn()}
                    onDisable={onDisable}
                    isAiEnabled={true}
                />
            );

            const disableBtn = screen.getByRole('button', { name: 'tools.docs_reader.privacy_status_off' });
            expect(disableBtn).toBeInTheDocument();
            fireEvent.click(disableBtn);
            expect(onDisable).toHaveBeenCalledTimes(1);
        });
    });

    describe('DocAiInput', () => {
        it('handles typing and calling onSend when Enter key is pressed', async () => {
            const user = userEvent.setup();
            const onSend = vi.fn();

            render(<DocAiInput onSend={onSend} isGenerating={false} />);
            const textarea = screen.getByRole('textbox', { name: 'tools.docs_reader.qa_placeholder' });

            await user.type(textarea, 'What does this API do?');
            await user.keyboard('{Enter}');

            expect(onSend).toHaveBeenCalledWith('What does this API do?');
        });

        it('disables input when isGenerating is true', () => {
            render(<DocAiInput onSend={vi.fn()} isGenerating={true} />);
            const textarea = screen.getByRole('textbox', { name: 'tools.docs_reader.qa_placeholder' });
            expect(textarea).toBeDisabled();
        });
    });

    describe('DocAiDrawer', () => {
        beforeEach(() => {
            localStorage.clear();
            (window as any).pywebview = {
                api: {
                    ai_doc_query: vi.fn().mockResolvedValue({ status: 'success', message_id: 'doc_123' }),
                    ai_abort_doc_generation: vi.fn().mockResolvedValue({ status: 'success' }),
                },
            };
        });

        it('renders locked privacy screen when isAiEnabled is false', () => {
            const onOpenModal = vi.fn();
            renderWithToast(
                <DocAiDrawer
                    isOpen={true}
                    onClose={vi.fn()}
                    docContent="# Title\nSome content"
                    docPath="/path/doc.md"
                    folderPath="/path"
                    isAiEnabled={false}
                    onOpenPrivacyModal={onOpenModal}
                />
            );

            expect(screen.getAllByText('tools.docs_reader.privacy_status_off').length).toBeGreaterThan(0);
            const enableBtn = screen.getByRole('button', { name: 'tools.docs_reader.privacy_btn_enable' });
            fireEvent.click(enableBtn);
            expect(onOpenModal).toHaveBeenCalledTimes(1);
        });

        it('generates summary and receives streaming chunks when enabled', async () => {
            const user = userEvent.setup();
            renderWithToast(
                <DocAiDrawer
                    isOpen={true}
                    onClose={vi.fn()}
                    docContent={'# Architecture\nOverview of the system'}
                    docPath="/path/arch.md"
                    folderPath="/path"
                    isAiEnabled={true}
                    onOpenPrivacyModal={vi.fn()}
                    providerInfo={{
                        provider: 'ollama',
                        model: 'qwen',
                        is_local: true,
                        is_configured: true,
                    }}
                />
            );

            const summaryBtn = screen.getByRole('button', { name: 'tools.docs_reader.summary_btn' });
            await user.click(summaryBtn);

            expect((window as any).pywebview.api.ai_doc_query).toHaveBeenCalledWith(
                '',
                '# Architecture\nOverview of the system',
                'summary'
            );

            // Simulate incoming chunk
            act(() => {
                window.dispatchEvent(
                    new CustomEvent('vylo_doc_ai_chunk', {
                        detail: {
                            chunk: 'Summary: System architecture overview.',
                            is_done: true,
                            message_id: 'doc_123',
                            error: '',
                        },
                    })
                );
            });

            expect(await screen.findByText('Summary: System architecture overview.')).toBeInTheDocument();
        });

        it('allows asking questions in Q&A tab and aborting with stop button', async () => {
            const user = userEvent.setup();
            renderWithToast(
                <DocAiDrawer
                    isOpen={true}
                    onClose={vi.fn()}
                    docContent={'# Endpoints\nPOST /api/auth'}
                    docPath="/path/api.md"
                    folderPath="/path"
                    isAiEnabled={true}
                    onOpenPrivacyModal={vi.fn()}
                />
            );

            // Switch to Q&A tab
            await user.click(screen.getByRole('button', { name: 'tools.docs_reader.tab_qa' }));
            expect(screen.getByText('tools.docs_reader.qa_empty')).toBeInTheDocument();

            // Ask question
            const input = screen.getByRole('textbox', { name: 'tools.docs_reader.qa_placeholder' });
            await user.type(input, 'What is the auth route?');
            await user.click(screen.getByRole('button', { name: 'tools.docs_reader.qa_send' }));

            expect((window as any).pywebview.api.ai_doc_query).toHaveBeenCalledWith(
                'What is the auth route?',
                '# Endpoints\nPOST /api/auth',
                'qa',
                '',
                '',
                '/path/api.md',
                '/path'
            );

            // Stop button appears and can be clicked
            const stopBtn = screen.getByRole('button', { name: 'tools.docs_reader.stop_generating' });
            await user.click(stopBtn);
            expect((window as any).pywebview.api.ai_abort_doc_generation).toHaveBeenCalledTimes(1);
        });

        it('persists and resumes chat history per folderPath', async () => {
            const user = userEvent.setup();
            localStorage.setItem(
                'vylo_docs_ai_history_/test/folder_a',
                JSON.stringify({
                    qaMessages: [{ id: 'msg_1', role: 'assistant', content: 'Saved answer for folder A' }],
                    summary: 'Saved summary for folder A',
                })
            );

            renderWithToast(
                <DocAiDrawer
                    isOpen={true}
                    onClose={vi.fn()}
                    docContent={'# Doc A'}
                    docPath="/test/folder_a/doc1.md"
                    folderPath="/test/folder_a"
                    isAiEnabled={true}
                    onOpenPrivacyModal={vi.fn()}
                />
            );

            // Verify summary was resumed
            expect(await screen.findByText('Saved summary for folder A')).toBeInTheDocument();

            // Switch to Q&A tab and verify question was resumed
            await user.click(screen.getByRole('button', { name: 'tools.docs_reader.tab_qa' }));
            expect(await screen.findByText('Saved answer for folder A')).toBeInTheDocument();

            // Clear chat button wipes only qaMessages
            const clearBtn = screen.getByRole('button', { name: 'tools.docs_reader.clear_chat' });
            await user.click(clearBtn);
            expect(screen.queryByText('Saved answer for folder A')).not.toBeInTheDocument();

            const saved = JSON.parse(localStorage.getItem('vylo_docs_ai_history_/test/folder_a') || '{}');
            expect(saved.qaMessages).toHaveLength(0);
        });

        it('handles clicking suggestion prompt chips in empty Q&A tab', async () => {
            const user = userEvent.setup();
            renderWithToast(
                <DocAiDrawer
                    isOpen={true}
                    onClose={vi.fn()}
                    docContent={'# Endpoints\nPOST /api/auth'}
                    docPath="/path/api.md"
                    folderPath="/path"
                    isAiEnabled={true}
                    onOpenPrivacyModal={vi.fn()}
                />
            );

            // Switch to Q&A tab
            await user.click(screen.getByRole('button', { name: 'tools.docs_reader.tab_qa' }));
            const chip = screen.getByRole('button', { name: /tools.docs_reader.qa_suggest_summary/i });
            expect(chip).toBeInTheDocument();

            await user.click(chip);
            expect((window as any).pywebview.api.ai_doc_query).toHaveBeenCalledWith(
                'tools.docs_reader.qa_suggest_summary',
                '# Endpoints\nPOST /api/auth',
                'qa',
                '',
                '',
                '/path/api.md',
                '/path'
            );
        });

        it('renders summary error banner with retry button on timeout or failure', async () => {
            const user = userEvent.setup();
            renderWithToast(
                <DocAiDrawer
                    isOpen={true}
                    onClose={vi.fn()}
                    docContent={'# Architecture\nOverview'}
                    docPath="/path/arch.md"
                    folderPath="/path"
                    isAiEnabled={true}
                    onOpenPrivacyModal={vi.fn()}
                />
            );

            const summaryBtn = screen.getByRole('button', { name: 'tools.docs_reader.summary_btn' });
            await user.click(summaryBtn);

            act(() => {
                window.dispatchEvent(
                    new CustomEvent('vylo_doc_ai_chunk', {
                        detail: {
                            chunk: '',
                            is_done: true,
                            message_id: 'doc_sum_123',
                            error: 'backend.ai.timeout',
                        },
                    })
                );
            });

            expect(await screen.findByText('backend.ai.timeout')).toBeInTheDocument();
            const retryBtn = screen.getByRole('button', { name: 'tools.docs_reader.retry' });
            await user.click(retryBtn);

            expect((window as any).pywebview.api.ai_doc_query).toHaveBeenCalledTimes(2);
        });

        it('supports copying assistant answer in Q&A bubble', async () => {
            const user = userEvent.setup();
            const writeTextMock = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: writeTextMock,
                },
                configurable: true,
            });

            localStorage.setItem(
                'vylo_docs_ai_history_/test/copy_folder',
                JSON.stringify({
                    qaMessages: [{ id: 'msg_answer', role: 'assistant', content: 'Detailed API explanation.' }],
                    summary: '',
                })
            );

            renderWithToast(
                <DocAiDrawer
                    isOpen={true}
                    onClose={vi.fn()}
                    docContent={'# Doc'}
                    docPath="/test/copy_folder/doc.md"
                    folderPath="/test/copy_folder"
                    isAiEnabled={true}
                    onOpenPrivacyModal={vi.fn()}
                />
            );

            await user.click(screen.getByRole('button', { name: 'tools.docs_reader.tab_qa' }));
            const copyBtn = screen.getByRole('button', { name: 'tools.docs_reader.copy_answer' });
            await user.click(copyBtn);

            expect(writeTextMock).toHaveBeenCalledWith('Detailed API explanation.');
        });

        it('parses references from AI answer and triggers onOpenFile when clicking citation chip', async () => {
            const user = userEvent.setup();
            const onOpenFile = vi.fn();

            localStorage.setItem(
                'vylo_docs_ai_history_/test/ref_folder',
                JSON.stringify({
                    qaMessages: [{
                        id: 'msg_ref',
                        role: 'assistant',
                        content: 'This explains token usage.\n\nReferences: [specs/oauth.md, guides/setup.md]'
                    }],
                    summary: '',
                })
            );

            renderWithToast(
                <DocAiDrawer
                    isOpen={true}
                    onClose={vi.fn()}
                    docContent={'# Doc'}
                    docPath="/test/ref_folder/doc.md"
                    folderPath="/test/ref_folder"
                    isAiEnabled={true}
                    onOpenPrivacyModal={vi.fn()}
                    onOpenFile={onOpenFile}
                />
            );

            await user.click(screen.getByRole('button', { name: 'tools.docs_reader.tab_qa' }));

            expect(screen.getByText(/tools\.docs_reader\.references/)).toBeInTheDocument();

            const chip1 = screen.getByText('specs/oauth.md').closest('button');
            expect(chip1).toBeInTheDocument();
            const chip2 = screen.getByText('guides/setup.md').closest('button');
            expect(chip2).toBeInTheDocument();

            await user.click(chip1!);
            expect(onOpenFile).toHaveBeenCalledWith('/test/ref_folder/specs/oauth.md');
        });
    });
});
