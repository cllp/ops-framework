import { useEffect, useRef, useState } from "react";
import { filadressFel } from "../lib/bibliotek.js";
import { blobBytes } from "../lib/blobbytes.js";
import { formatDateTime } from "../lib/format.js";
import { tolkaEml } from "../lib/mejlfil.js";
import { ordet } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsVantar } from "./OpsVantar.jsx";
import { TextForhandsvisning } from "./TextForhandsvisning.jsx";

/**
 * Ett sparat mejl (`.eml`) i Biblioteket, visat tolkat i detaljen (0.270.0, cllp/lifehub.app#884, punkt 4).
 *
 * ⛔ SAMMA VÄG SOM DE ANDRA FÖRHANDSVISNINGARNA: byten hämtas med appens `hamtaFil`, bara när detaljen är öppen, och tolkas av `lib/mejlfil.js`.
 * Överst Från, Till, Kopia, Datum och Ämne, sedan texten, sist bilagornas namn och storlek. Ladda ned står kvar under.
 * ⛔ TEXT, ALDRIG HTML. Ett mejl med bara en HTML-del visas som text med en rad som säger det, så ingen bild hämtas och ingenting i mejlet körs (ärendets
 * "Ingen fjärrladdning av bilder i mejlet"). ⛔ BILAGORNA LISTAS, DE SPARAS INTE HÄR: att lägga en i Biblioteket skriver data och är ett eget steg.
 *
 * @param {{ hamta: (sokvag: string) => Promise<Blob>, sokvag: string, namn: string }} props
 */
export function MejlfilForhandsvisning({ hamta, sokvag, namn }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_MEJLFIL} */ k) => ordet(ORD_MEJLFIL, k, sprak);
  const [lage, setLage] = useState(
    /** @type {{ lage: "hamtar" } | { lage: "klar", mejl: import("../lib/mejlfil.js").Mejl } | { lage: "text", blob: Blob } | { lage: "stor" } | { lage: "fel", fel: string }} */ ({ lage: "hamtar" }),
  );
  const hamtaRef = useRef(hamta);
  hamtaRef.current = hamta;
  useEffect(() => {
    let kvar = true;
    setLage({ lage: "hamtar" });
    Promise.resolve()
      .then(() => hamtaRef.current(sokvag))
      .then(async (blob) => {
        if (blob.size > MEJLFIL_BYTE) {
          if (kvar) setLage({ lage: "stor" });
          return;
        }
        const t = tolkaEml(new Uint8Array(await blobBytes(blob)));
        if (kvar) setLage(t.ok ? { lage: "klar", mejl: t.mejl } : { lage: "text", blob });
      })
      .catch((e) => {
        if (kvar) setLage({ lage: "fel", fel: filadressFel(e) });
      });
    return () => {
      kvar = false;
    };
  }, [sokvag]);

  if (lage.lage === "hamtar") return <div data-bibliotek-mejl="hamtar" className="m-0 text-etikett text-ink-muted"><OpsVantar text={o("hamtar")} /></div>;
  if (lage.lage === "fel") return <p role="alert" data-bibliotek-mejl="fel" className="m-0 text-etikett text-danger">{`${o("fel")} ${lage.fel}`}</p>;
  if (lage.lage === "stor") return <p role="status" data-bibliotek-mejl="stor" className="m-0 text-etikett text-ink-muted">{o("stor")}</p>;
  if (lage.lage === "text") {
    return (
      <div data-bibliotek-mejl="text" className="flex min-w-0 flex-col gap-2">
        <p className="m-0 text-meta text-ink-muted">{o("inteMejl")}</p>
        <TextForhandsvisning hamta={() => Promise.resolve(lage.blob)} sokvag={sokvag} namn={namn} />
      </div>
    );
  }
  const { mejl } = lage;
  const text = mejl.text.length > MEJLFIL_TECKEN ? `${mejl.text.slice(0, MEJLFIL_TECKEN)}…` : mejl.text;
  const fakta = [
    [o("fran"), mejl.fran],
    [o("till"), mejl.till],
    [o("kopia"), mejl.kopia],
    [o("datum"), mejl.datum ? formatDateTime(mejl.datum) : ""],
    [o("amne"), mejl.amne],
  ].filter(([, v]) => v);
  return (
    <div data-bibliotek-mejl="klar" role="region" aria-label={o("innehall").replace("{namn}", namn)} className="flex min-w-0 flex-col gap-3">
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-etikett">
        {fakta.map(([t, v]) => (
          <div key={t} className="contents">
            <dt className="text-ink-muted">{t}</dt>
            <dd className="m-0 min-w-0 break-words text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {mejl.franHtml ? <p data-mejl-franhtml="" className="m-0 text-meta text-ink-muted">{o("franHtml")}</p> : null}
      {text ? (
        <pre
          data-mejl-text=""
          tabIndex={0}
          aria-label={o("texten")}
          className="m-0 max-h-96 max-w-prose overflow-auto whitespace-pre-wrap break-words rounded-lg bg-sunken p-3 font-sans text-etikett text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {text}
        </pre>
      ) : (
        <p className="m-0 text-meta text-ink-muted">{o("utanText")}</p>
      )}
      {mejl.bilagor.length ? (
        <div className="flex flex-col gap-1">
          <p className="m-0 text-meta text-ink-muted">{o("bilagor").replace("{antal}", String(mejl.bilagor.length))}</p>
          <ul data-mejl-bilagor="" className="m-0 flex list-none flex-col gap-1 p-0">
            {mejl.bilagor.map((b, i) => (
              <li key={`${b.namn}-${i}`} className="text-etikett text-ink">
                {b.namn} <span className="text-meta text-ink-muted tabular-nums">{storlek(b.byte)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** @param {number} byte */
const storlek = (byte) => (byte >= 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(byte / 1024))} kB`);

/** Det största ett mejl får vara för att visas tolkat: 25 MB, Bibliotekets tak för en fil. */
export const MEJLFIL_BYTE = 25 * 1024 * 1024;

/** Hur många tecken av texten som visas. Resten finns i filen. */
export const MEJLFIL_TECKEN = 100_000;

/** @type {import("../lib/ord.js").Ordbok} */
const ORD_MEJLFIL = {
  hamtar: { sv: "Hämtar mejlet.", en: "Fetching the email." },
  fel: { sv: "Mejlet gick inte att visa.", en: "The email could not be shown." },
  stor: { sv: "Mejlet är för stort för att visas här. Ladda ned det.", en: "The email is too large to show here. Download it." },
  inteMejl: { sv: "Filen går inte att läsa som ett mejl, så den visas som text.", en: "The file cannot be read as an email, so it is shown as text." },
  innehall: { sv: "Mejlet i {namn}", en: "The email in {namn}" },
  fran: { sv: "Från", en: "From" },
  till: { sv: "Till", en: "To" },
  kopia: { sv: "Kopia", en: "Cc" },
  datum: { sv: "Datum", en: "Date" },
  amne: { sv: "Ämne", en: "Subject" },
  texten: { sv: "Mejlets text", en: "The email's text" },
  franHtml: { sv: "Mejlet var formaterat. Här visas bara texten, utan bilder.", en: "The email was formatted. Only the text is shown here, without images." },
  utanText: { sv: "Mejlet har ingen text.", en: "The email has no text." },
  bilagor: { sv: "{antal} bilagor, i filen:", en: "{antal} attachments, in the file:" },
};
