import {createPanoptesRoot, PanoptesRouterProvider} from "@knaw-huc/panoptes-react";
import {panoptesBlocksLibrary} from "@knaw-huc/panoptes-react-blocks";
import {createTranslate} from "./i18n/i18n.ts";
import {createRoute} from "@tanstack/react-router";
import Home from "./components/home/Home.tsx";
import '@knaw-huc/panoptes-react/style.css';
import '@knaw-huc/panoptes-react-blocks/style.css';
import './css/theme.css';
import './css/index.css';

const panoptesUrl = '$VITE_PANOPTES_URL';
const panoptesIsEmbedded = '$VITE_PANOPTES_IS_EMBEDDED';
const panoptesSearchPath = '$VITE_PANOPTES_SEARCH_PATH';
const panoptesDetailPath = '$VITE_PANOPTES_DETAIL_PATH';
const panoptesDataset = '$VITE_PANOPTES_DATASET';

const getVar = (envVariable: string): string | undefined =>
    envVariable.startsWith('$VITE_')
        ? (envVariable.slice(1) in import.meta.env ? import.meta.env[envVariable.slice(1)] : undefined)
        : envVariable;

const root = createPanoptesRoot(document.getElementById('root')!, {
    url: getVar(panoptesUrl),
    isEmbedded: getVar(panoptesIsEmbedded) === 'true',
    searchPath: getVar(panoptesSearchPath),
    detailPath: getVar(panoptesDetailPath),
    dataset: getVar(panoptesDataset),
    translateFn: createTranslate(),
    blocks: panoptesBlocksLibrary,
    theme: "huygens",
    navItems: [
        {
            "label": "hi-sportdb-home",
            "href": "/",
            "labelKey": "hi-sportdb-browser.pages.home"
        }
    ],
    routes: (rootRoute) => [
        createRoute({
            path: '/',
            getParentRoute: () => rootRoute,
            component: Home
        })
    ],
    branding: 'SportDB',
});
root.render(<PanoptesRouterProvider/>);