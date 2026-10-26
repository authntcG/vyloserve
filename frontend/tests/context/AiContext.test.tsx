import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AiProvider, useAiAssistant } from '../../src/context/AiContext';
import { ToastProvider } from '../../src/context/ToastContext';
import { AlertProvider } from '../../src/context/AlertContext';
import { mockPywebviewApi, resetPywebviewApi, dispatchAppEvent } from '../test-utils';

function ConsumerComponent() {
    const {
        messages,
        isGenerating,
        streamingText,
        enableAi,
        activeProvider,
        activeModel,
        availableModels,
        isLoadingModels,
        accountTier,
        isCheckingTier,
        detectAccountTier,
        fetchAvailableModels,
        sendMessage,
        stopGenerating,
        setActiveModel,
        clearChat,
        actionStates,
        setActionState,
    } = useAiAssistant();

    return (
        <div>
            <span data-testid="enable-ai">{String(enableAi)}</span>
            <span data-testid="active-provider">{activeProvider}</span>
            <span data-testid="active-model">{activeModel}</span>
            <span data-testid="is-generating">{String(isGenerating)}</span>
            <span data-testid="streaming-text">{streamingText}</span>
            <span data-testid="message-count">{messages.length}</span>
            <span data-testid="models-count">{availableModels.length}</span>
            <span data-testid="is-loading-models">{String(isLoadingModels)}</span>
            <span data-testid="account-tier">{accountTier}</span>
            <span data-testid="is-checking-tier">{String(isCheckingTier)}</span>
            <span data-testid="action-state-m1">{actionStates['m1:0']?.status || 'none'}</span>
            {messages.map((m) => (
                <div key={m.id} data-testid="msg-item">
                    {m.role}: {m.content}
                </div>
            ))}
            <button type="button" onClick={() => sendMessage('Hello AI', 'dashboard')}>
                send-btn
            </button>
            <button type="button" onClick={stopGenerating}>
                stop-btn
            </button>
            <button type="button" onClick={() => setActiveModel('custom-model-x')}>
                switch-model-btn
            </button>
            <button type="button" onClick={clearChat}>
                clear-btn
            </button>
            <button type="button" onClick={() => fetchAvailableModels('gemini', 'valid-key', '', false)}>
                fetch-models-btn
            </button>
            <button type="button" onClick={() => detectAccountTier('gemini', 'valid-key')}>
                detect-tier-btn
            </button>
            <button type="button" onClick={() => setActionState('m1:0', { status: 'success' })}>
                set-action-btn
            </button>
        </div>
    );
}

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <ToastProvider>
            <AlertProvider>
                <AiProvider>{ui}</AiProvider>
            </AlertProvider>
        </ToastProvider>
    );
}

