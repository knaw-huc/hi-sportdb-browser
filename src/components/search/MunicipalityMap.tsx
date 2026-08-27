import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useFacet, useTranslate} from '@knaw-huc/faceted-search-react';
import 'leaflet/dist/leaflet.css';
import {type Gemeente, loadMunicipalities} from './loadMunicipalities.ts';
import classes from './MunicipalityMap.module.css';
import L from 'leaflet';
import useMunicipalityCounts from "./useMunicipalityCounts.ts";
import {MUNICIPALITY_FACET_KEY} from "./fetchCounts.ts";
import {bucketsFor, SELECTED_COLOR, styleFor} from './buckets.ts';

const NETHERLANDS: L.LatLngBoundsLiteral = [[50.7, 3.3], [53.6, 7.3]];

const MIN_BOX_PIXELS = 8;

const MunicipalityMap = () => {
    const {t} = useTranslate();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const shapesRef = useRef(new Map<string, L.Polygon>());
    const [boxMode, setBoxMode] = useState(false);

    // The boundaries come from an external service now, so a failure has to say something went wrong,
    // rather than leave an empty map behind.
    const {data: gemeenten, isError} = useQuery({
        queryKey: ['gemeenten-1984'],
        queryFn: loadMunicipalities,
        staleTime: Infinity,
    });
    const counts = useMunicipalityCounts();
    const {values, setValues} = useFacet(MUNICIPALITY_FACET_KEY, []);

    const selected = useMemo(
        () => new Set(Array.isArray(values) ? values : [values].filter(Boolean)),
        [values]);

    const countByValue = useMemo(
        () => new Map(counts.map((count) => [count.value, count.count])),
        [counts]);

    const buckets = useMemo(
        () => bucketsFor(counts.map((count) => count.count)),
        [counts]);

    // Values the backend knows but the 1984 boundaries don't: the `onbekend`
    // and `anders` sentinels. Those results have no place on the map.
    const unmapped = useMemo(() => {
        if (!gemeenten) {
            return 0;
        }
        const mapped = new Set(gemeenten.map((gemeente) => gemeente.value));
        return counts.filter((count) => !mapped.has(count.value))
            .reduce((total, count) => total + count.count, 0);
    }, [counts, gemeenten]);

    // The click handlers below are registered once and outlive the render they
    // were created in, so they reach the current selection through a ref rather
    // than closing over a stale copy of it.
    const toggleRef = useRef<(value: string) => void>(() => undefined);
    useEffect(() => {
        toggleRef.current = (value: string) => {
            const next = new Set(selected);
            if (!next.delete(value)) next.add(value);
            setValues([...next]);
        };
    }, [selected, setValues]);

    const selectWithin = useCallback((bounds: L.LatLngBounds) => {
        const within = [...shapesRef.current.entries()]
            .filter(([, shape]) => bounds.intersects(shape.getBounds()))
            .map(([value]) => value);
        setValues(within);
    }, [setValues]);

    useEffect(() => {
        if (!containerRef.current) return;

        const shapes = shapesRef.current;
        const map = L.map(containerRef.current, {
            preferCanvas: true,
            boxZoom: false,
            attributionControl: true,
            zoomSnap: 0.25,
        }).fitBounds(NETHERLANDS);
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            shapes.clear();
        };
    }, []);

    // Drawing the 749 polygons is the expensive part, so it happens once and
    // later renders only restyle the shapes that are already on the map.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !gemeenten) return;

        const shapes = shapesRef.current;
        const layer = L.geoJSON(gemeenten.map((gemeente) => gemeente.feature), {
            style: styleFor(0, false, []),
            onEachFeature: (_feature, shape) => shape.bindTooltip('', {sticky: true}),
        }).addTo(map);

        gemeenten.forEach((gemeente: Gemeente, index) => {
            const shape = layer.getLayers()[index] as L.Polygon;
            shape.on('click', () => toggleRef.current(gemeente.value));
            shapes.set(gemeente.value, shape);
        });

        // The map is set up before the flex column around it has settled on its
        // final width, so the initial fit is against the wrong size. Measure
        // again and fit to what was actually drawn.
        map.invalidateSize();
        map.fitBounds(layer.getBounds());

        return () => {
            layer.remove();
            shapes.clear();
        };
    }, [gemeenten]);

    useEffect(() => {
        if (!gemeenten) return;

        gemeenten.forEach((gemeente) => {
            const shape = shapesRef.current.get(gemeente.value);
            if (!shape) return;

            const count = countByValue.get(gemeente.value) ?? 0;
            shape.setStyle(styleFor(count, selected.has(gemeente.value), buckets));
            shape.setTooltipContent(`<b>${gemeente.name}</b><br/>${t('gemeenteMap.tooltip', {count})}`);
        });
    }, [buckets, countByValue, gemeenten, selected, t]);

    // Dragging out an area replaces the selection — that is what picking an
    // area means; individual municipalities keep toggling on click.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !boxMode) return;

        const container = map.getContainer();
        map.dragging.disable();
        container.classList.add(classes.drawing);

        let origin: L.LatLng | null = null;
        let originPoint: L.Point | null = null;
        let box: L.Rectangle | null = null;

        const onDown = (event: L.LeafletMouseEvent) => {
            origin = event.latlng;
            originPoint = event.containerPoint;
            box = L.rectangle(L.latLngBounds(origin, origin), {
                color: SELECTED_COLOR, weight: 1.5, dashArray: '4', fillOpacity: 0.1,
            }).addTo(map);
        };

        const onMove = (event: L.LeafletMouseEvent) => {
            if (origin && box) box.setBounds(L.latLngBounds(origin, event.latlng));
        };

        const onUp = (event: L.LeafletMouseEvent) => {
            if (origin && originPoint
                && originPoint.distanceTo(event.containerPoint) >= MIN_BOX_PIXELS)
                selectWithin(L.latLngBounds(origin, event.latlng));

            setBoxMode(false);
        };

        map.on('mousedown', onDown).on('mousemove', onMove).on('mouseup', onUp);

        return () => {
            map.off('mousedown', onDown).off('mousemove', onMove).off('mouseup', onUp);
            box?.remove();
            map.dragging.enable();
            container.classList.remove(classes.drawing);
        };
    }, [boxMode, selectWithin]);

    return (
        <section className={classes.wrapper} aria-label={t('gemeenteMap.label')}>
            <div className={classes.toolbar}>
                <button type="button"
                        className={boxMode ? classes.buttonActive : classes.button}
                        aria-pressed={boxMode}
                        onClick={() => setBoxMode((active) => !active)}>
                    {t(boxMode ? 'gemeenteMap.box.cancel' : 'gemeenteMap.box.start')}
                </button>
                {selected.size > 0 && (
                    <button type="button" className={classes.button} onClick={() => setValues([])}>
                        {t('gemeenteMap.clear', {count: selected.size})}
                    </button>
                )}
                <ul className={classes.legend}>
                    {buckets.map((bucket) => (
                        <li key={bucket.min}>
                            <span className={classes.swatch} style={{background: bucket.color}}/>
                            {bucket.max === undefined
                                ? t('gemeenteMap.legend.from', {min: bucket.min})
                                : t('gemeenteMap.legend.range', {min: bucket.min, max: bucket.max})}
                        </li>
                    ))}
                </ul>
            </div>
            <div ref={containerRef} className={classes.map}/>
            {isError && <p className={classes.note}>{t('gemeenteMap.error')}</p>}
            {unmapped > 0 && <p className={classes.note}>{t('gemeenteMap.unmapped', {count: unmapped})}</p>}
        </section>
    );
}

export default MunicipalityMap;
