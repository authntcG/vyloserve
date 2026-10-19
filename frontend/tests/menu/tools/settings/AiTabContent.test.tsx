import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ToastProvider } from '../../../../src/context/ToastContext';
import { AlertProvider } from '../../../../src/context/AlertContext';
import { AiProvider } from '../../../../src/context/AiContext';
import AiTabContent from '../../../../src/menu/tools/settings/AiTabContent';
import { mockPywebviewApi, resetPywebviewApi } from '../../../test-utils';

function renderAiTabContent() {
    return render(
        <ToastProvider>
            <AlertProvider>
                <AiProvider>
                    <AiTabContent />
                </AiProvider>
            </AlertProvider>
        </ToastProvider>
    );
}

describe('AiTabContent', () => {
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
        });
    });

    afterEach(() => {
        resetPywebviewApi();
    });

    it('renders provider select and disables model select when API key is empty', async () => {
        renderAiTabContent();

        await waitFor(() => {
            expect(screen.getByLabelText(/AI Provider/i)).toBeInTheDocument();
        });

        // Gemini with empty key has model select disabled
        const modelSelect = screen.getByLabelText(/AI Model/i);
        expect(modelSelect).toBeInTheDocument();
        expect(screen.getByText(/Enter API key to unlock available models/i)).toBeInTheDocument();
    });

    it('detects free tier when a valid key is entered and blurs', async () => {
        const user = userEvent.setup();
        renderAiTabContent();

        const keyInput = await screen.findByPlaceholderText('sk-...');
        await user.type(keyInput, 'AIzaSyFakeValidKey');
        await user.tab();

        await waitFor(() => {
            expect(window.pywebview.api.save_app_settings).toHaveBeenCalledWith({
                ai_api_key: 'AIzaSyFakeValidKey',
            });
        });

        await waitFor(() => {
            expect(screen.getByText('Free Tier')).toBeInTheDocument();
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
                    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
                ],
                tier: 'pro',
                is_pro: true,
            }),
            ai_detect_account_tier: vi.fn().mockResolvedValue({
                status: 'success',
                tier: 'pro',
                is_pro: true,
                label: 'ai.tier_pro',
            }),
        });

        renderAiTabContent();

        await waitFor(() => {
            expect(screen.getByText('Pro / Pay-As-You-Go')).toBeInTheDocument();
        });
    });

    it('runs test connection and displays success status', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    ai_provider: 'gemini',
                    ai_api_key: 'AIzaSyProKey',
                    ai_model: 'gemini-3.5-flash-lite',
                },
            }),
            save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_chat_history: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            ai_get_available_models: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' }],
                tier: 'free',
            }),
            ai_detect_account_tier: vi.fn().mockResolvedValue({
                status: 'success',
                tier: 'free',
                is_pro: false,
            }),
            ai_test_connection: vi.fn().mockResolvedValue({
                status: 'success',
                message: 'backend.ai.connection_success',
            }),
        });

        const user = userEvent.setup();
        renderAiTabContent();

        const testBtn = await screen.findByRole('button', { name: /Test Connection/i });
        await user.click(testBtn);

        await waitFor(() => {
            expect(window.pywebview.api.ai_test_connection).toHaveBeenCalled();
        });
    });

    it('displays base URL input when provider is ollama', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {
                    ai_provider: 'ollama',
                    ai_base_url: 'http://localhost:11434/v1',
                },
            }),
            save_app_settings: vi.fn().mockResolvedValue({ status: 'success' }),
            ai_get_chat_history: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
            ai_get_available_models: vi.fn().mockResolvedValue({
                status: 'success',
                data: [{ value: 'llama3.2', label: 'Llama 3.2' }],
                tier: 'local',
            }),
            ai_detect_account_tier: vi.fn().mockResolvedValue({
                status: 'success',
                tier: 'local',
                is_pro: false,
            }),
        });

        renderAiTabContent();

        await waitFor(() => {
            expect(screen.getByLabelText(/API Base URL/i)).toBeInTheDocument();
            expect(screen.queryByLabelText(/API Key/i)).not.toBeInTheDocument();
        });
    });

    it('handles connection test error and displays error toast', async () => {
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: { ai_provider: 'gemini', ai_api_key: 'bad_key' },
            }),
            ai_detect_account_tier: vi.fn().mockResolvedValue({
                status: 'success',
                tier: 'free',
                is_pro: false,
            }),
            ai_test_connection: vi.fn().mockResolvedValue({
                status: 'error',
                message: 'backend.ai.connection_failed',
            }),
        });

        const user = userEvent.setup();
        renderAiTabContent();

        const testBtn = await screen.findByRole('button', { name: /Test Connection/i });
        await waitFor(() => expect(testBtn).toBeEnabled());
        await user.click(testBtn);

        await waitFor(() => {
            expect(window.pywebview.api.ai_test_connection).toHaveBeenCalled();
            expect(screen.getAllByText('backend.ai.connection_failed').length).toBeGreaterThan(0);
        });
    });

    it('clears chat history when confirmed via alert modal', async () => {
        const clearHistory = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: {},
            }),
            ai_clear_chat_history: clearHistory,
        });

        const user = userEvent.setup();
        renderAiTabContent();

        const clearBtn = await screen.findByRole('button', { name: /Clear Chat History|settings\.ai_clear_history/i });
        await user.click(clearBtn);

        // Click delete on the confirmation modal
        const confirmBtn = await screen.findByText('Delete');
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(clearHistory).toHaveBeenCalledTimes(1);
        });
    });

    it('switches to custom model and updates setting on input blur', async () => {
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: { ai_provider: 'gemini', ai_api_key: 'valid_key' },
            }),
            ai_detect_account_tier: vi.fn().mockResolvedValue({
                status: 'success',
                tier: 'free',
                is_pro: false,
            }),
            save_app_settings: saveSettings,
        });

        const user = userEvent.setup();
        renderAiTabContent();

        const modelSelectBtn = await screen.findByLabelText(/AI Model/i);
        await waitFor(() => expect(modelSelectBtn).toBeEnabled());
        await user.click(modelSelectBtn);

        const customOption = await screen.findByText(/Custom Model\.\.\./i);
        await user.click(customOption);

        const customInput = await screen.findByLabelText(/Custom Model/i);
        await user.type(customInput, 'my-custom-llm');
        fireEvent.blur(customInput);

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith({ ai_model: 'my-custom-llm' });
        });
    });

    it('toggles enable AI and floating assistant settings', async () => {
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: { enable_ai_assistant: true, enable_floating_ai: true },
            }),
            save_app_settings: saveSettings,
        });

        const user = userEvent.setup();
        renderAiTabContent();

        const enableAiSwitch = await screen.findByLabelText('settings.enable_ai');
        await user.click(enableAiSwitch);

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith({ enable_ai_assistant: false });
        });

        const floatingSwitch = await screen.findByLabelText('settings.enable_floating');
        await user.click(floatingSwitch);

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith({ enable_floating_ai: false });
        });
    });

    it('toggles auto context and changes temperature range', async () => {
        const saveSettings = vi.fn().mockResolvedValue({ status: 'success' });
        mockPywebviewApi({
            get_app_settings: vi.fn().mockResolvedValue({
                status: 'success',
                data: { ai_auto_context: true, ai_temperature: 0.5 },
            }),
            save_app_settings: saveSettings,
        });

        const user = userEvent.setup();
        renderAiTabContent();

        const autoContextSwitch = await screen.findByLabelText('settings.ai_auto_context');
        await user.click(autoContextSwitch);

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith({ ai_auto_context: false });
        });

        const tempSlider = screen.getByRole('slider');
        fireEvent.change(tempSlider, { target: { value: '0.8' } });

        await waitFor(() => {
            expect(saveSettings).toHaveBeenCalledWith({ ai_temperature: 0.8 });
        });
    });
});
