import type {ReactNode} from 'react';
import type {Feature, Polygon} from 'geojson';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import {act} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {colorFor, bucketsFor, EMPTY_COLOR, SELECTED_COLOR} from './buckets.ts';
import {loadMunicipalities} from './loadMunicipalities.ts';
import useMunicipalityCounts from './useMunicipalityCounts.ts';
import MunicipalityMap from './MunicipalityMap.tsx';

// Leaflet needs a laid-out container and a real browser to draw into, so the
// map itself is faked: the tests are about which shapes get which style, which
// handlers are wired up and what a drag selects, not about Leaflet's rendering.
const leaflet = vi.hoisted(() => {
    interface LatLng {
        lat: number;
        lng: number;
    }

    // A bounds is only ever asked whether it contains a shape, so longitude is
    // enough to place everything on a line from west to east.
    const latLngBounds = vi.fn((a: LatLng, b: LatLng) => ({
        west: Math.min(a.lng, b.lng),
        east: Math.max(a.lng, b.lng),
        intersects: vi.fn(function (this: {west: number, east: number}, other: {lng: number}) {
            return other.lng >= this.west && other.lng <= this.east;
        }),
    }));

    const makeShape = (lng: number) => ({
        handlers: {} as Record<string, () => void>,
        on: vi.fn(function (this: {handlers: Record<string, () => void>}, event: string, fn: () => void) {
            this.handlers[event] = fn;
            return this;
        }),
        setStyle: vi.fn(),
        bindTooltip: vi.fn(),
        setTooltipContent: vi.fn(),
        getBounds: vi.fn(() => ({lng})),
    });

    type Shape = ReturnType<typeof makeShape>;

    const makeLayer = (features: Feature<Polygon>[], options: {
        style?: unknown,
        onEachFeature?: (feature: Feature<Polygon>, shape: Shape) => void,
    }) => {
        const shapes = features.map((feature) => makeShape(feature.geometry.coordinates[0][0][0]));
        shapes.forEach((shape, index) => options?.onEachFeature?.(features[index], shape));

        const layer = {
            shapes,
            style: options?.style,
            getLayers: () => shapes,
            getBounds: vi.fn(() => latLngBounds({lat: 50, lng: 3}, {lat: 54, lng: 8})),
            addTo: vi.fn((): Layer => layer),
            remove: vi.fn(),
        };
        return layer;
    };

    type Layer = ReturnType<typeof makeLayer>;

    const makeBox = () => {
        const box = {addTo: vi.fn((): Box => box), setBounds: vi.fn(), remove: vi.fn()};
        return box;
    };

    type Box = ReturnType<typeof makeBox>;

    const makeMap = () => {
        const container = document.createElement('div');
        const handlers: Record<string, ((event: unknown) => void)[]> = {};
        const instance = {
            container,
            fitBounds: vi.fn(() => instance),
            invalidateSize: vi.fn(),
            getContainer: () => container,
            dragging: {disable: vi.fn(), enable: vi.fn()},
            on: vi.fn((event: string, fn: (event: unknown) => void) => {
                (handlers[event] ??= []).push(fn);
                return instance;
            }),
            off: vi.fn((event: string, fn: (event: unknown) => void) => {
                handlers[event] = (handlers[event] ?? []).filter((handler) => handler !== fn);
                return instance;
            }),
            remove: vi.fn(),
            fire: (event: string, payload: unknown) => (handlers[event] ?? [])
                .forEach((handler) => handler(payload)),
        };
        return instance;
    };

    type MapInstance = ReturnType<typeof makeMap>;

    const maps: MapInstance[] = [];
    const layers: Layer[] = [];
    const rectangles: Box[] = [];

    const geoJSON = vi.fn((...args: Parameters<typeof makeLayer>) => {
        const layer = makeLayer(...args);
        layers.push(layer);
        return layer;
    });

    const rectangle = vi.fn(() => {
        const box = makeBox();
        rectangles.push(box);
        return box;
    });

    const map = vi.fn(() => {
        const instance = makeMap();
        maps.push(instance);
        return instance;
    });

    return {L: {map, geoJSON, rectangle, latLngBounds}, maps, layers, rectangles};
});

vi.mock('leaflet', () => ({default: leaflet.L}));
vi.mock('./loadMunicipalities.ts', () => ({loadMunicipalities: vi.fn()}));
vi.mock('./useMunicipalityCounts.ts', () => ({default: vi.fn()}));

// Renders the interpolation values into the key, so assertions can name the key
// they expect rather than a translated sentence.
const t = (key: string, options?: Record<string, unknown>) =>
    [key, ...(options ? Object.values(options) : [])].join(':');

