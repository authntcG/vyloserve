import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { fireEvent, screen } from '../test-utils';
import { renderWithToast } from '../test-utils';
import GlobalAppInterceptor from '../../src/components/AppInterceptor';

function renderWithLogArea() {
    return renderWithToast(
        <>
            <GlobalAppInterceptor />
            <div className="vylo-log-area" data-testid="log-area">log line content</div>
            <div data-testid="other-area">unrelated area</div>
        </>
    );
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GlobalAppInterceptor', () => {
    it('renders nothing until a context-menu event fires inside a .vylo-log-area element', () => {
        renderWithLogArea();
        expect(screen.queryByText('components.interceptor.copy_btn')).not.toBeInTheDocument();
    });

    it('shows the copy menu with the clicked element text when right-clicking inside a .vylo-log-area', () => {
        renderWithLogArea();

        fireEvent.contextMenu(screen.getByTestId('log-area'), { clientX: 50, clientY: 60 });

        expect(screen.getByText('components.interceptor.copy_btn')).toBeInTheDocument();
    });

    it('hides the menu when right-clicking outside a .vylo-log-area element', () => {
        renderWithLogArea();
        fireEvent.contextMenu(screen.getByTestId('log-area'), { clientX: 50, clientY: 60 });
        expect(screen.getByText('components.interceptor.copy_btn')).toBeInTheDocument();

        fireEvent.contextMenu(screen.getByTestId('other-area'));

        expect(screen.queryByText('components.interceptor.copy_btn')).not.toBeInTheDocument();
    });

    it('closes the menu on a regular click', async () => {
        const user = userEvent.setup();
        renderWithLogArea();
        fireEvent.contextMenu(screen.getByTestId('log-area'), { clientX: 50, clientY: 60 });
        expect(screen.getByText('components.interceptor.copy_btn')).toBeInTheDocument();

        await user.click(document.body);

        expect(screen.queryByText('components.interceptor.copy_btn')).not.toBeInTheDocument();
    });

    it('clamps the menu position so it stays within the viewport', () => {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(400);
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(300);
        renderWithLogArea();

        fireEvent.contextMenu(screen.getByTestId('log-area'), { clientX: 9000, clientY: 9000 });

        const menu = screen.getByText('components.interceptor.copy_btn').closest('div')!;
        expect(menu).toHaveStyle({ top: '220px', left: '220px' });
    });

    it('prefers the current text selection over the element text when copying', async () => {
        const user = userEvent.setup();
        vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected snippet' } as unknown as Selection);
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        renderWithLogArea();
        fireEvent.contextMenu(screen.getByTestId('log-area'), { clientX: 10, clientY: 10 });

        await user.click(screen.getByText('components.interceptor.copy_btn'));

        expect(writeText).toHaveBeenCalledWith('selected snippet');
    });

    it('copies the element text, shows a success toast, and closes the menu on success', async () => {
        const user = userEvent.setup();
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        renderWithLogArea();
        fireEvent.contextMenu(screen.getByTestId('log-area'), { clientX: 10, clientY: 10 });

        await user.click(screen.getByText('components.interceptor.copy_btn'));

        expect(writeText).toHaveBeenCalledWith('log line content');
        expect(await screen.findByText('components.interceptor.copy_success')).toBeInTheDocument();
        expect(screen.queryByText('components.interceptor.copy_btn')).not.toBeInTheDocument();
    });

    it('shows an error toast when the clipboard write fails', async () => {
        const user = userEvent.setup();
        const writeText = vi.fn().mockRejectedValue(new Error('denied'));
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        renderWithLogArea();
        fireEvent.contextMenu(screen.getByTestId('log-area'), { clientX: 10, clientY: 10 });

        await user.click(screen.getByText('components.interceptor.copy_btn'));

        expect(await screen.findByText('components.interceptor.copy_error')).toBeInTheDocument();
    });

    it('disables the copy button and does not touch the clipboard when there is no text to copy', async () => {
        const user = userEvent.setup();
        const writeText = vi.fn();
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        renderWithToast(
            <>
                <GlobalAppInterceptor />
                <div className="vylo-log-area" data-testid="empty-log-area"></div>
            </>
        );

        fireEvent.contextMenu(screen.getByTestId('empty-log-area'), { clientX: 10, clientY: 10 });
        const copyButton = screen.getByText('components.interceptor.copy_btn').closest('button')!;
        expect(copyButton).toBeDisabled();

        await user.click(copyButton);

        expect(writeText).not.toHaveBeenCalled();
    });

    it.each([
        ['F12', {}],
        ['s', { ctrlKey: true }],
        ['ArrowLeft', { altKey: true }],
    ])('prevents the default browser action for the %s shortcut', (key, modifiers) => {
        renderWithLogArea();
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });

        window.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
    });

    it('does not intercept a plain, unmodified key press', () => {
        renderWithLogArea();
        const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });

        window.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
    });
});
