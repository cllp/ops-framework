import { cx } from "../lib/cx.js";

/**
 * Väntesnurra. EN väntesymbol i hela huset.
 *
 * ⛔ Den här finns för ett mätt problem. I SessionStudio ritas väntan med
 * `Loader2` + `animate-spin` på SJUTTIO ställen, i fem olika storlekar
 * (`w-3`, `w-3.5`, `w-4`, `w-5`, `w-8`), ibland i accentfärg och ibland i
 * ärvd, och på vissa ställen utan `aria-hidden`. Ingen valde den spridningen:
 * den uppstod för att varje anropsställe fick ta beslutet själv. Formen här är
 * MEDVETET samma cirkelbåge som Lucides `loader-circle`, så att övergången
 * inte känns som ett byte av produkt.
 *
 * ⛔ Ramverket tar ändå inget ikonberoende (se `icons.jsx`). Bågen är tjugo
 * tecken SVG. Att dra in ett helt ikonbibliotek för dem hade tvingat på varje
 * konsument ett val som är appens, inte ramverkets.
 *
 * ── Tillgänglighet, och varför standardvärdet är som det är ────────────────
 *
 * En snurra betyder "vänta". Det beskedet måste nå även den som inte ser den,
 * annars sitter en skärmläsaranvändare i tystnad och tror att klicket inte
 * gick fram. Därför ANNONSERAR den som standard.
 *
 * ⛔ Men två annonseringar för samma väntan är värre än ingen. Ligger snurran
 * inuti något som redan säger ifrån, alltså en `OpsButton` med `busy`, en
 * `OpsEmpty` med `busy` eller vilken yta som helst med `aria-busy`, då ska den
 * vara ren dekor. Det är vad `decorative` är till för, och den ska sättas
 * uttryckligen. Det omvända standardvärdet (tyst om ingen ber om ljud) hade
 * gett en tystnad som ingen upptäcker förrän någon faktiskt behöver den.
 */

const STORLEKAR = {
  sm: 16,
  md: 20,
  lg: 32,
};

const TONER = {
  /** Ärver textfärgen där den står. Rätt inuti en knapp eller en rad text. */
  current: "text-current",
  /** Ramverkets accent. Rätt när snurran står för sig själv på en tom yta. */
  accent: "text-accent",
  /** Dämpad. Rätt när väntan är bakgrundsarbete och inte ska dra blicken. */
  muted: "text-ink-muted",
};

/**
 * @param {object} props
 * @param {"sm"|"md"|"lg"} [props.size]
 * @param {"current"|"accent"|"muted"} [props.tone]
 * @param {string} [props.label] Vad som väntas på. Läses upp, syns inte.
 * @param {boolean} [props.decorative] Sätts när omgivningen redan annonserar väntan.
 */
export function OpsSpinner({ size = "md", tone = "current", label = "Hämtar", decorative = false }) {
  const px = STORLEKAR[size];
  if (!px) {
    throw new Error(`OpsSpinner: okänd size "${size}". Giltiga: ${Object.keys(STORLEKAR).join(", ")}.`);
  }

  const tonKlass = TONER[tone];
  if (!tonKlass) {
    throw new Error(`OpsSpinner: okänd tone "${tone}". Giltiga: ${Object.keys(TONER).join(", ")}.`);
  }

  // ⛔ En snurra som annonserar utan att säga vad den väntar på läser upp
  // "Hämtar" i tomma luften. Tom sträng är därför ett fel, inte ett tyst läge:
  // det tysta läget heter `decorative` och ska väljas medvetet.
  if (!decorative && !label) {
    throw new Error("OpsSpinner: label krävs när snurran annonserar. Är den ren dekor, sätt decorative.");
  }

  const bage = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Rörelsen sitter på SVG:n, inte på omslaget. Ett omslag som snurrar
      // drar med sig den dolda texten, och den behöver inte rotera.
      className={cx("animate-spin motion-reduce:animate-spin-slow", tonKlass)}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );

  if (decorative) return bage;

  return (
    // `status` + `polite`: väntan nämns när skärmläsaren är klar med annat.
    // `assertive` hade avbrutit mitt i en mening för ett besked som inte är
    // brådskande.
    <span role="status" aria-live="polite" className="inline-flex items-center">
      {bage}
      <span className="sr-only">{label}</span>
    </span>
  );
}
