import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { datumnyckel, idagsnyckel, manader, manadsrutnat, perDag } from "../lib/kalender.js";
import { OpsStatusDot } from "./OpsStatusDot.jsx";

/**
 * Kalender: en månad i taget, i en rulle, med det som faktiskt ligger på dagen.
 *
 * ══ ⛔ VAD DEN ÄR OCH VAD DEN INTE ÄR ═══════════════════════════════════
 *
 * CP 2026-09-22: "Jag vill ha en REN Enkel och strukturerad kalender i samma
 * utseende med så lite kod som möjligt. Absolut ingen overkill."
 *
 * Den ritar DATERADE POSTER. Den äger inte urvalet, vet inte var posterna kommer
 * ifrån och har ingen åsikt om vad de betyder. Appen skickar in en lista och får
 * ett rutnät.
 *
 * ⛔ INGEN DRAG-MARKERING, INGA LAGER, INGA AVATARER, INGEN EXPORT. Förebilden
 * (SessionStudios CalView) bär allt det, och den bär det för att den handlar om
 * grupper som ska hitta en tid ihop. Ett bolags kalender har en läsare. Allt
 * sådant som portats in hade varit kod som aldrig körs, och den sortens kod
 * upptäcks först när någon ska ändra något bredvid den.
 *
 * ══ ⛔ FORMEN ÄR LÅNAD, KODEN ÄR DET INTE ══════════════════════════════
 *
 * Fyra beslut är tagna ur SessionStudio, eftersom de är mätta där och inte
 * behöver mätas om:
 *
 *   1. EN RULLE, INTE EN SIDA PER MÅNAD. Man bläddrar inte mellan månader, man
 *      rullar förbi dem. Nästa månads början syns innan den här månaden tar slut.
 *   2. DEN ÖPPNAR PÅ IDAG. Utan det öppnar en kalender med historik på en tom
 *      ruta långt bak, och det ser ut som att posterna saknas.
 *   3. VECKODAGSRADEN ÄR KLISTRAD. Rullar man tre månader vet man annars inte
 *      längre vilken kolumn som är onsdag.
 *   4. EN FLYTANDE "IDAG"-KNAPP som dyker upp FÖRST när innevarande månad rullat
 *      ur bild, med en pil åt det håll man ska rulla.
 *
 * ⛔ TOKENS ÄR RAMVERKETS, INTE FÖREBILDENS. De två systemen delar inte ett enda
 * tokennamn (`--color-bg-card` mot `--color-raised`), så en kopierad klassrad
 * hade dragit in ett andra designspråk i appen. Formen bär över, färgerna gör det
 * inte.
 *
 * ══ ⛔ DAGEN ÖPPNAS UNDER MÅNADEN, INTE I EN POPOVER ═══════════════════
 *
 * Förebilden lägger dagens innehåll i en flytande ruta vid fingret. Det kräver
 * positionering, kollisionshantering och en stängningsväg, alltså den dyraste
 * delen av hela komponenten, och på en telefon täcker rutan ändå det man pekar på.
 *
 * Här fälls dagen ut UNDER sitt rutnät. Ingen positionering, inget lager, och
 * listan går att läsa med tummen kvar på skärmen.
 */

const VECKODAGAR = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const MANADSNAMN = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

/** Hur många prickar en ruta ritar innan den börjar räkna i stället. */
const MAX_PRICKAR = 3;

/*
 * ══ ⛔ RUTNÄTETS PRICKAR BÄR "NÅGOT FINNS", INTE VILKEN STATUS ══════════
 *
 * Första utkastet satte en `OpsStatusDot` per post i dagsrutan, och ramverkets
 * egen vakt stoppade det: den kräver ett ord till varje färg, och ett ord per
 * prick hade blivit "Öppet Öppet Klart" i en ruta som är 44 px bred.
 *
 * Vakten hade rätt om mer än tillgängligheten. Tre statusfärger i en dagsruta
 * på en telefon är inte information, det är brus: man ser att något är rött men
 * inte vad, och måste öppna dagen ändå.
 *
 * Rutan svarar därför bara på "finns det något här, och hur mycket". STATUS,
 * MED SITT ORD, bor i dagslistan ett tryck bort, där det finns plats för både
 * färgen och ordet bredvid titeln. Det är samma arbetsdelning som `OpsEventList`
 * gör mellan pricken på raden och `Status` i utfällningen.
 */

