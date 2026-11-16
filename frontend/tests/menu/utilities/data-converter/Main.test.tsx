import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '../../../test-utils';
import { renderWithToast } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import DataConverterMain from '../../../../src/menu/utilities/data-converter/Main';

describe('DataConverterMain Component', () => {
  it('renders header, tabs, and generates SQL from default sample CSV', async () => {
    renderWithToast(<DataConverterMain />);

    expect(screen.getByText('Data & SQL Converter')).toBeInTheDocument();
    expect(screen.getByText('CSV to SQL')).toBeInTheDocument();
    expect(screen.getByText('JSON to SQL')).toBeInTheDocument();
    expect(screen.getByText('CSV ↔ JSON')).toBeInTheDocument();
    expect(screen.getByText('Markdown Table')).toBeInTheDocument();

    // Default sample CSV converted to SQL
    const outputTextarea = screen.getByPlaceholderText('Converted output will appear here...');
    expect(outputTextarea).toHaveValue();
    expect((outputTextarea as HTMLTextAreaElement).value).toContain('INSERT INTO `users`');
    expect((outputTextarea as HTMLTextAreaElement).value).toContain('Alice Johnson');
  });

  it('updates table name and changes generated SQL', async () => {
    const user = userEvent.setup();
    renderWithToast(<DataConverterMain />);

    const tableNameInput = screen.getByLabelText('Target Table Name');
    await user.clear(tableNameInput);
    await user.type(tableNameInput, 'customers');

    await waitFor(() => {
      const outputTextarea = screen.getByPlaceholderText('Converted output will appear here...');
      expect((outputTextarea as HTMLTextAreaElement).value).toContain('INSERT INTO `customers`');
    });
  });

  it('switches to JSON to SQL tab and converts JSON data', async () => {
    const user = userEvent.setup();
    renderWithToast(<DataConverterMain />);

    const jsonToSqlTab = screen.getByRole('button', { name: 'JSON to SQL' });
    await user.click(jsonToSqlTab);

    await waitFor(() => {
      const outputTextarea = screen.getByPlaceholderText('Converted output will appear here...');
      expect((outputTextarea as HTMLTextAreaElement).value).toContain('INSERT INTO `users`');
      expect((outputTextarea as HTMLTextAreaElement).value).toContain('Alice Johnson');
    });
  });

  it('switches to Markdown Table tab and outputs markdown table', async () => {
    const user = userEvent.setup();
    renderWithToast(<DataConverterMain />);

    const markdownTab = screen.getByRole('button', { name: 'Markdown Table' });
    await user.click(markdownTab);

    await waitFor(() => {
      const outputTextarea = screen.getByPlaceholderText('Converted output will appear here...');
      expect((outputTextarea as HTMLTextAreaElement).value).toContain('| id');
      expect((outputTextarea as HTMLTextAreaElement).value).toContain('| ---');
      expect((outputTextarea as HTMLTextAreaElement).value).toContain('| Alice Johnson');
    });
  });

  it('triggers copy to clipboard', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
    renderWithToast(<DataConverterMain />);

    const copyBtn = screen.getByRole('button', { name: /copy output/i });
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalled();
  });

  it('switches between CSV and JSON in CSV ↔ JSON tab', async () => {
    const user = userEvent.setup();
    renderWithToast(<DataConverterMain />);

    const csvJsonTab = screen.getByRole('button', { name: 'CSV ↔ JSON' });
    await user.click(csvJsonTab);

    await waitFor(() => {
      const outputTextarea = screen.getByPlaceholderText('Converted output will appear here...');
      expect((outputTextarea as HTMLTextAreaElement).value).toContain('"name": "Alice Johnson"');
    });

    // Switch conversion direction
    const jsonToCsvBtn = screen.getByRole('button', { name: 'JSON → CSV' });
    await user.click(jsonToCsvBtn);

    // Load sample json
    const loadSampleBtn = screen.getByRole('button', { name: /Load Sample/i });
    await user.click(loadSampleBtn);

    await waitFor(() => {
      const outputTextarea = screen.getByPlaceholderText('Converted output will appear here...');
      expect((outputTextarea as HTMLTextAreaElement).value).toContain('Alice Johnson');
    });
  });

  it('clears input and displays error when invalid JSON is provided in JSON to SQL tab', async () => {
    const user = userEvent.setup();
    renderWithToast(<DataConverterMain />);

    // Clear input
    const clearBtn = screen.getByRole('button', { name: /Clear/i });
    await user.click(clearBtn);

    const inputArea = screen.getByPlaceholderText('Paste CSV or JSON here...');
    expect(inputArea).toHaveValue('');

    // Switch to JSON to SQL
    const jsonTab = screen.getByRole('button', { name: 'JSON to SQL' });
    await user.click(jsonTab);

    // Type invalid json
    fireEvent.change(inputArea, { target: { value: '{"broken": invalid}' } });

    await waitFor(() => {
      expect(screen.getByText(/JSON syntax error/i)).toBeInTheDocument();
    });
  });
});
