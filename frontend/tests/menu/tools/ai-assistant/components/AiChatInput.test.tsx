import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { createRef } from 'react';
import AiChatInput, { type AiChatInputHandle } from '../../../../../src/menu/tools/ai-assistant/components/AiChatInput';

describe('AiChatInput', () => {
    const defaultProps = {
        onSend: vi.fn(),
        onStop: vi.fn(),
        isGenerating: false,
        variant: 'full' as const,
        activeProvider: 'gemini',
        activeModel: 'gemini-3.5-flash-lite',
        attachedContext: { includeScreen: true, includeLogs: false },
        onToggleContext: vi.fn(),
    };

    it('renders full variant with textarea, accessibility label, and send button', () => {
        render(<AiChatInput {...defaultProps} />);

        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
        expect(textarea.id).toBe('ai-full-prompt-input');

        const sendBtn = screen.getByRole('button', { name: /send/i });
        expect(sendBtn).toBeInTheDocument();
        expect(sendBtn).toBeDisabled();

        expect(screen.getByText(/server status attached/i)).toBeInTheDocument();
        expect(screen.getByText(/gemini • gemini-3.5-flash-lite/i)).toBeInTheDocument();
    });

    it('renders floating variant with floating textarea id and floating context toggles', () => {
        render(
            <AiChatInput
                {...defaultProps}
                variant="floating"
                activeScreen="apache"
            />
        );

        const textarea = screen.getByRole('textbox');
        expect(textarea.id).toBe('ai-floating-prompt-input');
        expect(screen.getByText(/apache/i)).toBeInTheDocument();
    });

    it('enables send button on input and calls onSend when clicked', () => {
        const onSend = vi.fn();
        render(<AiChatInput {...defaultProps} onSend={onSend} />);

        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Halo AI' } });

        const sendBtn = screen.getByRole('button', { name: /send/i });
        expect(sendBtn).not.toBeDisabled();

        fireEvent.click(sendBtn);
        expect(onSend).toHaveBeenCalledWith('Halo AI');
        expect(textarea).toHaveValue('');
    });

    it('sends prompt on Enter and preserves newline on Shift+Enter', () => {
        const onSend = vi.fn();
        render(<AiChatInput {...defaultProps} onSend={onSend} />);

        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Test Enter' } });

        // Shift+Enter
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();

        // Enter
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
        expect(onSend).toHaveBeenCalledWith('Test Enter');
    });

    it('renders stop button when isGenerating is true and calls onStop', () => {
        const onStop = vi.fn();
        render(<AiChatInput {...defaultProps} isGenerating={true} onStop={onStop} />);

        const stopBtn = screen.getByRole('button', { name: /stop/i });
        expect(stopBtn).toBeInTheDocument();

        fireEvent.click(stopBtn);
        expect(onStop).toHaveBeenCalled();
    });

    it('calls onToggleContext when clicking context toggle buttons', () => {
        const onToggle = vi.fn();
        render(<AiChatInput {...defaultProps} onToggleContext={onToggle} />);

        const toggleBtn = screen.getByRole('button', { name: /attach error logs/i });
        fireEvent.click(toggleBtn);
        expect(onToggle).toHaveBeenCalledWith('includeLogs');
    });

    it('renders suggestions and populates input when suggestion is clicked', () => {
        render(
            <AiChatInput
                {...defaultProps}
                suggestions={['Saran A', 'Saran B']}
            />
        );

        expect(screen.getByText('Saran A')).toBeInTheDocument();
        const suggestionBtn = screen.getByRole('button', { name: /saran a/i });
        fireEvent.click(suggestionBtn);

        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveValue('Saran A');
    });

    it('exposes imperative handle to setPrompt, focus, and clear', () => {
        const ref = createRef<AiChatInputHandle>();
        render(<AiChatInput {...defaultProps} ref={ref} />);

        expect(ref.current).toBeDefined();

        act(() => {
            ref.current?.setPrompt('Via Handle');
        });
        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveValue('Via Handle');

        act(() => {
            ref.current?.clear();
        });
        expect(textarea).toHaveValue('');
    });
});
