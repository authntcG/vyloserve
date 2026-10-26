import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import AiFloatingWidget from '../../../../../src/menu/tools/ai-assistant/components/AiFloatingWidget';
import { AiProvider } from '../../../../../src/context/AiContext';
import { ToastProvider } from '../../../../../src/context/ToastContext';
import { AlertProvider } from '../../../../../src/context/AlertContext';
import { mockPywebviewApi, resetPywebviewApi } from '../../../../test-utils';

function renderWidget(props: { activeScreen?: string; onOpenFullPage?: () => void } = {}) {
    mockPywebviewApi({
        ai_get_chat_history: vi.fn().mockResolvedValue({ status: 'success', data: [] }),
        ai_send_message: vi.fn().mockResolvedValue({ status: 'success', message_id: 'msg_float' }),
        ai_get_server_context: vi.fn().mockResolvedValue({ status: 'success', data: 'Server ctx' }),
    });

    const onOpen = props.onOpenFullPage || vi.fn();
    const screenName = props.activeScreen || 'dashboard';

    return {
        ...render(
            <ToastProvider>
                <AlertProvider>
                    <AiProvider>
                        <AiFloatingWidget activeScreen={screenName} onOpenFullPage={onOpen} />
                    </AiProvider>
                </AlertProvider>
            </ToastProvider>
        ),
        onOpen,
    };
}

