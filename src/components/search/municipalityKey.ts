// Historical shortened names and transcription errors still occur alongside full names.
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

// Lowercase, drop diacritics and everything that isn't a letter or digit.
function normalize(name: string): string {
    return name.normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

// Join display names and legacy index keys, without changing the raw values
// sent back to the facet endpoint.
export function municipalityKey(value: string): string {
    return normalize(FACET_VALUE_BY_NAME[value] ?? value);
}
