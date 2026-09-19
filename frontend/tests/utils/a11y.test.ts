import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { onEnterOrSpace } from '../../src/utils/a11y';

function makeKeyboardEvent(key: string): KeyboardEvent {
    return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

describe('onEnterOrSpace', () => {
    it.each(['Enter', ' '])('calls the handler and preventDefault() for key "%s"', (key) => {
        const handler = vi.fn();
        const event = makeKeyboardEvent(key);

        onEnterOrSpace(handler)(event);

        expect(handler).toHaveBeenCalledWith(event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it.each(['Tab', 'Escape', 'a'])('does nothing for key "%s"', (key) => {
        const handler = vi.fn();
        const event = makeKeyboardEvent(key);

        onEnterOrSpace(handler)(event);

        expect(handler).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});
