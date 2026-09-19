import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../test-utils';
import Modal from '../../src/components/Modal';

describe('Modal', () => {
    it('renders nothing when closed and not keepMounted', () => {
        const { container } = render(
            <Modal isOpen={false} onClose={vi.fn()} title="Settings">content</Modal>
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('stays mounted (but visually hidden) when closed with keepMounted', () => {
        render(
            <Modal isOpen={false} onClose={vi.fn()} title="Settings" keepMounted>content</Modal>
        );
        expect(screen.getByText('content')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toHaveClass('opacity-0', 'invisible');
    });

    it('renders the title, icon and children when open', () => {
        render(
            <Modal isOpen={true} onClose={vi.fn()} title="Apache Settings" icon="dns">
                <p>body content</p>
            </Modal>
        );
        expect(screen.getByText('Apache Settings')).toBeInTheDocument();
        expect(screen.getByText('dns')).toBeInTheDocument();
        expect(screen.getByText('body content')).toBeInTheDocument();
    });

    it('calls onClose when the header close button is clicked', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Modal isOpen={true} onClose={onClose} title="Settings">content</Modal>);

        await user.click(screen.getAllByTitle('Close')[0]);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the overlay is clicked', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Modal isOpen={true} onClose={onClose} title="Settings">content</Modal>);

        await user.click(screen.getByLabelText('Close'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose from the overlay while isLoading is true', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Modal isOpen={true} onClose={onClose} title="Settings" isLoading>content</Modal>);

        await user.click(screen.getByLabelText('Close'));

        expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when the Escape key is pressed', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Modal isOpen={true} onClose={onClose} title="Settings">content</Modal>);

        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ignores the Escape key while isDestructive is true', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Modal isOpen={true} onClose={onClose} title="Settings" isDestructive>content</Modal>);

        await user.keyboard('{Escape}');

        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not render an Apply button when onApply is not provided', () => {
        render(<Modal isOpen={true} onClose={vi.fn()} title="Settings">content</Modal>);
        expect(screen.queryByText('Apply Changes')).not.toBeInTheDocument();
    });

    it('renders and disables the Apply button based on isApplyDisabled, and calls onApply when clicked', async () => {
        const user = userEvent.setup();
        const onApply = vi.fn();
        const { rerender } = render(
            <Modal isOpen={true} onClose={vi.fn()} title="Settings" onApply={onApply} isApplyDisabled>content</Modal>
        );
        expect(screen.getByText('Apply Changes')).toBeDisabled();

        rerender(<Modal isOpen={true} onClose={vi.fn()} title="Settings" onApply={onApply}>content</Modal>);
        await user.click(screen.getByText('Apply Changes'));

        expect(onApply).toHaveBeenCalledTimes(1);
    });

    it('shows a custom applyText label and a spinner while isLoading', () => {
        render(
            <Modal isOpen={true} onClose={vi.fn()} title="Settings" onApply={vi.fn()} applyText="Save Changes" isLoading>
                content
            </Modal>
        );
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
        expect(screen.getByText('sync')).toBeInTheDocument();
    });

    it('renders customHeader/customFooter instead of the default ones when provided', () => {
        render(
            <Modal
                isOpen={true}
                onClose={vi.fn()}
                title="Settings"
                customHeader={<div>my custom header</div>}
                customFooter={<div>my custom footer</div>}
            >
                content
            </Modal>
        );
        expect(screen.getByText('my custom header')).toBeInTheDocument();
        expect(screen.getByText('my custom footer')).toBeInTheDocument();
        expect(screen.queryByTitle('Close')).not.toBeInTheDocument();
    });
});
