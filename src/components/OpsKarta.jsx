import { useEffect, useState } from "react";
import { OpsGastFelrad } from "./OpsGastFelrad.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { forvalda } from "../lib/ord.js";
import { lasGeojson } from "../lib/karta.js";
import { OpsVantar } from "./OpsVantar.jsx";

/**
 * En karta för en GeoJSON-fil (0.223.0, cllp/ops-framework#570).
 *
 * Punkter, linjer och ytor. Ett tryck visar namn och beskrivning ur properties. Färg per objekt ur simplestyle (`marker-color`, `stroke`, `fill`), annars ur `typ` eller `type` mot paletten salvia, ockra och terrakotta, annars instansens accent.
 *
 * ⛔ LAT. MapLibre och kartvyn hämtas först när det finns något att rita. En app som inte importerar `OpsKarta` får inget av det, och en app som importerar den får det först när komponenten ritas. `check:delbarhet` mäter båda.
 * ⛔ INTE `React.lazy`: den minns ett misslyckande, och då hade Försök igen varit en död knapp. Ett misslyckat försök glöms.
 *
 * @param {object} props
 * @param {object | string} props.data En FeatureCollection, en Feature, en geometri, eller samma sak som JSON. Appen hämtar filen. Komponenten ritar den.
 * @param {Partial<Record<keyof typeof ORD_OPSKARTA, string>>} [props.ord] Egna ord. Vinner över ordboken.
 */
export function OpsKarta({ data, ord }) {
  const sprak = useOpsSprak();
  if (data === undefined) throw new Error("OpsKarta kräver data: en GeoJSON FeatureCollection, en Feature eller en geometri.");
  const texter = { ...forvalda(ORD_OPSKARTA, sprak), ...rena(ord) };
  const last = lasGeojson(data);
  if (!last.ok) return <p role="alert" data-karta-fel={last.fel} className="m-0 text-etikett text-danger">{texter.ogiltig}</p>;
  if (last.samling.features.length === 0) return <p role="status" data-karta-lage="tom" className="m-0 text-etikett text-ink-secondary">{texter.tom}</p>;
  return <KartaLat samling={last.samling} texter={texter} />;
}

/**
 * @param {object} props
 * @param {import("../lib/karta.js").KartaSamling} props.samling
 * @param {Record<string, string>} props.texter
 */
function KartaLat({ samling, texter }) {
  const [vy, setVy] = useState(/** @type {{ Komponent: typeof import("./OpsKartaVy.jsx").OpsKartaVy } | null} */ (null));
  const [fel, setFel] = useState(false);
  const [forsok, setForsok] = useState(0);
  useEffect(() => {
    let kvar = true;
    setFel(false);
    laddaVyn().then(
      (m) => {
        if (kvar) setVy({ Komponent: m.OpsKartaVy });
      },
      () => {
        if (kvar) setFel(true);
      },
    );
    return () => {
      kvar = false;
    };
  }, [forsok]);
  if (fel) return <OpsGastFelrad data="karta-fel" text={texter.lasfel} forsokIgen={texter.forsokIgen} onForsokIgen={() => setForsok((n) => n + 1)} />;
  if (!vy) return <div data-karta-lage="hamtar" className="m-0 text-etikett text-ink-muted"><OpsVantar text={texter.hamtar} /></div>;
  const { Komponent } = vy;
  return <Komponent samling={samling} texter={texter} />;
}

/** @type {Promise<typeof import("./OpsKartaVy.jsx")> | null} */
let vynLaddas = null;

function laddaVyn() {
  if (!vynLaddas) {
    vynLaddas = import("./OpsKartaVy.jsx").catch((e) => {
      vynLaddas = null;
      throw e;
    });
  }
  return vynLaddas;
}

/** @param {object | undefined} ord */
function rena(ord) {
  if (!ord) return {};
  /** @type {Record<string, string>} */
  const ut = {};
  for (const [nyckel, varde] of Object.entries(ord)) {
    if (typeof varde === "string" && varde) ut[nyckel] = varde;
  }
  return ut;
}

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_OPSKARTA = {
  rubrik: { sv: "Karta", en: "Map" },
  hamtar: { sv: "Hämtar kartan.", en: "Loading the map." },
  lasfel: { sv: "Kartan gick inte att hämta. Kontrollera nätet och försök igen.", en: "The map could not be loaded. Check the network and try again." },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
  tom: { sv: "Kartan har inget att visa.", en: "The map has nothing to show." },
  ogiltig: { sv: "Kartfilen går inte att läsa.", en: "The map file could not be read." },
  farger: { sv: "Kartans färger saknas i temat.", en: "The map colors are missing from the theme." },
  zoomaIn: { sv: "Zooma in", en: "Zoom in" },
  zoomaUt: { sv: "Zooma ut", en: "Zoom out" },
  aterstall: { sv: "Återställ riktningen", en: "Reset north" },
  stang: { sv: "Stäng", en: "Close" },
  visaTillhorighet: { sv: "Visa vem kartan kommer från", en: "Show map credits" },
  tvaFingrar: { sv: "Använd två fingrar för att flytta kartan.", en: "Use two fingers to move the map." },
  ctrl: { sv: "Håll Ctrl och rulla för att zooma kartan.", en: "Use Ctrl and scroll to zoom the map." },
  cmd: { sv: "Håll Cmd och rulla för att zooma kartan.", en: "Use Cmd and scroll to zoom the map." },
};
