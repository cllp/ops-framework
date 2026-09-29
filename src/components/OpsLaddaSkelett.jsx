import { useEffect, useState } from "react";
import { OpsButton } from "./OpsButton.jsx";

/**
 * Skelettet medan inloggningen kontrolleras (0.31.0, fynd 7 i cllp/bolag-ops#475).
 *
 * ══ ⛔ EN TEXT ÄR EN BLOCKERANDE TOM SEKUND ═══════════════════════════════
 *
 * Före 0.31.0 visade `OpsAuthGate` en snurra och orden "Kontrollerar inloggning" på en tom sida så länge auth svarade. Live på
 * 0.30.1 tog det flera sekunder, och hela den tiden var sidan en vit yta med en text: ingen struktur att vänja ögat vid, och
 * ingen väg ut om svaret aldrig kom. Nu ritas HUVUDET och innehållet som grå block (samma mått som det riktiga: toppradens 56 px,
 * kort med 24 px rundning), och efter en tidsgräns (`langsamEfterMs`, förval 8 s) tillkommer en tydlig rad med "Försök igen".
 *
 * ⛔ SKELETTET ÄR DEKOR, ORDEN ÄR STATUS. Blocken är `aria-hidden`; en `role="status"` bär "Kontrollerar inloggning" för den som
 * lyssnar. Rörelsen (`animate-pulse`) är `motion-safe`: den som bett om mindre rörelse får stillastående block.
 *
 * ⛔ "FÖRSÖK IGEN" LÄMNAR INTE APPEN I ETT LÄGE DEN INTE KAN LÄMNA SJÄLV. Utan `onForsokIgen` laddar knappen om sidan, vilket är
 * det enda ramverket vet hur man gör utan att kunna auth-leverantörens API.
 *
 * @param {object} props
 * @param {string} [props.etikett] Statusordet. Förval "Kontrollerar inloggning".
 * @param {number} [props.langsamEfterMs] Efter så här många millisekunder visas raden med "Försök igen". Förval 8000.
 * @param {string} [props.langsamText]
 * @param {string} [props.forsokIgenEtikett]
 * @param {() => void} [props.onForsokIgen]
 */
export function OpsLaddaSkelett({
  etikett = "Kontrollerar inloggning",
  langsamEfterMs = 8000,
  langsamText = "Det här tar längre tid än väntat. Kontrollera anslutningen och försök igen.",
  forsokIgenEtikett = "Försök igen",
  onForsokIgen,
}) {
  const [langsam, setLangsam] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLangsam(true), langsamEfterMs);
    return () => clearTimeout(t);
  }, [langsamEfterMs]);

  const block = "rounded-md bg-sunken motion-safe:animate-pulse";
  return (
    <div role="status" aria-live="polite" aria-busy={!langsam || undefined} data-skelett="" className="min-h-dvh bg-canvas">
      <span className="sr-only">{etikett}</span>
      <div aria-hidden="true" className="flex h-(--topbar-height) items-center gap-4 border-b border-line bg-surface px-4">
        <div className={`${block} h-8 w-32`} />
        <div className="hidden flex-1 items-center justify-center gap-3 md:flex">
          <div className={`${block} h-4 w-14`} />
          <div className={`${block} h-4 w-20`} />
          <div className={`${block} h-4 w-12`} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`${block} size-9 rounded-full`} />
          <div className={`${block} size-9 rounded-full`} />
          <div className={`${block} size-7 rounded-full`} />
        </div>
      </div>
      <div aria-hidden="true" className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-6">
        <div className={`${block} h-7 w-48`} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className={`${block} h-24 rounded-card`} />
          <div className={`${block} h-24 rounded-card`} />
          <div className={`${block} hidden h-24 rounded-card sm:block`} />
        </div>
      </div>
      {langsam ? (
        <div className="mx-auto mt-6 flex w-full max-w-5xl flex-col items-start gap-3 px-4">
          <p className="m-0 text-brod text-ink-secondary">{langsamText}</p>
          <OpsButton variant="secondary" onClick={onForsokIgen ?? (() => globalThis.location?.reload())}>
            {forsokIgenEtikett}
          </OpsButton>
        </div>
      ) : null}
    </div>
  );
}
