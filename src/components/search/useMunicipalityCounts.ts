import {useDataset, usePanoptes} from "@knaw-huc/panoptes-react";
import {useSearchState} from "@knaw-huc/faceted-search-react";
import {keepPreviousData, useQuery} from "@tanstack/react-query";
import fetchCounts, {type FacetCount} from "./fetchCounts.ts";

export default function useMunicipalityCounts(): FacetCount[] {
    const {url} = usePanoptes();
    const [dataset] = useDataset();
    const {query, facetValues} = useSearchState();

    const {data} = useQuery({
        queryKey: ['gemeente-counts', url, dataset, query, facetValues],
        queryFn: () => fetchCounts(url, dataset, query, facetValues),
        placeholderData: keepPreviousData,
    });
    return data ?? [];
}
