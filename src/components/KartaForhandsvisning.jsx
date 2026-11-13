import { useEffect, useRef, useState } from "react";
import { avkodaTextfil, filadressFel } from "../lib/bibliotek.js";
import { ordet } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { blobBytes } from "../lib/blobbytes.js";
import { OpsKarta } from "./OpsKarta.jsx";

/**
 * En GeoJSON-fil i Biblioteket visas som karta i detaljen (0.224.0, cllp/lifehub.app#765 skiva 1).
 *
 * ══ ⛔ VARFÖR ══════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-13 i #765: kartdata som läggs i Biblioteket ska gå att se som en karta, inte bara laddas ned. Fram till 0.223.0 var en `.geojson` en
 * fil med länk, eftersom `OpsBibliotek` inte hade någon väg att visa den, och kartvyn (`OpsKarta`) fanns bara som fristående komponent.
 *
 * ⛔ SAMMA VÄG SOM TEXTFILEN (`TextForhandsvisning`): byten hämtas med appens `hamtaFil` (inloggningen), och bara när detaljen är öppen.
 * Ingen ny prop och ingen egen sida i appen: det som behövs finns redan, och en andra väg att hämta en fil hade varit två svar på samma fråga.
 * MapLibre hämtas först när kartan ritas (`OpsKarta`), så detaljen för en annan fil laddar ingenting extra.
 *
 * ⛔ ETT TAK, `KARTA_BYTE`. En GeoJSON-fil får vara lika stor som andra filer, och en karta med tiotals megabyte geometri gör en telefon
 * långsam. Över taket står det att kartan är för stor att visa här, och länken under laddar ned den. Tomhet och trasig JSON säger `OpsKarta`
 * själv, med sina egna ord, så att kartvyn säger samma sak var den än visas.
 *
 * @param {{ hamta: (sokvag: string) => Promise<Blob>, sokvag: string }} props
 */
export function KartaForhandsvisning({ hamta, sokvag }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_BIBLIOTEKKARTA} */ k) => ordet(ORD_BIBLIOTEKKARTA, k, sprak);
  const [lage, setLage] = useState(/** @type {{ lage: "hamtar" } | { lage: "klar", text: string } | { lage: "stor" } | { lage: "fel", fel: string }} */ ({ lage: "hamtar" }));
  // ⛔ FUNKTIONEN I EN REF, SÖKVÄGEN SOM BEROENDE, som i `TextForhandsvisning`: en ny `hamta` vid varje rendering ska inte hämta filen igen.
  const hamtaRef = useRef(hamta);
  hamtaRef.current = hamta;
  useEffect(() => {
    let kvar = true;
    setLage({ lage: "hamtar" });
    Promise.resolve()
      .then(() => hamtaRef.current(sokvag))
      .then(async (blob) => {
        if (blob.size > KARTA_BYTE) {
          if (kvar) setLage({ lage: "stor" });
          return;
        }
        const bytes = new Uint8Array(await blobBytes(blob));
        if (kvar) setLage({ lage: "klar", text: avkodaTextfil(bytes, false) });
      })
      .catch((e) => {
        if (kvar) setLage({ lage: "fel", fel: filadressFel(e) });
      });
    return () => {
      kvar = false;
    };
  }, [sokvag]);
  if (lage.lage === "hamtar") return <p role="status" data-bibliotek-karta="hamtar" className="m-0 text-etikett text-ink-muted">{o("hamtar")}</p>;
  if (lage.lage === "stor") return <p role="status" data-bibliotek-karta="stor" className="m-0 text-etikett text-ink-muted">{o("stor")}</p>;
  if (lage.lage === "fel") {
    return (
      <p role="alert" data-bibliotek-karta="fel" className="m-0 text-etikett text-danger">
        {`${o("fel")} ${lage.fel}`}
      </p>
    );
  }
  return (
    <div data-bibliotek-karta="klar" className="min-w-0">
      <OpsKarta data={lage.text} />
    </div>
  );
}

/** Största fil som ritas som karta i detaljen, 10 MB. Större filer laddas ned. */
export const KARTA_BYTE = 10 * 1024 * 1024;

const ORD_BIBLIOTEKKARTA = {
  hamtar: { sv: "Hämtar kartan.", en: "Fetching the map." },
  fel: { sv: "Kartan gick inte att hämta.", en: "The map could not be fetched." },
  stor: { sv: "Kartan är för stor att visa här. Ladda ned filen för att öppna den.", en: "The map is too large to show here. Download the file to open it." },
};
