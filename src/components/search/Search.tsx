import {useRouter} from '@tanstack/react-router';
import {
    FacetedSearch,
    FacetsSection,
    getReadableRange,
    HookedDateRangeFacet,
    HookedFilterFacet,
    HookedNumericRangeFacet,
    HookedPagination,
    HookedResultsView,
    HookedSearchFacet,
    HookedSelectedFacets,
} from '@knaw-huc/faceted-search-react';
import type {Facets} from '@knaw-huc/faceted-search-react';
import {
    type Facet,
    useDataset,
    useFacets,
    usePanoptes,
    useRangeFacet,
    useSearch,
    useTextFacetItems,
} from '@knaw-huc/panoptes-react';
import MunicipalityMap from './MunicipalityMap.tsx';
import classes from './Search.module.css';

function RangeFacetRendering({facet, withTerms}: {facet: Facet, withTerms?: boolean}) {
    const {terms} = useRangeFacet(facet.property);
    return (
        <HookedNumericRangeFacet facetKey={facet.property}
                                 min={Number(terms[0].start)}
                                 max={Number(terms[terms.length - 1].end)}
                                 terms={withTerms ? terms : undefined}
                                 startOpen={facet.startOpen}
                                 step={1}/>
    );
}

function DateFacetRendering({facet}: {facet: Facet}) {
    const {terms} = useRangeFacet(facet.property);
    return (
        <HookedDateRangeFacet facetKey={facet.property}
                              min={String(terms[0].start)}
                              max={String(terms[terms.length - 1].end)}
                              terms={terms}
                              startOpen={facet.startOpen}/>
    );
}

function FacetRendering({facet}: {facet: Facet}) {
    switch (facet.type) {
        case 'text':
        case 'tree':
            return <HookedFilterFacet facetKey={facet.property}
                                      startOpen={facet.startOpen}
                                      useItems={useTextFacetItems}/>;
        case 'range':
            return <RangeFacetRendering facet={facet}/>;
        case 'histogram':
            return <RangeFacetRendering facet={facet} withTerms/>;
        case 'date':
            return <DateFacetRendering facet={facet}/>;
    }
}

function SearchFacets() {
    const {data: facets} = useFacets();
    return (
        <div className={classes.facets}>
            <FacetsSection>
                <HookedSearchFacet/>
                {facets.map((facet) => <FacetRendering key={facet.property} facet={facet}/>)}
            </FacetsSection>
        </div>
    );
}

function SearchResults() {
    const router = useRouter();
    const [dataset] = useDataset();
    const {detailPath, resultCardRenderer} = usePanoptes();

    return (
        <div className={classes.results}>
            <MunicipalityMap/>
            <HookedSelectedFacets/>
            <HookedResultsView useResults={useSearch} id={(result) => result.id}>
                {(result) => resultCardRenderer(result,
                    router.buildLocation({ to: detailPath, params: {dataset, id: result.id}}).href)}
            </HookedResultsView>
            <HookedPagination/>
        </div>
    );
}

// Sadly we need to copy over and reimplement the entire search component, which is basically a copy
// of the Panoptes-React search component plus an additional map component at the top.
export default function Search() {
    const {data: registeredFacets} = useFacets();
    const {translateFn, locale, pageSize} = usePanoptes();

    const facets = registeredFacets.reduce<Facets>((acc, facet) => {
        acc[facet.property] = {
            label: facet.name,
            valueRenderer: facet.type === 'range' ? (value) => getReadableRange(value, false) : undefined,
        };
        return acc;
    }, {});

    return (
        <FacetedSearch facets={facets} pageSize={pageSize} translate={translateFn} locale={locale}>
            <div className={classes.search}>
                <SearchFacets/>
                <SearchResults/>
            </div>
        </FacetedSearch>
    );
}
