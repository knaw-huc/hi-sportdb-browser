import {describe, expect, it} from 'vitest';
import {municipalityKey} from './municipalityKey.ts';

describe('municipalityKey', () => {
    it.each([
        ['Amsterdam', 'amsterdam'],
        ["'s-Gravenhage", 'sgravenhage'],
        ['Hengelo (O.)', 'hengelo_o'],
        ['Hengelo (Gld.)', 'hengelo_gld'],
        ['Middelburg (Z.)', 'middelburg_z'],
        ['Kollumerland en Nieuwkruisland', 'kollumerland'],
        ['Ilpendam', 'iipendam'],
        ['Ohé en Laak', 'ohenlaak'],
    ])('joins %s and %s to the same municipality', (name, legacy) => {
        expect(municipalityKey(name)).toBe(municipalityKey(legacy));
    });

    it('keeps municipalities in different provinces distinct', () => {
        expect(municipalityKey('Hengelo (O.)')).not.toBe(municipalityKey('Hengelo (Gld.)'));
        expect(municipalityKey('Bergen (NH.)')).not.toBe(municipalityKey('Bergen (L.)'));
    });
});
