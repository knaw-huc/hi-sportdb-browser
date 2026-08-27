import type {Feature, Polygon} from 'geojson';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {loadMunicipalities} from './loadMunicipalities.ts';

const square: Polygon = {type: 'Polygon', coordinates: [[[4, 52], [5, 52], [5, 53], [4, 53], [4, 52]]]};

const feature = (gm_naam: string): Feature<Polygon> =>
    ({type: 'Feature', geometry: square, properties: {gm_naam}});

const collection = (...names: string[]) =>
    ({ok: true, json: async () => ({type: 'FeatureCollection', features: names.map(feature)})}) as Response;

const valueOf = async (name: string) => {
    vi.mocked(fetch).mockResolvedValue(collection(name));
    const [gemeente] = await loadMunicipalities();
    return gemeente.value;
};

describe('loadMunicipalities', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(collection()));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('the WFS request', () => {
        it('asks Gemeentegeschiedenis for the 1984 boundaries as GeoJSON', async () => {
            await loadMunicipalities();

            const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
            expect(url.origin + url.pathname).toBe('https://gemeentegeschiedenis.nl/cgi-bin/mapserv');
            expect(url.searchParams.get('map')).toBe('gg2.map');
            expect(url.searchParams.get('SERVICE')).toBe('WFS');
            expect(url.searchParams.get('REQUEST')).toBe('GetFeature');
            expect(url.searchParams.get('TYPENAME')).toBe('gemeenteref');
            // The `plaats` facet is indexed by Procrustus on the 1984 municipality (gemeente1984 in the input data)
            expect(url.searchParams.get('JAAR')).toBe('1984');
        });

        it('asks for the long output format the service advertises', async () => {
            await loadMunicipalities();

            const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
            // The shorter 'application/json' is rejected by the service.
            expect(url.searchParams.get('outputFormat')).toBe('application/json; subtype=geojson; charset=utf-8');
        });

        it('throws when the boundaries cannot be fetched', async () => {
            vi.mocked(fetch).mockResolvedValue({ok: false, status: 503} as Response);

            await expect(loadMunicipalities()).rejects.toThrow('Unable to fetch the 1984 municipal boundaries!');
        });

        it('returns nothing for an empty collection rather than failing', async () => {
            await expect(loadMunicipalities()).resolves.toEqual([]);
        });
    });

    describe('joining boundaries onto facet values', () => {
        it('keeps the original name for display and the feature for drawing', async () => {
            vi.mocked(fetch).mockResolvedValue(collection('Utrecht'));

            const [gemeente] = await loadMunicipalities();
            expect(gemeente.name).toBe('Utrecht');
            expect(gemeente.feature).toEqual(feature('Utrecht'));
        });

        it('lowercases the name', async () => {
            await expect(valueOf('Utrecht')).resolves.toBe('utrecht');
        });

        it('drops spaces, hyphens and apostrophes', async () => {
            await expect(valueOf('Bergen op Zoom')).resolves.toBe('bergenopzoom');
            await expect(valueOf('Berkel-Enschot')).resolves.toBe('berkelenschot');
            await expect(valueOf("'s-Gravenhage")).resolves.toBe('sgravenhage');
        });

        it('strips diacritics', async () => {
            await expect(valueOf('Súdwest')).resolves.toBe('sudwest');
            await expect(valueOf('Terneuzen-Zaamslag')).resolves.toBe('terneuzenzaamslag');
        });

        it('keeps digits', async () => {
            await expect(valueOf('Gemeente 2')).resolves.toBe('gemeente2');
        });

        it.each([
            ['Kollumerland en Nieuwkruisland', 'kollumerland'],
            ['Nuenen, Gerwen en Nederwetten', 'nuenen'],
            ['Oploo, Sint Anthonis en Ledeacker', 'oploo'],
            ['Vessem, Wintelre en Knegsel', 'vessem'],
            ['Hoogeloon, Hapert en Casteren', 'hoogeloon'],
            ['Megen, Haren en Macharen', 'megenharenmacharen'],
            ['Hooge en Lage Mierde', 'mierde'],
            ['Oost-, West- en Middelbeers', 'middelbeers'],
            ['het Bildt', 'bildt'],
            ['Ohé en Laak', 'ohenlaak'],
        ])('maps the compound name %s onto the shortened facet value %s', async (name, value) => {
            await expect(valueOf(name)).resolves.toBe(value);
        });

        it('maps Ilpendam onto the misread facet value it is indexed under', async () => {
            // The facet value carries a reading error (i instead of l); joining
            // on the correct name would leave the municipality uncoloured.
            await expect(valueOf('Ilpendam')).resolves.toBe('iipendam');
        });

        it('normalises names that are not exceptions instead of dropping them', async () => {
            vi.mocked(fetch).mockResolvedValue(collection('Nuenen, Gerwen en Nederwetten', 'Bergen op Zoom'));

            expect((await loadMunicipalities()).map((gemeente) => gemeente.value))
                .toEqual(['nuenen', 'bergenopzoom']);
        });
    });
});