const facet: {values: string | string[], setValues: ReturnType<typeof vi.fn>} =
    {values: [], setValues: vi.fn()};

vi.mock('@knaw-huc/faceted-search-react', () => ({
    useTranslate: () => ({t}),
    useFacet: () => ({label: 'Plaats', values: facet.values, setValues: facet.setValues}),
}));

const polygon = (lng: number): Feature<Polygon> => ({
    type: 'Feature',
    properties: {},
    geometry: {type: 'Polygon', coordinates: [[[lng, 52], [lng + 0.1, 52], [lng + 0.1, 52.1], [lng, 52]]]},
});

const GEMEENTEN = [
    {value: 'amsterdam', name: 'Amsterdam', feature: polygon(4.9)},
    {value: 'utrecht', name: 'Utrecht', feature: polygon(5.1)},
    {value: 'groningen', name: 'Groningen', feature: polygon(6.6)},
];

const COUNTS = [
    {value: 'amsterdam', count: 120},
    {value: 'utrecht', count: 12},
    // A value the 1984 boundaries do not know: it has no place on the map.
    {value: 'onbekend', count: 7},
];

const point = (x: number, y: number) => ({
    x, y,
    distanceTo: (other: {x: number, y: number}) => Math.hypot(other.x - x, other.y - y),
});

const wrapper = ({children}: {children: ReactNode}) => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

// The polygons are only on the map once the boundaries have loaded.
const renderMap = async () => {
    const rendered = render(<MunicipalityMap/>, {wrapper});
    await waitFor(() => expect(leaflet.layers).not.toHaveLength(0));
    return rendered;
};

const currentMap = () => leaflet.maps[leaflet.maps.length - 1];
const shapesOf = () => leaflet.layers[leaflet.layers.length - 1].shapes;

const startBoxMode = async () => {
    await act(async () => {
        screen.getByRole('button', {name: 'gemeenteMap.box.start'}).click();
    });
};

const drag = async (from: {lng: number, at: ReturnType<typeof point>},
                    to: {lng: number, at: ReturnType<typeof point>}) => {
    const map = currentMap();
    await act(async () => {
        map.fire('mousedown', {latlng: {lat: 52, lng: from.lng}, containerPoint: from.at});
        map.fire('mousemove', {latlng: {lat: 52, lng: to.lng}, containerPoint: to.at});
        map.fire('mouseup', {latlng: {lat: 52, lng: to.lng}, containerPoint: to.at});
    });
};

