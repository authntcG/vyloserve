import { describe, it, expect } from 'vitest';
import { screen, waitFor, fireEvent } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import JsonStudioMain from '../../../../src/menu/utilities/json-studio/Main';

describe('JsonStudioMain Component', () => {
  it('renders JSON studio with Formatter tab by default and formats input', async () => {
    const user = userEvent.setup();
    renderWithToast(<JsonStudioMain />);

    expect(screen.getByText('JSON Studio')).toBeInTheDocument();
    expect(screen.getByText('Formatter & Validator')).toBeInTheDocument();

    const formatBtn = screen.getByRole('button', { name: /format & validate/i });
    await user.click(formatBtn);

    await waitFor(() => {
      expect(screen.getByText('JSON formatted successfully')).toBeInTheDocument();
    });
  });

  it('switches to Tree Explorer tab and displays tree nodes and supports filtering', async () => {
    const user = userEvent.setup();
    renderWithToast(<JsonStudioMain />);

    const treeTab = screen.getByText('Tree Explorer');
    await user.click(treeTab);

    await waitFor(() => {
      expect(screen.getByText('Tree Structure Explorer')).toBeInTheDocument();
      expect(screen.getByText('root:')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Filter keys...');
    await user.type(searchInput, 'server');
    expect(searchInput).toHaveValue('server');
  });

  it('allows changing indentation using reusable Select component', async () => {
    const user = userEvent.setup();
    renderWithToast(<JsonStudioMain />);

    // The Select trigger is labeled by the FieldLabel "Indent:"
    const selectTrigger = screen.getByRole('button', { name: /indent:/i });
    expect(selectTrigger).toBeInTheDocument();
    expect(screen.getByText('2 Spaces')).toBeInTheDocument();
    await user.click(selectTrigger);

    // Click "4 Spaces" option in dropdown listbox
    const option4 = await screen.findByRole('option', { name: /4 spaces/i });
    await user.click(option4);

    const formatBtn = screen.getByRole('button', { name: /format & validate/i });
    await user.click(formatBtn);

    await waitFor(() => {
      expect(screen.getByText('JSON formatted successfully')).toBeInTheDocument();
    });
  });

  it('switches to Diff tab and displays live visual diff, supports view toggles', async () => {
    const user = userEvent.setup();
    renderWithToast(<JsonStudioMain />);

    const diffTab = screen.getByText('JSON Diff');
    await user.click(diffTab);

    await waitFor(() => {
      expect(screen.getByText('Live Visual Diff')).toBeInTheDocument();
      expect(screen.getByText('Split View')).toBeInTheDocument();
      expect(screen.getByText('Unified View')).toBeInTheDocument();
    });

    // Switch to Unified View
    const unifiedBtn = screen.getByRole('button', { name: /unified view/i });
    await user.click(unifiedBtn);
    expect(unifiedBtn).toHaveAttribute('aria-pressed', 'true');

    // Toggle structural path table
    const toggleStructuralBtn = screen.getByRole('button', { name: /show structural path table/i });
    await user.click(toggleStructuralBtn);

    await waitFor(() => {
      expect(screen.getByText('Structural Comparison')).toBeInTheDocument();
      expect(screen.getByText('JSON Path')).toBeInTheDocument();
    });
  });

  it('handles invalid JSON syntax formatting and tree empty state', async () => {
    const user = userEvent.setup();
    renderWithToast(<JsonStudioMain />);

    const rawInput = screen.getByPlaceholderText('{"key": "value"}');
    fireEvent.change(rawInput, { target: { value: '{"bad_json": ' } });

    const formatBtn = screen.getByRole('button', { name: /format & validate/i });
    await user.click(formatBtn);

    expect(await screen.findByText('Invalid JSON syntax')).toBeInTheDocument();
    expect(screen.getByText('Syntax Error:')).toBeInTheDocument();

    // Switch to Tree Explorer while JSON is invalid -> displays EmptyState
    const treeTab = screen.getByText('Tree Explorer');
    await user.click(treeTab);
    expect(await screen.findByText('No Valid JSON to Render')).toBeInTheDocument();
  });

  it('handles sample, clear, minify indent, sort keys, and copy output actions', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithToast(<JsonStudioMain />);

    // Test Clear button
    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    await user.click(clearBtn);
    const rawInput = screen.getByPlaceholderText('{"key": "value"}');
    expect(rawInput).toHaveValue('');

    // Test Sample button
    const sampleBtn = screen.getByRole('button', { name: 'Sample' });
    await user.click(sampleBtn);
    expect((rawInput as HTMLTextAreaElement).value).toContain('VyloServe');

    // Toggle Sort Keys
    const sortKeysCheckbox = screen.getByLabelText(/Sort Keys/i);
    await user.click(sortKeysCheckbox);
    expect(sortKeysCheckbox).toBeChecked();

    // Select Minify indent
    const indentTrigger = screen.getByRole('button', { name: /indent:/i });
    await user.click(indentTrigger);
    const minifyOption = await screen.findByRole('option', { name: /minify/i });
    await user.click(minifyOption);

    // Format
    const formatBtn = screen.getByRole('button', { name: /format & validate/i });
    await user.click(formatBtn);
    expect(await screen.findByText('JSON formatted successfully')).toBeInTheDocument();

    // Copy formatted output
    const copyOutputBtn = screen.getByRole('button', { name: /copy/i });
    await user.click(copyOutputBtn);
    expect(writeTextSpy).toHaveBeenCalled();

    // Switch to Diff tab and click sample buttons on A and B
    const diffTab = screen.getByText('JSON Diff');
    await user.click(diffTab);
    const sampleBtns = screen.getAllByRole('button', { name: 'Sample' });
    for (const btn of sampleBtns) {
      await user.click(btn);
    }
  });
});
