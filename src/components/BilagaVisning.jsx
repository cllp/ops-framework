import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { attachmentSize, isAudio, isImage } from "../lib/file.js";
import { kommentarbilagaFel } from "../lib/handelsemodell.js";
import { forvalda } from "../lib/ord.js";
import { FilIkon } from "./icons.jsx";
import { OpsLjudspelare } from "./OpsLjudspelare.jsx";
import { OpsModal } from "./OpsModal.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/** Orden i den stora bilden, på båda språken (0.106.0, #386 skiva 9). */
export const ORD_BILAGAVISNING = {
  visaStor: { sv: "Visa större", en: "View larger" },
  laddaNed: { sv: "Ladda ned", en: "Download" },
  stang: { sv: "Stäng", en: "Close" },
  foregaende: { sv: "Föregående bild", en: "Previous image" },
  nasta: { sv: "Nästa bild", en: "Next image" },
  avBilder: { sv: "av", en: "of" },
};

/**
 * Snabbvyn för en bilaga: bilden som en miniatyr som öppnas i full storlek, en fil som en nedladdningslänk med namn och storlek.
 *
 * ⛔ EN VY FÖR KOMMENTARER OCH MEDDELANDEN (0.77.0, #292). Två kopior av "så här ser en bilaga ut" hade glidit isär första gången
 * den ena fick en ram. `marke` är attributets namn, eftersom kommentarernas prov redan läser `data-kommentar-bilaga-visad`.
 *
 * ⛔ RITAS BARA NÄR `kommentarbilagaFel` är `null` (0.80.0, #300). En dataUrl som inte är filens typ, till exempel
 * `javascript:`, blir ingen `href` och ingen `src`. Namnet sägs ändå, så en ogiltig rad inte ser ut som att den inte fanns.
 *
 * ⛔ INGEN `<iframe>` FÖR EN PDF. Den ritas olika i varje webbläsare, och en tom ruta ser ut som att filen inte kom fram.
 *
 * ⛔ ETT LJUD ÄR `OpsLjudspelare`, INTE EN NEDLADDNINGSLÄNK (0.90.8). Samma spelare som Biblioteket.
 * Märket blir `ljud` så en provning kan skilja det från en fil som fortfarande laddas ned.
 *
 * ⛔ EN BILD ÖPPNAS STOR VID TRYCK, DEN LADDAS INTE NED (0.106.0, #386 skiva 9). Miniatyren var en nedladdningslänk: ett tryck på en
 * skärmbild i en kommentar eller ett meddelande sparade filen i stället för att visa den, och på en telefon hamnade den i Hämtade
 * filer. Nu är miniatyren en knapp som visar bilden i full storlek i en dialog (`OpsModal`: fokus fångas, Escape stänger, fokus
 * tillbaka till miniatyren), och Ladda ned står i dialogens fot. Samma vy i kommentarerna, i chatten och i Chattinfo.
 *
 * Bläddring (#369): `galleri` är alla bilder i samma tråd, i ordning, och `galleriPlats` den här bildens plats i den. Med fler än en
 * bild får den stora vyn Föregående och Nästa, och piltangenterna växlar. Utan `galleri` är det bara den egna bilden, som förr.
 * Bara kommentarerna skickar `galleri` i dag; chatten och Chattinfo visar en bild i taget.
 *
 * ⛔ PLATSEN KOMMER FRÅN ANROPAREN (granskningen av PR 398, BÖR 2), inte ur en jämförelse av innehållet: samma skärmbild postad två
 * gånger hade annars alltid öppnats på den första.
 *
 * ⛔ PILTANGENTERNA LYSSNAS PÅ DOKUMENTET medan vyn är öppen (MÅSTE 2). Fokus hamnar på Stäng när dialogen öppnas, utanför bilden.
 *
 * @param {{ bilaga: import("../lib/file.js").Bilaga, alt: string, marke?: string, sprak?: string, galleri?: { bilaga: import("../lib/file.js").Bilaga, alt: string }[], galleriPlats?: number }} props
 */
