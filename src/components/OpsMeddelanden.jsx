import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { formatDate, formatTime, formatRelativeDate } from "../lib/format.js";
import { MAX_MEDDELANDE, utdrag } from "../lib/samtal.js";
import { useSamtal } from "../data/useSamtal.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsIdentity } from "./OpsIdentity.jsx";
import { OpsIconLink } from "./OpsIconLink.jsx";
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
 * ⛔ DET PRIVATA SYNS. Ett privat samtal bär etiketten "Privat" i listan och raden "Bara ni två ser det här" i huvudet.
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
 * @param {() => void} [props.onNytt] Öppnar "Nytt meddelande" (skalets `skapa.meddelande`). Utelämnad: ingen knapp.
 * @param {string | null} [props.valt] Valt samtal, när appen styr det (t.ex. ur adressen).
 * @param {(samtalId: string | null) => void} [props.onValj]
 * @param {(antal: number) => void} [props.onOlasta] Anropas med antalet olästa när det ändras, för ingångens räknare.
 * @param {string} [props.sprak] "sv" eller "en", för tiderna. Förval "sv".
 * @param {Meddelandetexter} [props.texter]
 */
export function OpsMeddelanden({ kalla, uid, groupId, gruppNamn, medlemmar, onNytt, valt, onValj, onOlasta, sprak = "sv", texter = {} }) {
  const t = { ...TEXTER, ...texter };
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const { rader, laddar, fel, olasta, lasOm } = useSamtal({ kalla, groupId, uid });
  const [egetVal, setEgetVal] = useState(/** @type {string | null} */ (null));
  const valdId = valt !== undefined ? valt : egetVal;
  const valj = (/** @type {string | null} */ id) => (onValj ? onValj(id) : setEgetVal(id));
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

  const namn = useMemo(() => {
    /** @type {Map<string, Medlemsrad>} */
    const m = new Map();
    for (const r of medlemmar ?? []) if (r?.userId) m.set(r.userId, r);
    return m;
  }, [medlemmar]);
  const namnFor = (/** @type {string} */ id) => namn.get(id)?.namn || id;

  const nu = Date.now();
  const visade = rader
    .filter((r) => (filter === "olasta" ? r.olasta > 0 : true))
    .filter((r) => {
      const q = sok.trim().toLocaleLowerCase("sv");
      if (!q) return true;
      const rubrik = r.samtal.slag === "grupp" ? gruppNamn : namnFor(r.motpart ?? "");
      return rubrik.toLocaleLowerCase("sv").includes(q) || (r.senaste?.text ?? "").toLocaleLowerCase("sv").includes(q);
    });
  const vald = rader.find((r) => r.samtal.id === valdId) ?? null;

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
    <div
      data-ops-meddelanden=""
      className="flex h-[calc(100dvh-var(--safe-top)-var(--topbar-height)-var(--bottom-nav-h)-var(--safe-bottom))] min-h-0 flex-col bg-canvas md:h-[calc(100dvh-var(--safe-top)-var(--topbar-height))] md:flex-row md:gap-2 md:p-2"
    >
      {/* ── Listan ─────────────────────────────────────────────────────────────────────────── */}
      <section
        aria-label={t.rubrik}
        data-samtalslista=""
        className={cx(
          "min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface md:flex md:w-[35%] md:min-w-[220px] md:max-w-[40%] md:flex-none md:shrink-0 md:rounded-xl",
          vald ? "hidden" : "flex",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1">
          <span className="text-accent">
            <MeddelandeIkon size={18} />
          </span>
          <h2 className="m-0 min-w-0 flex-1 truncate text-etikett font-semibold text-ink">{t.rubrik}</h2>
          {onNytt ? (
            <button
              type="button"
              onClick={onNytt}
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
                        aktiv ? "bg-raised" : "hover:bg-raised",
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
                          {s ? <span className="shrink-0 text-liten tabular-nums text-ink-muted">{radtid(s.tid, nu, locale)}</span> : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1">
                          <span data-slag="" className={cx("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-liten font-medium", r.samtal.slag === "grupp" ? "bg-raised text-ink-secondary" : "bg-accent-faint text-accent")}>
                            {r.samtal.slag !== "grupp" ? <LasIkon size={10} /> : null}
                            {slagetFor(r)}
                          </span>
                        </span>
                        {s ? (
                          <span className={cx("mt-0.5 block truncate text-meta", r.olasta > 0 ? "text-ink-secondary" : "text-ink-muted")}>
                            <span className="text-ink-muted">{s.av === uid ? t.du : namnFor(s.av)}: </span>
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

      {/* ── Samtalet ───────────────────────────────────────────────────────────────────────── */}
      <section
        aria-label={vald ? rubrikFor(vald) : t.valjSamtal}
        className={cx("min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden bg-surface md:flex md:rounded-xl", vald ? "flex" : "hidden")}
      >
        {vald ? (
          <>
            {/* Telefon: en rad "‹ Tillbaka" överst, som SS (`ChatInboxPanel.jsx:880-892`). */}
            <button
              type="button"
              onClick={() => valj(null)}
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b border-line px-3 text-meta text-ink-secondary hover:text-ink md:hidden"
            >
              <ChevronVansterIkon size={14} />
              <span>{t.tillbaka}</span>
            </button>
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
              sprak={sprak}
              texter={t}
            />
          </>
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
 * @param {string} [props.sprak]
 * @param {Meddelandetexter} [props.texter]
 */
export function OpsSamtal({ kalla, uid, samtal, rubrik, marke, lastTill = 0, namnFor, medlemmar, onLast, sprak = "sv", texter = {} }) {
  const t = { ...TEXTER, ...texter };
  const locale = sprak === "en" ? "en-GB" : "sv-SE";
  const [meddelanden, setMeddelanden] = useState(/** @type {Array<import("../lib/samtal.js").Meddelande & { id: string }> | null} */ (null));
  const [fel, setFel] = useState(/** @type {Error | null} */ (null));
  const [text, setText] = useState("");
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
      await kalla.skicka(samtal.id, { text, av: uid });
      setText("");
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
                  <span className="rounded-full bg-canvas px-3 py-1 text-liten font-medium text-ink-muted">{formatRelativeDate(m.tid, { locale })}</span>
                </div>
              ) : null}
              <div data-meddelande={egen ? "eget" : "annans"} className={cx("flex gap-2", fortsattning ? "mt-px" : "mt-2", egen ? "flex-row-reverse" : "")}>
                {!egen ? <span className="w-8 shrink-0">{!fortsattning ? <OpsIdentity name={namnFor(m.av)} seed={m.av} imageUrl={medlemsbild(m.av)} size="sm" rund /> : null}</span> : null}
                <div className={cx("flex max-w-[70%] flex-col", egen ? "items-end" : "items-start")}>
                  {!egen && !fortsattning && samtal.slag === "grupp" ? <span className="mb-0.5 ml-1 text-liten text-ink-muted">{namnFor(m.av)}</span> : null}
                  <div
                    className={cx(
                      "rounded-2xl px-3.5 py-2 text-etikett leading-relaxed break-words whitespace-pre-wrap",
                      egen ? "bg-accent text-accent-contrast" : "bg-raised text-ink",
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

      <form
        className="flex shrink-0 items-end gap-2 border-t border-line px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          skicka();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // ⛔ Enter skickar, Skift plus Enter bryter raden, som SS skrivfält (`ComposerBar.jsx`).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              skicka();
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
    </div>
  );
}
