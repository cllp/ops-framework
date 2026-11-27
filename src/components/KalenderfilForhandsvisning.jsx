import { useEffect, useRef, useState } from "react";
import { avkodaTextfil, filadressFel } from "../lib/bibliotek.js";
import { blobBytes } from "../lib/blobbytes.js";
import { tolkaIcs, tolkaVcf } from "../lib/kalenderfil.js";
import { ordet } from "../lib/ord.js";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsTable } from "./OpsTable.jsx";
import { OpsVantar } from "./OpsVantar.jsx";
import { TextForhandsvisning } from "./TextForhandsvisning.jsx";

/**
 * En kalenderfil (`.ics`) eller kontaktfil (`.vcf`) i Biblioteket, visad tolkad i detaljen (0.269.0, cllp/lifehub.app#884, punkt 5).
 *
 * ⛔ SAMMA VÄG SOM SIE-FILEN OCH TEXTFILEN: byten hämtas med appens `hamtaFil`, bara när detaljen är öppen, och tolkas av `lib/kalenderfil.js`.
 * Händelserna står i en tabell (datum, tid, händelse, plats), de tidigaste först, och kontakterna i en tabell (namn, organisation, telefon, e-post).
 * Ladda ned står kvar under. ⛔ INGEN IMPORT HÄR: att lägga in händelserna i en kalender är ett eget steg som skriver data (ärendets punkt 5).
 * ⛔ INGA LÄNKAR TILL TELEFON ELLER E-POST: numret och adressen är text som går att markera. Detaljen ritar inte `tel:` eller `mailto:` åt en fil någon laddat upp.
 *
 * @param {{ hamta: (sokvag: string) => Promise<Blob>, sokvag: string, namn: string, sort: "ics" | "vcf" }} props
 */
export function KalenderfilForhandsvisning({ hamta, sokvag, namn, sort }) {
  const sprak = useOpsSprak();
  const o = (/** @type {keyof typeof ORD_KALENDERFIL} */ k) => ordet(ORD_KALENDERFIL, k, sprak);
  const [lage, setLage] = useState(
    /** @type {{ lage: "hamtar" } | { lage: "ics", namn: string, handelser: import("../lib/kalenderfil.js").KalenderHandelse[] } | { lage: "vcf", kontakter: import("../lib/kalenderfil.js").Kontakt[] } | { lage: "text", blob: Blob } | { lage: "stor" } | { lage: "fel", fel: string }} */ ({ lage: "hamtar" }),
  );
  const hamtaRef = useRef(hamta);
  hamtaRef.current = hamta;
  useEffect(() => {
    let kvar = true;
    setLage({ lage: "hamtar" });
    Promise.resolve()
      .then(() => hamtaRef.current(sokvag))
      .then(async (blob) => {
        if (blob.size > KALENDERFIL_BYTE) {
          if (kvar) setLage({ lage: "stor" });
          return;
        }
        const text = avkodaTextfil(new Uint8Array(await blobBytes(blob)));
        const t = sort === "ics" ? tolkaIcs(text) : tolkaVcf(text);
        if (!kvar) return;
        if (!t.ok) setLage({ lage: "text", blob });
        else if ("handelser" in t) setLage({ lage: "ics", namn: t.namn, handelser: t.handelser });
        else setLage({ lage: "vcf", kontakter: t.kontakter });
      })
      .catch((e) => {
        if (kvar) setLage({ lage: "fel", fel: filadressFel(e) });
      });
    return () => {
      kvar = false;
    };
  }, [sokvag, sort]);

  if (lage.lage === "hamtar") return <div data-bibliotek-kalenderfil="hamtar" className="m-0 text-etikett text-ink-muted"><OpsVantar text={o("hamtar")} /></div>;
  if (lage.lage === "fel") return <p role="alert" data-bibliotek-kalenderfil="fel" className="m-0 text-etikett text-danger">{`${o("fel")} ${lage.fel}`}</p>;
  if (lage.lage === "stor") return <p role="status" data-bibliotek-kalenderfil="stor" className="m-0 text-etikett text-ink-muted">{o("stor")}</p>;
  if (lage.lage === "text") {
    return (
      <div data-bibliotek-kalenderfil="text" className="flex min-w-0 flex-col gap-2">
        <p className="m-0 text-meta text-ink-muted">{o(sort === "ics" ? "inteIcs" : "inteVcf")}</p>
        <TextForhandsvisning hamta={() => Promise.resolve(lage.blob)} sokvag={sokvag} namn={namn} />
      </div>
    );
  }
  if (lage.lage === "ics") {
    const tid = (/** @type {{ datum: string, tid: string | null, zon: string | null } | null} */ t) => (t ? [t.tid ?? o("heldag"), t.zon ? `(${t.zon})` : ""].filter(Boolean).join(" ") : "");
    const visade = lage.handelser.slice(0, KALENDERFIL_VISAS);
    return (
      <div data-bibliotek-kalenderfil="ics" role="region" aria-label={o("innehall").replace("{namn}", namn)} className="flex min-w-0 flex-col gap-2">
        {lage.namn ? <p className="m-0 text-etikett text-ink">{lage.namn}</p> : null}
        <OpsTable
          caption={o("handelser")}
          hideCaption
          columns={[
            { key: "datum", label: o("datum"), tight: true },
            { key: "tid", label: o("tid"), tight: true },
            { key: "rubrik", label: o("handelse") },
            { key: "plats", label: o("plats") },
          ]}
          rows={visade.map((h, i) => ({
            id: String(i),
            datum: h.start?.datum ?? "",
            tid: tid(h.start),
            rubrik: [h.rubrik || o("utanRubrik"), h.aterkommer ? `(${o("aterkommer")})` : "", h.installd ? `(${o("installd")})` : ""].filter(Boolean).join(" "),
            plats: h.plats,
          }))}
          empty={<p className="m-0 text-meta text-ink-muted">{o("ingaHandelser")}</p>}
        />
        {lage.handelser.length > visade.length ? <p className="m-0 text-meta text-ink-muted">{o("visar").replace("{visas}", String(visade.length)).replace("{alla}", String(lage.handelser.length))}</p> : null}
      </div>
    );
  }
  const visade = lage.kontakter.slice(0, KALENDERFIL_VISAS);
  return (
    <div data-bibliotek-kalenderfil="vcf" role="region" aria-label={o("innehall").replace("{namn}", namn)} className="flex min-w-0 flex-col gap-2">
      <OpsTable
        caption={o("kontakter")}
        hideCaption
        columns={[
          { key: "namn", label: o("namn") },
          { key: "organisation", label: o("organisation") },
          { key: "telefon", label: o("telefon") },
          { key: "epost", label: o("epost") },
        ]}
        rows={visade.map((k, i) => ({
          id: String(i),
          namn: k.namn || o("utanNamn"),
          organisation: [k.organisation, k.titel].filter(Boolean).join(", "),
          telefon: k.telefon.join(", "),
          epost: k.epost.join(", "),
        }))}
        empty={<p className="m-0 text-meta text-ink-muted">{o("ingaKontakter")}</p>}
      />
      {lage.kontakter.length > visade.length ? <p className="m-0 text-meta text-ink-muted">{o("visar").replace("{visas}", String(visade.length)).replace("{alla}", String(lage.kontakter.length))}</p> : null}
    </div>
  );
}