export function BilagaVisning({ bilaga, alt, marke = "data-kommentar-bilaga-visad", sprak: sprakProp, galleri, galleriPlats }) {
  const kontext = useOpsSprak();
  const o = /** @type {Record<keyof typeof ORD_BILAGAVISNING, string>} */ (forvalda(ORD_BILAGAVISNING, sprakProp ?? kontext));
  const [stor, setStor] = useState(false);
  const [plats, setPlats] = useState(0);
  const lista = galleri && galleri.length > 1 ? galleri : [{ bilaga, alt }];
  const oppna = () => {
    const i = typeof galleriPlats === "number" && galleriPlats >= 0 && galleriPlats < lista.length ? galleriPlats : lista.findIndex((g) => g.bilaga === bilaga);
    setPlats(i < 0 ? 0 : i);
    setStor(true);
  };
  const steg = (/** @type {number} */ d) => setPlats((i) => (i + d + lista.length) % lista.length);
  const antal = lista.length;
  useEffect(() => {
    if (!stor || antal < 2) return undefined;
    const tangent = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); setPlats((i) => (i + 1) % antal); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setPlats((i) => (i - 1 + antal) % antal); }
    };
    document.addEventListener("keydown", tangent);
    return () => document.removeEventListener("keydown", tangent);
  }, [stor, antal]);
  const visad = lista[Math.min(plats, lista.length - 1)];
  const knapp = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const fel = kommentarbilagaFel(bilaga);
  const ljud = !fel && isAudio(bilaga.typ);
  const bild = !fel && !ljud && isImage(bilaga.typ);
  const attr = { [marke]: fel ? "ogiltig" : ljud ? "ljud" : bild ? "bild" : "fil" };
  if (fel) {
    const namn = bilaga && typeof bilaga === "object" && typeof /** @type {any} */ (bilaga).namn === "string" ? /** @type {any} */ (bilaga).namn : "";
    return (
      <p role="alert" {...attr} className="m-0 text-meta text-danger">
        {namn || alt}
      </p>
    );
  }
  const storlek = bilaga.tecken ? attachmentSize(bilaga.tecken) : "";
  if (ljud) {
    return (
      <div {...attr} className="w-full min-w-0 max-w-full">
        <OpsLjudspelare src={bilaga.dataUrl} namn={bilaga.namn} />
      </div>
    );
  }
  if (bild) {
    return (
      <>
        <button
          type="button"
          {...attr}
          data-bilaga-forstora=""
          aria-label={`${o.visaStor}: ${alt}`}
          ref={knapp}
          onClick={oppna}
          className="block w-fit max-w-full cursor-zoom-in rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <img src={bilaga.dataUrl} alt={alt} className="block max-h-40 max-w-full rounded-md border border-line" />
        </button>
        {stor ? (
          <OpsModal
            open
            // ⛔ Fokus tillbaka till miniatyren när dialogen stängs. Radix lämnar det till dialogens egen Trigger, och här finns ingen:
            // utan raden hamnade fokus på sidans början (mätt i bild-oppnas-stor.test.jsx).
            onOpenChange={(v) => {
              setStor(v);
              if (!v) setTimeout(() => knapp.current?.focus(), 0);
            }}
            title={visad.bilaga.namn || visad.alt}
            size="lg"
            closeLabel={o.stang}
            footer={
              <a href={visad.bilaga.dataUrl} download={visad.bilaga.namn || "bild"} data-bilaga-ladda-ned="" className="inline-flex min-h-11 items-center rounded-md px-3 text-etikett font-medium text-accent no-underline hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                {o.laddaNed}
              </a>
            }
          >
            <div
              data-bilaga-galleri={lista.length > 1 ? "" : undefined}
              className="flex flex-col items-center gap-2"
            >
              <img data-bilaga-stor="" src={visad.bilaga.dataUrl} alt={visad.alt} className="mx-auto block max-h-[70dvh] max-w-full object-contain" />
              {lista.length > 1 ? (
                <div className="flex items-center gap-3">
                  <button type="button" data-bilaga-foregaende="" aria-label={o.foregaende} onClick={() => steg(-1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-accent hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><ChevronLeft size={20} aria-hidden="true" /></button>
                  <span data-bilaga-plats="" className="text-meta text-ink-muted">{`${plats + 1} ${o.avBilder} ${lista.length}`}</span>
                  <button type="button" data-bilaga-nasta="" aria-label={o.nasta} onClick={() => steg(1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-accent hover:bg-accent-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><ChevronRight size={20} aria-hidden="true" /></button>
                </div>
              ) : null}
            </div>
          </OpsModal>
        ) : null}
      </>
    );
  }
  return (
    <a
      href={bilaga.dataUrl}
      download={bilaga.namn || "bilaga"}
      {...attr}
      className="flex min-h-11 w-fit max-w-full items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2 text-meta text-ink no-underline hover:bg-accent-faint"
    >
      <FilIkon />
      <span className="min-w-0 truncate">{bilaga.namn}</span>
      {storlek ? <span className="shrink-0 text-ink-muted">{storlek}</span> : null}
    </a>
  );
}
