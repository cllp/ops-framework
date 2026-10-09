import { attachmentSize, isAudio, isImage } from "../lib/file.js";
import { kommentarbilagaFel } from "../lib/handelsemodell.js";
import { FilIkon } from "./icons.jsx";
import { OpsLjudspelare } from "./OpsLjudspelare.jsx";

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
 * ⛔ ETT LJUD ÄR `OpsLjudspelare`, INTE EN NEDLADDNINGSLÄNK (0.90.3). Samma spelare som Biblioteket.
 * Märket blir `ljud` så en provning kan skilja det från en fil som fortfarande laddas ned.
 *
 * @param {{ bilaga: import("../lib/file.js").Bilaga, alt: string, marke?: string }} props
 */
export function BilagaVisning({ bilaga, alt, marke = "data-kommentar-bilaga-visad" }) {
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
      <a href={bilaga.dataUrl} download={bilaga.namn || "bild"} {...attr} className="block w-fit">
        <img src={bilaga.dataUrl} alt={alt} className="block max-h-40 max-w-full rounded-md border border-line" />
      </a>
    );
  }
  return (
    <a
      href={bilaga.dataUrl}
      download={bilaga.namn || "bilaga"}
      {...attr}
      className="flex w-fit max-w-full items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2 text-meta text-ink no-underline hover:bg-accent-faint"
    >
      <FilIkon />
      <span className="min-w-0 truncate">{bilaga.namn}</span>
      {storlek ? <span className="shrink-0 text-ink-muted">{storlek}</span> : null}
    </a>
  );
}
