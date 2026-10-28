import { useId, useState } from "react";
import { cx } from "../lib/cx.js";
import { KALENDERPRICK } from "../lib/kalenderfarg.js";
import { lagerFarg } from "../lib/kalenderlager.js";
import { radRubrikKlass } from "../lib/radKlass.js";
import { forvalda } from "../lib/ord.js";
import { ChevronNedIkon, KalenderIkon } from "./icons.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { OpsSegmented } from "./OpsSegmented.jsx";
import { OpsSwitch } from "./OpsToggle.jsx";
import { LANGTRYCK_KLASS, useLangtryck } from "./useLangtryck.js";
import { ValRad } from "./ValRad.jsx";

/**
 * Listans egna ord på båda språken (0.151.0). Före 0.151.0 stod de som svenska litteraler i JSX; nu bor de här, och appens egna ord (sektionernas namn, kalendrarnas namn och märken)
 * är fortfarande appens och passerar orörda. `{namn}` byts mot kalenderns namn.
 */
export const ORD_OPSKALENDERLISTA = {
  alla: { sv: "Alla kalendrar", en: "All calendars" },
  gruppens: { sv: "Gruppens kalendrar", en: "Group calendars" },
  mina: { sv: "Mina kalendrar", en: "My calendars" },
  minaTom: { sv: "Du har inga egna kalendrar ännu.", en: "You have no calendars of your own yet." },
  visasSom: { sv: "Visas som", en: "Shown as" },
  visningFor: { sv: "Visning för {namn}", en: "Display for {namn}" },
  handelser: { sv: "Händelser", en: "Events" },
  ram: { sv: "Ram", en: "Frame" },
  bada: { sv: "Båda", en: "Both" },
  visaBara: { sv: "Visa bara den här", en: "Show only this" },
  visaSomForut: { sv: "Visa som förut", en: "Show as before" },
  kontoFelLas: { sv: "Valen gick inte att hämta från kontot. Det som visas är från den här enheten.", en: "Your choices could not be fetched from your account. What you see is from this device." },
  kontoFelSkriv: { sv: "Valet sparades inte på kontot. Det gäller på den här enheten tills det lyckas.", en: "Your choice was not saved to your account. It applies on this device until it succeeds." },
  forsokIgen: { sv: "Försök igen", en: "Try again" },
};

/**
 * Listan Kalendrar (0.134.0, cllp/lifehub.app#402): EN rad per kalender med färgprick, namn, en `OpsSwitch` för om den syns, och en utfällning för
 * hur den visas (Händelser, Ram eller Båda).
 *
 * ══ ⛔ DEN ERSÄTTER "VISA BARA" OCH KALENDERLAGREN, INTE BARA KOMPLETTERAR DEM ═══════════════════════════════════════
 *
 * Till 0.133.0 betydde ett tryck på en kalender i väljaren "visa bara den", och valet sparades inte alls. Samtidigt matade appen in samma
 * Apple-kalender en andra gång som ett LAGER, med ett eget val som sparades någon annanstans. CP 2026-10-20: "Kaka på kaka. Det är allvarliga
 * saker som skall fixas." Nu är varje kalender en rad, raden har en växel, och växeln är det enda som avgör om kalendern syns. Ett tryck
 * på en rad slår AV den (och på igen), aldrig "visa bara denna".
 *
 * ⛔ INGA RÅA KRYSSRUTOR. Växeln är `OpsSwitch` (`placering="rad"`), samma som resten av ramverkets inställningsrader: hela raden är träffytan.
 *
 * ⛔ RAMVERKET KÄNNER INGA SEKTIONER. Appen skickar `sektion` per kalender ("Gruppens kalendrar", "Mina kalendrar", "Från Mitt konto", "Ärenden"), och
 * ordningen är raderna första uppträdande, utom att gruppens kommer före mina när appen inte skickat `sektioner`. En sektion utan rader ritas bara
 * om appen gett den en `tomText` (arbetsreglernas punkt 5: tomt är ett svar), och aldrig som en rubrik utan något under.
 *
 * @param {object} props
 * @param {ReadonlyArray<import("./OpsCalendar.jsx").KalenderVal>} props.kalendrar
 * @param {ReturnType<typeof import("../lib/useKalenderSynlighet.js").useKalenderSynlighet>} props.syn
 * @param {ReadonlyArray<{ namn: string, tomText?: string }>} [props.sektioner] Ordningen och tomtexterna. Utan den: gruppens, mina, resten.
 * @param {import("react").ReactNode} [props.efter] Raden Hantera kalendrar.
 * @param {string} [props.sprak] Förval språket ur `OpsSprakProvider`.
 *
 * ══ ⛔ VISA BARA DEN HÄR: LÅNGTRYCK, OCH EN KNAPP FÖR DEN SOM INTE HAR ETT (0.151.0, CP 2026-10-28) ══════════════════
 *
 * Långtryck på en rad gör den ensam synlig och döljer de andra; ett nytt långtryck på samma rad, när den redan är ensam, tar tillbaka valen som gällde före (`useKalenderSynlighet().visaBara`).
 * Gesten är ramverkets enda (`useLangtryck`, samma hålltid och samma släppskydd som skalets ikoner): ett vanligt tryck på raden växlar den som förut.
 * ⛔ LÅNGTRYCK FINNS INTE MED MUS OCH INTE MED TANGENTBORD, och en funktion som bara nås med en gest är inte nåbar. Därför: Shift+F10 och högerklick på raden gör samma sak (kroken har båda),
 * och en knapp med ordet står i radens utfällning, eller, för en rad som är dold och alltså inte har någon utfällning, som en egen rad under den.
 * ⛔ MED EN ENDA KALENDER FINNS VARKEN GESTEN ELLER KNAPPEN: "bara den här" betyder ingenting när det inte finns någon annan.
 */
