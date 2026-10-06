import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useOpsSprak } from "./OpsSprak.jsx";
import { cx } from "../lib/cx.js";
import { formatDate, formatTime, formatRelativeDate } from "../lib/format.js";
import { MAX_MEDDELANDE, delaSamtalsnyckel, utdrag } from "../lib/samtal.js";
import { useSamtal } from "../data/useSamtal.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { NAMN_SAKNAS } from "../lib/personnamn.js";
import { usePersonnamn } from "./usePersonnamn.js";
import { OpsIconLink } from "./OpsIconLink.jsx";
import { OpsMottagare } from "./OpsMottagare.jsx";
import { OpsCountBadge } from "./counter.jsx";
import { AgentIkon, ChevronVansterIkon, GruppIkon, KryssIkon, LasIkon, MeddelandeIkon, PlusIkon, SkickaIkon, SokIkon } from "./icons.jsx";

/**
 * Meddelanden: inkorgen med gruppchatten och de privata samtalen, och samtalet bredvid (0.34.0, #182, #185).
 *
 * ══ ⛔ SS ChatInboxPanel ÄR FÖREBILDEN (regel 12) ══════════════════════════════════════════════════
 *
 * `cllp/sessions-platform` `apps/web/src/components/ChatInboxPanel.jsx`: på dator en lista till vänster (35 procent,
 * minst 220 px, högst 40, `:959`) och samtalet till höger (`:1194`), båda som kort med rundade hörn på sidans bakgrund
 * (`sm:gap-2 sm:p-2`, `:957`). På telefon är listan hela sidan, och ett valt samtal ersätter den med en rad
 * "‹ Tillbaka" överst (`:880-892`). Överst i listan: filtret Alla / Olästa (`:968-1000`) och sökningen (`:1065-1085`).
 * En rad (`:698-760`): en ruta på 40 px med samtalets ikon, räknaren i dess hörn, namnet (fetare när det finns
 * olästa), tiden, en etikett för slaget och det senaste meddelandet med avsändaren först.
 *
 * ⛔ STORLEKARNA ÄR RAMVERKETS ROLLER, INTE SS PIXLAR (check-typografi). SS 9 px (tid, etikett) blir 10 (`text-liten`),
 * 11 px (sökningen) blir `text-hjalp`, bubblans 13 px blir 14 (`text-etikett`). Jämförelsen står i
 * `docs/jamforelser/0.34.0/jamforelse.md`.
 *
 * ⛔ ANDRAS BUBBLOR, DEN VALDA RADEN OCH ETIKETTEN GRUPP ÄR `bg-hover`, INTE `bg-raised`. I det ljusa temat är `raised` samma färg
 * som `surface` (tokens.css), så en bubbla i `raised` på samtalets yta hade varit text utan bubbla. Upptäckt i montaget mot SS,
 * där `--color-chat-bubble-other-bg` skiljer sig från ytan, och mätt i check-skalyta avsnitt 29.
 *
 * ⛔ DET PRIVATA SYNS. Ett privat samtal bär etiketten "Privat" i listan och raden "Bara ni två ser det här" i huvudet.
 *
 * ⛔ "NYTT MEDDELANDE" LÄMNAR ALDRIG MEDDELANDEN (0.63.0, #263). CP 2026-10-06 11:22, med en skärminspelning från LifeHub: "steget
 * med att öppna en liten chattfönster till är lite konstigt", och "Chatten dök upp långt senare...". Knappen öppnade skalets
 * skapa-panel, som dolde hela vyn, och tråden ritades bara när samtalet fanns bland raderna, som lästes om först vid nästa
 * `focus`. Förebilden är SS: man väljer en person i inkorgen (`ChatInboxPanel.jsx:1091-1124`), samtalet öppnas eller skapas
 * (`ensureDMConversation`, `:477-505`), och tråden ritas på det VALDA samtalet (`:186-191`, `DMPanel.jsx:95-97`). Här:
 *   - läget "nytt" i högerpanelen, med Till överst och trådens skrivfält längst ned, och listan kvar till vänster;
 *   - valet i Till öppnar samtalet direkt med `oppnaPrivat`. Finns det redan öppnas det, med sin historik;
 *   - tråden ritas på `valdId`. Saknas raden läses gruppen och paret ur nyckeln (`delaSamtalsnyckel`), och rubriken ur
 *     medlemmarna;
 *   - raden läggs in i listan lokalt (`laggIn`) efter öppnandet och efter Skicka, och listan läses sedan om.
 *
 * ⛔ ETT SAMTAL ÄR EN MODELL (CP:s beslut 4). Gruppchatten, ett privat samtal och ett agentsamtal ritas av samma vy;
 * skillnaden är huvudets rad och vilka namn som skrivs ut.
 */

