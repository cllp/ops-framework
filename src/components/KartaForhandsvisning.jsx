import { useEffect, useRef, useState } from "react";
import { arKartfil, avkodaTextfil, filadressFel } from "../lib/bibliotek.js";
import { ordet } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { blobBytes } from "../lib/blobbytes.js";
import { OpsKarta } from "./OpsKarta.jsx";
import { TextForhandsvisning } from "./TextForhandsvisning.jsx";
import { OpsVantar } from "./OpsVantar.jsx";

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
 * ⛔ EN `.json` AVGÖRS AV SITT INNEHÅLL (0.228.0, CP 2026-11-14: "Jag kan inte se att jag får upp en karta. Bara json från firebase storage."). För en post som `arKartfil` inte kan avgöra utan
 * innehållet (`application/json` utan ändelsen `.geojson`) läses filen här, inom `KARTA_BYTE`, och frågan ställs igen med texten. GeoJSON ritas som karta. Annan JSON, och en `.json` över taket,
 * visas som text (`TextForhandsvisning`, med byten som redan hämtats), aldrig som en länk. En fil som redan är en karta (`geo+json`, `.geojson`) och ligger över taket säger som förut att den är för stor.
 *
 * @param {{ hamta: (sokvag: string) => Promise<Blob>, sokvag: string, post?: { fil?: { namn?: unknown, mime?: unknown } }, namn?: string }} props
 *   `post` är posten filen hör till. Utan den räknas filen som en karta, som i 0.224.0. `namn` står i textrutans etikett när en `.json` visas som text.
 */
export function KartaForhandsvisning({ hamta, sokvag, post, namn = "" }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_BIBLIOTEKKARTA} */ k) => ordet(ORD_BIBLIOTEKKARTA, k, sprak);
  const [lage, setLage] = useState(/** @type {{ lage: "hamtar" } | { lage: "klar", text: string } | { lage: "text", blob: Blob } | { lage: "stor" } | { lage: "fel", fel: string }} */ ({ lage: "hamtar" }));
  // Svaret före innehållet: `true` (en karta) eller `null` (innehållet avgör). Utan `post` en karta, som förut.
  const kanske = post ? arKartfil(post) : true;
  const postRef = useRef(post);
  postRef.current = post;
  // ⛔ FUNKTIONEN I EN REF, SÖKVÄGEN SOM BEROENDE, som i `TextForhandsvisning`: en ny `hamta` vid varje rendering ska inte hämta filen igen.
  const hamtaRef = useRef(hamta);
  hamtaRef.current = hamta;
  useEffect(() => {
    let kvar = true;
    setLage({ lage: "hamtar" });
    Promise.resolve()
      .then(() => hamtaRef.current(sokvag))
      .then(async (blob) => {
        const provas = postRef.current ? arKartfil(postRef.current) === null : false;
        if (blob.size > KARTA_BYTE) {
          // ⛔ EN `.json` ÖVER TAKET LÄSES INTE FÖR ATT AVGÖRA OM DEN ÄR EN KARTA: den visas som text, med sin början.
          if (kvar) setLage(provas ? { lage: "text", blob } : { lage: "stor" });
          return;
        }
        const text = avkodaTextfil(new Uint8Array(await blobBytes(blob)), false);
        if (!kvar) return;
        if (provas && !arKartfil(postRef.current, text)) setLage({ lage: "text", blob });
        else setLage({ lage: "klar", text });
      })
      .catch((e) => {
        if (kvar) setLage({ lage: "fel", fel: filadressFel(e) });
      });
    return () => {
      kvar = false;
    };
  }, [sokvag, kanske]);
  if (lage.lage === "text") return <TextForhandsvisning hamta={() => Promise.resolve(lage.blob)} sokvag={sokvag} namn={namn} />;
  // En `.json` som kanske inte är en karta säger inte "Hämtar kartan.".
  if (lage.lage === "hamtar") return <div data-bibliotek-karta="hamtar" className="m-0 text-etikett text-ink-muted"><OpsVantar text={o(kanske === null ? "hamtarFil" : "hamtar")} /></div>;
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
  hamtarFil: { sv: "Hämtar filen.", en: "Fetching the file." },
  fel: { sv: "Kartan gick inte att hämta.", en: "The map could not be fetched." },
  stor: { sv: "Kartan är för stor att visa här. Ladda ned filen för att öppna den.", en: "The map is too large to show here. Download the file to open it." },
};
