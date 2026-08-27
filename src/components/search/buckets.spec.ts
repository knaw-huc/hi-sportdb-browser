import {describe, expect, it} from 'vitest';
import {bucketsFor, colorFor, EMPTY_COLOR, RAMP, styleFor} from './buckets.ts';

describe('bucketsFor', () => {
    it('returns no buckets when there is nothing to shade', () => {
        expect(bucketsFor([])).toEqual([]);
        expect(bucketsFor([0, 0, 0])).toEqual([]);
    });

    it('collapses to a single open-ended bucket when every count is the same', () => {
        expect(bucketsFor([7, 7, 7])).toEqual([{min: 7, max: undefined, color: RAMP[RAMP.length - 1]}]);
    });

    it('ignores zeroes when deciding the lowest count', () => {
        // 0 is "no results", not a low result, so a single non-zero count still
        // collapses to one bucket.
        expect(bucketsFor([0, 5, 0])).toEqual([{min: 5, max: undefined, color: RAMP[RAMP.length - 1]}]);
    });

    it('spreads a wide range logarithmically over the full ramp, darkest first', () => {
        expect(bucketsFor([1, 5, 12, 40, 200, 1000])).toEqual([
            {min: 316, max: undefined, color: '#094870'},
            {min: 100, max: 315, color: '#3d76a3'},
            {min: 32, max: 99, color: '#6699c0'},
            {min: 10, max: 31, color: '#8fb5d3'},
            {min: 3, max: 9, color: '#b7d0e3'},
            {min: 1, max: 2, color: '#dce9f2'},
        ]);
    });

    it('never produces more buckets than there are ramp colours', () => {
        expect(bucketsFor([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 5000]).length).toBeLessThanOrEqual(RAMP.length);
    });

    it('drops bounds that round onto each other instead of emitting empty buckets', () => {
        // A logarithmic split of 1..3 over six buckets rounds to the same
        // integer several times over; only the distinct bounds survive.
        expect(bucketsFor([1, 2, 3])).toEqual([
            {min: 3, max: undefined, color: '#3d76a3'},
            {min: 2, max: 2, color: '#8fb5d3'},
            {min: 1, max: 1, color: '#dce9f2'},
        ]);
    });

    it('leaves the top bucket open-ended and the rest contiguous', () => {
        const buckets = bucketsFor([1, 5, 12, 40, 200, 1000]);

        expect(buckets[0].max).toBeUndefined();
        // Read low to high: every bucket ends exactly where the next one starts.
        [...buckets].reverse().forEach((bucket, index, ascending) => {
            const next = ascending[index + 1];
            if (next) {
                expect(bucket.max).toBe(next.min - 1);
            }
        });
    });

    it('covers the highest count in the top bucket', () => {
        const highest = 1000;
        const buckets = bucketsFor([1, highest]);

        expect(highest).toBeGreaterThanOrEqual(buckets[0].min);
        expect(colorFor(highest, buckets)).toBe(buckets[0].color);
    });

    it('rounds fractional counts before bucketing them', () => {
        expect(bucketsFor([6.6, 7.4])).toEqual([{min: 7, max: undefined, color: RAMP[RAMP.length - 1]}]);
    });

    it('does not reach the darkest ramp colours when the range is narrow', () => {
        // Documents current behaviour: colours are spread proportionally over
        // however many bounds survived rounding, so a two-bucket legend tops
        // out halfway up the ramp rather than at the darkest colour.
        expect(bucketsFor([1, 2])).toEqual([
            {min: 2, max: undefined, color: RAMP[3]},
            {min: 1, max: 1, color: RAMP[0]},
        ]);
    });
});

describe('colorFor', () => {
    const buckets = bucketsFor([1, 5, 12, 40, 200, 1000]);

    it('picks the bucket the count falls into', () => {
        expect(colorFor(1, buckets)).toBe('#dce9f2');
        expect(colorFor(2, buckets)).toBe('#dce9f2');
        expect(colorFor(3, buckets)).toBe('#b7d0e3');
        expect(colorFor(315, buckets)).toBe('#3d76a3');
        expect(colorFor(316, buckets)).toBe('#094870');
    });

    it('keeps counts above the top bound in the open-ended bucket', () => {
        expect(colorFor(99999, buckets)).toBe('#094870');
    });

    it('falls back to the empty colour below the lowest bucket', () => {
        expect(colorFor(0, buckets)).toBe(EMPTY_COLOR);
    });

    it('falls back to the empty colour when there are no buckets at all', () => {
        expect(colorFor(42, [])).toBe(EMPTY_COLOR);
    });
});

describe('styleFor', () => {
    const buckets = bucketsFor([1, 1000]);

    it('shades municipalities with results more opaquely than empty ones', () => {
        expect(styleFor(10, false, buckets).fillOpacity).toBe(0.85);
        expect(styleFor(0, false, buckets).fillOpacity).toBe(0.55);
    });

    it('outlines the selected municipalities', () => {
        expect(styleFor(10, true, buckets)).toMatchObject({color: '#c1440e', weight: 2.5});
        expect(styleFor(10, false, buckets)).toMatchObject({color: '#ffffff', weight: 0.5});
    });

    it('greys out a municipality without results even when it is selected', () => {
        expect(styleFor(0, true, buckets)).toMatchObject({fillColor: EMPTY_COLOR, color: '#c1440e'});
    });
});