describe('MunicipalityMap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leaflet.maps.length = 0;
        leaflet.layers.length = 0;
        leaflet.rectangles.length = 0;
        facet.values = [];
        vi.mocked(loadMunicipalities).mockResolvedValue(GEMEENTEN);
        vi.mocked(useMunicipalityCounts).mockReturnValue(COUNTS);
    });

    describe('drawing the municipalities', () => {
        it('draws every municipality once and keeps it addressable by facet value', async () => {
            await renderMap();

            expect(leaflet.L.geoJSON).toHaveBeenCalledTimes(1);
            expect(shapesOf()).toHaveLength(GEMEENTEN.length);
        });

        it('fits the map to the drawn boundaries after remeasuring the container', async () => {
            await renderMap();

            const map = currentMap();
            // The flex column has not settled on its width when the map is
            // created, so the first fit is against the wrong size.
            expect(map.invalidateSize).toHaveBeenCalled();
            expect(map.fitBounds).toHaveBeenLastCalledWith(leaflet.layers[0].getBounds.mock.results[0].value);
        });

        it('shades each municipality by its own count', async () => {
            await renderMap();

            const buckets = bucketsFor(COUNTS.map((count) => count.count));
            const [amsterdam, utrecht, groningen] = shapesOf();
            expect(amsterdam.setStyle).toHaveBeenLastCalledWith(
                expect.objectContaining({fillColor: colorFor(120, buckets), fillOpacity: 0.85}));
            expect(utrecht.setStyle).toHaveBeenLastCalledWith(
                expect.objectContaining({fillColor: colorFor(12, buckets), fillOpacity: 0.85}));
            // Groningen has no results in this search.
            expect(groningen.setStyle).toHaveBeenLastCalledWith(
                expect.objectContaining({fillColor: EMPTY_COLOR, fillOpacity: 0.55}));
        });

        it('outlines the municipalities that are part of the selection', async () => {
            facet.values = ['utrecht'];
            await renderMap();

            const [amsterdam, utrecht] = shapesOf();
            expect(utrecht.setStyle).toHaveBeenLastCalledWith(
                expect.objectContaining({color: SELECTED_COLOR, weight: 2.5}));
            expect(amsterdam.setStyle).toHaveBeenLastCalledWith(
                expect.objectContaining({color: '#ffffff', weight: 0.5}));
        });

        it('labels each municipality with its name and result count', async () => {
            await renderMap();

            const [amsterdam, , groningen] = shapesOf();
            expect(amsterdam.setTooltipContent)
                .toHaveBeenLastCalledWith('<b>Amsterdam</b><br/>gemeenteMap.tooltip:120');
            expect(groningen.setTooltipContent)
                .toHaveBeenLastCalledWith('<b>Groningen</b><br/>gemeenteMap.tooltip:0');
        });

        it('restyles the existing shapes when the counts change instead of redrawing them', async () => {
            const {rerender} = await renderMap();
            const [amsterdam] = shapesOf();
            const stylings = amsterdam.setStyle.mock.calls.length;

            vi.mocked(useMunicipalityCounts).mockReturnValue([{value: 'amsterdam', count: 3}]);
            await act(async () => {
                rerender(<MunicipalityMap/>);
            });

            // Drawing 749 polygons is the expensive part; only the styling
            // should be redone.
            expect(leaflet.L.geoJSON).toHaveBeenCalledTimes(1);
            expect(amsterdam.setStyle.mock.calls.length).toBeGreaterThan(stylings);
        });

        it('removes the map on unmount', async () => {
            const {unmount} = await renderMap();
            const map = currentMap();

            unmount();

            expect(map.remove).toHaveBeenCalled();
        });
    });

    describe('clicking a municipality', () => {
        it('adds it to the selection', async () => {
            await renderMap();

            await act(async () => shapesOf()[0].handlers.click());

            expect(facet.setValues).toHaveBeenCalledWith(['amsterdam']);
        });

        it('removes it again when it was already selected', async () => {
            facet.values = ['amsterdam', 'utrecht'];
            await renderMap();

            await act(async () => shapesOf()[0].handlers.click());

            expect(facet.setValues).toHaveBeenCalledWith(['utrecht']);
        });

        it('keeps the rest of the selection', async () => {
            facet.values = ['groningen'];
            await renderMap();

            await act(async () => shapesOf()[1].handlers.click());

            expect(facet.setValues).toHaveBeenCalledWith(['groningen', 'utrecht']);
        });
    });

    describe('selecting an area', () => {
        it('takes over the map while an area is being drawn', async () => {
            await renderMap();
            await startBoxMode();

            const map = currentMap();
            expect(map.dragging.disable).toHaveBeenCalled();
            expect(map.getContainer().className).toContain('drawing');
            expect(screen.getByRole('button', {name: 'gemeenteMap.box.cancel'})).toHaveAttribute('aria-pressed', 'true');
        });

        it('replaces the selection with everything the box covers', async () => {
            facet.values = ['groningen'];
            await renderMap();
            await startBoxMode();

            await drag({lng: 4.5, at: point(0, 0)}, {lng: 5.5, at: point(120, 90)});

            // Picking an area means picking exactly that area, so Groningen
            // drops out rather than staying selected.
            expect(facet.setValues).toHaveBeenCalledWith(['amsterdam', 'utrecht']);
        });

        it('ignores a drag too small to be meant as a box', async () => {
            await renderMap();
            await startBoxMode();

            // Under MIN_BOX_PIXELS: a click that wobbled, not a selection.
            await drag({lng: 4.5, at: point(0, 0)}, {lng: 5.5, at: point(3, 3)});

            expect(facet.setValues).not.toHaveBeenCalled();
        });

        it('selects nothing when the box covers no municipality', async () => {
            await renderMap();
            await startBoxMode();

            await drag({lng: 3.4, at: point(0, 0)}, {lng: 3.6, at: point(60, 60)});

            expect(facet.setValues).toHaveBeenCalledWith([]);
        });

        it('follows the pointer with the drawn box', async () => {
            await renderMap();
            await startBoxMode();

            await drag({lng: 4.5, at: point(0, 0)}, {lng: 5.5, at: point(120, 90)});

            const [box] = leaflet.rectangles;
            expect(box.setBounds).toHaveBeenCalled();
            expect(box.remove).toHaveBeenCalled();
        });

        it('leaves box mode and hands the map back after the drag', async () => {
            await renderMap();
            await startBoxMode();

            await drag({lng: 4.5, at: point(0, 0)}, {lng: 5.5, at: point(120, 90)});

            const map = currentMap();
            expect(map.dragging.enable).toHaveBeenCalled();
            expect(map.getContainer().className).not.toContain('drawing');
            expect(screen.getByRole('button', {name: 'gemeenteMap.box.start'})).toHaveAttribute('aria-pressed', 'false');
        });

        it('hands the map back when box mode is cancelled without drawing', async () => {
            await renderMap();
            await startBoxMode();

            await act(async () => {
                screen.getByRole('button', {name: 'gemeenteMap.box.cancel'}).click();
            });

            const map = currentMap();
            expect(map.dragging.enable).toHaveBeenCalled();
            expect(facet.setValues).not.toHaveBeenCalled();
        });
    });

    describe('the toolbar', () => {
        it('offers to clear the selection only when something is selected', async () => {
            await renderMap();
            expect(screen.queryByRole('button', {name: /gemeenteMap.clear/})).not.toBeInTheDocument();
        });

        it('names how many municipalities the selection holds', async () => {
            facet.values = ['amsterdam', 'utrecht'];
            await renderMap();

            expect(screen.getByRole('button', {name: 'gemeenteMap.clear:2'})).toBeInTheDocument();
        });

        it('clears the whole selection', async () => {
            facet.values = ['amsterdam'];
            await renderMap();

            await act(async () => {
                screen.getByRole('button', {name: 'gemeenteMap.clear:1'}).click();
            });

            expect(facet.setValues).toHaveBeenCalledWith([]);
        });

        it('accepts a single selected value that is not wrapped in an array', async () => {
            facet.values = 'amsterdam';
            await renderMap();

            expect(screen.getByRole('button', {name: 'gemeenteMap.clear:1'})).toBeInTheDocument();
        });

        it('treats an empty facet value as no selection', async () => {
            facet.values = '';
            await renderMap();

            expect(screen.queryByRole('button', {name: /gemeenteMap.clear/})).not.toBeInTheDocument();
        });
    });

    describe('the legend', () => {
        it('lists a swatch per bucket, darkest first', async () => {
            await renderMap();

            const buckets = bucketsFor(COUNTS.map((count) => count.count));
            const entries = screen.getAllByRole('listitem');
            expect(entries).toHaveLength(buckets.length);
            expect(entries[0]).toHaveTextContent(`gemeenteMap.legend.from:${buckets[0].min}`);
        });

        it('reads the closed buckets as a range', async () => {
            await renderMap();

            const buckets = bucketsFor(COUNTS.map((count) => count.count));
            const closed = buckets[buckets.length - 1];
            expect(screen.getAllByRole('listitem').at(-1))
                .toHaveTextContent(`gemeenteMap.legend.range:${closed.min}:${closed.max}`);
        });

        it('stays empty while there is nothing to shade', async () => {
            vi.mocked(useMunicipalityCounts).mockReturnValue([]);
            await renderMap();

            expect(screen.queryAllByRole('listitem')).toHaveLength(0);
        });
    });

    describe('what the map cannot show', () => {
        it('reports the results that fall outside the 1984 municipalities', async () => {
            await renderMap();

            expect(screen.getByText('gemeenteMap.unmapped:7')).toBeInTheDocument();
        });

        it('adds up every unmapped value', async () => {
            vi.mocked(useMunicipalityCounts).mockReturnValue([
                {value: 'amsterdam', count: 5},
                {value: 'onbekend', count: 7},
                {value: 'anders', count: 3},
            ]);
            await renderMap();

            expect(screen.getByText('gemeenteMap.unmapped:10')).toBeInTheDocument();
        });

        it('says nothing when every result sits on the map', async () => {
            vi.mocked(useMunicipalityCounts).mockReturnValue([{value: 'amsterdam', count: 5}]);
            await renderMap();

            expect(screen.queryByText(/gemeenteMap.unmapped/)).not.toBeInTheDocument();
        });

        it('says the boundaries could not be loaded rather than leaving an empty map', async () => {
            vi.mocked(loadMunicipalities).mockRejectedValue(new Error('Unable to fetch the 1984 municipal boundaries!'));
            render(<MunicipalityMap/>, {wrapper});

            expect(await screen.findByText('gemeenteMap.error')).toBeInTheDocument();
        });

        it('is still labelled for screen readers when the boundaries fail', async () => {
            vi.mocked(loadMunicipalities).mockRejectedValue(new Error('boom'));
            render(<MunicipalityMap/>, {wrapper});

            await screen.findByText('gemeenteMap.error');
            expect(screen.getByRole('region', {name: 'gemeenteMap.label'})).toBeInTheDocument();
        });
    });
});
