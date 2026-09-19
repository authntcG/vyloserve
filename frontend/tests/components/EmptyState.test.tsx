import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from '../../src/components/EmptyState';

/**
 * Contoh test dasar (starter) untuk komponen presentational murni --
 * tanpa hooks, tanpa dependency i18n/context. Pola ini yang paling
 * gampang ditiru untuk komponen baru: render, query lewat role/text
 * (bukan className/testid -- lihat docs/frontend_ui.md), lalu assert
 * apa yang DILIHAT user.
 */
describe('EmptyState', () => {
    it('renders icon, title, and description', () => {
        render(
            <EmptyState icon="folder_open" title="Tidak ada proyek" description="Klik tombol di bawah untuk membuat proyek pertama." />
        );

        expect(screen.getByText('Tidak ada proyek')).toBeInTheDocument();
        expect(screen.getByText('Klik tombol di bawah untuk membuat proyek pertama.')).toBeInTheDocument();
        expect(screen.getByText('folder_open')).toBeInTheDocument();
    });

    it('does not render an action button when actionText/onAction are not provided', () => {
        render(<EmptyState icon="folder_open" title="Kosong" description="..." />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders an action button and calls onAction when clicked, only when both actionText and onAction are provided', async () => {
        const user = userEvent.setup();
        const onAction = vi.fn();

        render(
            <EmptyState
                icon="add_box"
                title="Kosong"
                description="..."
                actionText="Tambah Proyek"
                onAction={onAction}
            />
        );

        const button = screen.getByRole('button', { name: 'Tambah Proyek' });
        await user.click(button);

        expect(onAction).toHaveBeenCalledTimes(1);
    });
});
