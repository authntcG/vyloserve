import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AiChatMessage from '../../../../../src/menu/tools/ai-assistant/components/AiChatMessage';
import { ToastProvider } from '../../../../../src/context/ToastContext';
import { AlertProvider } from '../../../../../src/context/AlertContext';

function renderMsg(message: any) {
    return render(
        <ToastProvider>
            <AlertProvider>
                <AiChatMessage message={message} />
            </AlertProvider>
        </ToastProvider>
    );
}

describe('AiChatMessage', () => {
    beforeEach(() => {
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it('renders user message with appropriate styling and timestamp', () => {
        renderMsg({
            id: 'u1',
            role: 'user',
            content: 'How to fix port 80 collision?',
            timestamp: Date.now(),
        });

        expect(screen.getByText('How to fix port 80 collision?')).toBeInTheDocument();
        const bubble = screen.getByText('How to fix port 80 collision?').closest('div');
        expect(bubble?.className).toContain('bg-primary');
    });

    it('renders assistant message with code blocks and language badge', () => {
        const markdown = 'Here is the Apache command:\n```bash\nhttpd -k restart\n```\nDone!';
        renderMsg({
            id: 'a1',
            role: 'assistant',
            content: markdown,
            model: 'gemini-2.0-flash',
            timestamp: Date.now(),
        });

        expect(screen.getByText('Here is the Apache command:')).toBeInTheDocument();
        expect(screen.getByText('httpd -k restart')).toBeInTheDocument();
        expect(screen.getByText('bash')).toBeInTheDocument();
        expect(screen.getByText('Done!')).toBeInTheDocument();
    });

    it('copies code when clicking the copy code block button', async () => {
        const markdown = '```apache\nListen 8080\n```';
        renderMsg({
            id: 'a2',
            role: 'assistant',
            content: markdown,
            timestamp: Date.now(),
        });

        const copyBtns = screen.getAllByRole('button', { name: /copy/i });
        expect(copyBtns.length).toBeGreaterThanOrEqual(1);
        fireEvent.click(copyBtns[0]);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Listen 8080');
    });

    it('renders error notice when message has error', () => {
        renderMsg({
            id: 'a3',
            role: 'assistant',
            content: '',
            error: 'backend.ai.connection_failed',
            timestamp: Date.now(),
        });

        expect(screen.getByText('backend.ai.connection_failed')).toBeInTheDocument();
    });

    it('toggles context view and allows copying attached server context', async () => {
        renderMsg({
            id: 'u2',
            role: 'user',
            content: 'Check server status',
            context: 'Active Screen: apache\nListening on port: 80',
            timestamp: Date.now(),
        });

        const toggleBtn = screen.getByRole('button', { name: /context/i });
        expect(toggleBtn).toBeInTheDocument();
        expect(screen.queryByText(/active screen: apache/i)).not.toBeInTheDocument();

        // Expand context
        fireEvent.click(toggleBtn);
        expect(screen.getByText(/attached server context/i)).toBeInTheDocument();
        expect(screen.getByText(/active screen: apache/i)).toBeInTheDocument();

        // Copy context
        const copyContextBtn = screen.getByTitle(/copy context/i);
        expect(copyContextBtn).toBeInTheDocument();
        fireEvent.click(copyContextBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Active Screen: apache\nListening on port: 80');

        // Collapse context
        const hideBtn = screen.getByRole('button', { name: /hide context/i });
        fireEvent.click(hideBtn);
        expect(screen.queryByText(/attached server context/i)).not.toBeInTheDocument();
    });

    it('renders context card with full width and break-all to prevent horizontal clipping', () => {
        renderMsg({
            id: 'u3',
            role: 'user',
            content: 'Check server status',
            context: 'Active Screen: apache\nLongTokenPath: D:\\Projects\\Python\\vyloserve\\bin\\apache\\2.4.58\\conf\\httpd.conf',
            timestamp: Date.now(),
        });

        const toggleBtn = screen.getByRole('button', { name: /context/i });
        fireEvent.click(toggleBtn);

        const pre = screen.getByText(/longtokenpath/i).closest('pre');
        expect(pre?.className).toContain('break-all');
        expect(pre?.className).toContain('whitespace-pre-wrap');

        const contextCard = pre?.closest('.rounded-xl');
        expect(contextCard?.className).toContain('max-w-full');
        expect(contextCard?.className).not.toContain('sm:max-w-md');
    });

    it('renders source citation badges under assistant message when sources are provided', () => {
        renderMsg({
            id: 'a4',
            role: 'assistant',
            content: 'Apache is running on port 8080.',
            sources: [
                { type: 'system', label: 'VyloServe System Environment' },
                { type: 'doc', label: 'Apache HTTP Server (docs/user_guide.md)', id: 'apache' },
                { type: 'log', label: 'Apache Error Log (error.log)' }
            ],
            timestamp: Date.now(),
        });

        expect(screen.getByText('VyloServe System Environment')).toBeInTheDocument();
        expect(screen.getByText('Apache HTTP Server (docs/user_guide.md)')).toBeInTheDocument();
        expect(screen.getByText('Apache Error Log (error.log)')).toBeInTheDocument();
        expect(screen.getByText(/sources/i)).toBeInTheDocument();
    });

    it('parses vylo_action code blocks and renders AiActionCard instead of raw code', () => {
        const contentWithAction = 'Saya dapat membantu menyalakan Apache.\n\n```vylo_action\n{\n  "service": "apache",\n  "action": "start",\n  "target": "2.4.58",\n  "label": "Mulai Apache 2.4.58"\n}\n```\nSilakan konfirmasi di bawah.';
        renderMsg({
            id: 'a5',
            role: 'assistant',
            content: contentWithAction,
            timestamp: Date.now(),
        });

        expect(screen.getByText('Saya dapat membantu menyalakan Apache.')).toBeInTheDocument();
        expect(screen.getByText('Silakan konfirmasi di bawah.')).toBeInTheDocument();
        expect(screen.queryByText(/```vylo_action/i)).not.toBeInTheDocument();
        expect(screen.getByText('Mulai Apache 2.4.58')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /confirm & execute/i })).toBeInTheDocument();
    });

    it('parses JSON array in vylo_action and renders multiple AiActionCards with header', () => {
        const contentWithMultiAction = `Saya akan membantu menyalakan server Apache dan database MySQL.\n\n\`\`\`vylo_action\n[\n  {\n    "service": "apache",\n    "action": "start",\n    "label": "Mulai Apache"\n  },\n  {\n    "service": "database",\n    "action": "start",\n    "target": "mysql_8_0_35",\n    "label": "Mulai MySQL 8.0.35"\n  }\n]\n\`\`\`\nSilakan konfirmasi aksi di bawah.`;
        renderMsg({
            id: 'a6',
            role: 'assistant',
            content: contentWithMultiAction,
            timestamp: Date.now(),
        });

        expect(screen.getByText('Mulai Apache')).toBeInTheDocument();
        expect(screen.getByText('Mulai MySQL 8.0.35')).toBeInTheDocument();
        expect(screen.getByText(/proposed system actions \(2\)/i)).toBeInTheDocument();
        const confirmBtns = screen.getAllByRole('button', { name: /confirm & execute/i });
        expect(confirmBtns).toHaveLength(2);
    });

    it('copies clean content when clicking the message copy button', () => {
        renderMsg({
            id: 'a7',
            role: 'assistant',
            content: 'Here is the response without action blocks.',
            timestamp: Date.now(),
        });

        const copyBtn = screen.getByRole('button', { name: /copy/i });
        fireEvent.click(copyBtn);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Here is the response without action blocks.');
        expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });

    it('renders assistant message while streaming without footer copy button', () => {
        render(
            <ToastProvider>
                <AlertProvider>
                    <AiChatMessage
                        message={{
                            id: 'a8',
                            role: 'assistant',
                            content: 'Generating answer...',
                            timestamp: Date.now(),
                        }}
                        isStreaming={true}
                    />
                </AlertProvider>
            </ToastProvider>
        );

        expect(screen.getByText('Generating answer...')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
    });

    it('parses vylo_suggestions and removes it from clean content', () => {
        const textWithSuggestions = 'Hello! How can I help?\n\n```vylo_suggestions\n["How to start Apache?", "How to change PHP version?"]\n```';
        renderMsg({
            id: 'a9',
            role: 'assistant',
            content: textWithSuggestions,
            timestamp: Date.now(),
        });

        expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
        expect(screen.queryByText(/vylo_suggestions/i)).not.toBeInTheDocument();
    });
});
