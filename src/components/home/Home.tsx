import {useEffect, useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import classes from './Home.module.css';

interface MunicipalityProps {
    gm_naam: string;
    cbscode: string;
    acode: string;
    jaar: string;
    bron: string;
}

export default function Home() {

    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        // Set an initial view immediately so tiles render before the
        // (async) GeoJSON loads and fitBounds runs.
        const map = L.map(mapRef.current).setView([52.15, 5.4], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Recalculate size once the flex container has its final dimensions.
        map.invalidateSize();

        let cancelled = false;

        fetch('/nlgis-boonstra-1984.geojson')
            .then((r) => r.json())
            .then((data: GeoJSON.FeatureCollection) => {
                if (cancelled) return;

                const layer = L.geoJSON(data, {
                    style: () => ({
                        weight: 1,
                        color: '#3949ab',
                        fillColor: '#5c6bc0',
                        fillOpacity: 0.25,
                    }),
                    onEachFeature: (feature, lyr) => {
                        const p = feature.properties as MunicipalityProps;
                        lyr.bindPopup(
                            `<b>${p.gm_naam}</b><br/>CBS code: ${p.cbscode}<br/>jaar: ${p.jaar}`,
                        );
                        lyr.on({
                            mouseover: (e) =>
                                (e.target as L.Path).setStyle({weight: 3, color: '#1a237e', fillOpacity: 0.5}),
                            mouseout: (e) => layer.resetStyle(e.target as L.Path),
                        });
                    },
                }).addTo(map);

                map.fitBounds(layer.getBounds());
            })
            .catch((err) => console.error('Failed to load GeoJSON:', err));

        return () => {
            cancelled = true;
            map.remove();
        };
    }, []);

    return (<div ref={mapRef} className={classes.map}/>);

}
