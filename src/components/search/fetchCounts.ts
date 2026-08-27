export interface FacetCount {
    value: string;
    count: number;
}

// Procrustus indexing uses gemeente1984 from the input data for indexing 'plaats'
export const MUNICIPALITY_FACET_KEY = 'plaats';
// Above the 749 municipalities of 1984, so every one of them gets a count.
export const MUNICIPALITY_FACET_AMOUNT = 1000;

export default async function fetchCounts(url: string, dataset: string, query: string | undefined,
                           facets: Record<string, string[]>): Promise<FacetCount[]> {
    const response = await fetch(`${url}/api/datasets/${dataset}/facet/${MUNICIPALITY_FACET_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: MUNICIPALITY_FACET_KEY,
            amount: MUNICIPALITY_FACET_AMOUNT,
            filter: '',
            sort: 'hits',
            query,
            facets
        }),
    });
    if (!response.ok) {
        throw new Error(`Unable to fetch ${MUNICIPALITY_FACET_KEY} counts!`);
    }
    return response.json();
}
