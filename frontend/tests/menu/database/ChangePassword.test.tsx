import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, screen } from '../../test-utils';
import { mockPywebviewApi, renderWithToast } from '../../test-utils';
import ChangePassword, { type ChangePasswordRef } from '../../../src/menu/database/ChangePassword';

const runningInstance = {
    id: 'db_1',
    name: 'MySQL',
    engine: 'mysql' as const,
    version: '8.0',
    port: 3306,
    status: 'running' as const,
    dataDir: 'C:/data',
};

describe('ChangePassword', () => {
    it('defaults the username field to "root" for a mysql instance', () => {
        renderWithToast(<ChangePassword instance={runningInstance} ref={createRef<ChangePasswordRef>()} />);
        expect(screen.getByLabelText('database.username')).toHaveValue('root');
    });

    it('defaults the username field to "postgres" for a postgres instance', () => {
        renderWithToast(
            <ChangePassword instance={{ ...runningInstance, engine: 'postgres' }} ref={createRef<ChangePasswordRef>()} />
        );
        expect(screen.getByLabelText('database.username')).toHaveValue('postgres');
    });

    it('shows a warning and does not call the API when the new password field is empty', async () => {
        const changeCreds = vi.fn();
        mockPywebviewApi({ change_db_credentials: changeCreds });
        const ref = createRef<ChangePasswordRef>();
        renderWithToast(<ChangePassword instance={runningInstance} ref={ref} />);

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(changeCreds).not.toHaveBeenCalled();
        expect(await screen.findByText('database.new_password_empty_warning')).toBeInTheDocument();
    });

    it('shows a warning and does not call the API when the instance is not running', async () => {
        const changeCreds = vi.fn();
        mockPywebviewApi({ change_db_credentials: changeCreds });
        const ref = createRef<ChangePasswordRef>();
        renderWithToast(<ChangePassword instance={{ ...runningInstance, status: 'stopped' }} ref={ref} />);
        fireEvent.change(screen.getByLabelText('database.new_password'), { target: { value: 'newpass' } });

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(changeCreds).not.toHaveBeenCalled();
        expect(await screen.findByText('database.db_must_be_running')).toBeInTheDocument();
    });

    it('calls change_db_credentials with the entered values and shows a success toast on success', async () => {
        const changeCreds = vi.fn().mockResolvedValue({ status: 'success', message: 'database.password_changed', args: {} });
        mockPywebviewApi({ change_db_credentials: changeCreds });
        const ref = createRef<ChangePasswordRef>();
        renderWithToast(<ChangePassword instance={runningInstance} ref={ref} />);
        fireEvent.change(screen.getByLabelText('database.current_password'), { target: { value: 'oldpass' } });
        fireEvent.change(screen.getByLabelText('database.new_password'), { target: { value: 'newpass' } });

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(true);
        expect(changeCreds).toHaveBeenCalledWith('db_1', 'root', 'oldpass', 'newpass');
        expect(await screen.findByText('database.password_changed')).toBeInTheDocument();
    });

    it('shows the API-provided error message and resolves false when the API reports failure', async () => {
        mockPywebviewApi({
            change_db_credentials: vi.fn().mockResolvedValue({ status: 'error', message: 'database.wrong_old_password', args: {} }),
        });
        const ref = createRef<ChangePasswordRef>();
        renderWithToast(<ChangePassword instance={runningInstance} ref={ref} />);
        fireEvent.change(screen.getByLabelText('database.new_password'), { target: { value: 'newpass' } });

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(await screen.findByText('database.wrong_old_password')).toBeInTheDocument();
    });

    it('shows a generic fetch-error toast and resolves false when the API call throws', async () => {
        mockPywebviewApi({ change_db_credentials: vi.fn().mockRejectedValue(new Error('boom')) });
        const ref = createRef<ChangePasswordRef>();
        renderWithToast(<ChangePassword instance={runningInstance} ref={ref} />);
        fireEvent.change(screen.getByLabelText('database.new_password'), { target: { value: 'newpass' } });

        const result = await act(async () => ref.current!.submit());

        expect(result).toBe(false);
        expect(await screen.findByText('database.fetch_cred_error')).toBeInTheDocument();
    });

    it('lets the user edit the username field', async () => {
        const user = userEvent.setup();
        renderWithToast(<ChangePassword instance={runningInstance} ref={createRef<ChangePasswordRef>()} />);

        await user.clear(screen.getByLabelText('database.username'));
        await user.type(screen.getByLabelText('database.username'), 'custom_admin');

        expect(screen.getByLabelText('database.username')).toHaveValue('custom_admin');
    });
});
