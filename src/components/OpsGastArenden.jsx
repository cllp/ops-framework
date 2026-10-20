import { useEffect, useMemo, useRef, useState } from "react";
import { GASTSKRIV_MAX_TECKEN } from "../lib/gast.js";
import { formatDagOchKlockslag, formatDate } from "../lib/format.js";
import { definierade, forvalda } from "../lib/ord.js";
import { statusTone } from "../lib/statusTone.js";
import { OpsButton } from "./OpsButton.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { Skrivfalt, texterPa } from "./OpsMeddelanden.jsx";
import { OpsPill } from "./OpsPill.jsx";

/**
 * Orden i gästens ärenden, på svenska och engelska (0.132.0, cllp/lifehub.app#389, skiva 3). Statusorden är ärendemodellens tre lägen (`ny`, `hanterad`, `avskriven`); en annan status ritas som den är.
 * @type {import("../lib/ord.js").Ordbok}
 */
export const ORD_OPSGASTARENDEN = {
  rubrik: { sv: "Ärenden till dig", en: "Cases for you" },
  ingress: {
    sv: "Här ligger ärendena som gruppen har gett dig. Du ser inte gruppens andra ärenden. Du kan kommentera och markera dem klara, men inte öppna dem igen.",
    en: "These are the cases the group has given you. You do not see the group's other cases. You can comment on them and mark them done, but not reopen them.",
  },
  tom: { sv: "Inga ärenden ligger hos dig just nu.", en: "No cases are with you right now." },
  laddar: { sv: "Hämtar ärendena", en: "Loading the cases" },
  fel: { sv: "Ärendena kunde inte hämtas just nu.", en: "The cases could not be loaded right now." },
  avkortad: { sv: "Gruppen har fler ärenden än vi kan söka igenom. Det kan finnas ärenden hos dig som inte visas.", en: "The group has more cases than we can search. There may be cases with you that are not shown." },
  status_ny: { sv: "Öppet", en: "Open" },
  status_hanterad: { sv: "Klart", en: "Done" },
  status_avskriven: { sv: "Avskrivet", en: "Dismissed" },
  forfaller: { sv: "Förfaller {datum}", en: "Due {datum}" },
  kommentarer: { sv: "Kommentarer", en: "Comments" },
  inga: { sv: "Inga kommentarer än.", en: "No comments yet." },
  fler: { sv: "Äldre kommentarer visas inte.", en: "Older comments are not shown." },
  gast: { sv: "Gäst", en: "Guest" },
  du: { sv: "Du", en: "You" },
  skrivPlats: { sv: "Skriv en kommentar", en: "Write a comment" },
  skrivNot: { sv: "Din kommentar märks Gäst. Du kan inte bifoga filer.", en: "Your comment is marked Guest. You cannot attach files." },
  skrivFel: { sv: "Kommentaren kunde inte skickas.", en: "The comment could not be sent." },
  klar: { sv: "Markera klar", en: "Mark done" },
  klarFraga: { sv: "Markera ärendet som klart? Du kan inte öppna det igen.", en: "Mark the case as done? You cannot reopen it." },
  klarJa: { sv: "Ja, markera klart", en: "Yes, mark done" },
  avbryt: { sv: "Avbryt", en: "Cancel" },
  klarFel: { sv: "Ärendet kunde inte markeras som klart.", en: "The case could not be marked as done." },
};

/** @typedef {{ id: string, text: string, tid: number, av: { namn: string }, gast?: boolean, egen?: boolean }} Arendekommentar */
/** @typedef {{ id: string, rubrik?: string, text?: string, status?: string, forfallodag?: string, kommentarer?: Arendekommentar[], fler?: boolean }} Gastarende */

/**
 * Ett ärende med sina kommentarer, en skrivruta och Markera klar. Eget tillstånd per ärende: en kommentar som skrivs i ett ärende lämnas inte kvar i ett annat.
 *
 * @param {{ post: Gastarende, onKommentera: (id: string, text: string) => Promise<unknown>, onKlar: (id: string) => Promise<unknown>, sprak: string, t: Record<string, string> }} props
 */
