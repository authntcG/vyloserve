import { describe, it, expect } from 'vitest';
import { compareVersions } from '../../src/utils/version';

describe('compareVersions', () => {
    it.each([
        ['8.2.10', '8.2.9', 1],
        ['8.2.9', '8.2.10', -1],
        ['8.2.9', '8.2.9', 0],
        ['8.3.0', '8.2.99', 1],
        ['8.2', '8.2.0', 0],
        ['8.2.1', '8.2', 1],
        ['10.11.6', '10.11.6', 0],
        ['16', '15', 1],
    ])('compareVersions(%s, %s) -> %s', (v1, v2, expected) => {
        expect(compareVersions(v1, v2)).toBe(expected);
    });
});
