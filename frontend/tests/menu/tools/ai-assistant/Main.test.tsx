import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import AiAssistantMain from '../../../../src/menu/tools/ai-assistant/Main';
import { AiProvider } from '../../../../src/context/AiContext';
import { ToastProvider } from '../../../../src/context/ToastContext';
import { AlertProvider } from '../../../../src/context/AlertContext';
import { mockPywebviewApi, resetPywebviewApi } from '../../../test-utils';

function renderMain(customHistory: any[] = []) {
    mockPywebviewApi({
        ai_get_chat_history: vi.fn().mockResolvedValue({
            status: 'success',
            data: customHistory,
        }),
        ai_send_message: vi.fn().mockResolvedValue({ status: 'success', message_id: 'msg_test' }),
        ai_get_server_context: vi.fn().mockResolvedValue({ status: 'success', data: 'Server ctx' }),
        save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
    });

    return render(
        <ToastProvider>
            <AlertProvider>
                <AiProvider>
                    <AiAssistantMain />
                </AiProvider>
            </AlertProvider>
        </ToastProvider>
    );
}

describe('AiAssistantMain', () => {
    beforeEach(() => {
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        resetPywebviewApi();
    });

    it('renders page header and model selector with accessibility label', async () => {
        renderMain();

        expect(screen.getByRole('heading', { level: 2, name: /ai assistant/i })).toBeInTheDocument();
        expect(screen.getAllByText(/local server developer copilot/i).length).toBeGreaterThanOrEqual(1);

        // Model selector label must match id (Rule #6 AGENTS.md)
        const select = screen.getByLabelText(/^model$/i);
        expect(select).toBeInTheDocument();
        expect(select.id).toBe('ai-header-model-select');
    });

    it('renders empty state with quick prompt suggestions when no messages exist', async () => {
        renderMain([]);

        await waitFor(() => {
            expect(screen.getByText(/quick questions/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/analyze recent error logs/i)).toBeInTheDocument();
        expect(screen.getByText(/apache virtualhost/i)).toBeInTheDocument();
        expect(screen.getByText(/php\.ini settings/i)).toBeInTheDocument();
    });

    it('clicking a quick prompt populates the input textarea', async () => {
        renderMain([]);

        await waitFor(() => {
            expect(screen.getByText(/analyze recent error logs/i)).toBeInTheDocument();
        });

        const quickBtn = screen.getByText(/analyze recent error logs/i).closest('button')!;
        fireEvent.click(quickBtn);

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.value).toMatch(/analyze recent error logs/i);
    });

    it('renders chat messages when history contains items', async () => {
        const history = [
            { id: '1', role: 'user', content: 'What is Apache?', timestamp: 1000 },
            { id: '2', role: 'assistant', content: 'Apache HTTP Server is a web server.', timestamp: 2000 },
        ];
        renderMain(history);

        await waitFor(() => {
            expect(screen.getByText('What is Apache?')).toBeInTheDocument();
            expect(screen.getByText('Apache HTTP Server is a web server.')).toBeInTheDocument();
        });
    });

    it('submitting prompt via Enter key triggers sendMessage and resets textarea', async () => {
        renderMain([]);

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'How to restart PHP?' } });
        expect(textarea).toHaveValue('How to restart PHP?');

        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(window.pywebview.api.ai_send_message).toHaveBeenCalledWith(
                'How to restart PHP?',
                'Server ctx',
                expect.any(String),
                expect.any(String)
            );
            expect(textarea).toHaveValue('');
        });
    });

    it('has proper accessibility associations between label and prompt textarea', () => {
        renderMain();

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        expect(input.id).toBe('ai-full-prompt-input');
    });

    it('renders New Chat button with add icon and calls scrollIntoView on mount', async () => {
        renderMain([
            { id: '1', role: 'user', content: 'Halo', timestamp: 1000 },
        ]);

        const newChatBtn = screen.getByRole('button', { name: /new chat/i });
        expect(newChatBtn).toBeInTheDocument();
        expect(newChatBtn.textContent).toContain('add');

        await waitFor(() => {
            expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
        });
    });
});