/** Det största en kalender- eller kontaktfil får vara för att visas tolkad: 5 MB. Större laddas ned. */
export const KALENDERFIL_BYTE = 5 * 1024 * 1024;

/** Hur många händelser eller kontakter som visas. */
export const KALENDERFIL_VISAS = 500;

/** @type {import("../lib/ord.js").Ordbok} */
const ORD_KALENDERFIL = {
  hamtar: { sv: "Hämtar filen.", en: "Fetching the file." },
  fel: { sv: "Filen gick inte att visa.", en: "The file could not be shown." },
  stor: { sv: "Filen är för stor för att visas här. Ladda ned den.", en: "The file is too large to show here. Download it." },
  inteIcs: { sv: "Filen går inte att läsa som kalender, så den visas som text.", en: "The file cannot be read as a calendar, so it is shown as text." },
  inteVcf: { sv: "Filen går inte att läsa som kontakter, så den visas som text.", en: "The file cannot be read as contacts, so it is shown as text." },
  innehall: { sv: "Innehållet i {namn}", en: "The contents of {namn}" },
  handelser: { sv: "Händelser", en: "Events" },
  kontakter: { sv: "Kontakter", en: "Contacts" },
  datum: { sv: "Datum", en: "Date" },
  tid: { sv: "Tid", en: "Time" },
  handelse: { sv: "Händelse", en: "Event" },
  plats: { sv: "Plats", en: "Place" },
  heldag: { sv: "Heldag", en: "All day" },
  aterkommer: { sv: "återkommer", en: "repeats" },
  installd: { sv: "inställd", en: "cancelled" },
  utanRubrik: { sv: "Utan rubrik", en: "No title" },
  namn: { sv: "Namn", en: "Name" },
  organisation: { sv: "Organisation", en: "Organisation" },
  telefon: { sv: "Telefon", en: "Phone" },
  epost: { sv: "E-post", en: "Email" },
  utanNamn: { sv: "Utan namn", en: "No name" },
  ingaHandelser: { sv: "Filen har inga händelser.", en: "The file has no events." },
  ingaKontakter: { sv: "Filen har inga kontakter.", en: "The file has no contacts." },
  visar: { sv: "Visar {visas} av {alla}. Alla finns i filen.", en: "Showing {visas} of {alla}. All are in the file." },
};
