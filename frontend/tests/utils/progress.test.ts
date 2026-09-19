import { describe, it, expect } from 'vitest';
import { clampPercent } from '../../src/utils/progress';

describe('clampPercent', () => {
    it.each([
        [50, 50],
        [0, 0],
        [100, 100],
        [-5, 0],
        [150, 100],
        [Number.NaN, 0],
    ])('clampPercent(%s) -> %s', (input, expected) => {
        expect(clampPercent(input)).toBe(expected);
    });
});
