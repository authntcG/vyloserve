import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import GitLabActionCard from '../../../../../src/menu/tools/ai-assistant/components/GitLabActionCard';

describe('GitLabActionCard', () => {
    beforeEach(() => {
        (window as any).pywebview = {
            api: {
                execute_gitlab_action: vi.fn().mockResolvedValue({
                    status: 'success',
                    message: 'backend.gitlab.comment_success',
                    web_url: 'https://gitlab.com/owner/repo/-/issues/42#note_100',
                }),
                open_external_url: vi.fn(),
            },
        };
    });

    it('renders issue card with preview and buttons', () => {
        render(
            <GitLabActionCard
                action={{
                    service: 'gitlab',
                    action: 'comment_issue',
                    target: '42',
                    params: {
                        repo: 'owner/repo',
                        comment: 'Identified bug in query builder.',
                    },
                }}
            />
        );

        expect(screen.getByText('Issue #42')).toBeInTheDocument();
        expect(screen.getByText('(owner/repo)')).toBeInTheDocument();
        expect(screen.getByText('Identified bug in query builder.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send to gitlab/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    });

    it('allows toggling edit mode and editing the comment', () => {
        render(
            <GitLabActionCard
                action={{
                    service: 'gitlab',
                    action: 'comment_issue',
                    target: '42',
                    params: {
                        repo: 'owner/repo',
                        comment: 'Original comment draft.',
                    },
                }}
            />
        );

        const editBtn = screen.getByRole('button', { name: /edit/i });
        fireEvent.click(editBtn);

        const textarea = screen.getByLabelText(/comment preview/i);
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveValue('Original comment draft.');

        fireEvent.change(textarea, { target: { value: 'Updated comment text.' } });
        expect(textarea).toHaveValue('Updated comment text.');
    });

    it('handles discard action', () => {
        render(
            <GitLabActionCard
                action={{
                    service: 'gitlab',
                    action: 'comment_issue',
                    target: '42',
                    params: {
                        repo: 'owner/repo',
                        comment: 'Draft to discard.',
                    },
                }}
            />
        );

        const discardBtn = screen.getByRole('button', { name: /discard/i });
        fireEvent.click(discardBtn);

        expect(screen.getAllByText(/discard/i).length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: /send to gitlab/i })).not.toBeInTheDocument();
    });

    it('executes send action and shows open web button', async () => {
        const onExecuted = vi.fn();

        render(
            <GitLabActionCard
                action={{
                    service: 'gitlab',
                    action: 'comment_issue',
                    target: '42',
                    params: {
                        repo: 'owner/repo',
                        comment: 'Verified solution.',
                    },
                }}
                onExecuted={onExecuted}
            />
        );

        const sendBtn = screen.getByRole('button', { name: /send to gitlab/i });
        fireEvent.click(sendBtn);

        await waitFor(() => {
            expect((window as any).pywebview.api.execute_gitlab_action).toHaveBeenCalledWith(
                'comment_issue',
                'owner/repo',
                '42',
                { comment: 'Verified solution.' }
            );
            expect(onExecuted).toHaveBeenCalledTimes(1);
        });

        const openBtn = await screen.findByRole('button', { name: /open in gitlab/i });
        fireEvent.click(openBtn);
        expect((window as any).pywebview.api.open_external_url).toHaveBeenCalledWith(
            'https://gitlab.com/owner/repo/-/issues/42#note_100'
        );
    });

    it('handles failure when API returns error', async () => {
        (window as any).pywebview.api.execute_gitlab_action = vi.fn().mockResolvedValue({
            status: 'error',
            message: 'Token expired or permission denied.',
        });

        render(
            <GitLabActionCard
                action={{
                    service: 'gitlab',
                    action: 'comment_issue',
                    target: '99',
                    params: {
                        repo: 'owner/repo',
                        comment: 'Will fail.',
                    },
                }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /send to gitlab/i }));

        await waitFor(() => {
            expect(screen.getByText('Token expired or permission denied.')).toBeInTheDocument();
        });
    });
});
