import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test-utils';
import DbSettings from '../../../src/menu/database/Settings';

const baseInstance = { id: 'db_1', name: 'MySQL', version: '8.0', port: 3306, status: 'running' as const, dataDir: 'C:/data' };

describe('DbSettings', () => {
    it('renders a loading skeleton and no inputs while isLoading is true', () => {
        render(<DbSettings instance={{ ...baseInstance, engine: 'mysql' }} config={{}} onChange={vi.fn()} isLoading={true} />);
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('database.port')).not.toBeInTheDocument();
    });

    it('shows MySQL-specific fields and the "bind-address" label for a mysql instance', () => {
        render(
            <DbSettings instance={{ ...baseInstance, engine: 'mysql' }} config={{ port: 3306 }} onChange={vi.fn()} isLoading={false} />
        );

        expect(screen.getByText('bind-address')).toBeInTheDocument();
        expect(screen.getByLabelText('innodb_buffer_pool_size')).toBeInTheDocument();
        expect(screen.queryByLabelText('shared_buffers')).not.toBeInTheDocument();
    });

    it('shows PostgreSQL-specific fields and the "listen_addresses" label for a postgres instance', () => {
        render(
            <DbSettings instance={{ ...baseInstance, engine: 'postgres' }} config={{ port: 5432 }} onChange={vi.fn()} isLoading={false} />
        );

        expect(screen.getByText('listen_addresses')).toBeInTheDocument();
        expect(screen.getByLabelText('shared_buffers')).toBeInTheDocument();
        expect(screen.queryByLabelText('innodb_buffer_pool_size')).not.toBeInTheDocument();
    });

    it('calls onChange with the numeric port value when the port field changes', () => {
        const onChange = vi.fn();
        render(
            <DbSettings instance={{ ...baseInstance, engine: 'mysql' }} config={{ port: 3306 }} onChange={onChange} isLoading={false} />
        );

        fireEvent.change(screen.getByLabelText('database.port'), { target: { value: '3307' } });

        expect(onChange).toHaveBeenLastCalledWith('port', 3307);
    });

    it('calls onChange with "listen_addresses" (not "bind_address") when editing the bind field for postgres', () => {
        const onChange = vi.fn();
        render(
            <DbSettings instance={{ ...baseInstance, engine: 'postgres' }} config={{ listen_addresses: '' }} onChange={onChange} isLoading={false} />
        );

        fireEvent.change(screen.getByLabelText('listen_addresses'), { target: { value: '*' } });

        expect(onChange).toHaveBeenCalledWith('listen_addresses', '*');
    });

    it('calls onChange with "bind_address" when editing the bind field for mysql', () => {
        const onChange = vi.fn();
        render(
            <DbSettings instance={{ ...baseInstance, engine: 'mysql' }} config={{ bind_address: '' }} onChange={onChange} isLoading={false} />
        );

        fireEvent.change(screen.getByLabelText('bind-address'), { target: { value: '0.0.0.0' } });

        expect(onChange).toHaveBeenCalledWith('bind_address', '0.0.0.0');
    });

    it.each([
        ['innodb_buffer_pool_size', 'innodb_buffer_pool_size', '256M'],
        ['max_allowed_packet', 'max_allowed_packet', '64M'],
        ['max_connections', 'max_connections', '200'],
        ['collation_server', 'collation_server', 'utf8mb4_general_ci'],
    ])('calls onChange for the MySQL "%s" performance field', (label, key, value) => {
        const onChange = vi.fn();
        render(<DbSettings instance={{ ...baseInstance, engine: 'mysql' }} config={{}} onChange={onChange} isLoading={false} />);

        fireEvent.change(screen.getByLabelText(label), { target: { value } });

        expect(onChange).toHaveBeenCalledWith(key, value);
    });

    it('changes the MySQL character_set_server select and defaults to utf8mb4', () => {
        const onChange = vi.fn();
        render(<DbSettings instance={{ ...baseInstance, engine: 'mysql' }} config={{}} onChange={onChange} isLoading={false} />);
        expect(screen.getByLabelText('character_set_server')).toHaveValue('utf8mb4');

        fireEvent.change(screen.getByLabelText('character_set_server'), { target: { value: 'latin1' } });

        expect(onChange).toHaveBeenCalledWith('character_set_server', 'latin1');
    });

    it('defaults default_storage_engine to InnoDB when unset', () => {
        render(<DbSettings instance={{ ...baseInstance, engine: 'mysql' }} config={{}} onChange={vi.fn()} isLoading={false} />);
        expect(screen.getByLabelText('default_storage_engine')).toHaveValue('InnoDB');
    });

    it.each([
        ['shared_buffers', 'shared_buffers', '128MB'],
        ['work_mem', 'work_mem', '4MB'],
        ['maintenance_work_mem', 'maintenance_work_mem', '64MB'],
        ['effective_cache_size', 'effective_cache_size', '512MB'],
        ['max_connections', 'max_connections', '100'],
        ['timezone', 'timezone', 'UTC'],
    ])('calls onChange for the PostgreSQL "%s" performance field', (label, key, value) => {
        const onChange = vi.fn();
        render(<DbSettings instance={{ ...baseInstance, engine: 'postgres' }} config={{}} onChange={onChange} isLoading={false} />);

        fireEvent.change(screen.getByLabelText(label), { target: { value } });

        expect(onChange).toHaveBeenCalledWith(key, value);
    });

    it('shows the save-restart warning message', () => {
        render(<DbSettings instance={{ ...baseInstance, engine: 'mysql' }} config={{}} onChange={vi.fn()} isLoading={false} />);
        expect(screen.getByText('database.save_restart_warning')).toBeInTheDocument();
    });
});
