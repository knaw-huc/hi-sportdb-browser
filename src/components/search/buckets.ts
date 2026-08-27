import type {PathOptions} from 'leaflet';

// RAMP is an array of hex colors representing the buckets, e.g., ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c']
export const RAMP = ['#dce9f2', '#b7d0e3', '#8fb5d3', '#6699c0', '#3d76a3', '#094870'];
export const EMPTY_COLOR = '#f2f2f2';
export const SELECTED_COLOR = '#c1440e';

export interface Bucket {
    min: number;
    max?: number;
    color: string;
}

const snap = (val: number) => Math.round(val);

export const bucketsFor = (counts: number[]): Bucket[] => {
    // Remove any value equal to 0
    const present = counts.filter((count) => count > 0);
    if (present.length === 0) {
        return [];
    }

    // Apply the snap directly to the lowest and highest values to align the scale boundaries
    const lowest = snap(Math.min(...present));
    const highest = snap(Math.max(...present));

    // Edge case: if all counts are the same
    if (lowest === highest) {
        return [{ min: lowest, max: undefined, color: RAMP[RAMP.length - 1] }];
    }

    const numBuckets = RAMP.length;
    const bounds: number[] = [];

    // Logarithmic distribution
    // Using 'highest + 1' consistently ensures the absolute maximum value falls inside the last bucket
    const logMin = Math.log(lowest);
    const logMax = Math.log(highest + 1);
    const step = (logMax - logMin) / numBuckets;

    for (let i = 0; i <= numBuckets; i++) {
        const rawBound = Math.exp(logMin + i * step);
        const snapped = snap(rawBound);

        // Prevent duplicate bounds caused by rounding consecutive values
        if (bounds.length === 0 || snapped > bounds[bounds.length - 1]) {
            bounds.push(snapped);
        }
    }

    // Ensure the final boundary is always high enough to cover the highest value
    if (bounds[bounds.length - 1] <= highest) {
        bounds[bounds.length - 1] = highest + 1;
    }

    // Generate the buckets from lowest to highest
    const buckets: Bucket[] = [];
    for (let i = 0; i < bounds.length - 1; i++) {
        const min = bounds[i];
        const nextMin = bounds[i + 1];

        // Since we are dealing with integers, max is the next minimum minus 1
        const max = nextMin - 1;

        // Distribute available colors from RAMP proportionally across the generated buckets
        const colorIndex = Math.floor((i / (bounds.length - 1)) * RAMP.length);
        const color = RAMP[Math.min(colorIndex, RAMP.length - 1)];

        buckets.push({ min, max, color });
    }

    // Adjust the final bucket to capture everything 'and above' (max === undefined)
    if (buckets.length > 0) {
        buckets[buckets.length - 1].max = undefined;
    }

    // Reverse the array so the highest counts (and darkest colors) appear first for the map legend
    return buckets.reverse();
}

export const colorFor = (count: number, buckets: Bucket[]): string => {
    return buckets.find((bucket) => count >= bucket.min)?.color ?? EMPTY_COLOR;
}

export const styleFor = (count: number, isSelected: boolean, buckets: Bucket[]): PathOptions => {
    return {
        fillColor: colorFor(count, buckets),
        fillOpacity: count > 0 ? 0.85 : 0.55,
        color: isSelected ? SELECTED_COLOR : '#ffffff',
        weight: isSelected ? 2.5 : 0.5,
    };
}