export function OpsKalenderLista({ kalendrar, syn, sektioner, efter, sprak: sprakProp }) {
  const kontext = useOpsSprak();
  const sprak = sprakProp ?? kontext;
  const o = /** @type {Record<keyof typeof ORD_OPSKALENDERLISTA, string>} */ (forvalda(ORD_OPSKALENDERLISTA, sprak));
  const [oppen, setOppen] = useState(/** @type {string | null} */ (null));
  const grupper = sektionerFor(kalendrar, sektioner, o);
  return (
    <div data-kalenderlista="" className="flex flex-col">
      <ValRad chosen={syn.arForval} onClick={syn.aterstall} ikon={<KalenderIkon size={16} />}>
        {o.alla}
      </ValRad>
      {/* ⛔ FELET SYNS (punkt 5): ett val som inte sparades på kontot ser annars ut som ett som gjorde det, och personen ser det först på en annan enhet. */}
      {syn.kontoFel ? (
        <div role="alert" data-kalender-kontofel={syn.kontoFel} className="mx-3 my-1 flex flex-col items-start gap-1 rounded-base border border-danger/40 px-3 py-2 text-etikett text-ink">
          <p className="m-0">{syn.kontoFel === "las" ? o.kontoFelLas : o.kontoFelSkriv}</p>
          <button
            type="button"
            data-kontofel-igen=""
            onClick={syn.sparaIgen}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-base px-2 text-etikett font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-8"
          >
            {o.forsokIgen}
          </button>
        </div>
      ) : null}
      {grupper.map((g) => (
        <div key={g.namn} role="group" aria-label={g.namn} data-kalendersektion={g.namn} className="mt-2 flex flex-col">
          <p className={radRubrikKlass}>{g.namn}</p>
          {g.rader.length > 0 ? (
            g.rader.map((k) => <Kalenderrad key={k.id} k={k} syn={syn} o={o} oppen={oppen === k.id} onOppna={() => setOppen((x) => (x === k.id ? null : k.id))} />)
          ) : (
            <p data-kalendersektion-tom="" className="m-0 px-3 py-1.5 text-meta text-ink-muted">
              {g.tomText}
            </p>
          )}
        </div>
      ))}
      {efter}
    </div>
  );
}

/**
 * @param {object} props
 * @param {import("./OpsCalendar.jsx").KalenderVal} props.k
 * @param {ReturnType<typeof import("../lib/useKalenderSynlighet.js").useKalenderSynlighet>} props.syn
 * @param {Record<keyof typeof ORD_OPSKALENDERLISTA, string>} props.o
 * @param {boolean} props.oppen
 * @param {() => void} props.onOppna
 */
