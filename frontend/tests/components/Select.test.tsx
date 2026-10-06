import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from '../../src/components/Select';

const OPTIONS = [
    { value: 'mysql57', label: 'MySQL 5.7' },
    { value: 'mysql80', label: 'MySQL 8.0' },
    { value: 'mariadb106', label: 'MariaDB 10.6' },
];

describe('Select', () => {
    it('shows the placeholder when no value is selected', () => {
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />);
        expect(screen.getByRole('button', { name: /Select version/ })).toBeInTheDocument();
    });

    it('shows the selected option label when a value is set', () => {
        render(<Select options={OPTIONS} value="mysql80" onChange={vi.fn()} placeholder="Select version" />);
        expect(screen.getByRole('button', { name: /MySQL 8\.0/ })).toBeInTheDocument();
    });

    it('highlights the selected option using the theme-aware primary token, not a hardcoded blue', async () => {
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value="mysql80" onChange={vi.fn()} placeholder="Select version" />);
        await user.click(screen.getByRole('button', { name: /MySQL 8\.0/ }));

        const selectedOption = screen.getByRole('option', { name: 'MySQL 8.0' });
        expect(selectedOption).toHaveClass('bg-primary/10', 'dark:bg-primary/20', 'text-primary');
        expect(selectedOption.className).not.toMatch(/\bbg-blue-|\btext-blue-/);
    });

    it('associates the optional label with the trigger via htmlFor/id so getByLabelText works', () => {
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" label="character_set_server" />);
        expect(screen.getByLabelText('character_set_server')).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('opens the panel and lists all options on click (searchable by default)', async () => {
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />);

        await user.click(screen.getByRole('button', { name: /Select version/ }));

        expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'MySQL 5.7' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'MySQL 8.0' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'MariaDB 10.6' })).toBeInTheDocument();
    });

    it('filters options by typing in the search box (default label-only filter)', async () => {
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />);
        await user.click(screen.getByRole('button', { name: /Select version/ }));

        await user.type(screen.getByPlaceholderText('Search...'), 'maria');

        expect(screen.getByRole('option', { name: 'MariaDB 10.6' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'MySQL 5.7' })).not.toBeInTheDocument();
    });

    it('supports a custom filterFn matching fields beyond the visible label', async () => {
        const projects = [
            { value: 'p1', label: 'laravel.test', sublabel: 'My Laravel App' },
            { value: 'p2', label: 'wp.test', sublabel: 'My WordPress Site' },
        ];
        const user = userEvent.setup();
        render(
            <Select
                options={projects}
                value={null}
                onChange={vi.fn()}
                placeholder="Select project"
                filterFn={(opt, q) => opt.label.toLowerCase().includes(q.toLowerCase()) || !!opt.sublabel?.toLowerCase().includes(q.toLowerCase())}
            />
        );
        await user.click(screen.getByRole('button', { name: /Select project/ }));

        await user.type(screen.getByPlaceholderText('Search...'), 'wordpress');

        expect(screen.getByRole('option', { name: /wp\.test/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /laravel\.test/ })).not.toBeInTheDocument();
    });

    it('renders no search input when searchable=false', async () => {
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" searchable={false} />);

        await user.click(screen.getByRole('button', { name: /Select version/ }));

        expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
        expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('calls onChange and closes the panel when an option is clicked', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={onChange} placeholder="Select version" />);
        await user.click(screen.getByRole('button', { name: /Select version/ }));

        await user.click(screen.getByRole('option', { name: 'MySQL 8.0' }));

        expect(onChange).toHaveBeenCalledWith('mysql80');
        expect(screen.queryByRole('option', { name: 'MySQL 8.0' })).not.toBeInTheDocument();
    });

    it('closes the panel when clicking outside', async () => {
        const user = userEvent.setup();
        render(
            <div>
                <Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />
                <button type="button">outside</button>
            </div>
        );
        await user.click(screen.getByRole('button', { name: /Select version/ }));
        expect(screen.getByRole('option', { name: 'MySQL 5.7' })).toBeInTheDocument();

        await user.click(screen.getByText('outside'));

        expect(screen.queryByRole('option', { name: 'MySQL 5.7' })).not.toBeInTheDocument();
    });

    it('selects the highlighted option via ArrowDown + Enter without opening the search box focus trap', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={onChange} placeholder="Select version" />);
        await user.click(screen.getByRole('button', { name: /Select version/ }));
        await waitFor(() => expect(screen.getByPlaceholderText('Search...')).toHaveFocus());

        await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

        expect(onChange).toHaveBeenCalledWith('mariadb106');
    });

    // Regresi: menekan Enter LANGSUNG di sebuah baris option (bukan hasil navigasi Arrow)
    // sempat terproses DUA KALI -- sekali oleh onEnterOrSpace di baris itu sendiri, lalu
    // event-nya bubbling ke handler keyboard-nav di container, yang keliru baca
    // document.activeElement (fokus sudah pindah ke trigger akibat seleksi pertama) dan
    // memilih ulang opsi di highlightedIndex default (0) alih-alih opsi yang benar diklik.
    it('selects exactly the option Enter was pressed on, not the default highlighted index', () => {
        const onChange = vi.fn();
        render(<Select options={OPTIONS} value={null} onChange={onChange} placeholder="Select version" />);
        fireEvent.click(screen.getByRole('button', { name: /Select version/ }));

        // "MySQL 8.0" ada di index 1, BUKAN index 0 (default highlightedIndex) -- kalau bug
        // double-handling muncul lagi, onChange akan terpanggil dua kali dan nilai akhirnya
        // "mysql57" (index 0), bukan "mysql80".
        fireEvent.keyDown(screen.getByRole('option', { name: 'MySQL 8.0' }), { key: 'Enter' });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('mysql80');
    });

    it('closes without selecting when Escape is pressed, and returns focus to the trigger', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={onChange} placeholder="Select version" />);
        const trigger = screen.getByRole('button', { name: /Select version/ });
        await user.click(trigger);

        await user.keyboard('{Escape}');

        expect(onChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('option', { name: 'MySQL 5.7' })).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('shows loadingText and a disabled trigger (no panel) while loading', async () => {
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" loading loadingText="Fetching versions..." />);

        expect(screen.getByText('Fetching versions...')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Select version/ })).not.toBeInTheDocument();
    });

    it('shows errorText and disables the trigger when options failed to load', async () => {
        const user = userEvent.setup();
        render(<Select options={[]} value={null} onChange={vi.fn()} placeholder="Select version" errorText="Failed to fetch" />);

        const trigger = screen.getByRole('button', { name: 'Failed to fetch' });
        expect(trigger).toBeDisabled();
        await user.click(trigger);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('shows emptyText when a search yields no matches', async () => {
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />);
        await user.click(screen.getByRole('button', { name: /Select version/ }));

        await user.type(screen.getByPlaceholderText('Search...'), 'zzz-no-match');

        expect(screen.getByText('No results found.')).toBeInTheDocument();
    });

    it('shows a truncation notice only when not searching and the option count exceeds displayLimit', async () => {
        const many = Array.from({ length: 20 }, (_, i) => ({ value: `v${i}`, label: `Version ${i}` }));
        const user = userEvent.setup();
        render(
            <Select
                options={many}
                value={null}
                onChange={vi.fn()}
                placeholder="Select version"
                displayLimit={15}
                truncatedText="Showing top 15"
            />
        );
        await user.click(screen.getByRole('button', { name: /Select version/ }));

        expect(screen.getAllByRole('option')).toHaveLength(15);
        expect(screen.getByText('Showing top 15')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('Search...'), 'Version 1');
        expect(screen.queryByText('Showing top 15')).not.toBeInTheDocument();
    });

    it('accepts an explicit id so an external <label htmlFor> owned by the caller resolves to the trigger', () => {
        render(
            <div>
                <label htmlFor="theme-select">Theme</label>
                <Select id="theme-select" options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />
            </div>
        );
        expect(screen.getByLabelText('Theme')).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('renders the open panel via a portal into document.body, not inside a clipping ancestor', async () => {
        const user = userEvent.setup();
        const { container } = render(
            <div style={{ overflow: 'hidden', position: 'relative' }}>
                <Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />
            </div>
        );
        await user.click(screen.getByRole('button', { name: /Select version/ }));

        const listbox = screen.getByRole('listbox');
        expect(container.contains(listbox)).toBe(false);
        expect(document.body.contains(listbox)).toBe(true);
    });

    it('closes the panel when an ancestor scrolls, to avoid a stale portal position', async () => {
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />);
        await user.click(screen.getByRole('button', { name: /Select version/ }));
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        fireEvent.scroll(window);

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('does NOT close the panel when scrolling the options listbox itself', async () => {
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />);
        await user.click(screen.getByRole('button', { name: /Select version/ }));

        fireEvent.scroll(screen.getByRole('listbox'));

        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('closes the panel when clicking outside, but NOT when clicking inside the portaled panel itself', async () => {
        const user = userEvent.setup();
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" />);
        await user.click(screen.getByRole('button', { name: /Select version/ }));

        await user.click(screen.getByPlaceholderText('Search...'));
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        await user.click(document.body);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('renders an optional visible label', () => {
        render(<Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Select version" label="Database Version" />);
        expect(screen.getByText('Database Version')).toBeInTheDocument();
    });

    it('does not call onChange when a disabled option is clicked or activated via Enter', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        const optionsWithDisabled = [...OPTIONS, { value: 'coming_soon', label: 'Coming Soon', disabled: true }];
        render(<Select options={optionsWithDisabled} value={null} onChange={onChange} placeholder="Select version" />);
        await user.click(screen.getByRole('button', { name: /Select version/ }));

        const disabledOption = screen.getByRole('option', { name: 'Coming Soon' });
        expect(disabledOption).toHaveAttribute('aria-disabled', 'true');

        await user.click(disabledOption);
        expect(onChange).not.toHaveBeenCalled();

        disabledOption.focus();
        await user.keyboard('{Enter}');
        expect(onChange).not.toHaveBeenCalled();
    });
});