function Arendekort({ post, onKommentera, onKlar, sprak, t }) {
  // ⛔ FÄLTETS NAMN ÄR "Skriv en kommentar", inte chattens "Skriv ett meddelande": en gäst som läser upp skärmen ska höra vad fältet gör.
  const texter = useMemo(() => texterPa(sprak, { skriv: t.skrivPlats }), [sprak, t.skrivPlats]);
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const [skrivText, setSkrivText] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [skrivFel, setSkrivFel] = useState("");
  const [fraga, setFraga] = useState(false);
  const [klarFel, setKlarFel] = useState("");
  const levande = useRef(true);
  useEffect(() => {
    levande.current = true;
    return () => {
      levande.current = false;
    };
  }, []);
  const oppen = post.status === "ny";
  const statusText = post.status ? (t[`status_${post.status}`] ?? post.status) : "";
  const kommentarer = post.kommentarer ?? [];

  async function skicka() {
    const ut = skrivText.trim();
    if (!ut || skickar) return;
    setSkickar(true);
    setSkrivFel("");
    try {
      await onKommentera(post.id, ut);
      if (levande.current) setSkrivText("");
    } catch (e) {
      if (levande.current) setSkrivFel(e instanceof Error && e.message ? e.message : t.skrivFel);
    } finally {
      if (levande.current) setSkickar(false);
    }
  }

  async function markeraKlar() {
    setKlarFel("");
    try {
      await onKlar(post.id);
      if (levande.current) setFraga(false);
    } catch (e) {
      if (levande.current) setKlarFel(e instanceof Error && e.message ? e.message : t.klarFel);
    }
  }

  return (
    <article data-gast-arende={post.id} data-status={post.status ?? ""} aria-label={post.rubrik} className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <h3 data-gast-arende-rubrik="" className="m-0 min-w-0 flex-1 text-sektion text-ink wrap-anywhere">{post.rubrik}</h3>
        {statusText ? (
          <span data-gast-arende-status="">
            <OpsPill tone={statusTone(post.status)}>{statusText}</OpsPill>
          </span>
        ) : null}
      </header>
      {post.forfallodag ? (
        <p data-gast-arende-forfaller="" className="m-0 text-meta text-ink-secondary">{t.forfaller.replace("{datum}", formatDate(post.forfallodag, { locale }))}</p>
      ) : null}
      {post.text ? <p data-gast-arende-text="" className="m-0 whitespace-pre-wrap text-brod text-ink wrap-anywhere">{post.text}</p> : null}

      <section aria-label={t.kommentarer} data-gast-arende-kommentarer="" className="flex min-w-0 flex-col gap-2">
        <h4 className="m-0 text-sektion uppercase text-ink-muted">{t.kommentarer}</h4>
        {kommentarer.length === 0 ? (
          <p className="m-0 text-etikett text-ink-muted">{t.inga}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {kommentarer.map((k) => (
              <li key={k.id} data-gast-arende-kommentar={k.id} className="flex min-w-0 flex-col gap-0.5 rounded-base bg-sunken px-3 py-2">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-liten text-ink-muted">
                  <span>{k.egen ? t.du : k.av.namn}</span>
                  {k.gast ? <span data-gast-markning="" className="rounded-full bg-surface px-1.5 py-px text-mikro font-semibold text-ink-secondary">{t.gast}</span> : null}
                  <span>{formatDagOchKlockslag(k.tid, { locale })}</span>
                </span>
                <span className="whitespace-pre-wrap text-brod text-ink wrap-anywhere">{k.text}</span>
              </li>
            ))}
          </ul>
        )}
        {post.fler ? <p data-gast-arende-fler="" className="m-0 text-meta text-ink-muted">{t.fler}</p> : null}
      </section>

      <div data-gast-arende-skriv="" className="flex min-w-0 flex-col gap-1">
        <Skrivfalt text={skrivText} setText={setSkrivText} skickar={skickar} onSkicka={skicka} texter={texter} sprak={sprak} maxTecken={GASTSKRIV_MAX_TECKEN} />
        {skrivFel ? <p role="alert" data-gast-arende-skrivfel="" className="m-0 text-etikett text-danger">{skrivFel}</p> : null}
        <p className="m-0 text-meta text-ink-muted">{t.skrivNot}</p>
      </div>

      {oppen ? (
        <div data-gast-arende-klar="" className="flex min-w-0 flex-col gap-2">
          {fraga ? (
            <div role="group" aria-label={t.klar} className="flex min-w-0 flex-col gap-2 rounded-base border border-line bg-canvas p-3">
              <p className="m-0 text-brod text-ink">{t.klarFraga}</p>
              <div className="flex flex-wrap gap-2">
                <OpsButton variant="primary" onClick={markeraKlar}>
                  {t.klarJa}
                </OpsButton>
                <OpsButton variant="secondary" onClick={() => setFraga(false)}>
                  {t.avbryt}
                </OpsButton>
              </div>
            </div>
          ) : (
            <div>
              <OpsButton variant="secondary" onClick={() => setFraga(true)}>
                {t.klar}
              </OpsButton>
            </div>
          )}
          {klarFel ? <p role="alert" data-gast-arende-klarfel="" className="m-0 text-etikett text-danger">{klarFel}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Ärendena som delegerats till en gäst (0.132.0, cllp/lifehub.app#389, skiva 3).
 *
 * ══ ⛔ DEN RITAR BARA DET SERVERN GAV, OCH SERVERN GER BARA GÄSTENS EGNA ═══════════════════════════════════════════════════
 *
 * Vyn gör inget urval. Tjänstens `arenden` har redan filtrerat på gästens `gastId` (`gastDelegerad`) och vitlistat fälten (`GASTARENDEFALT`): rubrik, text, status, förfallodag och kommentarer, aldrig ärendets
 * GitHub-adress. En vy som själv gallrade en längre lista hade varit en andra gräns att hålla i takt med den första, och en bugg där hade visat gruppens ärenden för en gäst.
 *
 * ══ ⛔ BYGGD AV PRIMITIVER ═════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Inget ärendeskal, ingen inkorg, ingen modell med tillägg och ingen delegering: `OpsButton`, `OpsPill` (statusens ton är `statusTone`, samma som i appens listor), chattens skrivfält (`Skrivfalt`, utan bilagor,
 * mikrofon och omnämnanden) och kommentarernas rader. Gästen kan kommentera och markera klart, ingenting mer: inte öppna igen, inte byta ansvarig och inte skapa.
 *
 * ⛔ MARKERA KLAR FRÅGAR FÖRST. Gästen kan inte öppna ett ärende igen, och en knapp bredvid en skrivruta på en telefon trycks av misstag. Ett fel står utskrivet och ärendet står kvar öppet.
 * ⛔ ETT FEL FRÅN `onKommentera` STÅR UNDER FÄLTET OCH TEXTEN BLIR KVAR. En kommentar som inte gick fram och försvinner ur rutan är skriven förgäves.
 * ⛔ TOMT ÄR ETT SVAR: utan ärenden står `tom`. (Gästens vy visar normalt ingen flik alls då, men komponenten själv tiger inte.)
 *
 * @param {object} props
 * @param {ReadonlyArray<Gastarende>} props.poster Tjänstens `arenden().poster`.
 * @param {boolean} [props.avkortad] Tjänstens `arenden().avkortad`: gruppen hade fler ärenden än servern läser, så listan kan sakna något. Det sägs.
 * @param {(id: string, text: string) => Promise<unknown>} props.onKommentera Tjänstens `kommenteraArende`. Avvisar med ett Error vars text visas under fältet.
 * @param {(id: string) => Promise<unknown>} props.onKlar Tjänstens `markeraArendeKlart`. Avvisar med ett Error vars text visas.
 * @param {boolean} [props.laddar] Första hämtningen pågår.
 * @param {string | null} [props.fel] Hämtningen föll. Ett fel är inte "inga ärenden".
 * @param {string} [props.sprak]
 * @param {Partial<Record<keyof typeof ORD_OPSGASTARENDEN, string>>} [props.ord]
 */
export function OpsGastArenden({ poster, avkortad = false, onKommentera, onKlar, laddar = false, fel = null, sprak = "sv", ord }) {
  if (!Array.isArray(poster)) {
    throw new Error("OpsGastArenden: poster måste vara en lista, tom när gästen inte har några. Utan den går det inte att skilja 'inga ärenden' från 'inte hämtade'.");
  }
  for (const p of poster) if (!p || typeof p.id !== "string") throw new Error("OpsGastArenden: varje ärende har { id, rubrik, text, status, forfallodag, kommentarer } (tjänstens arenden()).");
  if (typeof onKommentera !== "function" || typeof onKlar !== "function") throw new Error("OpsGastArenden: onKommentera och onKlar krävs. En gäst som kan läsa men inte svara har inget att göra med ärendet.");
  const t = { ...forvalda(ORD_OPSGASTARENDEN, sprak), ...definierade(/** @type {Record<string, string>} */ (ord ?? {})) };

  return (
    <section aria-label={t.rubrik} data-gast-arenden="" className="flex min-w-0 flex-col gap-4">
      <p data-gast-arenden-ingress="" className="m-0 text-etikett text-ink-secondary">{t.ingress}</p>
      {fel ? (
        <p role="alert" data-gast-arenden-fel="" className="m-0 text-etikett text-danger">{t.fel}</p>
      ) : laddar ? (
        <OpsEmpty busy title={t.laddar} busyLabel={t.laddar} />
      ) : poster.length === 0 ? (
        <OpsEmpty title={t.tom} />
      ) : (
        poster.map((p) => <Arendekort key={p.id} post={p} onKommentera={onKommentera} onKlar={onKlar} sprak={sprak} t={t} />)
      )}
      {avkortad ? <p role="status" data-gast-arenden-avkortad="" className="m-0 text-meta text-ink-muted">{t.avkortad}</p> : null}
    </section>
  );
}