function Kalenderrad({ k, syn, o, oppen, onOppna }) {
  const id = useId();
  const syns = syn.arSynlig(k.id);
  const visning = syn.visning(k.id);
  const ensam = syn.arEnsam(k.id);
  const kanBara = syn.kanVisaBara;
  // ⛔ ETT LÅNGTRYCK, EN MENY-TANGENT OCH ETT HÖGERKLICK GÖR SAMMA SAK SOM KNAPPEN (`useLangtryck`). Musen håller inte in (`utanMus`): den har högerklick och knappen, och ett långsamt klick ska vara ett klick. Utan fler än en kalender är gesten avslagen: ytan beter sig då som förut.
  const lang = useLangtryck({ onLangtryck: kanBara ? () => syn.visaBara(k.id) : null, hogerklick: true, haptik: true, utanMus: true });
  const visaBaraKnapp = kanBara ? (
    <button
      type="button"
      data-visa-bara=""
      data-visa-bara-lage={ensam ? "tillbaka" : "bara"}
      onClick={() => syn.visaBara(k.id)}
      className="inline-flex min-h-8 cursor-pointer items-center self-start rounded-base px-2 py-1 text-etikett text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0"
    >
      {ensam ? o.visaSomForut : o.visaBara}
    </button>
  ) : null;
  const ord = { handelser: o.handelser, ram: o.ram, bada: o.bada };
  return (
    <div data-kalenderrad={k.id} data-syns={syns ? "ja" : "nej"} data-visning={visning} className="flex flex-col">
      <div {...lang.handelser} data-kalenderrad-yta="" className={cx(lang.aktiv && LANGTRYCK_KLASS)}>
        <OpsSwitch
          placering="rad"
          label={k.namn}
          hint={k.marke || undefined}
          checked={syns}
          onChange={() => syn.vaxla(k.id)}
          ikon={<span data-kalenderprick={lagerFarg(k)} className={cx("block size-2.5 rounded-full", KALENDERPRICK[lagerFarg(k)])} />}
        />
      </div>
      {/* ⛔ VISNINGEN FINNS BARA FÖR EN KALENDER SOM SYNS. Hur en dold kalender skulle visas är ingen fråga någon ställer, och en rad per kalender
          med ett val under hade gjort listan dubbelt så hög på en telefon. Ordet står kvar på knappen, så att valet syns utan att fällas ut.
          ⛔ "VISA BARA DEN HÄR" (0.151.0) LIGGER I UTFÄLLNINGEN för en rad som syns, och som en egen rad under en som är dold: en dold rad har ingen utfällning, och just den är den
          man oftast vill se ensam. En synlig rad får ingen extra rad i den hopfällda listan. */}
      {syns ? (
        <div className="-mt-1.5 flex flex-col gap-1 pr-3 pb-1 pl-9">
          <button
            type="button"
            data-kalendervisning-knapp=""
            aria-expanded={oppen}
            aria-controls={`${id}-visning`}
            onClick={onOppna}
            className="inline-flex min-h-8 cursor-pointer items-center gap-1 self-start rounded-base px-2 py-1 text-etikett text-ink-muted transition-colors duration-(--duration-fast) ease-standard hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-0"
          >
            <span>
              {o.visasSom} <span className="font-medium text-ink-secondary">{ord[visning]}</span>
            </span>
            <span aria-hidden="true" className={cx("flex shrink-0 transition-transform duration-(--duration-fast) ease-standard", oppen && "rotate-180")}>
              <ChevronNedIkon size={12} />
            </span>
          </button>
          <div id={`${id}-visning`} hidden={!oppen} className="flex flex-col gap-1">
            {oppen ? (
              <>
                <OpsSegmented
                  ariaLabel={o.visningFor.replace("{namn}", k.namn)}
                  value={visning}
                  onChange={(v) => syn.valjVisning(k.id, v)}
                  options={[
                    { value: "handelser", label: o.handelser },
                    { value: "ram", label: o.ram },
                    { value: "bada", label: o.bada },
                  ]}
                />
                {visaBaraKnapp}
              </>
            ) : null}
          </div>
        </div>
      ) : kanBara ? (
        <div className="-mt-1.5 flex flex-col pr-3 pb-1 pl-9">{visaBaraKnapp}</div>
      ) : null}
    </div>
  );
}

