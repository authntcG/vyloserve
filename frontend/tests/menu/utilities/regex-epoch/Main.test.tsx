import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import RegexEpochMain from '../../../../src/menu/utilities/regex-epoch/Main';

describe('RegexEpochMain Component', () => {
  it('renders header, tabs, and epoch live clock controls', async () => {
    renderWithToast(<RegexEpochMain />);

    expect(screen.getByText('Regex Tester & Epoch Converter')).toBeInTheDocument();
    expect(screen.getByText('Unix Epoch & Time')).toBeInTheDocument();
    expect(screen.getByText('Regex Tester')).toBeInTheDocument();
    expect(screen.getByText('Current Unix Timestamp')).toBeInTheDocument();
  });

  it('toggles pause and resume on live epoch ticker', async () => {
    const user = userEvent.setup();
    renderWithToast(<RegexEpochMain />);

    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    expect(pauseBtn).toBeInTheDocument();

    await user.click(pauseBtn);
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();

    const resumeBtn = screen.getByRole('button', { name: /resume/i });
    await user.click(resumeBtn);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('converts timestamp to human date fields', async () => {
    const user = userEvent.setup();
    renderWithToast(<RegexEpochMain />);

    const timestampInput = screen.getByLabelText(/unix timestamp/i);
    await user.clear(timestampInput);
    await user.type(timestampInput, '1700000000');

    await waitFor(() => {
      // 1700000000 is 2023-11-14T22:13:20.000Z
      expect(screen.getByText(/2023-11-14T22:13:20\.000Z/i)).toBeInTheDocument();
    });
  });

  it('switches to Regex tab and tests patterns with preset', async () => {
    const user = userEvent.setup();
    renderWithToast(<RegexEpochMain />);

    const regexTab = screen.getByRole('button', { name: /regex tester/i });
    await user.click(regexTab);

    expect(screen.getByText('Regular Expression')).toBeInTheDocument();
    expect(screen.getByText('Test String')).toBeInTheDocument();

    // Select Email preset
    const emailPresetBtn = screen.getByRole('button', { name: 'Email Address' });
    await user.click(emailPresetBtn);

    await waitFor(() => {
      expect(screen.getByText(/2 Matches Found/i)).toBeInTheDocument();
      expect(screen.getByText('support@vyloserve.dev')).toBeInTheDocument();
      expect(screen.getByText('admin@test.local')).toBeInTheDocument();
    });
  });

  it('handles invalid regex gracefully without crashing', async () => {
    const user = userEvent.setup();
    renderWithToast(<RegexEpochMain />);

    const regexTab = screen.getByRole('button', { name: /regex tester/i });
    await user.click(regexTab);

    const patternInput = screen.getByLabelText('Regular Expression');
    await user.clear(patternInput);
    await user.type(patternInput, '(abc'); // unclosed parenthesis

    await waitFor(() => {
      expect(screen.getByText(/Invalid regular expression/i)).toBeInTheDocument();
    });
  });

  it('handles use in converter button and copies epoch fields', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    renderWithToast(<RegexEpochMain />);

    // Click "Use in Converter"
    const useBtn = screen.getByRole('button', { name: /use in converter/i });
    await user.click(useBtn);

    // Copy UTC
    const copyUtcBtn = screen.getByTitle('Copy UTC');
    await user.click(copyUtcBtn);
    expect(writeTextSpy).toHaveBeenCalled();

    // Copy ISO
    const copyIsoBtn = screen.getByTitle('Copy ISO');
    await user.click(copyIsoBtn);
    expect(writeTextSpy).toHaveBeenCalledTimes(2);
  });

  it('switches regex presets and toggles flags', async () => {
    const user = userEvent.setup();
    renderWithToast(<RegexEpochMain />);

    const regexTab = screen.getByRole('button', { name: /regex tester/i });
    await user.click(regexTab);

    // IPv4 preset
    const ipv4Btn = screen.getByRole('button', { name: 'IPv4 Address' });
    await user.click(ipv4Btn);
    await waitFor(() => {
      expect(screen.getByText(/2 Matches Found/i)).toBeInTheDocument();
    });

    // UUID preset
    const uuidBtn = screen.getByRole('button', { name: 'UUID' });
    await user.click(uuidBtn);
    await waitFor(() => {
      expect(screen.getByText(/1 Matches Found/i)).toBeInTheDocument();
    });

    // Toggle Case-Insensitive Flag
    const ignoreCaseCheckbox = screen.getByLabelText(/case-insensitive/i);
    await user.click(ignoreCaseCheckbox);
    expect(ignoreCaseCheckbox).toBeChecked();
  });
});
