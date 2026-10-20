import { useEffect, useMemo, useRef } from "react";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { Meddelanderader, texterPa } from "./OpsMeddelanden.jsx";

/**
 * Orden i gästens chatt, på svenska och engelska (0.132.0, cllp/lifehub.app#389, skiva 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTCHATT = {
  rubrik: { sv: "Chatt", en: "Chat" },
  tom: { sv: "Inga meddelanden än.", en: "No messages yet." },
  historik: { sv: "Du ser hela gruppens chatt, från början.", en: "You can see the whole group chat, from the beginning." },
  skrivskyddad: { sv: "Du kan läsa chatten men inte skriva i den. Svar i trådar visas inte än.", en: "You can read the chat but not write in it. Replies in threads are not shown yet." },
  aldre: { sv: "Visa äldre meddelanden", en: "Show older messages" },
  bilaga: { sv: "Bilaga: {namn}. Bilagor visas inte för gäster.", en: "Attachment: {namn}. Attachments are not shown to guests." },
  fel: { sv: "Chatten kunde inte hämtas just nu.", en: "The chat could not be loaded right now." },
  laddar: { sv: "Hämtar chatten", en: "Loading the chat" },
};

/**
 * Gruppens chatt för en gäst: bara läsning (0.132.0, cllp/lifehub.app#389, skiva 2).
 *
 * ══ ⛔ DEN RITAR MEDLEMMENS BUBBLOR (`Meddelanderader`), INTE MEDLEMMENS CHATT ═══════════════════════════════════════════
 *
 * `OpsMeddelanden` är 4 300 rader med en samtalskälla, skrivfält, trådar, reaktioner och fästa meddelanden, och ingenting av det går att slå av för en gäst. Den rena ritaren av raderna
 * (dagsavdelare, bubblor, tid) är en egen funktion i samma fil och tar raderna som props; den delas här (regel 2), så att en gästs chatt ser ut som medlemmens utan en andra bubbla att hålla i takt.
 * Skrivfält, trådar, reaktioner och bilagornas innehåll byggs inte: de hör till skiva 3 (gästen skriver), och sidan SÄGER det i stället för att tiga (`skrivskyddad`, `bilaga`).
 *
 * ⛔ AVSÄNDAREN ÄR ETT NAMN OCH ALDRIG ETT UID. Tjänsten (`createGastService.chatt`) skickar `av: { namn }`; vyn använder namnet som nyckel för avatar och sammanhållning av på varandra följande
 * meddelanden. Ingen adress eller uid finns att visa.
 *
 * ⛔ TOMT ÄR ETT SVAR: utan meddelanden står `tom`. Äldre meddelanden hämtas med en knapp (`onAldre`), inte tyst.
 *
 * @param {object} props
 * @param {ReadonlyArray<{ id: string, av: { namn: string }, text: string, tid: number, svarPa?: { id: string, namn: string, text: string }, bilaga?: { namn: string, typ: string } }>} props.meddelanden Tjänstens `chatt().meddelanden`, äldst först.
 * @param {boolean} [props.fler] Det finns äldre meddelanden (`chatt().fler`).
 * @param {() => void | Promise<unknown>} [props.onAldre] Hämtar nästa sida bakåt. Utan den ritas ingen knapp.
 * @param {boolean} [props.laddar] Första sidan hämtas ännu.
 * @param {string | null} [props.fel] Hämtningen föll. Ett fel är inte "inga meddelanden".
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_OPSGASTCHATT, string>>} [props.ord]
 */
export function OpsGastChatt({ meddelanden, fler = false, onAldre, laddar = false, fel = null, sprak = "sv", ord }) {
  if (!Array.isArray(meddelanden)) {
    throw new Error("OpsGastChatt: meddelanden måste vara en lista, tom när chatten är tom. Utan den går det inte att skilja 'inga meddelanden' från 'inte hämtad'.");
  }
  for (const m of meddelanden) {
    if (!m || typeof m.id !== "string" || typeof m.tid !== "number" || typeof m.av?.namn !== "string") throw new Error("OpsGastChatt: varje meddelande har { id, av: { namn }, text, tid } (tjänstens chatt()).");
  }
  const t = { ...forvalda(ORD_OPSGASTCHATT, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const texter = useMemo(() => texterPa(sprak, {}), [sprak]);
  const logg = useRef(/** @type {HTMLDivElement | null} */ (null));
  const sistaId = meddelanden.length > 0 ? meddelanden[meddelanden.length - 1].id : "";
  // Chatten börjar nederst, där det nyaste står. Ett nytt meddelande rullar bara ner den som redan står längst ned.
  const vidBotten = useRef(true);
  useEffect(() => {
    const el = logg.current;
    if (el && vidBotten.current) el.scrollTop = el.scrollHeight;
  }, [sistaId]);

  const rader = useMemo(() => meddelanden.map((m) => ({ id: m.id, text: m.text, av: m.av.namn, tid: m.tid, ...(m.svarPa ? { svarPa: m.svarPa.id } : {}) })), [meddelanden]);
  const originalPerId = useMemo(() => new Map(meddelanden.map((m) => [m.id, m])), [meddelanden]);
  const uppslag = useMemo(
    () => new Map(meddelanden.filter((m) => m.svarPa).map((m) => [/** @type {string} */ (m.svarPa?.id), { id: /** @type {string} */ (m.svarPa?.id), av: /** @type {string} */ (m.svarPa?.namn), text: /** @type {string} */ (m.svarPa?.text), tid: 0 }])),
    [meddelanden],
  );

  return (
    <section aria-label={t.rubrik} data-gast-chatt="" className="flex min-w-0 flex-col gap-3">
      <p data-gast-chatt-historik="" className="m-0 text-meta text-ink-muted">{t.historik}</p>
      {fel ? (
        <p role="alert" data-gast-chatt-fel="" className="m-0 text-etikett text-danger">{t.fel}</p>
      ) : laddar ? (
        <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />
      ) : meddelanden.length === 0 ? (
        <OpsEmpty title={t.tom} />
      ) : (
        <div
          ref={logg}
          role="log"
          aria-label={t.rubrik}
          data-gast-chatt-logg=""
          onScroll={(e) => {
            const el = e.currentTarget;
            vidBotten.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="flex max-h-[60dvh] min-h-48 min-w-0 flex-col overflow-y-auto rounded-lg border border-line bg-surface p-3"
        >
          {fler && onAldre ? (
            <div className="flex justify-center pb-2">
              <OpsButton variant="secondary" size="sm" onClick={onAldre}>
                {t.aldre}
              </OpsButton>
            </div>
          ) : null}
          <Meddelanderader
            meddelanden={/** @type {any} */ (rader)}
            uid=""
            namnFor={(/** @type {string} */ namn) => namn}
            medlemmar={[]}
            locale={locale}
            visaNamn
            texter={texter}
            citat={{ pa: false, onCitera: () => {}, uppslag: /** @type {any} */ (uppslag) }}
            efter={(m) => {
              const bilaga = originalPerId.get(m.id)?.bilaga;
              return bilaga ? <span data-gast-chatt-bilaga="" className="text-meta text-ink-muted">{t.bilaga.replace("{namn}", bilaga.namn)}</span> : null;
            }}
          />
        </div>
      )}
      <p data-gast-chatt-skrivskyddad="" className="m-0 text-meta text-ink-muted">{t.skrivskyddad}</p>
    </section>
  );
}
