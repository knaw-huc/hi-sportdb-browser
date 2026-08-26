import type {ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import fetchCounts from './fetchCounts.ts';
import useMunicipalityCounts from './useMunicipalityCounts.ts';

vi.mock('./fetchCounts.ts', () => ({default: vi.fn()}));

const searchState = {query: undefined as string | undefined, facetValues: {} as Record<string, string[]>};

vi.mock('@knaw-huc/panoptes-react', () => ({
    usePanoptes: () => ({url: 'https://panoptes.example'}),
    useDataset: () => ['sport'],
}));
vi.mock('@knaw-huc/faceted-search-react', () => ({
    useSearchState: () => searchState,
}));

const wrapper = ({children}: {children: ReactNode}) => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useMunicipalityCounts', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        searchState.query = undefined;
        searchState.facetValues = {};
        vi.mocked(fetchCounts).mockResolvedValue([]);
    });

    it('returns an empty list while the counts are still loading', () => {
        const {result} = renderHook(() => useMunicipalityCounts(), {wrapper});
        expect(result.current).toEqual([]);
    });

    it('returns the counts once they arrive', async () => {
        const counts = [{value: 'amsterdam', count: 120}];
        vi.mocked(fetchCounts).mockResolvedValue(counts);

        const {result} = renderHook(() => useMunicipalityCounts(), {wrapper});

        await waitFor(() => expect(result.current).toEqual(counts));
    });

    it('counts against the current query and facet selection', async () => {
        searchState.query = 'korfbal';
        searchState.facetValues = {sport: ['korfbal']};

        renderHook(() => useMunicipalityCounts(), {wrapper});

        await waitFor(() => expect(fetchCounts).toHaveBeenCalledWith(
            'https://panoptes.example', 'sport', 'korfbal', {sport: ['korfbal']}));
    });

    it('re-counts when the search changes', async () => {
        const {rerender} = renderHook(() => useMunicipalityCounts(), {wrapper});
        await waitFor(() => expect(fetchCounts).toHaveBeenCalledTimes(1));

        searchState.query = 'schaken';
        rerender();

        await waitFor(() => expect(fetchCounts).toHaveBeenLastCalledWith(
            'https://panoptes.example', 'sport', 'schaken', {}));
    });

    it('keeps showing the previous counts while the new ones are fetched', async () => {
        const first = [{value: 'amsterdam', count: 120}];
        vi.mocked(fetchCounts).mockResolvedValue(first);

        const {result, rerender} = renderHook(() => useMunicipalityCounts(), {wrapper});
        await waitFor(() => expect(result.current).toEqual(first));

        // The map would flash back to grey between searches without
        // keepPreviousData.
        vi.mocked(fetchCounts).mockReturnValue(new Promise(() => undefined));
        searchState.query = 'schaken';
        rerender();

        expect(result.current).toEqual(first);
    });

    it('falls back to an empty list when the counts cannot be fetched', async () => {
        vi.mocked(fetchCounts).mockRejectedValue(new Error('Unable to fetch plaats counts!'));

        const {result} = renderHook(() => useMunicipalityCounts(), {wrapper});

        await waitFor(() => expect(vi.mocked(fetchCounts)).toHaveBeenCalled());
        expect(result.current).toEqual([]);
    });
});
