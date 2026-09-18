import { useId } from "react";
import { cx } from "../lib/cx.js";

/**
 * Ett dragreglage med ett nolläge, för att laborera med ett tal utan att ändra det.
 *
 * ── ⛔ DET HÄR ÄR ETT SIMULERINGSREGLAGE, INTE ETT INMATNINGSFÄLT ────────
 *
 * Skillnaden bestämmer hela formen. Ett inmatningsfält frågar "vad ska värdet
 * vara?" och svaret sparas. Det här frågar "hur skulle det se ut om?", och
 * svaret ska kunna kastas. Därför har reglaget ett NOLLÄGE som är verkligheten,
 * och därför står nuläget alltid kvar bredvid det simulerade.
 *
 * Kommer ur bolag-ops#141: "Nuläget är utgångspunkten (reglaget står i mitten),
 * sedan kan man dra en post upp eller ner och se hur kassaflödet påverkas."
 *
 * ── ⛔ NOLLÄGET MÅSTE GÅ ATT TRÄFFA EXAKT, OCH DET ÄR INTE SAMMA SAK SOM ──
 *     ATT DET ÄR STARTVÄRDET
 *
 * Har man dragit reglaget och vill tillbaka till verkligheten måste man komma
 * PRECIS dit, annars är jämförelsen mot nuläget borta och siffran bredvid
 * ljuger med några procent. Ett reglage man siktar med räcker inte, och på en
 * touchskärm är det inte ens nära.
 *
 * Två saker löser det, och båda behövs:
 *
 *   1. En `Återställ`-knapp som sätter värdet till exakt `noll`.
 *   2. Ett synligt märke på skenan där nolläget ligger, så man ser vad man
 *      siktar mot innan man drar.
 *
 * ⛔ Knappen döljs INTE när man står på noll, den blir inaktiv. En knapp som
 * försvinner flyttar allt bredvid sig, och i en lista med ett reglage per rad
 * blir det ett hopp varje gång någon drar tillbaka till mitten. Exakt den
 * sortens hopp är vad bolag-ops#143 och #152 handlade om.
 *
 * ── ⛔ ETT NATIVT `input type=range`, INTE EN EGEN DIV ────────────────────
 *
 * Ett handgjort reglage måste återimplementera pekarfångst, touch, piltangenter,
 * Home och End, `role="slider"` och hela aria-värdefamiljen. Den
 * återimplementationen är precis det som brukar gå sönder på mobil, alltså på
 * den enda skärm CP uttryckligen ställde krav på.
 *
 * Det nativa elementet ger allt det gratis och är dessutom det enda som får
 * plattformens egna dragrörelser rätt. Priset är att tumme och skena bara går
 * att måla med leverantörsspecifika pseudoelement, som inte finns som
 * verktygsklasser. De ligger därför i `tokens/tokens.css` under `.ops-reglage`,
 * i ett `@layer components`, och de använder bara tokens.
 *
 * ⛔ Den CSS:en är inte valfri pynt. Utan den ritar webbläsaren sin egen tumme i
 * systemets accentfärg, alltså en färg utanför tokenkontraktet som inte byter
 * med mörkt läge.
 *
 * ── ⛔ `aria-valuetext` I ORD, ALDRIG BARA TALET ─────────────────────────
 *
 * Ett reglage som läses upp som "minus femton" säger ingenting: minus femton
 * vadå, och av vad? `formateraVarde` är därför OBLIGATORISK och inte en
 * bekvämlighet. Den som lyssnar ska höra samma sak som den som ser, alltså
 * "15 procent lägre, 4 500 kr per månad".
 *
 * ── ⛔ TRÄFFYTAN ────────────────────────────────────────────────────────
 *
 * Skenan är tunn men elementet är 44px högt, för det är tummen som ska träffa
 * reglaget och inte pekaren. En 4px skena är omöjlig att ta tag i på en telefon,
 * och en sådan kontroll rapporteras som "den funkar inte" snarare än som "den är
 * liten".
 */

/**
 * @param {object} props
 * @param {string} props.label Vad reglaget styr. Syns, och är kontrollens namn.
 * @param {number} props.value Nuvarande läge.
 * @param {(value: number) => void} props.onChange
 * @param {number} props.min
 * @param {number} props.max
 * @param {number} props.noll Läget som betyder "som det är idag".
 * @param {(value: number) => string} props.formateraVarde Läget i ord, för både skärm och uppläsning.
 * @param {number} [props.step]
 * @param {string} [props.aterstallLabel] Texten på återställningsknappen.
 */
export function OpsSlider({
  label,
  value,
  onChange,
  min,
  max,
  noll,
  formateraVarde,
  step = 1,
  aterstallLabel = "Återställ",
}) {
  /*
   * ⛔ KASTAR HELLRE ÄN RITAR ETT REGLAGE DÄR NOLLÄGET INTE GÅR ATT NÅ. Ligger
   * `noll` utanför spannet blir återställningsknappen en knapp som sätter ett
   * värde reglaget inte kan visa, och då står tumme och siffra och säger olika
   * saker. Det är en tyst felform: inget kraschar, det ser bara konstigt ut.
   */
  if (!(noll >= min && noll <= max)) {
    throw new Error(
      `OpsSlider: noll (${noll}) ligger utanför ${min} till ${max}. Nolläget är det man återställer till, så ett nolläge utanför skenan är ett reglage som inte går att nollställa.`,
    );
  }
  if (typeof formateraVarde !== "function") {
    throw new Error(
      "OpsSlider: formateraVarde måste vara en funktion. Ett reglage som läses upp som ett naket tal säger inte vad talet betyder, och det är hela poängen med att ha ett reglage i stället för ett fält.",
    );
  }

  const id = useId();
  const text = formateraVarde(value);
  const vidNoll = value === noll;

  // Nollmärkets plats på skenan, i procent. Räknas ur samma spann som reglaget
  // självt, så märket kan inte hamna på fel ställe utan att reglaget gör det med.
  const nollProcent = max === min ? 50 : ((noll - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className={cx("text-sm tabular-nums", vidNoll ? "text-ink-secondary" : "text-accent")}>{text}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex h-11 flex-1 items-center">
          {/* ⛔ Märket ligger UNDER reglaget och är `pointer-events-none`. Låg det
              över skulle det äta ett tryck mitt på skenan, alltså precis där man
              siktar när man vill tillbaka till nuläget. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line-strong"
            style={{ left: `${nollProcent}%` }}
          />
          <input
            id={id}
            type="range"
            className="ops-reglage relative h-11 w-full cursor-pointer bg-transparent"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-valuetext={text}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>

        {/* ⛔ En vanlig knapp och inte `OpsButton`: den skulle importera en
            primitiv in i en annan primitiv, och då ärver reglaget knappens
            storlekar och varianter som en yta det inte bad om. */}
        <button
          type="button"
          disabled={vidNoll}
          onClick={() => onChange(noll)}
          className={cx(
            "shrink-0 rounded-md border px-3 py-2 text-sm",
            "transition-colors duration-(--duration-fast) ease-standard",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
            vidNoll
              ? "cursor-default border-line bg-sunken text-ink-muted"
              : "cursor-pointer border-line-strong bg-raised text-ink hover:border-accent",
          )}
        >
          {aterstallLabel}
        </button>
      </div>
    </div>
  );
}
