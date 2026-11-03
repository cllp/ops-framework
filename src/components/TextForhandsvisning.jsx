import { useEffect, useRef, useState } from "react";
import { avkodaTextfil, filadressFel, TEXTFORHANDS_BYTE } from "../lib/bibliotek.js";
import { ordet } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Textfilens innehåll i detaljen (0.153.0, ops-framework#460 punkt 3, lifehub.app QA-fynd 5).
 *
 * ══ ⛔ VARFÖR ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * En `.txt` öppnades direkt från lagringen och webbläsaren gissade teckenkodningen: "fÃ¶r" i stället för "för". Här hämtas byten med inloggningen (`hamtaFil`, `getBlob`) och avkodas av oss, som UTF-8,
 * med Windows-1252 som reserv för en fil som inte är giltig UTF-8 (`avkodaTextfil`). Ingen regeländring behövs, och förhandsvisningen är rätt oavsett vilken innehållstyp lagringen har (en fil som laddades upp före 0.153.0 har ingen kodning).
 *
 * ⛔ BARA DE FÖRSTA `TEXTFORHANDS_BYTE` BYTEN, och raden under säger det när det finns mer. En textfil får vara 25 MB, och en detalj som ritar 25 MB text är en flik som hänger sig. Tomhet och fel skrivs ut (arbetsreglernas punkt 5):
 * en tom fil säger "Filen är tom.", och en fil som inte gick att hämta säger varför, med länken kvar under.
 *
 * ══ ⛔ DELAD MED BILAGAVISNING (0.178.0, cllp/lifehub.app#524) ═══════════════════════════════════════════════════════════
 *
 * Utbruten ur `OpsBibliotek` och inte kopierad. En textbilaga i chatten (text/plain, CSV) laddades ned vid tryck i stället för att visas (omtestet av #524 i lifehub.app, DELVIS: storleken var lagad i 0.168.0, men
 * ett klick gav fortfarande en `data:`-länk med `download`). Bilagan visas nu med samma förhandsvisning som Biblioteket: avkodning, tak, tomhet och fel är desamma på båda ställena, så de kan inte glida isär.
 * `hamta` får `sokvag` och ger en Blob: för Biblioteket hämtar den filen ur lagringen, för en bilaga gör den data-URL:en till en Blob (`bilagaTillBlob`).
 *
 * @param {{ hamta: (sokvag: string) => Promise<Blob>, sokvag: string, namn: string }} props
 */
export function TextForhandsvisning({ hamta, sokvag, namn }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_BIBLIOTEKTEXT} */ k) => ordet(ORD_BIBLIOTEKTEXT, k, sprak);
  const [lage, setLage] = useState(/** @type {{ lage: "hamtar" } | { lage: "klar", text: string, avkortad: boolean } | { lage: "fel", fel: string }} */ ({ lage: "hamtar" }));
  // ⛔ FUNKTIONEN I EN REF, SÖKVÄGEN SOM BEROENDE. En app som skickar `hamtaFil={(s) => lagring.hamta(s)}` ger en ny funktion vid varje rendering, och texten hade hämtats om (och blinkat "Hämtar texten.") varje gång något annat i vyn ändrades.
  const hamtaRef = useRef(hamta);
  hamtaRef.current = hamta;
  useEffect(() => {
    let kvar = true;
    setLage({ lage: "hamtar" });
    Promise.resolve()
      .then(() => hamtaRef.current(sokvag))
      .then(async (blob) => {
        const avkortad = blob.size > TEXTFORHANDS_BYTE;
        const del = avkortad ? blob.slice(0, TEXTFORHANDS_BYTE) : blob;
        const bytes = new Uint8Array(await blobBytes(del));
        if (kvar) setLage({ lage: "klar", text: avkodaTextfil(bytes, avkortad), avkortad });
      })
      .catch((e) => {
        if (kvar) setLage({ lage: "fel", fel: filadressFel(e) });
      });
    return () => {
      kvar = false;
    };
  }, [sokvag]);
  if (lage.lage === "hamtar") return <p role="status" data-bibliotek-text="hamtar" className="m-0 text-etikett text-ink-muted">{o("hamtar")}</p>;
  if (lage.lage === "fel") {
    return (
      <p role="alert" data-bibliotek-text="fel" className="m-0 text-etikett text-danger">
        {`${o("fel")} ${lage.fel}`}
      </p>
    );
  }
  if (lage.text === "") return <p role="status" data-bibliotek-text="tom" className="m-0 text-etikett text-ink-muted">{o("tom")}</p>;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <pre
        data-bibliotek-text="klar"
        tabIndex={0}
        aria-label={o("innehall").replace("{namn}", namn)}
        className="m-0 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-sunken p-3 font-mono text-meta text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {lage.text}
      </pre>
      {lage.avkortad ? (
        <p data-bibliotek-text-avkortad="" className="m-0 text-meta text-ink-muted">
          {o("avkortad")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Textförhandsvisningens ord (0.153.0, granskningen av PR 464), på båda språken som resten av komponentens ordböcker. ⛔ Resten av `FilVisning` ("Hämtar filen.", "Filen har ingen adress.", "Radera")
 * och `filadressFel` är fortfarande bara svenska: befintlig skuld, inte rättad här.
 * @type {import("../lib/ord.js").Ordbok}
 */
const ORD_BIBLIOTEKTEXT = {
  hamtar: { sv: "Hämtar texten.", en: "Fetching the text." },
  fel: { sv: "Texten gick inte att visa.", en: "The text could not be shown." },
  tom: { sv: "Filen är tom.", en: "The file is empty." },
  innehall: { sv: "Innehållet i {namn}", en: "The contents of {namn}" },
  avkortad: { sv: "Det här är början av filen. Resten finns i filen.", en: "This is the start of the file. The rest is in the file." },
};

/** @param {Blob} blob @returns {Promise<ArrayBuffer>} */
function blobBytes(blob) {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((los, fel) => {
    const l = new FileReader();
    l.onload = () => los(/** @type {ArrayBuffer} */ (l.result));
    l.onerror = () => fel(l.error ?? new Error("Filen gick inte att läsa."));
    l.readAsArrayBuffer(blob);
  });
}