/**
 * @typedef {object} Medlemsrad
 * @property {string} userId
 * @property {string} [namn]
 * @property {string} [bild]
 * @property {string} [typ]
 * @property {string} [status]
 */

/**
 * @typedef {object} Meddelandetexter
 * @property {string} [rubrik] Förval "Meddelanden".
 * @property {string} [nytt] Förval "Nytt meddelande".
 * @property {string} [alla] Förval "Alla".
 * @property {string} [olasta] Förval "Olästa".
 * @property {string} [sok] Förval "Sök i meddelanden".
 * @property {string} [rensaSok] Förval "Rensa sökningen".
 * @property {string} [tomt] Förval "Inga samtal än".
 * @property {string} [tomtOlasta] Förval "Inget oläst".
 * @property {string} [ingenTraff] Förval "Ingen träff".
 * @property {string} [valjSamtal] Förval "Välj ett samtal".
 * @property {string} [tillbaka] Förval "Tillbaka".
 * @property {string} [grupp] Etiketten för gruppchatten. Förval "Grupp".
 * @property {string} [privat] Förval "Privat".
 * @property {string} [agent] Förval "Agent".
 * @property {string} [privatRad] Förval "Bara ni två ser det här".
 * @property {string} [gruppRad] Förval "Alla i gruppen ser det här".
 * @property {string} [agentRad] Förval "Bara du och agenten ser det här".
 * @property {string} [inga] Förval "Inga meddelanden än".
 * @property {string} [skriv] Förval "Skriv ett meddelande".
 * @property {string} [skicka] Förval "Skicka".
 * @property {string} [du] Förval "Du".
 * @property {string} [olastaText] Substantivet efter räknarens siffra. Förval "olästa".
 * @property {string} [fel] Förval "Meddelandena kunde inte hämtas".
 * @property {string} [till] Mottagarväljarens etikett i läget "nytt". Förval "Till".
 * @property {string} [valjMottagare] Felet när man skickar i läget "nytt" utan att ha valt någon. Förval "Välj vem meddelandet ska till.".
 * @property {string} [oppnaFel] Rubriken när samtalet inte kunde öppnas. Förval "Samtalet kunde inte öppnas".
 * @property {string} [ingenAnnan] När det inte finns någon att skriva till. Förval "Det finns ingen annan i gruppen att skriva till.".
 */

/** @type {Required<Meddelandetexter>} */
const TEXTER = {
  rubrik: "Meddelanden",
  nytt: "Nytt meddelande",
  alla: "Alla",
  olasta: "Olästa",
  sok: "Sök i meddelanden",
  rensaSok: "Rensa sökningen",
  tomt: "Inga samtal än",
  tomtOlasta: "Inget oläst",
  ingenTraff: "Ingen träff",
  valjSamtal: "Välj ett samtal",
  tillbaka: "Tillbaka",
  grupp: "Grupp",
  privat: "Privat",
  agent: "Agent",
  privatRad: "Bara ni två ser det här",
  gruppRad: "Alla i gruppen ser det här",
  agentRad: "Bara du och agenten ser det här",
  inga: "Inga meddelanden än",
  skriv: "Skriv ett meddelande",
  skicka: "Skicka",
  du: "Du",
  olastaText: "olästa",
  fel: "Meddelandena kunde inte hämtas",
  till: "Till",
  valjMottagare: "Välj vem meddelandet ska till.",
  oppnaFel: "Samtalet kunde inte öppnas",
  ingenAnnan: "Det finns ingen annan i gruppen att skriva till.",
};

/**
 * Tiden på en rad: klockslag i dag, annars datum.
 * @param {number} tid @param {number} nu @param {string} locale
 */
function radtid(tid, nu, locale) {
  const d = new Date(tid);
  const n = new Date(nu);
  return d.toDateString() === n.toDateString() ? formatTime(tid, { locale }) : formatDate(tid, { locale });
}

/** "i dag" blir "I dag" i avdelaren, som SS (`ChatDateDivider.jsx`). @param {string} t */
const forstaVersal = (t) => (t ? t.charAt(0).toLocaleUpperCase("sv") + t.slice(1) : t);

/**
 * Ingången till meddelandena, med antalet olästa (0.34.0). En `OpsIconLink` med ramverkets ikon, för appens `actions`.
 *
 * @param {{ href: string, olasta: number, etikett?: string, olastaText?: string, onNavigate?: (href: string, e: any) => void, active?: boolean }} props
 */