/**
 * En dagsruta.
 *
 * ⛔ EN `<button>` OCH INTE EN `<div onClick>`, även för en tom dag. Tomma dagar
 * är inte tryckbara alls, och de som har något måste gå att nå med tangentbord.
 * En klickbar div gör ingetdera och ser likadan ut.
 *
 * ⛔ TRÄFFYTAN ÄR HELA RUTAN. En siffra är några pixlar bred, och en kalender man
 * missar med tummen är en kalender man slutar öppna.
 *
 * @param {{ dag: number | null, nyckel: string, poster: import("../lib/kalender.js").Kalenderpost[], arIdag: boolean, vald: boolean, onValj: (nyckel: string) => void }} props
 */
function Dagsruta({ dag, nyckel, poster, arIdag, vald, onValj }) {
  if (dag === null) return <div aria-hidden="true" />;

  const antal = poster.length;
  const etikett = antal === 0 ? `${dag}` : `${dag}, ${antal} ${antal === 1 ? "post" : "poster"}`;

  return (
    <button
      type="button"
      disabled={antal === 0}
      aria-pressed={vald}
      aria-label={etikett}
      onClick={() => onValj(nyckel)}
      className={cx(
        "flex min-h-14 flex-col items-center gap-1 rounded-md px-1 pt-1.5 pb-1 text-sm transition-colors duration-(--duration-fast) ease-standard",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        antal === 0 ? "cursor-default text-ink-muted" : "cursor-pointer text-ink hover:bg-accent-faint",
        vald && "bg-accent-subtle",
        // ⛔ Idag är en RING och inte en fylld yta. Fylld krockar med markeringen
        // för vald dag, och då går det inte att se vilken av de två man tittar på.
        arIdag && "ring-2 ring-accent ring-inset font-bold",
      )}
    >
      <span className="tabular-nums">{dag}</span>
      {/* ⛔ Dekor, och läses inte upp: antalet står redan i knappens namn. */}
      <span aria-hidden="true" className="flex min-h-2 items-center gap-0.5">
        {poster.slice(0, MAX_PRICKAR).map((p) => (
          <span key={p.id} className="size-1.5 rounded-full bg-accent" />
        ))}
        {antal > MAX_PRICKAR ? <span className="text-xs tabular-nums text-ink-muted">+{antal - MAX_PRICKAR}</span> : null}
      </span>
    </button>
  );
}

/**
 * Dagens poster, utfällda under månaden.
 *
 * ⛔ EN POST MED `url` BLIR EN LÄNK, resten blir text. En rad som ser tryckbar ut
 * och inte är det är ett löfte som inte infrias, och i en kalender över stängda
 * ärenden är länken hela poängen: man öppnar dagen för att komma vidare.
 *
 * @param {{ nyckel: string, poster: import("../lib/kalender.js").Kalenderpost[], statusOrd: Record<string, string> }} props
 */
