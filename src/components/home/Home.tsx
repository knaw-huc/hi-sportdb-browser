import {useEffect, useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import classes from './Home.module.css';

const WMS_URL = 'https://gemeentegeschiedenis.nl/cgi-bin/mapserv?map=gg2.map';
const LAYER = 'gemeenteref';

// Year of the municipal boundaries to display from the WMS service.
const JAAR = 1984;

interface Feature {
    gm_naam: string;
    cbscode: string;
    jaar: string;
    // Multipolygon as Leaflet rings: polygons → rings → points.
    geometry: L.LatLng[][][];
}

// The service advertises a GeoJSON GetFeatureInfo format but it errors
// server-side, so we request GML and pull the attributes and geometry out of it.
// Coordinates come back in the map CRS (EPSG:3857), so they're unprojected to
// lat/lng for drawing.
function parseFeature(gml: string, crs: L.CRS): Feature | null {
    const doc = new DOMParser().parseFromString(gml, 'application/xml');
    const feature = doc.getElementsByTagName('gemeenteref_feature')[0];
    if (!feature) return null;

    const get = (tag: string) => feature.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';

    const ring = (coords: Element) =>
        (coords.textContent ?? '').trim().split(/\s+/).map((pair) => {
            const [x, y] = pair.split(',').map(Number);
            return crs.unproject(L.point(x, y));
        });
    const geometry = Array.from(feature.getElementsByTagName('gml:Polygon')).map((poly) =>
        Array.from(poly.getElementsByTagName('gml:coordinates')).map(ring),
    );

    return {gm_naam: get('gm_naam'), cbscode: get('cbscode'), jaar: get('jaar'), geometry};
}

function getFeatureInfoUrl(map: L.Map, e: L.LeafletMouseEvent): string {
    const size = map.getSize();
    const bounds = map.getBounds();
    const sw = map.options.crs!.project(bounds.getSouthWest());
    const ne = map.options.crs!.project(bounds.getNorthEast());
    const params = new URLSearchParams({
        SERVICE: 'WMS',
        VERSION: '1.1.1',
        REQUEST: 'GetFeatureInfo',
        LAYERS: LAYER,
        QUERY_LAYERS: LAYER,
        JAAR: String(JAAR),
        SRS: 'EPSG:3857',
        BBOX: [sw.x, sw.y, ne.x, ne.y].join(','),
        WIDTH: String(size.x),
        HEIGHT: String(size.y),
        X: String(Math.round(e.containerPoint.x)),
        Y: String(Math.round(e.containerPoint.y)),
        INFO_FORMAT: 'application/vnd.ogc.gml',
        FEATURE_COUNT: '1',
    });
    return `${WMS_URL}&${params.toString()}`;
}

export default function Home() {

    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        const map = L.map(mapRef.current).setView([52.15, 5.4], 7);

        // Municipal boundaries from gemeentegeschiedenis.nl, overlaid as a
        // transparent WMS layer. The map CRS (EPSG:3857) is sent automatically;
        // JAAR is a service-specific parameter selecting the historical year.
        L.tileLayer.wms(WMS_URL, {
            layers: LAYER,
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            JAAR,
            attribution: '&copy; <a href="https://gemeentegeschiedenis.nl">Gemeentegeschiedenis</a>',
        } as L.WMSOptions).addTo(map);

        // Recalculate size once the flex container has its final dimensions.
        map.invalidateSize();

        // Fixed info panel in the top-right corner, shown on click.
        const info = new L.Control({position: 'topright'});
        let infoEl!: HTMLDivElement;
        info.onAdd = () => {
            infoEl = L.DomUtil.create('div', classes.info);
            infoEl.style.display = 'none';
            // Clicking the panel shouldn't trigger another GetFeatureInfo.
            L.DomEvent.disableClickPropagation(infoEl);
            return infoEl;
        };
        info.addTo(map);
        const showInfo = (html: string) => {
            infoEl.innerHTML = html;
            infoEl.style.display = '';
        };

        // WMS tiles are raster, so per-municipality info comes from a
        // GetFeatureInfo request for the clicked pixel.
        let cancelled = false;
        let highlight: L.Polygon | null = null;
        const onClick = async (e: L.LeafletMouseEvent) => {
            showInfo('…');
            try {
                const res = await fetch(getFeatureInfoUrl(map, e));
                const feature = parseFeature(await res.text(), map.options.crs!);
                if (cancelled) return;

                highlight?.remove();
                highlight = null;

                if (!feature) {
                    showInfo('Geen gemeente op deze locatie.');
                    return;
                }

                highlight = L.polygon(feature.geometry, {
                    weight: 3,
                    color: '#1a237e',
                    fillColor: '#5c6bc0',
                    fillOpacity: 0.4,
                }).addTo(map);

                showInfo(
                    `<b>${feature.gm_naam}</b><br/>CBS code: ${feature.cbscode}<br/>jaar: ${feature.jaar}`,
                );
            } catch (err) {
                if (!cancelled) showInfo('Ophalen van gegevens mislukt.');
                console.error('GetFeatureInfo failed:', err);
            }
        };
        map.on('click', onClick);

        return () => {
            cancelled = true;
            map.remove();
        };
    }, []);

    return (<div ref={mapRef} className={classes.map}/>);

}