describe('AiFloatingWidget', () => {
    beforeEach(() => {
        localStorage.clear();
        window.innerWidth = 1280;
        window.innerHeight = 800;
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
        window.HTMLElement.prototype.setPointerCapture = vi.fn();
        window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    });

    afterEach(() => {
        localStorage.clear();
        resetPywebviewApi();
    });

    it('returns null and auto-hides when activeScreen is ai-assistant', async () => {
        await act(async () => {
            renderWidget({ activeScreen: 'ai-assistant' });
        });
        expect(screen.queryByRole('button', { name: /vyloserve copilot/i })).not.toBeInTheDocument();
        expect(screen.queryByText('psychology')).not.toBeInTheDocument();
    });

    it('gracefully toggles null when enable_ai_assistant or enable_floating_ai changes without hook errors', async () => {
        renderWidget({ activeScreen: 'dashboard' });

        expect(screen.getByRole('button', { name: /vyloserve copilot/i })).toBeInTheDocument();

        // Toggle enable_ai_assistant to false
        await act(async () => {
            window.dispatchEvent(
                new CustomEvent('vylo_ai_settings_changed', {
                    detail: { enable_ai_assistant: false },
                })
            );
        });
        expect(screen.queryByRole('button', { name: /vyloserve copilot/i })).not.toBeInTheDocument();

        // Re-enable AI assistant but disable floating
        await act(async () => {
            window.dispatchEvent(
                new CustomEvent('vylo_ai_settings_changed', {
                    detail: { enable_ai_assistant: true, enable_floating_ai: false },
                })
            );
        });
        expect(screen.queryByRole('button', { name: /vyloserve copilot/i })).not.toBeInTheDocument();

        // Re-enable floating
        await act(async () => {
            window.dispatchEvent(
                new CustomEvent('vylo_ai_settings_changed', {
                    detail: { enable_ai_assistant: true, enable_floating_ai: true },
                })
            );
        });
        expect(screen.getByRole('button', { name: /vyloserve copilot/i })).toBeInTheDocument();
    });

    it('renders FAB on regular screens and toggles floating window on click', async () => {
        renderWidget({ activeScreen: 'dashboard' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });
        expect(fab).toBeInTheDocument();

        // Click FAB to open floating window
        fireEvent.click(fab);

        // Floating window header & controls should now be visible
        expect(screen.getAllByText(/vyloserve copilot/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('textbox')).toBeInTheDocument();
        expect(screen.getByRole('textbox').id).toBe('ai-floating-prompt-input');
    });

    it('calls onOpenFullPage when dock button in kebab menu is clicked', async () => {
        const { onOpen } = renderWidget({ activeScreen: 'apache' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });
        fireEvent.click(fab);

        // Open kebab menu
        const moreBtn = screen.getByRole('button', { name: /more options/i });
        fireEvent.click(moreBtn);

        const dockBtn = screen.getByRole('button', { name: /open in full page/i });
        expect(dockBtn).toBeInTheDocument();

        fireEvent.click(dockBtn);

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('sends prompt when pressing Enter in textarea', async () => {
        renderWidget({ activeScreen: 'apache' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });
        fireEvent.click(fab);

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'Floating question' } });
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

        await waitFor(() => {
            expect(window.pywebview.api.ai_send_message).toHaveBeenCalledWith(
                'Floating question',
                'Server ctx',
                expect.any(String),
                expect.any(String)
            );
        });
    });

    it('handles pointer dragging and updates position without triggering click toggle', async () => {
        renderWidget({ activeScreen: 'dashboard' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });
        expect(fab).toBeInTheDocument();

        // Start pointer drag
        fireEvent.pointerDown(fab, { clientX: 200, clientY: 200, pointerId: 1, button: 0 });
        fireEvent.pointerMove(fab, { clientX: 300, clientY: 350, pointerId: 1 });
        fireEvent.pointerUp(fab, { pointerId: 1 });

        // Moved distance was > 4px, so clicking shouldn't toggle the popup window
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('anchors popup window dynamically without overflowing viewport boundaries', async () => {
        // Set fixed viewport dimensions for test
        window.innerWidth = 1000;
        window.innerHeight = 700;

        renderWidget({ activeScreen: 'dashboard' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });

        // Click to open popup
        fireEvent.click(fab);

        // Popup should now be open
        const popup = screen.getByRole('textbox').closest('div[style*="position: fixed"]') as HTMLElement;
        expect(popup).toBeInTheDocument();

        // Verify computed style contains clamped left and top
        const leftVal = parseInt(popup.style.left, 10);
        const topVal = parseInt(popup.style.top, 10);
        const widthVal = parseInt(popup.style.width, 10);
        const heightVal = parseInt(popup.style.height, 10);

        expect(leftVal).toBeGreaterThanOrEqual(16);
        expect(leftVal + widthVal).toBeLessThanOrEqual(window.innerWidth - 16);
        expect(topVal).toBeGreaterThanOrEqual(16);
        expect(topVal + heightVal).toBeLessThanOrEqual(window.innerHeight - 16);
    });

    it('renders native copilot empty state and triggers message when quick prompt clicked', async () => {
        renderWidget({ activeScreen: 'apache' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });
        fireEvent.click(fab);

        // "Ready" status badge
        expect(screen.getByText('Ready')).toBeInTheDocument();

        // Find quick prompt button (e.g. bug_report for error logs)
        const quickPromptBtn = screen.getByRole('button', { name: /quick_prompt_logs/i });
        expect(quickPromptBtn).toBeInTheDocument();

        fireEvent.click(quickPromptBtn);

        await waitFor(() => {
            expect(window.pywebview.api.ai_send_message).toHaveBeenCalled();
        });
    });

    it('places popup without overlapping FAB and ensures FAB has higher zIndex than popup', async () => {
        window.innerWidth = 1000;
        window.innerHeight = 700;

        renderWidget({ activeScreen: 'dashboard' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });
        const fabWrapper = fab.closest('div[style*="position: fixed"]') as HTMLElement;
        expect(fabWrapper.style.zIndex).toBe('70');

        fireEvent.click(fab);

        const popup = screen.getByRole('textbox').closest('div[style*="position: fixed"]') as HTMLElement;
        expect(popup).toBeInTheDocument();
        expect(popup.style.zIndex).toBe('65');

        // Check bounding overlap
        const fabLeft = parseInt(fabWrapper.style.left, 10);
        const fabTop = parseInt(fabWrapper.style.top, 10);
        const fabRight = fabLeft + 48;
        const fabBottom = fabTop + 48;

        const popLeft = parseInt(popup.style.left, 10);
        const popTop = parseInt(popup.style.top, 10);
        const popRight = popLeft + parseInt(popup.style.width, 10);
        const popBottom = popTop + parseInt(popup.style.height, 10);

        // Bounding boxes do NOT intersect if one is completely left/right/above/below the other
        const noOverlap =
            fabRight <= popLeft || // FAB is to the left of popup
            fabLeft >= popRight || // FAB is to the right of popup
            fabBottom <= popTop || // FAB is above popup
            fabTop >= popBottom;   // FAB is below popup

        expect(noOverlap).toBe(true);
    });

    it('renders the model switcher using accessible Select component inside kebab menu', async () => {
        renderWidget({ activeScreen: 'dashboard' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });
        fireEvent.click(fab);

        // Open kebab menu
        const moreBtn = screen.getByRole('button', { name: /more options/i });
        fireEvent.click(moreBtn);

        // Select component with id="ai-floating-model-select"
        const selectTrigger = screen.getByLabelText(/^model$/i);
        expect(selectTrigger).toBeInTheDocument();
        expect(selectTrigger.id).toBe('ai-floating-model-select');
    });

    it('renders model name as static label without toggle button, and kebab menu toggles via burger button', async () => {
        renderWidget({ activeScreen: 'dashboard' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });
        fireEvent.click(fab);

        // Model subtitle must be a static text label, not a button
        expect(screen.getByText(/gemini 3.5 flash lite/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /gemini 3.5 flash lite/i })).not.toBeInTheDocument();

        // Open kebab menu via burger options button
        const moreBtn = screen.getByRole('button', { name: /more options/i });
        fireEvent.click(moreBtn);

        // Menu should be open
        expect(screen.getByRole('button', { name: /open in full page/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /ai assistant settings/i })).toBeInTheDocument();

        // Press Escape to close
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('button', { name: /open in full page/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /ai assistant settings/i })).not.toBeInTheDocument();
    });

    it('renders session usage footer in kebab menu with simplified inline stats and no nested popover', async () => {
        renderWidget({ activeScreen: 'dashboard' });

        const fab = screen.getByRole('button', { name: /vyloserve copilot/i });
        fireEvent.click(fab);

        // Open kebab menu
        const moreBtn = screen.getByRole('button', { name: /more options/i });
        fireEvent.click(moreBtn);

        const usageLabel = screen.getByText(/session usage/i);
        expect(usageLabel).toBeInTheDocument();
        expect(usageLabel).toHaveClass('text-slate-700', 'dark:text-slate-200');

        // Verify tokens count and requests count are rendered inline without extra clicks
        expect(screen.getByText(/0 Tokens/i)).toBeInTheDocument();
        expect(screen.getByText(/0 requests/i)).toBeInTheDocument();

        // Ensure there is no secondary button or popup that can get clipped
        expect(screen.queryByRole('button', { name: /token usage/i })).not.toBeInTheDocument();

        const footer = usageLabel.closest('.border-t');
        expect(footer).toBeInTheDocument();
        expect(footer).toHaveClass('bg-slate-100/70', 'dark:bg-slate-800/80');
        expect(footer?.className).not.toContain('slate-850');
    });
});
