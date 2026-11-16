import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import CryptoGeneratorMain from '../../../../src/menu/utilities/crypto-generator/Main';

describe('CryptoGeneratorMain Component', () => {
  beforeEach(() => {
    (window as any).pywebview = {
      api: {
        generate_bcrypt_hash: vi.fn().mockResolvedValue({
          status: 'success',
          hash: '$2y$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
          rounds: 10,
          prefix: '2y',
        }),
        verify_bcrypt_hash: vi.fn().mockResolvedValue({
          status: 'success',
          is_match: true,
          message: 'backend.crypto.verify_match',
        }),
        generate_crypto_ids: vi.fn().mockResolvedValue({
          status: 'success',
          ids: [
            '5249f701-ed63-4032-b63e-eab4504673ae',
            '12345678-abcd-ef01-2345-6789abcdef01',
          ],
        }),
        generate_text_hashes: vi.fn().mockResolvedValue({
          status: 'success',
          hashes: {
            MD5: '5d41402abc4b2a76b9719d911017c592',
            'SHA-1': 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
            'SHA-256': '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
            'SHA-512': '9b71d224bd62f3785d96d46ad3ea3d73319bf52174103e998826e7924719c279e8c45479900c14b9',
            CRC32: 'e4c2376b',
          },
        }),
      },
    };
  });

  afterEach(() => {
    delete (window as any).pywebview;
  });

  it('renders header, tabs, and Bcrypt controls', async () => {
    renderWithToast(<CryptoGeneratorMain />);

    expect(screen.getByText('Crypto, Bcrypt & Identifier Generator')).toBeInTheDocument();
    expect(screen.getByText('Bcrypt Password')).toBeInTheDocument();
    expect(screen.getByText('UUID & ULID Generator')).toBeInTheDocument();
    expect(screen.getByText('Text Checksum / Hashes')).toBeInTheDocument();
  });

  it('generates Bcrypt hash on button click', async () => {
    const user = userEvent.setup();
    renderWithToast(<CryptoGeneratorMain />);

    const generateBtn = screen.getByRole('button', { name: /generate bcrypt hash/i });
    await user.click(generateBtn);

    await waitFor(() => {
      expect((window as any).pywebview.api.generate_bcrypt_hash).toHaveBeenCalledWith(
        'secret123',
        10,
        '2y'
      );
    });

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('$2y$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
      ).toBeInTheDocument();
    });
  });

  it('verifies Bcrypt password match', async () => {
    const user = userEvent.setup();
    renderWithToast(<CryptoGeneratorMain />);

    const passwordInput = screen.getByPlaceholderText('Enter password to verify...');
    const hashInput = screen.getByPlaceholderText('$2y$10$...');

    await user.type(passwordInput, 'secret123');
    await user.type(hashInput, '$2y$10$testHashString1234567890');

    const verifyBtn = screen.getByRole('button', { name: /verify match/i });
    await user.click(verifyBtn);

    await waitFor(() => {
      expect((window as any).pywebview.api.verify_bcrypt_hash).toHaveBeenCalledWith(
        'secret123',
        '$2y$10$testHashString1234567890'
      );
    });
  });

  it('switches to UUID & ULID generator tab and generates IDs', async () => {
    const user = userEvent.setup();
    renderWithToast(<CryptoGeneratorMain />);

    const idTab = screen.getByRole('button', { name: /UUID & ULID Generator/i });
    await user.click(idTab);

    const generateIdsBtn = screen.getByRole('button', { name: /generate identifiers/i });
    await user.click(generateIdsBtn);

    await waitFor(() => {
      expect((window as any).pywebview.api.generate_crypto_ids).toHaveBeenCalledWith('uuid4', 5);
      expect(screen.getByText('5249f701-ed63-4032-b63e-eab4504673ae')).toBeInTheDocument();
    });
  });

  it('switches to Text Checksum tab and displays hash values', async () => {
    const user = userEvent.setup();
    renderWithToast(<CryptoGeneratorMain />);

    const checksumTab = screen.getByRole('button', { name: /Text Checksum \/ Hashes/i });
    await user.click(checksumTab);

    await waitFor(() => {
      expect(screen.getByText('MD5')).toBeInTheDocument();
      expect(screen.getByText('SHA-256')).toBeInTheDocument();
      expect(screen.getByText('CRC32')).toBeInTheDocument();
    });
  });

  it('handles options and copy actions in UUID and Checksum tabs', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithToast(<CryptoGeneratorMain />);

    // 1. UUID & ULID Tab
    const idTab = screen.getByRole('button', { name: /UUID & ULID Generator/i });
    await user.click(idTab);

    const generateIdsBtn = screen.getByRole('button', { name: /generate identifiers/i });
    await user.click(generateIdsBtn);

    await waitFor(() => {
      expect(screen.getByText('5249f701-ed63-4032-b63e-eab4504673ae')).toBeInTheDocument();
    });

    // Toggle Uppercase
    const upperCheckbox = screen.getByLabelText(/Uppercase \(A-Z\)/i);
    await user.click(upperCheckbox);

    await waitFor(() => {
      expect(screen.getByText('5249F701-ED63-4032-B63E-EAB4504673AE')).toBeInTheDocument();
    });

    // Toggle Hyphens off
    const hyphenCheckbox = screen.getByLabelText(/Include Hyphens/i);
    await user.click(hyphenCheckbox);

    // Copy single ID
    const copySingleBtns = screen.getAllByTitle('Copy ID');
    expect(copySingleBtns).not.toHaveLength(0);
    await user.click(copySingleBtns[0]);
    expect(writeTextSpy).toHaveBeenCalled();

    // Copy All IDs
    const copyAllBtn = screen.getByRole('button', { name: /Copy All/i });
    await user.click(copyAllBtn);
    expect(writeTextSpy).toHaveBeenCalled();

    // 2. Text Checksum Tab
    const checksumTab = screen.getByRole('button', { name: /Text Checksum \/ Hashes/i });
    await user.click(checksumTab);

    await waitFor(() => {
      expect(screen.getByText('MD5')).toBeInTheDocument();
    });

    // Toggle Uppercase Hex
    const upperHexToggle = screen.getByLabelText(/Uppercase Hex/i);
    await user.click(upperHexToggle);

    // Copy Hash
    const copyHashBtns = screen.getAllByTitle(/Copy .* hash/i);
    expect(copyHashBtns).not.toHaveLength(0);
    await user.click(copyHashBtns[0]);
    expect(writeTextSpy).toHaveBeenCalled();
  });
});