function Dagslista({ nyckel, poster, statusOrd }) {
  return (
    <div className="mt-2 flex flex-col gap-1 rounded-md border border-line bg-raised p-3">
      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">{nyckel}</p>
      {poster.map((p) => (
        <div key={p.id} className="flex items-baseline gap-2">
          {/* ⛔ HÄR får pricken finnas, för här finns plats för ordet bredvid.
              Saknar appen ordet för ett läge kastar `OpsStatusDot`, och det är
              rätt: en färg utan ord är inget besked. */}
          {p.status ? (
            <span className="shrink-0 translate-y-0.5">
              <OpsStatusDot status={p.status} label={statusOrd[p.status] || ""} />
            </span>
          ) : null}
          <span className="min-w-0">
            {p.url ? (
              <a
                className="font-semibold text-accent underline decoration-from-font underline-offset-2 hover:text-accent-hover"
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {p.titel}
              </a>
            ) : (
              <span className="font-semibold text-ink">{p.titel}</span>
            )}
            {p.not ? <span className="block text-sm text-ink-secondary">{p.not}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * @param {object} props
 * @param {import("../lib/kalender.js").Kalenderpost[]} props.poster Daterade poster. Odaterat hör inte hemma här.
 * @param {string} props.ariaLabel ⛔ Krävs: ett rutnät med tal är osynligt för den som inte ser det.
 * @param {Record<string, string>} [props.statusOrd] Appens ord per läge, som i `OpsEventList`.
 *   ⛔ Ramverket äger färgerna och appen orden: bara appen vet vad `vantar` betyder hos just den.
 * @param {number} [props.manaderBakat] Standard 1. ⛔ Inte tolv: en bolagskalender har få poster bakåt,
 *   och varje månad är ett rutnät till att rita och rulla förbi.
 * @param {number} [props.manaderFramat] Standard 3.
 * @param {Date} [props.idag] Bara för prov. Produktionen har en klocka.
 * @param {import("react").ReactNode} [props.tomtText] Vad som står när ingen post har datum.
 */
export function OpsKalender({ poster = [], ariaLabel, statusOrd = {}, manaderBakat = 1, manaderFramat = 3, idag, tomtText }) {
  if (!ariaLabel) {
    throw new Error("OpsKalender: ariaLabel krävs. Ett rutnät med tal är osynligt för den som inte ser det.");
  }

  const nu = idag || new Date();
  const idagNyckel = idagsnyckel(nu);
  const [vald, setVald] = useState(/** @type {string | null} */ (null));

  const karta = useMemo(() => perDag(poster), [poster]);
  const lista = useMemo(() => manader(nu, manaderBakat, manaderFramat), [nu, manaderBakat, manaderFramat]);

  const idagRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [visaTillbaka, setVisaTillbaka] = useState(false);
  const [riktning, setRiktning] = useState(/** @type {"upp" | "ner"} */ ("upp"));

  /*
   * ⛔ ETT HOPP UTAN ANIMERING VID MONTERING. Med historik bakåt ligger den
   * innevarande månaden en bit ner i rullen, och utan det här öppnar kalendern
   * på en månad som passerat: rutnätet är tomt och posterna ser ut att saknas.
   *
   * `didRef` finns för att det ska ske EN gång. Utan den hoppar vyn tillbaka
   * till idag varje gång posterna uppdateras, mitt i att någon rullar.
   */
  const didRef = useRef(false);
  useEffect(() => {
    if (didRef.current || !idagRef.current) return;
    didRef.current = true;
    idagRef.current.scrollIntoView({ block: "start" });
  }, []);

  useEffect(() => {
    const el = idagRef.current;
    if (!el || typeof IntersectionObserver !== "function") return undefined;
    const obs = new IntersectionObserver(
      ([traff]) => {
        setVisaTillbaka(!traff.isIntersecting);
        if (traff.isIntersecting) return;
        // Pilen pekar åt det håll man ska rulla för att nå idag.
        const topp = traff.rootBounds ? traff.rootBounds.top : 0;
        setRiktning(traff.boundingClientRect.bottom <= topp ? "upp" : "ner");
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const tillIdag = useCallback(() => {
    idagRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const harPoster = karta.size > 0;

  return (
    <section aria-label={ariaLabel} className="relative">
      {/* ⛔ Klistrad veckodagsrad. Efter tre månaders rullning är kolumnernas
          betydelse borta, och man räknar sig fram i stället för att läsa. */}
      <div className="sticky top-0 z-(--z-sticky) grid grid-cols-7 gap-1 bg-canvas pt-1 pb-2">
        {VECKODAGAR.map((d) => (
          <span key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {d}
          </span>
        ))}
      </div>

      {!harPoster && tomtText ? <p className="m-0 pb-3 text-sm text-ink-muted">{tomtText}</p> : null}

      <div className="flex flex-col gap-6">
        {lista.map(({ ar, manad }) => {
          const arIdagsManad = ar === nu.getFullYear() && manad === nu.getMonth();
          const rader = manadsrutnat(ar, manad);
          const valdIManaden = vald && vald.startsWith(`${ar}-${String(manad + 1).padStart(2, "0")}`) ? vald : null;

          return (
            <div key={`${ar}-${manad}`} ref={arIdagsManad ? idagRef : null}>
              <h3 className="m-0 mb-2 text-lg font-bold capitalize text-ink font-display">
                {MANADSNAMN[manad]} {ar}
              </h3>

              <div className="grid grid-cols-7 gap-1">
                {rader.map((rad, i) =>
                  rad.map((dag, j) => {
                    const nyckel = dag === null ? `tom-${i}-${j}` : datumnyckel(ar, manad, dag);
                    return (
                      <Dagsruta
                        key={nyckel}
                        dag={dag}
                        nyckel={nyckel}
                        poster={dag === null ? [] : karta.get(nyckel) || []}
                        arIdag={nyckel === idagNyckel}
                        vald={nyckel === vald}
                        onValj={(n) => setVald((forra) => (forra === n ? null : n))}
                      />
                    );
                  }),
                )}
              </div>

              {valdIManaden ? (
                <Dagslista nyckel={valdIManaden} poster={karta.get(valdIManaden) || []} statusOrd={statusOrd} />
              ) : null}
            </div>
          );
        })}
      </div>

      {visaTillbaka ? (
        <button
          type="button"
          onClick={tillIdag}
          className={cx(
            "sticky bottom-4 ml-auto flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-raised px-4 text-sm font-semibold text-ink shadow-md",
            "hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <span aria-hidden="true">{riktning === "upp" ? "↑" : "↓"}</span>
          Idag
        </button>
      ) : null}
    </section>
  );
}
