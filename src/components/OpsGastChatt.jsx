import { useEffect, useMemo, useRef, useState } from "react";
import { GASTSKRIV_MAX_TECKEN } from "../lib/gast.js";
import { definierade, forvalda } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { Meddelanderader, Skrivfalt, texterPa } from "./OpsMeddelanden.jsx";

/**
 * Orden i gästens chatt, på svenska och engelska (0.132.0, cllp/lifehub.app#389, skiva 2).
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTCHATT = {
  rubrik: { sv: "Chatt", en: "Chat" },
  tom: { sv: "Inga meddelanden än.", en: "No messages yet." },
  historik: { sv: "Du ser hela gruppens chatt, från början.", en: "You can see the whole group chat, from the beginning." },
  skrivskyddad: { sv: "Du kan läsa chatten men inte skriva i den. Svar i trådar visas inte än.", en: "You can read the chat but not write in it. Replies in threads are not shown yet." },
  skrivNot: { sv: "Du skriver som gäst: dina meddelanden märks Gäst. Du kan inte bifoga filer. Svar i trådar visas inte än.", en: "You write as a guest: your messages are marked Guest. You cannot attach files. Replies in threads are not shown yet." },
  skrivFel: { sv: "Meddelandet kunde inte skickas.", en: "The message could not be sent." },
  aldre: { sv: "Visa äldre meddelanden", en: "Show older messages" },
  bilaga: { sv: "Bilaga: {namn}. Bilagor visas inte för gäster.", en: "Attachment: {namn}. Attachments are not shown to guests." },
  fel: { sv: "Chatten kunde inte hämtas just nu.", en: "The chat could not be loaded right now." },
  laddar: { sv: "Hämtar chatten", en: "Loading the chat" },
};

/** Märket för gästens egna meddelanden i raderna. Ingen avsändare kan heta så, och namnen kommer aldrig härifrån. */
const EGEN = "__gast_egen__";

/**
 * Gruppens chatt för en gäst (0.132.0, cllp/lifehub.app#389, skiva 2).
 *
 * ══ ⛔ DEN RITAR MEDLEMMENS BUBBLOR (`Meddelanderader`), INTE MEDLEMMENS CHATT ═══════════════════════════════════════════
 *
 * `OpsMeddelanden` är 4 300 rader med en samtalskälla, skrivfält, trådar, reaktioner och fästa meddelanden, och ingenting av det går att slå av för en gäst. Den rena ritaren av raderna
 * (dagsavdelare, bubblor, tid) är en egen funktion i samma fil och tar raderna som props; den delas här (regel 2), så att en gästs chatt ser ut som medlemmens utan en andra bubbla att hålla i takt.
 * Skrivfältet är chattens (`Skrivfalt`, delat) utan bilagor, mikrofon, omnämnanden och agent. Trådar, reaktioner och bilagornas innehåll byggs inte, och sidan SÄGER det i stället för att tiga (`skrivNot`, `bilaga`).
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
 * @param {(text: string) => Promise<unknown>} [props.onSkriv] (0.132.0, CP 2026-10-20: "Gästen får skriva") Skickar ett meddelande (tjänstens `skrivChatt`). Ger den ett fel visas dess text under fältet och texten står kvar.
 *   Utan den ritas inget skrivfält och sidan säger att chatten bara går att läsa.
 * @param {boolean} [props.laddar] Första sidan hämtas ännu.
 * @param {string | null} [props.fel] Hämtningen föll. Ett fel är inte "inga meddelanden".
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_OPSGASTCHATT, string>>} [props.ord]
 */
export function OpsGastChatt({ meddelanden, fler = false, onAldre, onSkriv, laddar = false, fel = null, sprak = "sv", ord }) {
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

  const [skrivText, setSkrivText] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [skrivFel, setSkrivFel] = useState("");
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);
  async function skicka() {
    const ut = skrivText.trim();
    if (!ut || !onSkriv || skickar) return;
    setSkickar(true);
    setSkrivFel("");
    try {
      await onSkriv(ut);
      if (!levande.current) return;
      setSkrivText("");
      // Det gästen själv skrev ska synas: scrollen följer med hela vägen ned.
      vidBotten.current = true;
    } catch (e) {
      if (levande.current) setSkrivFel(e instanceof Error && e.message ? e.message : t.skrivFel);
    } finally {
      if (levande.current) setSkickar(false);
    }
  }
  // ⛔ GÄSTENS EGNA MEDDELANDEN ÄR "EGNA" (höger, accentfärg) som medlemmens: `uid` är ett märke som bara raderna känner igen. Ett annat namn är en avsändare, och märket Gäst sitter på varje meddelande en gäst skrivit.
  const rader = useMemo(() => meddelanden.map((m) => ({ id: m.id, text: m.text, av: m.egen ? EGEN : m.av.namn, tid: m.tid, ...(m.gast ? { gast: true } : {}), ...(m.svarPa ? { svarPa: m.svarPa.id } : {}) })), [meddelanden]);
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
            uid={EGEN}
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
      {onSkriv ? (
        <div data-gast-chatt-skriv="" className="flex min-w-0 flex-col">
          <Skrivfalt text={skrivText} setText={setSkrivText} skickar={skickar} onSkicka={skicka} texter={texter} sprak={sprak} maxTecken={GASTSKRIV_MAX_TECKEN} />
        </div>
      ) : null}
      {skrivFel ? <p role="alert" data-gast-chatt-skrivfel="" className="m-0 text-etikett text-danger">{skrivFel}</p> : null}
      <p data-gast-chatt-skrivskyddad="" className="m-0 text-meta text-ink-muted">{onSkriv ? t.skrivNot : t.skrivskyddad}</p>
    </section>
  );
}
