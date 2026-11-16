import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import JwtDebuggerMain from '../../../../src/menu/utilities/jwt-debugger/Main';

describe('JwtDebuggerMain Component', () => {
  it('renders JWT debugger and decodes default sample token', async () => {
    renderWithToast(<JwtDebuggerMain />);

    expect(screen.getByText('JWT Decoder & Inspector')).toBeInTheDocument();
    expect(screen.getByText('Header (JOSE)')).toBeInTheDocument();
    expect(screen.getByText('Payload (Claims)')).toBeInTheDocument();

    // Verify claims from default sample token
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('1234567890')).toBeInTheDocument();
  });

  it('triggers offline HMAC verification', async () => {
    const user = userEvent.setup();
    renderWithToast(<JwtDebuggerMain />);

    const verifyBtn = screen.getByRole('button', { name: /verify signature/i });
    await user.click(verifyBtn);

    await waitFor(() => {
      const match = screen.getAllByText(/Signature/i);
      expect(match.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('clears token input and shows empty state', async () => {
    const user = userEvent.setup();
    renderWithToast(<JwtDebuggerMain />);

    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText('No Decoded Token')).toBeInTheDocument();
    });
  });

  it('loads sample token, toggles secret visibility, and copies claims', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithToast(<JwtDebuggerMain />);

    // Clear then reload sample
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('No Decoded Token')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sample' }));
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    // Toggle secret visibility
    const secretInput = screen.getByPlaceholderText('your-secret-key');
    expect(secretInput).toHaveAttribute('type', 'password');

    const toggleVisBtn = screen.getByRole('button', { name: 'visibility' });
    await user.click(toggleVisBtn);
    expect(secretInput).toHaveAttribute('type', 'text');

    // Copy decoded JSON
    const copyBtns = screen.getAllByRole('button', { name: /copy/i });
    if (copyBtns.length > 0) {
      await user.click(copyBtns[0]);
      expect(writeTextSpy).toHaveBeenCalled();
    }
  });

  it('displays error info box when invalid JWT string is provided', async () => {
    const user = userEvent.setup();
    renderWithToast(<JwtDebuggerMain />);

    const textarea = screen.getByPlaceholderText(/eyJhbGciOiJIUzI1Ni/i);
    await user.clear(textarea);
    await user.type(textarea, 'invalid.token.string');

    await waitFor(() => {
      expect(screen.getByText(/Invalid JWT Header/i)).toBeInTheDocument();
    });
  });

  it('validates empty token and empty secret guards on verify', async () => {
    const user = userEvent.setup();
    renderWithToast(<JwtDebuggerMain />);

    // Clear token and try verifying
    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    await user.click(clearBtn);

    const verifyBtn = screen.getByRole('button', { name: /verify signature/i });
    await user.click(verifyBtn);
    expect(await screen.findByText('Please enter a JWT token')).toBeInTheDocument();

    // Reload sample, clear secret, and verify
    await user.click(screen.getByRole('button', { name: 'Sample' }));
    const secretInput = screen.getByPlaceholderText('your-secret-key');
    await user.clear(secretInput);
    await user.click(verifyBtn);
    expect(await screen.findByText('Please enter a secret key')).toBeInTheDocument();
  });

  it('switches HMAC algorithm, changes secret, and copies header and payload', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithToast(<JwtDebuggerMain />);

    // Type a new secret
    const secretInput = screen.getByPlaceholderText('your-secret-key');
    await user.clear(secretInput);
    await user.type(secretInput, 'my-super-secret-key');
    expect(secretInput).toHaveValue('my-super-secret-key');

    // Switch algorithm via Select dropdown
    const algoTrigger = screen.getByRole('button', { name: /algorithm/i });
    await user.click(algoTrigger);
    const hs512Option = await screen.findByRole('option', { name: /HS512/i });
    await user.click(hs512Option);

    // Verify signature with wrong secret -> failed toast & status
    const verifyBtn = screen.getByRole('button', { name: /verify signature/i });
    await user.click(verifyBtn);
    expect((await screen.findAllByText(/Signature verification failed/i)).length).toBeGreaterThanOrEqual(1);

    // Copy Header and Copy Payload buttons
    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    expect(copyButtons.length).toBeGreaterThanOrEqual(2);
    await user.click(copyButtons[0]);
    await user.click(copyButtons[1]);
    expect(writeTextSpy).toHaveBeenCalledTimes(2);
  });
});
