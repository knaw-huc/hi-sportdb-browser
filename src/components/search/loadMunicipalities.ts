import type {Feature, FeatureCollection, MultiPolygon, Polygon} from 'geojson';

// Same service Home.tsx draws its municipal boundaries from, but through WFS
// rather than WMS: WMS returns raster tiles, and colouring municipalities by
// result count and hit-testing a dragged box both need the geometry itself.
const WFS_URL = 'https://gemeentegeschiedenis.nl/cgi-bin/mapserv?map=gg2.map';

// Year of the municipal boundaries to fetch. The `plaats` facet is indexed
// against the 1984 municipality, so this has to match it.
const JAAR = 1984;

// The service advertises this exact string; the shorter 'application/json'
// is rejected.
const GEOJSON_FORMAT = 'application/json; subtype=geojson; charset=utf-8';

// The `plaats` facet holds the 1984 municipality, but compound names are cut
// back to their first part and one name carries a reading error. Every other
// value joins on the normalised name, so only the exceptions are listed here.
const FACET_VALUE_BY_NAME: Record<string, string> = {
    'Kollumerland en Nieuwkruisland': 'kollumerland',
    'Nuenen, Gerwen en Nederwetten': 'nuenen',
    'Oploo, Sint Anthonis en Ledeacker': 'oploo',
    'Vessem, Wintelre en Knegsel': 'vessem',
    'Hoogeloon, Hapert en Casteren': 'hoogeloon',
    'Megen, Haren en Macharen': 'megenharenmacharen',
    'Hooge en Lage Mierde': 'mierde',
    'Oost-, West- en Middelbeers': 'middelbeers',
    'het Bildt': 'bildt',
    'Ohé en Laak': 'ohenlaak',
    'Ilpendam': 'iipendam',
};

export interface Gemeente {
    // Value as it occurs in the `plaats` facet; what we filter on.
    value: string;
    // Name as it occurs in the boundaries; what we show.
    name: string;
    feature: Feature<Polygon | MultiPolygon>;
}

interface GemeenteProperties {
    gm_naam: string;
}

// Lowercase, drop diacritics and everything that isn't a letter or digit.
function normalize(name: string): string {
    return name.normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

// The
function getFeatureUrl(): string {
    const params = new URLSearchParams({
        SERVICE: 'WFS',
        VERSION: '1.1.0',
        REQUEST: 'GetFeature',
        TYPENAME: 'gemeenteref',
        JAAR: String(JAAR),
        outputFormat: GEOJSON_FORMAT,
    });
    return `${WFS_URL}&${params.toString()}`;
}

// This function loads the GeoJSON municipality (gemeenten) 1984 data from the Gemeentegeschiedenis website.
export async function loadMunicipalities(): Promise<Gemeente[]> {
    const response = await fetch(getFeatureUrl());
    if (!response.ok) {
        throw new Error(`Unable to fetch the ${JAAR} municipal boundaries!`);
    }

    const collection = await response.json() as FeatureCollection<Polygon | MultiPolygon, GemeenteProperties>;
    return collection.features.map((feature) => {
        const name = feature.properties.gm_naam;
        // Check if the municipality name is one of the exceptions and use the mapping if so, otherwise normalize
        // the mun. name.
        return {
            value: FACET_VALUE_BY_NAME[name] ?? normalize(name),
            name,
            feature
        };
    });
}
