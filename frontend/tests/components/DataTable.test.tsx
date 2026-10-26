import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DataTable, { type ColumnDef } from '../../src/components/DataTable';

interface TestItem {
    id: string;
    name: string;
    port: number;
}

const testColumns: ColumnDef<TestItem>[] = [
    {
        id: 'name',
        header: 'Service Name',
        render: (item) => item.name,
    },
    {
        id: 'port',
        header: 'Port',
        align: 'right',
        render: (item) => item.port,
    },
];

const testData: TestItem[] = [
    { id: '1', name: 'Apache HTTP', port: 80 },
    { id: '2', name: 'PHP-FPM', port: 9000 },
];

describe('DataTable', () => {
    it('renders table headers and rows accurately', () => {
        render(
            <DataTable
                data={testData}
                columns={testColumns}
                keyExtractor={(item) => item.id}
            />
        );

        expect(screen.getByText('Service Name')).toBeInTheDocument();
        expect(screen.getByText('Port')).toBeInTheDocument();
        expect(screen.getByText('Apache HTTP')).toBeInTheDocument();
        expect(screen.getByText('PHP-FPM')).toBeInTheDocument();
        expect(screen.getByText('80')).toBeInTheDocument();
        expect(screen.getByText('9000')).toBeInTheDocument();
    });

    it('renders optional toolbar title and header actions', () => {
        render(
            <DataTable
                data={testData}
                columns={testColumns}
                keyExtractor={(item) => item.id}
                title="Active Daemons"
                subtitle="List of listening services"
                headerActions={<button type="button">Refresh</button>}
            />
        );

        expect(screen.getByText('Active Daemons')).toBeInTheDocument();
        expect(screen.getByText('List of listening services')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });

    it('renders empty state when data is empty', () => {
        render(
            <DataTable
                data={[]}
                columns={testColumns}
                keyExtractor={(item) => item.id}
                emptyState={<span>No services configured</span>}
            />
        );

        expect(screen.getByText('No services configured')).toBeInTheDocument();
    });

    it('renders loading indicator when isLoading is true', () => {
        render(
            <DataTable
                data={[]}
                columns={testColumns}
                keyExtractor={(item) => item.id}
                isLoading
            />
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('applies density styles (compact, normal, relaxed)', () => {
        const { container, rerender } = render(
            <DataTable
                data={testData}
                columns={testColumns}
                keyExtractor={(item) => item.id}
                density="compact"
            />
        );

        expect(container.querySelector('th')).toHaveClass('py-2', 'px-3');

        rerender(
            <DataTable
                data={testData}
                columns={testColumns}
                keyExtractor={(item) => item.id}
                density="relaxed"
            />
        );

        expect(container.querySelector('th')).toHaveClass('py-3.5', 'px-5');
    });

    it('toggles density and persists to localStorage', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        const user = userEvent.setup();
        const onDensityChange = vi.fn();

        const { container } = render(
            <DataTable
                data={testData}
                columns={testColumns}
                keyExtractor={(item) => item.id}
                onDensityChange={onDensityChange}
            />
        );

        // Wrapper should have overflow-y-hidden
        const scrollWrapper = container.querySelector('.overflow-x-auto');
        expect(scrollWrapper).toHaveClass('overflow-y-hidden');

        // Click Compact density button
        const compactBtn = screen.getByRole('button', { name: /compact/i });
        await user.click(compactBtn);

        expect(compactBtn).toHaveAttribute('aria-pressed', 'true');
        expect(onDensityChange).toHaveBeenCalledWith('compact');
        expect(localStorage.getItem('vyloserve_table_density')).toBe('compact');
        expect(container.querySelector('th')).toHaveClass('py-2', 'px-3');
    });

    it('renders filters slot and interactive search bar with clear button', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        const user = userEvent.setup();
        const onSearchChange = vi.fn();

        const { rerender } = render(
            <DataTable
                data={testData}
                columns={testColumns}
                keyExtractor={(item) => item.id}
                filters={<div data-testid="custom-filter">My Filter</div>}
                search={{
                    value: '',
                    onChange: onSearchChange,
                    placeholder: 'Find daemons...',
                }}
            />
        );

        expect(screen.getByTestId('custom-filter')).toBeInTheDocument();
        const searchInput = screen.getByPlaceholderText('Find daemons...');
        expect(searchInput).toBeInTheDocument();

        // Type into search
        await user.type(searchInput, 'Apache');
        expect(onSearchChange).toHaveBeenCalled();

        // Rerender with search value to test clear button
        rerender(
            <DataTable
                data={testData}
                columns={testColumns}
                keyExtractor={(item) => item.id}
                search={{
                    value: 'Apache',
                    onChange: onSearchChange,
                    placeholder: 'Find daemons...',
                }}
            />
        );

        const clearBtn = screen.getByRole('button', { name: /clear/i });
        await user.click(clearBtn);
        expect(onSearchChange).toHaveBeenCalledWith('');
    });
});