export function OpsMeddelandeLank({ href, olasta, etikett = "Meddelanden", olastaText = "olästa", onNavigate, active }) {
  return <OpsIconLink href={href} icon={<MeddelandeIkon size={20} />} label={etikett} badge={olasta} badgeText={olastaText} onNavigate={onNavigate} active={active} />;
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>} props.kalla
 * @param {string} props.uid
 * @param {string | null} props.groupId
 * @param {string} props.gruppNamn Gruppchattens namn i listan.
 * @param {ReadonlyArray<Medlemsrad>} props.medlemmar Gruppens medlemskap, för namn och bilder.
 * @param {string | null} [props.valt] Valt samtal, när appen styr det (t.ex. ur adressen). Tråden ritas på id:t också när
 *   samtalet ännu inte finns bland raderna (0.63.0, #263).
 * @param {boolean} [props.nytt] (0.63.0, #263) Läget "nytt" i högerpanelen, när appen styr det (t.ex. ur adressen, `?nytt=1`).
 *   Utelämnad: komponenten håller läget själv.
 * @param {(samtalId: string | null, val?: { nytt: true }) => void} [props.onValj] Anropas med det valda samtalet, eller med
 *   `(null, { nytt: true })` när läget "nytt" öppnas. Ett anrop utan `val` betyder att läget "nytt" är stängt. EN signal för
 *   båda, så att en app som har dem i adressen skriver adressen en gång.
 * @param {(antal: number) => void} [props.onOlasta] Anropas med antalet olästa när det ändras, för ingångens räknare.
 * @param {string} [props.sprak] "sv" eller "en", för tiderna. Förval "sv".
 * @param {Meddelandetexter} [props.texter]
 */
export function OpsMeddelanden({ kalla, uid, groupId, gruppNamn, medlemmar, valt, nytt, onValj, onOlasta, sprak: sprakProp, texter = {} }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const t = { ...TEXTER, ...texter };
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const { rader, laddar, fel, olasta, lasOm, laggIn } = useSamtal({ kalla, groupId, uid });
  const [egetVal, setEgetVal] = useState(/** @type {string | null} */ (null));
  const [egetNytt, setEgetNytt] = useState(false);
  // ⛔ Läget "nytt" vinner över ett valt samtal: det är det man senast bad om.
  const nyttLage = Boolean(groupId) && (nytt !== undefined ? nytt : egetNytt);
  const valdId = nyttLage ? null : valt !== undefined ? valt : egetVal;
  /** @param {string | null} id @param {{ nytt: true }} [val] */
  const valj = (id, val) => {
    if (valt === undefined) setEgetVal(id);
    if (nytt === undefined) setEgetNytt(Boolean(val?.nytt));
    onValj?.(id, val);
  };
  // Det man skrev i läget "nytt" innan man valt någon följer med in i tråden.
  const utkast = useRef(/** @type {{ id: string, text: string } | null} */ (null));
  const [filter, setFilter] = useState(/** @type {"alla" | "olasta"} */ ("alla"));
  const [sok, setSok] = useState("");

  useEffect(() => {
    onOlasta?.(olasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olasta]);

  // Ett nytt val nollar sökningen i samtalet, inte i listan. Byts gruppen stängs samtalet: det hör till den förra gruppen.
  useEffect(() => {
    if (valt === undefined) setEgetVal(null);
  }, [groupId, valt]);
  useEffect(() => {
    if (nytt === undefined) setEgetNytt(false);
  }, [groupId, nytt]);

  const namn = useMemo(() => {
    /** @type {Map<string, Medlemsrad>} */
    const m = new Map();
    for (const r of medlemmar ?? []) if (r?.userId) m.set(r.userId, r);
    return m;
  }, [medlemmar]);
  // ⛔ ALDRIG ETT ID SOM NAMN (#218): medlemskapets namn, den inloggades eget namn, annars "Namn saknas".
  const personnamn = usePersonnamn();
  const namnFor = (/** @type {string} */ id) => personnamn(namn.get(id)?.namn, id).text;

  const nu = Date.now();
  const visade = rader
    .filter((r) => (filter === "olasta" ? r.olasta > 0 : true))
    .filter((r) => {
      const q = sok.trim().toLocaleLowerCase("sv");
      if (!q) return true;
      const rubrik = r.samtal.slag === "grupp" ? gruppNamn : namnFor(r.motpart ?? "");
      return rubrik.toLocaleLowerCase("sv").includes(q) || (r.senaste?.text ?? "").toLocaleLowerCase("sv").includes(q);
    });
  /*
   * ⛔ TRÅDEN RITAS PÅ DET VALDA ID:T, INTE PÅ LISTAN (#263, SS `ChatInboxPanel.jsx:186-191`). Raden ur listan när den finns.
   * Annars läses gruppen och paret ur nyckeln: ett id i en annan grupp, eller ett par jag inte är med i, ritar ingen tråd.
   * Slaget avgörs av vem den andra är, ur medlemmarna, på samma sätt som regeln skiljer `personer` från `agent`.
   */
  /** @type {typeof rader[number] | null} */
  const vald = useMemo(() => {
    if (!valdId) return null;
    const rad = rader.find((r) => r.samtal.id === valdId);
    if (rad) return rad;
    const d = delaSamtalsnyckel(valdId);
    if (!d || d.groupId !== groupId || !uid) return null;
    if ("slag" in d) return { samtal: { id: valdId, groupId: d.groupId, slag: "grupp", skapad: 0, skapadAv: "" }, senaste: null, olasta: 0, lastTill: 0, motpart: null };
    if (!d.deltagare.includes(uid)) return null;
    const annan = d.deltagare[0] === uid ? d.deltagare[1] : d.deltagare[0];
    const slag = namn.get(annan)?.typ === "agent" ? "agent" : "personer";
    return { samtal: { id: valdId, groupId: d.groupId, slag, deltagare: d.deltagare, skapad: 0, skapadAv: "" }, senaste: null, olasta: 0, lastTill: 0, motpart: annan };
  }, [valdId, rader, groupId, uid, namn]);
  const hoger = nyttLage || Boolean(vald);
  // Utkastet hör till den tråd som just öppnades ur läget "nytt". Den har läst det när den monterades; sedan glöms det.
  useEffect(() => {
    utkast.current = null;
  }, [valdId]);

  /** @param {typeof rader[number]} r */
  const rubrikFor = (r) => (r.samtal.slag === "grupp" ? gruppNamn : namnFor(r.motpart ?? ""));
  /** @param {typeof rader[number]} r @param {"md" | "sm"} storlek */
  const markeFor = (r, storlek) => {
    if (r.samtal.slag === "grupp") return <OpsIdentity name={gruppNamn} seed={groupId ?? "grupp"} size={storlek} icon={GruppIkon} />;
    const m = namn.get(r.motpart ?? "");
    if (r.samtal.slag === "agent") return <OpsIdentity name={m?.namn || t.agent} seed={r.motpart ?? "agent"} size={storlek} icon={AgentIkon} rund />;
    return <OpsIdentity name={namnFor(r.motpart ?? "")} seed={r.motpart ?? ""} imageUrl={m?.bild || undefined} size={storlek} rund />;
  };
  /** @param {typeof rader[number]} r */
  const slagetFor = (r) => (r.samtal.slag === "grupp" ? t.grupp : r.samtal.slag === "agent" ? t.agent : t.privat);

  return (
    /* ⛔ HÖJDEN ÄR FÖNSTRET MINUS SKALETS RAMAR (huvudet med sin kant på 1 px, och bottenraden under md), så att listan och
       samtalet rullar var för sig och skrivfältet står kvar längst ned, som SS (`h-full`, `:957`). Mätt i check-skalyta
       avsnitt 29: utan den enda pixeln för huvudets kant rullade hela sidan en pixel, och skrivfältet hamnade under bottenraden. */
    <div
      data-ops-meddelanden=""
      className="flex h-[calc(100dvh-var(--safe-top)-var(--topbar-height)-1px-var(--bottom-nav-h)-var(--safe-bottom))] min-h-0 flex-col bg-canvas md:h-[calc(100dvh-var(--safe-top)-var(--topbar-height)-1px)] md:flex-row md:gap-2 md:p-2"
    >
      {/* ── Listan ─────────────────────────────────────────────────────────────────────────── */}
      <section
        aria-label={t.rubrik}
        data-samtalslista=""
        className={cx(
          "min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface md:flex md:w-[35%] md:min-w-[220px] md:max-w-[40%] md:flex-none md:shrink-0 md:rounded-xl",
          hoger ? "hidden" : "flex",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1">
          <span className="text-accent">
            <MeddelandeIkon size={18} />
          </span>
          <h2 className="m-0 min-w-0 flex-1 truncate text-etikett font-semibold text-ink">{t.rubrik}</h2>
          {groupId ? (
            <button
              type="button"
              aria-pressed={nyttLage}
              onClick={() => valj(null, { nytt: true })}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-base px-2 text-meta font-medium text-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <PlusIkon size={14} />
              <span>{t.nytt}</span>
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 px-3 py-1">
          <div role="group" aria-label={t.rubrik} className="flex items-center rounded-base border border-line bg-canvas p-0.5">
            {/** @type {const} */ (["alla", "olasta"]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cx(
                  "relative min-h-8 cursor-pointer rounded-sm px-2.5 text-liten font-medium transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  filter === f ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                {f === "alla" ? t.alla : t.olasta}
                {f === "olasta" ? <OpsCountBadge count={olasta} text={t.olastaText} placement="corner" /> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="shrink-0 px-3 py-1.5">
          <label className="flex min-h-9 items-center gap-1.5 rounded-base border border-line bg-surface px-2.5 text-ink-muted focus-within:outline-2 focus-within:outline-accent">
            <SokIkon size={14} />
            <input
              type="search"
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              placeholder={t.sok}
              aria-label={t.sok}
              className="min-w-0 flex-1 bg-transparent text-hjalp text-ink outline-none placeholder:text-ink-muted"
            />
            {sok ? (
              <button type="button" onClick={() => setSok("")} aria-label={t.rensaSok} className="inline-flex cursor-pointer text-ink-muted hover:text-ink">
                <KryssIkon size={14} />
              </button>
            ) : null}
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {fel ? (
            <OpsBanner tone="danger" title={t.fel}>
              {fel.message}
            </OpsBanner>
          ) : laddar ? (
            <p className="m-0 px-2 py-6 text-center text-meta text-ink-muted" role="status">
              …
            </p>
          ) : visade.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="text-ink-muted">
                <MeddelandeIkon size={40} />
              </span>
              <p className="m-0 mt-3 text-etikett text-ink-muted">{sok.trim() ? t.ingenTraff : filter === "olasta" ? t.tomtOlasta : t.tomt}</p>
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {visade.map((r) => {
                const aktiv = r.samtal.id === valdId;
                const s = r.senaste;
                return (
                  <li key={r.samtal.id}>
                    <button
                      type="button"
                      data-samtalsrad={r.samtal.slag}
                      aria-current={aktiv || undefined}
                      onClick={() => valj(r.samtal.id)}
                      className={cx(
                        "flex w-full cursor-pointer items-center gap-3 rounded-card px-3 py-1.5 text-left transition-colors duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                        aktiv ? "bg-hover" : "hover:bg-hover",
                      )}
                    >
                      <span className="relative shrink-0">
                        <span aria-hidden="true" className="inline-flex">
                          {markeFor(r, "md")}
                        </span>
                        <OpsCountBadge count={r.olasta} text={t.olastaText} placement="corner" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cx("min-w-0 flex-1 truncate text-etikett font-medium", r.olasta > 0 ? "text-ink" : "text-ink-secondary")}>{rubrikFor(r)}</span>
                          {s ? <span data-tid="" className="shrink-0 text-liten tabular-nums text-ink-muted">{radtid(s.tid, nu, locale)}</span> : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1">
                          <span data-slag="" className={cx("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-liten font-medium", r.samtal.slag === "grupp" ? "bg-hover text-ink-secondary" : "bg-accent-faint text-accent")}>
                            {r.samtal.slag !== "grupp" ? <LasIkon size={10} /> : null}
                            {slagetFor(r)}
                          </span>
                        </span>
                        {s ? (
                          <span className={cx("mt-0.5 block truncate text-meta", r.olasta > 0 ? "text-ink-secondary" : "text-ink-muted")}>
                            <span className="text-ink-muted" data-namn-saknas={s.av !== uid && namnFor(s.av) === NAMN_SAKNAS ? "" : undefined}>{s.av === uid ? t.du : namnFor(s.av)}: </span>
                            {utdrag(s.text)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── Samtalet, eller läget "nytt" ─────────────────────────────────────────────────────── */}
      <section
        aria-label={nyttLage ? t.nytt : vald ? rubrikFor(vald) : t.valjSamtal}
        className={cx("min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden bg-surface md:flex md:rounded-xl", hoger ? "flex" : "hidden")}
      >
        {hoger ? (
          /* Telefon: en rad "‹ Tillbaka" överst, som SS (`ChatInboxPanel.jsx:880-892`). Läget "nytt" har samma rad. */
          <button
            type="button"
            onClick={() => valj(null)}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b border-line px-3 text-meta text-ink-secondary hover:text-ink md:hidden"
          >
            <ChevronVansterIkon size={14} />
            <span>{t.tillbaka}</span>
          </button>
        ) : null}
        {nyttLage && groupId ? (
          <NyttSamtal
            kalla={kalla}
            uid={uid}
            groupId={groupId}
            medlemmar={medlemmar}
            texter={t}
            onOppnat={(s, text) => {
              utkast.current = { id: s.id, text };
              laggIn(s);
              valj(s.id);
            }}
          />
        ) : vald ? (
          <OpsSamtal
            key={vald.samtal.id}
            kalla={kalla}
            uid={uid}
            samtal={vald.samtal}
            rubrik={rubrikFor(vald)}
            marke={markeFor(vald, "md")}
            lastTill={vald.lastTill}
            namnFor={namnFor}
            medlemmar={medlemmar}
            onLast={lasOm}
            onSkickat={(m) => laggIn(vald.samtal, m)}
            utkast={utkast.current?.id === vald.samtal.id ? utkast.current.text : undefined}
            sprak={sprak}
            texter={t}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="text-ink-muted opacity-50">
              <MeddelandeIkon size={48} />
            </span>
            <p className="m-0 mt-3 text-etikett font-medium text-ink-muted">{t.valjSamtal}</p>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Läget "nytt" i högerpanelen (0.63.0, #263): Till överst, med raden om vem som ser samtalet, och trådens skrivfält längst ned.
 *
 * ⛔ VALET ÖPPNAR SAMTALET DIREKT, innan något är skrivet, som SS "Starta chatt" (`ChatInboxPanel.jsx:1091-1124`, `:477-505`).
 * `oppnaPrivat` ger samma samtal som förra gången (nyckeln är härledd), så ett befintligt samtal öppnas med sin historik och
 * inget nytt skapas. Det första meddelandet skrivs sedan i trådens eget skrivfält, och man står kvar i tråden.
 *
 * ⛔ DET MAN SKRIVIT INNAN VALET FÖLJER MED, och ett Skicka utan mottagare säger vad som saknas i stället för att inte göra något.
 *
 * @param {{ kalla: ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>, uid: string, groupId: string, medlemmar: ReadonlyArray<Medlemsrad>, texter: Required<Meddelandetexter>, onOppnat: (samtal: import("../lib/samtal.js").Samtal, text: string) => void }} props
 */
function NyttSamtal({ kalla, uid, groupId, medlemmar, texter: t, onOppnat }) {
  const [mottagare, setMottagare] = useState(/** @type {import("../lib/samtal.js").Mottagare | null} */ (null));
  const [text, setText] = useState("");
  const [fel, setFel] = useState(/** @type {{ falt?: "till", text: string } | null} */ (null));
  const [oppnar, setOppnar] = useState(false);
  const tillId = useId();

  /** @param {import("../lib/samtal.js").Mottagare} m */
  const oppna = async (m) => {
    setMottagare(m);
    if (oppnar || (m.slag !== "person" && m.slag !== "agent") || !m.uid) return;
    setFel(null);
    setOppnar(true);
    try {
      const s = await kalla.oppnaPrivat(m.slag === "agent" ? { groupId, uid, annan: m.uid, slag: "agent" } : { groupId, uid, annan: m.uid });
      onOppnat(s, text);
    } catch (e) {
      setFel({ text: e instanceof Error ? e.message : String(e) });
      setOppnar(false);
    }
  };

  return (
    <div data-ops-nytt="" aria-busy={oppnar || undefined} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-faint text-accent">
          <PlusIkon size={18} />
        </span>
        <h3 className="m-0 min-w-0 flex-1 truncate text-etikett font-semibold text-ink">{t.nytt}</h3>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {fel && !fel.falt ? (
          <OpsBanner tone="danger" title={t.oppnaFel}>
            {fel.text}
          </OpsBanner>
        ) : null}
        <span id={tillId} className="text-meta font-medium text-ink-secondary">
          {t.till}
        </span>
        <OpsMottagare lage="person" medlemmar={medlemmar} uid={uid} value={mottagare} onChange={oppna} ariaLabel={t.till} tomText={t.ingenAnnan} />
        {/* ⛔ Raden syns alltid, också innan någon är vald: det är innan man skriver som man behöver veta vem som läser. */}
        <p data-privat="" className="m-0 flex items-center gap-1.5 text-meta text-ink-secondary">
          <LasIkon size={14} />
          <span>{mottagare?.slag === "agent" ? t.agentRad : t.privatRad}</span>
        </p>
        {fel?.falt === "till" ? (
          <p role="alert" className="m-0 text-meta text-danger">
            {fel.text}
          </p>
        ) : null}
      </div>
      <Skrivfalt
        text={text}
        setText={setText}
        skickar={oppnar}
        texter={t}
        onSkicka={() => {
          if (!mottagare) setFel({ falt: "till", text: t.valjMottagare });
        }}
      />
    </div>
  );
}

/**
 * Trådens skrivfält: en textruta och knappen Skicka. Samma i ett samtal och i läget "nytt", så att det första meddelandet
 * skrivs på samma ställe som alla andra (SS: trådens `ComposerBar`).
 *
 * @param {{ text: string, setText: (t: string) => void, skickar: boolean, onSkicka: () => void, texter: Required<Meddelandetexter>, fokus?: boolean }} props
 */
function Skrivfalt({ text, setText, skickar, onSkicka, texter: t, fokus = false }) {
  const ruta = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  useEffect(() => {
    if (fokus) ruta.current?.focus({ preventScroll: true });
    // Bara när fältet monteras: tråden som just öppnades ur läget "nytt" tar emot skrivandet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <form
      className="flex shrink-0 items-end gap-2 border-t border-line px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSkicka();
      }}
    >
      <textarea
        ref={ruta}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // ⛔ Enter skickar, Skift plus Enter bryter raden, som SS skrivfält (`ComposerBar.jsx`).
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSkicka();
          }
        }}
        rows={1}
        maxLength={MAX_MEDDELANDE}
        placeholder={t.skriv}
        aria-label={t.skriv}
        className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-canvas px-3.5 py-2.5 text-etikett text-ink outline-none placeholder:text-ink-muted focus-visible:border-accent"
      />
      <button
        type="submit"
        aria-label={t.skicka}
        disabled={skickar || !text.trim()}
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-contrast transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-hover disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <SkickaIkon size={18} />
      </button>
    </form>
  );
}

/**
 * Ett samtal: huvudet, meddelandena och skrivfältet. Samma vy för gruppchatten, ett privat samtal och ett agentsamtal.
 *
 * ⛔ LÄSMÄRKET FLYTTAS NÄR SAMTALET ÄR ÖPPET OCH NÅGOT NYTT FINNS, och bara framåt. Den som har samtalet öppet har sett
 * det som står där.
 *
 * @param {object} props
 * @param {ReturnType<typeof import("../data/samtalskalla.js").createSamtalskalla>} props.kalla
 * @param {string} props.uid
 * @param {import("../lib/samtal.js").Samtal} props.samtal
 * @param {string} props.rubrik
 * @param {import("react").ReactNode} [props.marke]
 * @param {number} [props.lastTill]
 * @param {(uid: string) => string} props.namnFor
 * @param {ReadonlyArray<Medlemsrad>} [props.medlemmar]
 * @param {() => void} [props.onLast] Anropas när läsmärket flyttats, så att inkorgens räknare kan läsas om.
 * @param {(meddelande: import("../lib/samtal.js").Meddelande & { id: string }) => void} [props.onSkickat] (0.63.0, #263) Anropas med
 *   det skickade meddelandet, så att inkorgen kan lägga in raden direkt i stället för vid nästa omläsning.
 * @param {string} [props.utkast] (0.63.0) Text som redan står i skrivfältet när samtalet öppnas, och fältet får fokus.
 * @param {string} [props.sprak]
 * @param {Meddelandetexter} [props.texter]
 */
export function OpsSamtal({ kalla, uid, samtal, rubrik, marke, lastTill = 0, namnFor, medlemmar, onLast, onSkickat, utkast, sprak: sprakProp, texter = {} }) {
  // ⛔ Språket ur appens `OpsSprakProvider` när appen inte gav ett (0.46.0, cllp/bolag-ops#528).
  const sprakKontext = useOpsSprak();
  const sprak = sprakProp ?? sprakKontext;
  const t = { ...TEXTER, ...texter };
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const [meddelanden, setMeddelanden] = useState(/** @type {Array<import("../lib/samtal.js").Meddelande & { id: string }> | null} */ (null));
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));
  const [text, setText] = useState(utkast ?? "");
  const [skickar, setSkickar] = useState(false);
  const markt = useRef(lastTill);
  const lyssnar = useRef(false);
  const slut = useRef(/** @type {HTMLDivElement | null} */ (null));

  const lasIn = async () => {
    try {
      setMeddelanden(await kalla.meddelanden(samtal.id));
      setFel(null);
    } catch (e) {
      setFel(e instanceof Error ? e : new Error(String(e)));
    }
  };

  useEffect(() => {
    const stang = kalla.prenumerera(samtal.id, {
      onData: (rader) => {
        setMeddelanden(rader);
        setFel(null);
      },
      onError: (e) => setFel(e),
    });
    lyssnar.current = Boolean(stang);
    if (!stang) lasIn();
    return () => stang?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalla, samtal.id]);

  // Läsmärket: den senaste tiden i samtalet, om den är senare än det förra märket.
  useEffect(() => {
    if (!meddelanden || meddelanden.length === 0) return;
    const senast = meddelanden[meddelanden.length - 1].tid;
    if (senast > markt.current) {
      markt.current = senast;
      kalla.markeraLast(samtal.id, uid, senast).then(() => onLast?.(), () => {});
    }
    slut.current?.scrollIntoView?.({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meddelanden]);

  const skicka = async () => {
    if (skickar || !text.trim()) return;
    setSkickar(true);
    try {
      const ny = await kalla.skicka(samtal.id, { text, av: uid });
      setText("");
      if (ny && typeof ny.tid === "number") onSkickat?.(/** @type {any} */ (ny));
      // Med en prenumeration kommer meddelandet av sig självt. Utan den läses samtalet om.
      if (!lyssnar.current) await lasIn();
    } catch (e) {
      setFel(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSkickar(false);
    }
  };

  const agent = samtal.slag === "agent";
  const privatRad = samtal.slag === "grupp" ? t.gruppRad : agent ? t.agentRad : t.privatRad;
  const medlemsbild = (/** @type {string} */ id) => (medlemmar ?? []).find((m) => m.userId === id)?.bild || undefined;

  return (
    <div data-ops-samtal={samtal.slag} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        {marke}
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-etikett font-semibold text-ink">{rubrik}</h3>
          <p data-privat-rad="" className="m-0 flex items-center gap-1 text-liten text-ink-muted">
            {samtal.slag !== "grupp" ? <LasIkon size={10} /> : null}
            <span>{privatRad}</span>
          </p>
        </div>
      </header>

      <div role="log" aria-label={rubrik} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {fel ? (
          <OpsBanner tone="danger" title={t.fel}>
            {fel.message}
          </OpsBanner>
        ) : null}
        {meddelanden && meddelanden.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <span className="text-ink-muted opacity-40">
              <MeddelandeIkon size={28} />
            </span>
            <p className="m-0 mt-3 text-etikett text-ink-muted">{t.inga}</p>
            <p className="m-0 mt-1 text-liten text-ink-muted">{privatRad}</p>
          </div>
        ) : null}
        {(meddelanden ?? []).map((m, i, alla) => {
          const egen = m.av === uid;
          const forra = alla[i - 1];
          const nyDag = !forra || new Date(forra.tid).toDateString() !== new Date(m.tid).toDateString();
          const fortsattning = !nyDag && forra && forra.av === m.av && m.tid - forra.tid < 5 * 60000;
          return (
            <div key={m.id}>
              {nyDag ? (
                <div className="flex justify-center py-3">
                  <span className="rounded-full bg-canvas px-3 py-1 text-liten font-medium text-ink-muted">{forstaVersal(formatRelativeDate(m.tid, { locale }))}</span>
                </div>
              ) : null}
              <div data-meddelande={egen ? "eget" : "annans"} className={cx("flex gap-2", fortsattning ? "mt-px" : "mt-2", egen ? "flex-row-reverse" : "")}>
                {!egen ? <span className="w-8 shrink-0">{!fortsattning ? <OpsIdentity name={namnFor(m.av)} seed={m.av} imageUrl={medlemsbild(m.av)} size="sm" rund /> : null}</span> : null}
                <div className={cx("flex max-w-[70%] flex-col", egen ? "items-end" : "items-start")}>
                  {!egen && !fortsattning && samtal.slag === "grupp" ? <span className="mb-0.5 ml-1 text-liten text-ink-muted" data-namn-saknas={namnFor(m.av) === NAMN_SAKNAS ? "" : undefined}>{namnFor(m.av)}</span> : null}
                  <div
                    className={cx(
                      "rounded-2xl px-3.5 py-2 text-etikett leading-relaxed break-words whitespace-pre-wrap",
                      egen ? "bg-accent text-accent-contrast" : "bg-hover text-ink",
                      fortsattning && egen ? "rounded-tr-lg" : "",
                      fortsattning && !egen ? "rounded-tl-lg" : "",
                    )}
                  >
                    {m.text}
                  </div>
                  <span className={cx("mt-0.5 text-liten tabular-nums text-ink-muted", egen ? "mr-1" : "ml-1")}>{formatTime(m.tid, { locale })}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={slut} />
      </div>

      <Skrivfalt text={text} setText={setText} skickar={skickar} onSkicka={skicka} texter={t} fokus={utkast !== undefined} />
    </div>
  );
}
