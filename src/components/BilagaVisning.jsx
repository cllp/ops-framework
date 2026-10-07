import { attachmentSize, isImage } from "../lib/file.js";
import { FilIkon } from "./icons.jsx";

/**
 * Snabbvyn för en bilaga: bilden som en miniatyr som öppnas i full storlek, en fil som en nedladdningslänk med namn och storlek.
 *
 * ⛔ EN VY FÖR KOMMENTARER OCH MEDDELANDEN (0.77.0, #292). Två kopior av "så här ser en bilaga ut" hade glidit isär första gången
 * den ena fick en ram. `marke` är attributets namn, eftersom kommentarernas prov redan läser `data-kommentar-bilaga-visad`.
 *
 * ⛔ INGEN `<iframe>` FÖR EN PDF. Den ritas olika i varje webbläsare, och en tom ruta ser ut som att filen inte kom fram.
 *
 * @param {{ bilaga: import("../lib/file.js").Bilaga, alt: string, marke?: string }} props
 */
export function BilagaVisning({ bilaga, alt, marke = "data-kommentar-bilaga-visad" }) {
  const storlek = bilaga.tecken ? attachmentSize(bilaga.tecken) : "";
  const slag = isImage(bilaga.typ) ? "bild" : "fil";
  const attr = { [marke]: slag };
  if (slag === "bild") {
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
