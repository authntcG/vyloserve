// Shared test suite factory for the InstallGo/Java/Node/Python components.
//
// These four components share the exact same forwardRef+useImperativeHandle
// "fetch versions on mount, install on submit()" shape, differing only in
// which pywebview API methods they call and which i18n keys they fall back
// to. Testing each one with a hand-written, near-identical file would push
// duplicated lines well past the project's 3% SonarQube new-code budget, so
// the shared behavior lives here once and each per-runtime test file only
// supplies its own config plus any option unique to that runtime.
import { createRef, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { vi, expect, describe, it } from 'vitest';
import { act, render, screen, waitFor } from '../../test-utils';
import { mockPywebviewApi } from '../../test-utils';
import { ToastProvider } from '../../../src/components/ToastContext';

export interface RuntimeRef {
    submit: () => Promise<boolean>;
}

export interface RuntimeInstallSuiteConfig {
    readonly label: string;
    readonly Component: ForwardRefExoticComponent<RefAttributes<RuntimeRef>>;
    readonly fetchMethod: string;
    readonly installMethod: string;
    readonly versionLabel: string;
    readonly successKey: string;
    readonly errorKey: string;
}

const VERSIONS = [
    { value: '1.0', label: 'v1.0' },
    { value: '2.0', label: 'v2.0' },
];

export function describeRuntimeInstallSuite(config: RuntimeInstallSuiteConfig) {
    const { label, Component, fetchMethod, installMethod, versionLabel, successKey, errorKey } = config;

    describe(`${label} (shared runtime installer behavior)`, () => {
        it('shows the version select once versions are fetched successfully', async () => {
            mockPywebviewApi({ [fetchMethod]: vi.fn().mockResolvedValue({ status: 'success', data: VERSIONS }) });
            render(<Component ref={createRef<RuntimeRef>()} />, { wrapper: ToastProvider });

            expect(screen.getByText(versionLabel)).toBeInTheDocument();
            await screen.findByText('v1.0');
        });

        it('shows an error toast and falls back to an empty version list when fetching versions fails', async () => {
            mockPywebviewApi({ [fetchMethod]: vi.fn().mockRejectedValue(new Error('network down')) });
            render(<Component ref={createRef<RuntimeRef>()} />, { wrapper: ToastProvider });

            expect(await screen.findByText('runtimes.fetch_version_error')).toBeInTheDocument();
            expect(screen.getByText('runtimes.error_fetching_result')).toBeInTheDocument();
        });

        it('installs the selected version, shows a success toast, and resolves true on success', async () => {
            const install = vi.fn().mockResolvedValue({ status: 'success' });
            mockPywebviewApi({
                [fetchMethod]: vi.fn().mockResolvedValue({ status: 'success', data: VERSIONS }),
                [installMethod]: install,
            });
            const ref = createRef<RuntimeRef>();
            render(<Component ref={ref} />, { wrapper: ToastProvider });
            await screen.findByText('v1.0');

            const result = await act(async () => ref.current!.submit());

            expect(result).toBe(true);
            expect(install).toHaveBeenCalled();
            expect(await screen.findByText(successKey)).toBeInTheDocument();
        });

        it('shows the API-provided error message, and resolves false, when the install call reports failure', async () => {
            mockPywebviewApi({
                [fetchMethod]: vi.fn().mockResolvedValue({ status: 'success', data: VERSIONS }),
                [installMethod]: vi.fn().mockResolvedValue({ status: 'error', message: 'custom.install.error', args: {} }),
            });
            const ref = createRef<RuntimeRef>();
            render(<Component ref={ref} />, { wrapper: ToastProvider });
            await screen.findByText('v1.0');

            const result = await act(async () => ref.current!.submit());

            expect(result).toBe(false);
            expect(await screen.findByText('custom.install.error')).toBeInTheDocument();
        });

        it('falls back to the generic install-error toast when the failed response has no message', async () => {
            mockPywebviewApi({
                [fetchMethod]: vi.fn().mockResolvedValue({ status: 'success', data: VERSIONS }),
                [installMethod]: vi.fn().mockResolvedValue({ status: 'error' }),
            });
            const ref = createRef<RuntimeRef>();
            render(<Component ref={ref} />, { wrapper: ToastProvider });
            await screen.findByText('v1.0');

            const result = await act(async () => ref.current!.submit());

            expect(result).toBe(false);
            expect(await screen.findByText(errorKey)).toBeInTheDocument();
        });

        it('shows the generic system-error toast, and resolves false, when the install call throws', async () => {
            mockPywebviewApi({
                [fetchMethod]: vi.fn().mockResolvedValue({ status: 'success', data: VERSIONS }),
                [installMethod]: vi.fn().mockRejectedValue(new Error('boom')),
            });
            const ref = createRef<RuntimeRef>();
            render(<Component ref={ref} />, { wrapper: ToastProvider });
            await screen.findByText('v1.0');

            const result = await act(async () => ref.current!.submit());

            expect(result).toBe(false);
            expect(await screen.findByText('runtimes.sys_error')).toBeInTheDocument();
        });
    });
}
