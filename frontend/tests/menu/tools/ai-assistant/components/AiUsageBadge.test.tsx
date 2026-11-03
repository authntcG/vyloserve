import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AiUsageBadge, { formatTokens } from '../../../../../src/menu/tools/ai-assistant/components/AiUsageBadge';
import { useAiAssistant } from '../../../../../src/context/AiContext';

vi.mock('../../../../../src/context/AiContext', () => ({
    useAiAssistant: vi.fn(),
}));

describe('formatTokens', () => {
    it('formats numbers correctly', () => {
        expect(formatTokens(undefined)).toBe('0');
        expect(formatTokens(-5)).toBe('0');
        expect(formatTokens(0)).toBe('0');
        expect(formatTokens(500)).toBe('500');
        expect(formatTokens(1500)).toBe('1.5k');
        expect(formatTokens(2400000)).toBe('2.4M');
    });
});

describe('AiUsageBadge', () => {
    const mockRefreshUsageStats = vi.fn();
    const mockResetUsageStats = vi.fn();

    const defaultUsageStats = {
        today: {
            prompt_tokens: 400,
            completion_tokens: 600,
            total_tokens: 1000,
            requests: 5,
        },
        week: {
            prompt_tokens: 2000,
            completion_tokens: 3000,
            total_tokens: 5000,
            requests: 20,
        },
        rate_limits: {
            'x-ratelimit-remaining-requests': '14900',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useAiAssistant as any).mockReturnValue({
            usageStats: defaultUsageStats,
            refreshUsageStats: mockRefreshUsageStats,
            resetUsageStats: mockResetUsageStats,
            activeProvider: 'gemini',
        });
    });

    it('renders standard badge with today token count', () => {
        render(<AiUsageBadge />);
        expect(screen.getByText('1.0k Tokens')).toBeInTheDocument();
    });

    it('opens and closes popover dialog on click', () => {
        render(<AiUsageBadge />);
        const badgeButton = screen.getByRole('button', { name: /token usage/i });
        fireEvent.click(badgeButton);

        const dialog = screen.getByRole('dialog', { name: /token usage/i });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText(/1[.,]000\s+Tokens/)).toBeInTheDocument();
        expect(screen.getByText(/5[.,]000\s+Tokens/)).toBeInTheDocument();

        // Close button
        const closeBtn = screen.getByRole('button', { name: /close/i });
        fireEvent.click(closeBtn);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders compact mode as icon button', () => {
        render(<AiUsageBadge compact />);
        const iconBtn = screen.getByRole('button', { name: /token usage/i });
        expect(iconBtn).toBeInTheDocument();
        expect(screen.getByText('data_usage')).toBeInTheDocument();
    });

    it('triggers resetUsageStats when reset button is clicked', () => {
        render(<AiUsageBadge />);
        fireEvent.click(screen.getByRole('button', { name: /token usage/i }));

        const resetBtn = screen.getByRole('button', { name: /reset usage/i });
        fireEvent.click(resetBtn);

        expect(mockResetUsageStats).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('triggers refreshUsageStats when refresh button in popover is clicked', () => {
        render(<AiUsageBadge />);
        fireEvent.click(screen.getByRole('button', { name: /token usage/i }));

        const refreshBtn = screen.getByRole('button', { name: /refresh/i });
        fireEvent.click(refreshBtn);

        expect(mockRefreshUsageStats).toHaveBeenCalledTimes(1);
    });
});
