import { useEffect, useState } from "react";
import { OpsGastFelrad } from "./OpsGastFelrad.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { ordet } from "../lib/ord.js";
import { OpsVantar } from "./OpsVantar.jsx";

/**
 * Förhandsvisningarna för SIE, kalender- och kontaktfiler och mejl, inlästa när en sådan fil visas (0.270.0, cllp/lifehub.app#884).
 *
 * ══ ⛔ VARFÖR LAT ════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 0.268.0 importerade `SieForhandsvisning` statiskt i `OpsBibliotek`, och med kalenderfilen och mejlet växte lifehub.app:s JS före första vyn med 1 636 byte gzip
 * över taket (mätt 2026-11-28 vid ompinningen). Tolkarna (`lib/sie.js`, `lib/kalenderfil.js`, `lib/mejlfil.js`) och vyerna ritas bara i detaljen för en sådan fil.
 * Samma väg som `OpsPdfVisningLat`: paketet skriver en fil per källmodul, och appens bundler gör den dynamiska importen till en egen bit.
 * `check:delbarhet` mäter att vyerna inte finns i en startfil som importerar `OpsBibliotek`.
 *
 * ⛔ INTE `React.lazy`: den minns ett misslyckande, och då hade Försök igen varit en död knapp tills sidan laddades om. Här glöms ett misslyckat försök.
 * ⛔ FELET SYNS (regel 5), med Försök igen, på samma rad som gästflikarna (#675).
 */

/**
 * @param {() => Promise<import("react").ComponentType<any>>} ladda
 * @param {string} data
 * @param {any} props
 */
function useLatVy(ladda, data, props) {
  const sprak = useOpsSprak();
  const [vy, setVy] = useState(/** @type {{ Komponent: import("react").ComponentType<any> } | null} */ (null));
  const [fel, setFel] = useState(false);
  const [forsok, setForsok] = useState(0);
  useEffect(() => {
    let kvar = true;
    setFel(false);
    ladda().then(
      (Komponent) => {
        if (kvar) setVy({ Komponent });
      },
      () => {
        if (kvar) setFel(true);
      },
    );
    return () => {
      kvar = false;
    };
  }, [forsok, ladda]);
  if (fel) {
    return (
      <div data-filvisning-lasfel={data}>
        <OpsGastFelrad data={`${data}-fel`} text={ordet(ORD_FILVISNING_LAT, "lasfel", sprak)} forsokIgen={ordet(ORD_FILVISNING_LAT, "forsokIgen", sprak)} onForsokIgen={() => setForsok((n) => n + 1)} />
      </div>
    );
  }
  if (!vy) return <div data-filvisning-lage="hamtar" className="m-0 text-etikett text-ink-muted"><OpsVantar text={ordet(ORD_FILVISNING_LAT, "hamtar", sprak)} /></div>;
  const { Komponent } = vy;
  return <Komponent {...props} />;
}

/**
 * Ett minne per modul. Ett misslyckat försök glöms, så att nästa försök hämtar på nytt.
 * @template T
 * @param {() => Promise<T>} importera
 * @returns {() => Promise<T>}
 */
function minns(importera) {
  /** @type {Promise<T> | null} */
  let laddas = null;
  return () => {
    if (!laddas) {
      laddas = importera().catch((e) => {
        laddas = null;
        throw e;
      });
    }
    return laddas;
  };
}

const laddaSie = minns(() => import("./SieForhandsvisning.jsx").then((m) => m.SieForhandsvisning));
const laddaKalenderfil = minns(() => import("./KalenderfilForhandsvisning.jsx").then((m) => m.KalenderfilForhandsvisning));
const laddaMejlfil = minns(() => import("./MejlfilForhandsvisning.jsx").then((m) => m.MejlfilForhandsvisning));

/** @param {import("react").ComponentProps<typeof import("./SieForhandsvisning.jsx").SieForhandsvisning>} props */
export function SieForhandsvisningLat(props) {
  return useLatVy(laddaSie, "sie", props);
}

/** @param {import("react").ComponentProps<typeof import("./KalenderfilForhandsvisning.jsx").KalenderfilForhandsvisning>} props */
export function KalenderfilForhandsvisningLat(props) {
  return useLatVy(laddaKalenderfil, "kalenderfil", props);
}

/** @param {import("react").ComponentProps<typeof import("./MejlfilForhandsvisning.jsx").MejlfilForhandsvisning>} props */
export function MejlfilForhandsvisningLat(props) {
  return useLatVy(laddaMejlfil, "mejl", props);
}

/** @type {import("../lib/ord.js").Ordbok} */
export const ORD_FILVISNING_LAT = {
  hamtar: { sv: "Hämtar filen.", en: "Fetching the file." },
  lasfel: { sv: "Visningen för filen gick inte att hämta. Kontrollera nätet och försök igen.", en: "The file viewer could not be loaded. Check the network and try again." },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
};
