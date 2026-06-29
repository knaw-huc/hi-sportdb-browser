# SportDB Browser (Panoptes)

A web front-end for browsing the **hi-sportdb** dataset, built on the
[KNAW-HuC Panoptes](https://github.com/knaw-huc) faceted-search framework. Currently it
provides a homepage map of historical Dutch municipalities (Boonstra 1984 boundaries) rendered with
[Leaflet](https://leafletjs.com/) and OpenStreetMap tiles. It will offer search capabilities in future versions.

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for dev server and bundling
- [`@knaw-huc/panoptes-react`](https://www.npmjs.com/package/@knaw-huc/panoptes-react) and
  [`@knaw-huc/panoptes-react-blocks`](https://www.npmjs.com/package/@knaw-huc/panoptes-react-blocks) for the search UI
- [Leaflet](https://leafletjs.com/) for the municipalities map (this might change, but creating the database offered a good opportunity to get to know Leaflet instead of OpenLayers)
- [i18next](https://www.i18next.com/) for English/Dutch localization

## Getting started

Requires [Node.js](https://nodejs.org/) (with npm).

```bash
npm install
cp .env.example .env   # then edit values as needed
npm run dev
```

The dev server prints a local URL (default <http://localhost:5173>).

## Configuration

The app reads its Panoptes connection settings from environment variables at
build/dev time. Copy `.env.example` to `.env` and adjust:

| Variable                     | Description                                              | Example                    |
| ---------------------------- | -------------------------------------------------------- | -------------------------- |
| `VITE_PANOPTES_URL`          | Base URL of the Panoptes backend API                     | `http://localhost:8000`    |
| `VITE_PANOPTES_IS_EMBEDDED`  | Whether the UI runs embedded (no top-level chrome)       | `false`                    |
| `VITE_PANOPTES_DATASET`      | Dataset identifier to query                              | `hi-sportdb`               |
| `VITE_PANOPTES_SEARCH_PATH`  | Search route template (`$dataset` is substituted)        | `/$dataset/search`         |
| `VITE_PANOPTES_DETAIL_PATH`  | Detail route template (`$dataset`, `$id` substituted)    | `/$dataset/details/$id`    |
| `VITE_PANOPTES_THEME`        | Panoptes UI theme                                        | `huygens`                  |

A running Panoptes backend serving the `hi-sportdb` dataset is required for the
search functionality to work.

## Scripts

| Command           | Description                                  |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with HMR           |
| `npm run build`   | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview the production build locally         |
| `npm run lint`    | Run ESLint                                   |

## Project structure

```
src/
  main.tsx              App entry; configures the Panoptes root and routes
  components/home/      Home page with the Leaflet municipalities map
  i18n/                 i18next setup and en/nl translations
  css/                  Theme and global styles
public/
  nlgis-boonstra-1984.geojson   Historical municipality boundaries
  favicon.svg, icons.svg
```

## Localization

The interface auto-detects the browser language and supports English (`en`) and
Dutch (`nl`), falling back to English. Translation strings live in
`src/i18n/locales/<lang>/common.json`.
```