describe('AiContext', () => {
    beforeEach(() => {
        mockPywebviewApi({
            ai_get_chat_history: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ id: 'm1', role: 'user', content: 'previous hi', timestamp: 1000 }],
            }),
            ai_send_message: vi.fn().mockResolvedValue({ status: 'success', message_id: 'msg_test_1' }),
            ai_abort_generation: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_clear_chat_history: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_server_context: vi.fn().mockResolvedValue({ status: 'success', data: 'Server status context' }),
            save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_available_models: vi.fn().mockResolvedValue({
                status: 'success',
                data: [
                    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
                    { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
                ],
            }),
            ai_detect_account_tier: vi.fn().mockResolvedValue({
                status: 'success',
                tier: 'free',
                is_pro: false,
                label: 'ai.tier_free',
            }),
            ai_get_action_states: vi.fn().mockResolvedValue({
                status: 'success',
                data: {},
            }),
            ai_save_action_states: vi.fn().mockResolvedValue({
                status: 'success',
            }),
        });
    });

    afterEach(() => {
        resetPywebviewApi();
    });

    it('throws error when useAiAssistant is used outside AiProvider', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<ConsumerComponent />)).toThrow(
            'useAiAssistant must be used within an AiProvider'
        );
        consoleError.mockRestore();
    });

    it('loads chat history on mount', async () => {
        renderWithProviders(<ConsumerComponent />);

        await waitFor(() => {
            expect(screen.getByTestId('message-count')).toHaveTextContent('1');
        });
        expect(screen.getByText('user: previous hi')).toBeInTheDocument();
    });

    it('updates state in response to vylo_ai_settings_changed event', async () => {
        renderWithProviders(<ConsumerComponent />);

        act(() => {
            dispatchAppEvent('vylo_ai_settings_changed', {
                enable_ai_assistant: false,
                ai_provider: 'groq',
                ai_model: 'llama-3.3-70b-versatile',
                ai_api_key: 'gsk-key',
            });
        });

        expect(screen.getByTestId('enable-ai')).toHaveTextContent('false');
        expect(screen.getByTestId('active-provider')).toHaveTextContent('groq');
        expect(screen.getByTestId('active-model')).toHaveTextContent('llama-3.3-70b-versatile');
    });

    it('sends message, updates user message in state immediately (optimistic UI), and sets isGenerating', async () => {
        renderWithProviders(<ConsumerComponent />);

        fireEvent.click(screen.getByText('send-btn'));

        // Optimistic UI: user message is rendered in the DOM immediately (0ms latency)
        expect(screen.getByText('user: Hello AI')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('is-generating')).toHaveTextContent('true');
        });
        expect(window.pywebview.api.ai_send_message).toHaveBeenCalledWith(
            'Hello AI',
            'Server status context',
            expect.any(String),
            expect.any(String)
        );
    });

    it('handles streaming chunks and finalizes assistant message on is_done', async () => {
        renderWithProviders(<ConsumerComponent />);

        fireEvent.click(screen.getByText('send-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('is-generating')).toHaveTextContent('true');
        });

        // Emit first chunk
        act(() => {
            dispatchAppEvent('vylo_ai_chunk', {
                chunk: 'First ',
                is_done: false,
                message_id: 'msg_test_1',
            });
        });
        expect(screen.getByTestId('streaming-text')).toHaveTextContent('First');

        // Emit second chunk
        act(() => {
            dispatchAppEvent('vylo_ai_chunk', {
                chunk: 'chunk!',
                is_done: false,
                message_id: 'msg_test_1',
            });
        });
        expect(screen.getByTestId('streaming-text')).toHaveTextContent('First chunk!');

        // Emit completion
        act(() => {
            dispatchAppEvent('vylo_ai_chunk', {
                chunk: '',
                is_done: true,
                message_id: 'msg_test_1',
            });
        });

        expect(screen.getByTestId('is-generating')).toHaveTextContent('false');
        expect(screen.getByTestId('streaming-text')).toHaveTextContent('');
        expect(screen.getByText('assistant: First chunk!')).toBeInTheDocument();
    });

    it('stops generation via stopGenerating', async () => {
        renderWithProviders(<ConsumerComponent />);

        fireEvent.click(screen.getByText('stop-btn'));

        await waitFor(() => {
            expect(window.pywebview.api.ai_abort_generation).toHaveBeenCalledTimes(1);
        });
    });

    it('switches model and saves it to app settings', async () => {
        renderWithProviders(<ConsumerComponent />);

        fireEvent.click(screen.getByText('switch-model-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('active-model')).toHaveTextContent('custom-model-x');
        });
        expect(window.pywebview.api.save_app_settings).toHaveBeenCalledWith({
            ai_model: 'custom-model-x',
        });
    });

    it('fetches dynamic models and updates availableModels', async () => {
        renderWithProviders(<ConsumerComponent />);

        fireEvent.click(screen.getByText('fetch-models-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('models-count')).toHaveTextContent('2');
        });
        expect(window.pywebview.api.ai_get_available_models).toHaveBeenCalledWith(
            'gemini',
            'valid-key',
            '',
            ''
        );
    });

    it('detects account tier and updates accountTier state', async () => {
        renderWithProviders(<ConsumerComponent />);

        fireEvent.click(screen.getByText('detect-tier-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('account-tier')).toHaveTextContent('free');
        });
        expect(window.pywebview.api.ai_detect_account_tier).toHaveBeenCalledWith(
            'gemini',
            'valid-key',
            'http://localhost:11434/v1'
        );
    });

    it('falls back to cached or default models if fetch fails', async () => {
        (window.pywebview.api.ai_get_available_models as any).mockResolvedValueOnce({
            status: 'error',
            message: 'backend.ai.fetch_models_failed',
            args: { e: 'Network error' },
        });

        renderWithProviders(<ConsumerComponent />);

        fireEvent.click(screen.getByText('fetch-models-btn'));

        await waitFor(() => {
            expect(Number(screen.getByTestId('models-count').textContent)).toBeGreaterThan(0);
        });
    });

    it('manages action states and syncs with backend and localStorage', async () => {
        renderWithProviders(<ConsumerComponent />);

        expect(screen.getByTestId('action-state-m1')).toHaveTextContent('none');

        fireEvent.click(screen.getByText('set-action-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('action-state-m1')).toHaveTextContent('success');
        });
        expect(window.pywebview.api.ai_save_action_states).toHaveBeenCalledWith({
            'm1:0': { status: 'success' },
        });
        expect(localStorage.getItem('vylo_ai_action_states')).toBe(JSON.stringify({ 'm1:0': { status: 'success' } }));

        // Clear chat also clears action states
        fireEvent.click(screen.getByText('clear-btn'));
        const deleteBtn = await screen.findByRole('button', { name: /delete/i });
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(screen.getByTestId('action-state-m1')).toHaveTextContent('none');
            expect(localStorage.getItem('vylo_ai_action_states')).toBeNull();
        });
    });
});
