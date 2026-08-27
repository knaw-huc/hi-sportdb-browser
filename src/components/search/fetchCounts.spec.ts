import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import fetchCounts, {MUNICIPALITY_FACET_AMOUNT, MUNICIPALITY_FACET_KEY} from './fetchCounts.ts';

const ok = (body: unknown) => ({ok: true, json: async () => body}) as Response;

describe('fetchCounts', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([])));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('asks the facet endpoint of the given dataset', async () => {
        await fetchCounts('https://panoptes.example', 'sport', undefined, {});

        expect(fetch).toHaveBeenCalledWith(
            `https://panoptes.example/api/datasets/sport/facet/${MUNICIPALITY_FACET_KEY}`,
            expect.objectContaining({method: 'POST', headers: {'Content-Type': 'application/json'}}));
    });

    it('asks for enough facet values to cover every 1984 municipality', async () => {
        await fetchCounts('https://panoptes.example', 'sport', 'korfbal', {sport: ['korfbal']});

        const [, init] = vi.mocked(fetch).mock.calls[0];
        expect(JSON.parse(String(init?.body))).toEqual({
            name: MUNICIPALITY_FACET_KEY,
            amount: MUNICIPALITY_FACET_AMOUNT,
            filter: '',
            sort: 'hits',
            query: 'korfbal',
            facets: {sport: ['korfbal']},
        });
        // 749 municipalities existed in 1984; anything less would silently
        // leave part of the map uncolored.
        expect(MUNICIPALITY_FACET_AMOUNT).toBeGreaterThan(749);
    });

    it('leaves an absent query out of the body rather than sending null', async () => {
        await fetchCounts('https://panoptes.example', 'sport', undefined, {});

        const [, init] = vi.mocked(fetch).mock.calls[0];
        expect(JSON.parse(String(init?.body))).not.toHaveProperty('query');
    });

    it('returns the parsed counts', async () => {
        const counts = [{value: 'amsterdam', count: 120}, {value: 'utrecht', count: 40}];
        vi.mocked(fetch).mockResolvedValue(ok(counts));

        await expect(fetchCounts('https://panoptes.example', 'sport', undefined, {})).resolves.toEqual(counts);
    });

    it('throws when the endpoint answers with an error status', async () => {
        vi.mocked(fetch).mockResolvedValue({ok: false, status: 500} as Response);

        await expect(fetchCounts('https://panoptes.example', 'sport', undefined, {}))
            .rejects.toThrow(`Unable to fetch ${MUNICIPALITY_FACET_KEY} counts!`);
    });

    it('propagates a network failure', async () => {
        vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(fetchCounts('https://panoptes.example', 'sport', undefined, {}))
            .rejects.toThrow('Failed to fetch');
    });
});
