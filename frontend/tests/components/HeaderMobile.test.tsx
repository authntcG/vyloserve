import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../test-utils';
import HeaderMobile from '../../src/components/HeaderMobile';

describe('HeaderMobile', () => {
    it('renders the dashboard title', () => {
        // HeaderMobile.tsx memanggil t('sidebar.menu_dashboard') TANPA fallback --
        // mock global react-i18next (tests/setup.ts) mengembalikan key literal
        // kalau tidak ada fallback, jadi itu yang di-assert di sini, bukan "Dashboard".
        render(<HeaderMobile onMenuClick={vi.fn()} />);
        expect(screen.getByText('sidebar.menu_dashboard')).toBeInTheDocument();
    });

    it('calls onMenuClick when the hamburger button is clicked', async () => {
        const user = userEvent.setup();
        const onMenuClick = vi.fn();
        render(<HeaderMobile onMenuClick={onMenuClick} />);

        await user.click(screen.getByText('menu').closest('button')!);

        expect(onMenuClick).toHaveBeenCalledTimes(1);
    });
});