/**
 * Sektionerna i den ordning de ritas.
 *
 * ══ ⛔ RADERNA KNYTS TILL SEKTIONERNA MED EN STABIL NYCKEL, OCH BARA RUBRIKEN ÖVERSÄTTS (granskningen av PR 458, fynd 4) ═══════
 *
 * Appen deklarerar `{ namn: "Gruppens kalendrar" }` och `{ namn: "Mina kalendrar", tomText }` (lifehub.app `kalenderlista.js`). Rader utan `sektion` hör till "grupp" eller "mina", och före
 * 0.151.0 var nyckeln bokstaven i namnet. När listans förval blev tvåspråkiga hamnade raderna på `sprak="en"` i nya sektioner ("Group calendars", "My calendars") medan appens deklarerade
 * (svenska) stod tomma. Nu är nyckeln `"grupp"` respektive `"mina"`, och ett deklarerat eller radens eget `sektion` som är något av de två standardnamnen på NÅGOT språk (`SEKTIONSNYCKEL`)
 * binds till den nyckeln. Rubriken som ritas är då standardnamnet på listans språk. Alla andra namn är appens och ritas som de är, med sin egen nyckel. ⛔ Det gamla sättet att deklarera
 * fungerar oförändrat: appen behöver inte ändras. En deklarerad `tomText` är appens ord och översätts inte; saknas den får "mina" sin standardtext på listans språk.
 *
 * @param {ReadonlyArray<import("./OpsCalendar.jsx").KalenderVal>} kalendrar
 * @param {ReadonlyArray<{ namn: string, tomText?: string }> | undefined} deklarerade
 * @param {Record<keyof typeof ORD_OPSKALENDERLISTA, string>} o
 * @returns {{ namn: string, tomText?: string, rader: import("./OpsCalendar.jsx").KalenderVal[] }[]}
 */
function sektionerFor(kalendrar, deklarerade, o) {
  /** Nyckeln för ett namn: "grupp" eller "mina" om det är ett standardnamn på något språk, annars namnet självt. @param {string} namn */
  const nyckelFor = (namn) => SEKTIONSNYCKEL.get(namn) ?? namn;
  /** Rubriken som ritas för en nyckel. @param {string} nyckel @param {string} namn */
  const rubrikFor = (nyckel, namn) => (nyckel === "grupp" ? o.gruppens : nyckel === "mina" ? o.mina : namn);
  /** @param {import("./OpsCalendar.jsx").KalenderVal} k */
  const nyckelPa = (k) => (typeof k.sektion === "string" && k.sektion.trim() ? nyckelFor(k.sektion.trim()) : k.grupp ? "grupp" : "mina");
  /** @type {Map<string, { namn: string, tomText?: string, rader: import("./OpsCalendar.jsx").KalenderVal[] }>} */
  const karta = new Map();
  // Utan deklarerade sektioner är det de två gamla som gäller: gruppens (bara med rader) och mina (alltid, med sin tomrad).
  const start = deklarerade ?? [{ namn: o.gruppens }, { namn: o.mina, tomText: o.minaTom }];
  for (const s of start) {
    if (!s || typeof s.namn !== "string" || !s.namn) continue;
    const nyckel = nyckelFor(s.namn);
    if (!karta.has(nyckel)) karta.set(nyckel, { namn: rubrikFor(nyckel, s.namn), tomText: s.tomText, rader: [] });
  }
  for (const k of kalendrar) {
    const nyckel = nyckelPa(k);
    if (!karta.has(nyckel)) karta.set(nyckel, { namn: rubrikFor(nyckel, typeof k.sektion === "string" ? k.sektion.trim() : nyckel), rader: [] });
    karta.get(nyckel)?.rader.push(k);
  }
  return [...karta.values()].filter((s) => s.rader.length > 0 || Boolean(s.tomText));
}

/** Standardnamnen på varje språk till sin nyckel. Hämtade ur ordboken, så att ett nytt språk där följer med. */
const SEKTIONSNYCKEL = new Map(
  /** @type {Array<[string, string]>} */ (
    Object.entries({ grupp: ORD_OPSKALENDERLISTA.gruppens, mina: ORD_OPSKALENDERLISTA.mina }).flatMap(([nyckel, ord]) => Object.values(ord).map((text) => /** @type {[string, string]} */ ([text, nyckel])))
  ),
);
