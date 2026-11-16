import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ToastProvider } from '../../../../../src/context/ToastContext';
import { AlertProvider } from '../../../../../src/context/AlertContext';
import { AiProvider } from '../../../../../src/context/AiContext';
import AiSettingsModal from '../../../../../src/menu/tools/ai-assistant/components/AiSettingsModal';
import { mockPywebviewApi, resetPywebviewApi } from '../../../../test-utils';

function renderAiSettingsModal(props: { isOpen?: boolean; onClose?: () => void } = {}) {
    const onClose = props.onClose || vi.fn();
    return {
        ...render(
            <ToastProvider>
                <AlertProvider>
                    <AiProvider>
                        <AiSettingsModal isOpen={props.isOpen ?? true} onClose={onClose} />
                    </AiProvider>
                </AlertProvider>
            </ToastProvider>
        ),
        onClose,
    };
}

describe('AiSettingsModal', () => {
    beforeEach(() => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    enable_ai_assistant: true,
                    enable_floating_ai: true,
                    ai_provider: 'gemini',
                    ai_model: 'gemini-3.5-flash-lite',
                    ai_api_key: '',
                    ai_base_url: 'http://localhost:11434/v1',
                },
            }),
            save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_chat_history: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            ai_get_available_models: vi.fn().mockResolvedValue({
                status: 'success',
                data: [
                    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
                    { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
                ],
                tier: 'free',
                is_pro: false,
            }),
            ai_detect_account_tier: vi.fn().mockResolvedValue({
                status: 'success',
                tier: 'free',
                is_pro: false,
                label: 'ai.tier_free',
            }),
            ai_test_connection: vi.fn().mockResolvedValue({
                status: 'success',
                message: 'backend.ai.connection_success',
            }),
            ai_clear_chat_history: vi.fn().mockResolvedValue({ status: 'success' }),
        });
    });

    afterEach(() => {
        resetPywebviewApi();
    });

    it('renders provider select, model select, and API key input when modal is open', async () => {
        renderAiSettingsModal();

        await waitFor(() => {
            expect(screen.getByLabelText(/AI Provider/i)).toBeInTheDocument();
        });

        expect(screen.getByLabelText(/Active Model/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /settings\.enable_ai|enable ai/i })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /settings\.enable_floating|enable floating/i })).toBeChecked();
    });

    it('does not render modal content when isOpen is false', () => {
        renderAiSettingsModal({ isOpen: false });
        expect(screen.queryByLabelText(/AI Provider/i)).not.toBeInTheDocument();
    });

    it('detects free tier when a valid key is entered and blurs', async () => {
        const user = userEvent.setup();
        renderAiSettingsModal();

        const keyInput = await screen.findByPlaceholderText('sk-...');
        await user.type(keyInput, 'AIzaSyFakeValidKey');
        await user.tab();

        await waitFor(() => {
            expect(window.pywebview.api.save_app_settings).toHaveBeenCalledWith({
                ai_api_key: 'AIzaSyFakeValidKey',
            });
        });
    });

    it('displays pro tier badge when account tier is pro', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    ai_provider: 'gemini',
                    ai_api_key: 'AIzaSyProKey',
                },
            }),
            save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_chat_history: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            ai_get_available_models: vi.fn().mockResolvedValue({
                status: 'success',
                data: [
                    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
                ],
                tier: 'pro',
                is_pro: true,
            }),
            ai_detect_account_tier: vi.fn().mockResolvedValue({
                status: 'success',
                tier: 'pro',
                is_pro: true,
            }),
        });

        renderAiSettingsModal();

        await waitFor(() => {
            expect(screen.getByText(/Pro \/ Pay-As-You-Go/i)).toBeInTheDocument();
        });
    });

    it('triggers test connection when clicking the test button', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    ai_provider: 'gemini',
                    ai_api_key: 'AIzaSyValidKey',
                    ai_model: 'gemini-3.5-flash-lite',
                },
            }),
            save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_chat_history: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            ai_get_available_models: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            ai_test_connection: vi.fn().mockResolvedValue({
                status: 'success',
                message: 'backend.ai.connection_success',
            }),
        });

        const user = userEvent.setup();
        renderAiSettingsModal();

        const testBtn = await screen.findByRole('button', { name: /test connection/i });
        await user.click(testBtn);

        await waitFor(() => {
            expect(window.pywebview.api.ai_test_connection).toHaveBeenCalledWith(
                'gemini',
                'AIzaSyValidKey',
                'gemini-3.5-flash-lite',
                expect.any(String)
            );
        });
    });

    it('shows base url input when provider is ollama', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    ai_provider: 'ollama',
                    ai_model: 'llama3.2',
                    ai_base_url: 'http://localhost:11434/v1',
                },
            }),
            save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_chat_history: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            ai_get_available_models: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        });

        renderAiSettingsModal();

        await waitFor(() => {
            expect(screen.getByLabelText(/API Base URL/i)).toBeInTheDocument();
        });
        expect(screen.queryByLabelText(/^API Key$/i)).not.toBeInTheDocument();
    });

    it('toggles password visibility when clicking eye icon', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    ai_provider: 'gemini',
                    ai_api_key: 'secret123',
                },
            }),
            save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_chat_history: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            ai_get_available_models: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        });

        const user = userEvent.setup();
        renderAiSettingsModal();

        const keyInput = (await screen.findByPlaceholderText('sk-...')) as HTMLInputElement;
        expect(keyInput.type).toBe('password');

        const toggleBtn = screen.getByLabelText(/toggle password visibility/i);
        await user.click(toggleBtn);
        expect(keyInput.type).toBe('text');

        await user.click(toggleBtn);
        expect(keyInput.type).toBe('password');
    });

    it('toggles master enable ai assistant switch and saves setting', async () => {
        const user = userEvent.setup();
        const { onClose } = renderAiSettingsModal();

        const toggle = await screen.findByRole('checkbox', { name: /settings\.enable_ai|enable ai/i });
        expect(toggle).toBeChecked();

        await user.click(toggle);

        await waitFor(() => {
            expect(window.pywebview.api.save_app_settings).toHaveBeenCalledWith({
                enable_ai_assistant: false,
            });
        });
    });

    it('applies generous non-clipping modal width and min-w-0 on content container', async () => {
        renderAiSettingsModal();

        const dialog = screen.getByRole('dialog');
        const modalBox = dialog.querySelector('.relative.w-full');
        expect(modalBox).toHaveClass('sm:w-[620px]', 'md:w-[680px]', 'max-w-[calc(100vw-2rem)]');

        // Content container must have min-w-0 to prevent horizontal clipping
        const contentContainer = modalBox?.querySelector('.min-w-0');
        expect(contentContainer).toBeInTheDocument();
        expect(contentContainer).toHaveClass('min-w-0');
    });

    it('renders master toggles card with theme-aware dynamic classes and opacity for disabled state', async () => {
        renderAiSettingsModal();

        const toggleAi = await screen.findByRole('checkbox', { name: /settings\.enable_ai|enable ai/i });
        const section = toggleAi.closest('section');
        expect(section).toBeInTheDocument();
        // Should use valid theme tokens, not non-existent slate-850
        expect(section).toHaveClass('bg-slate-100/70', 'dark:bg-slate-800/60');
        expect(section?.className).not.toContain('slate-850');

        // Toggle off Enable AI to verify disabled opacity
        fireEvent.click(toggleAi);
        const floatingToggle = screen.getByRole('checkbox', { name: /settings\.enable_floating|enable floating/i });
        const floatingRow = floatingToggle.closest('.flex.items-center.justify-between');
        expect(floatingRow).toHaveClass('opacity-50', 'pointer-events-none');
    });

    it('toggles floating AI, auto-context, and adjusts temperature slider', async () => {
        const user = userEvent.setup();
        renderAiSettingsModal();

        // 1. Toggle Floating AI
        const floatingToggle = await screen.findByRole('checkbox', { name: /settings\.enable_floating|enable floating/i });
        expect(floatingToggle).toBeChecked();
        await user.click(floatingToggle);
        expect(window.pywebview.api.save_app_settings).toHaveBeenCalledWith({
            enable_floating_ai: false,
        });

        // 2. Toggle Auto-Context
        const autoContextToggle = screen.getByRole('checkbox', { name: /settings\.ai_auto_context|auto-attach/i });
        await user.click(autoContextToggle);
        expect(window.pywebview.api.save_app_settings).toHaveBeenCalledWith({
            ai_auto_context: false,
        });

        // 3. Adjust Temperature range slider
        const tempSlider = screen.getByLabelText(/temperature/i);
        fireEvent.change(tempSlider, { target: { value: '0.4' } });
        expect(window.pywebview.api.save_app_settings).toHaveBeenCalledWith({
            ai_temperature: 0.4,
        });
    });

    it('saves base URL on blur and selects custom model when provider is ollama', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    ai_provider: 'ollama',
                    ai_model: 'llama3.2',
                    ai_base_url: 'http://localhost:11434/v1',
                },
            }),
            save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_chat_history: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            ai_get_available_models: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        });

        const user = userEvent.setup();
        renderAiSettingsModal();

        // Edit Base URL on blur
        await waitFor(() => {
            expect(screen.getByLabelText(/API Base URL/i)).toBeInTheDocument();
        });
        const baseUrlInput = screen.getByLabelText(/API Base URL/i);
        fireEvent.change(baseUrlInput, { target: { value: 'http://127.0.0.1:11434/v1' } });
        fireEvent.blur(baseUrlInput);
        expect(window.pywebview.api.save_app_settings).toHaveBeenCalledWith({
            ai_base_url: 'http://127.0.0.1:11434/v1',
        });

        // Select Custom Model
        const modelTrigger = screen.getByLabelText(/active model/i);
        await user.click(modelTrigger);
        const customModelOption = await screen.findByRole('option', { name: /custom model name/i });
        fireEvent.click(customModelOption);

        const customInput = await screen.findByPlaceholderText(/gpt-4o, claude-3-5-sonnet/i);
        fireEvent.change(customInput, { target: { value: 'llama3:8b' } });
        fireEvent.blur(customInput);
        expect(window.pywebview.api.save_app_settings).toHaveBeenCalledWith({
            ai_model: 'llama3:8b',
        });

        // Cancel custom model
        const cancelBtn = screen.getByRole('button', { name: /cancel/i });
        await user.click(cancelBtn);
        expect(screen.queryByPlaceholderText(/gpt-4o, claude-3-5-sonnet/i)).not.toBeInTheDocument();
    });

    it('tests connection and clears chat history with confirmation', async () => {
        const user = userEvent.setup();
        renderAiSettingsModal();

        // Wait for initial load
        await waitFor(() => {
            expect(window.pywebview.api.get_app_settings).toHaveBeenCalled();
        });

        // Type an API key so Test Connection button becomes enabled
        const keyInput = await screen.findByPlaceholderText('sk-...');
        await user.type(keyInput, 'AIzaSyTestKey');

        // Test connection
        const testBtn = await screen.findByRole('button', { name: /test connection/i });
        expect(testBtn).toBeEnabled();
        await user.click(testBtn);
        expect(window.pywebview.api.ai_test_connection).toHaveBeenCalled();
        expect((await screen.findAllByText(/connection_success/i)).length).toBeGreaterThanOrEqual(1);

        // Clear chat history
        const deleteHistoryBtn = screen.getByRole('button', { name: /delete/i });
        await user.click(deleteHistoryBtn);

        // Confirmation modal opens
        expect(screen.getAllByText('Clear Chat History?')).toHaveLength(2);
        const allDeleteBtns = screen.getAllByRole('button', { name: /delete/i });
        await user.click(allDeleteBtns[allDeleteBtns.length - 1]);

        expect(window.pywebview.api.ai_clear_chat_history).toHaveBeenCalled();
    });
});
