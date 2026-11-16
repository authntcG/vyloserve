import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from '../../src/utils/clipboard';

describe('copyToClipboard utility', () => {
  const originalClipboard = navigator.clipboard;
  const originalIsSecureContext = window.isSecureContext;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: originalIsSecureContext,
      configurable: true,
      writable: true,
    });
  });

  it('copies using navigator.clipboard when available in secure context', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const res = await copyToClipboard('Hello World');
    expect(res).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('Hello World');
  });

  it('falls back to execCommand when navigator.clipboard throws', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
      configurable: true,
    });

    const execMock = vi.fn().mockReturnValue(true);
    document.execCommand = execMock;

    const res = await copyToClipboard('Fallback Text');
    expect(res).toBe(true);
    expect(execMock).toHaveBeenCalledWith('copy');
  });

  it('falls back to execCommand when isSecureContext is false', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });

    const execMock = vi.fn().mockReturnValue(true);
    document.execCommand = execMock;

    const res = await copyToClipboard('Insecure Context');
    expect(res).toBe(true);
    expect(execMock).toHaveBeenCalledWith('copy');
  });

  it('returns false when both clipboard API and execCommand fail or throw', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });

    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error('Exec error');
    });

    const res = await copyToClipboard('Failure Text');
    expect(res).toBe(false);
  });
});
