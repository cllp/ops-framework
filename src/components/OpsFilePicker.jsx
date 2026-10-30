import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "../lib/cx.js";
import { isImage as arBildtyp, attachmentSize, filensNamn, readAttachment } from "../lib/file.js";
import { forvalda, ordet } from "../lib/ord.js";
import { OpsButton } from "./OpsButton.jsx";
import { FilIkon, GemIkon } from "./icons.jsx";
import { Faltknapp } from "./OpsRostinmatning.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";

/**
 * Välj en fil att bifoga: bild, PDF, kalkylark, kontoutdrag.
 *
 * ══ ⛔ VARFÖR DEN INTE HETER OpsImagePicker ══════════════════════════════
 *
 * Den gjorde det i praktiken en dag: `accept="image/*"` och namnet "Välj bild".
 * Rapporten kom omgående, och den var ett krav och inte en önskan: "det kan vara
 * ett kontoutdrag, pdf, excel, eller bild". En bildväljare som får en PDF är
 * ingen bildväljare, och en bildväljare som ARTIGT vägrar en PDF tvingar fram en
 * skärmbild av ett dokument man redan har.
 *
 * ⛔ Bilder får särbehandling INUTI komponenten (de krymps och visas), men
 * aldrig i namnet eller i kontraktet. Se `lib/file.js` för varför bara bilder går
 * att krympa.
 *
 * ══ ⛔ URKLIPPET ÄR EN FÖRSTAKLASSVÄG, INTE EN GENVÄG ═══════════════════
 *
 * På en dator är den snabbaste vägen från "jag ser något på skärmen" till "det
 * ligger i ärendet" en skärmbild i urklipp. Går den inte att klistra in måste man
 * spara till en fil, leta upp filen i en dialog, och sedan städa bort den. Tre
 * steg och ett skräp för något som borde vara ett kommando.
 *
 * ⛔ Lyssnaren sitter på DOKUMENTET och inte på ett fält. Man klistrar in där
 * blicken är, inte där fokus råkar ligga, och en inklistring som bara fungerar om
 * man först klickat i rätt ruta läses som att funktionen inte finns.
 *
 * ⛔ Följden är att TVÅ monterade filväljare båda tar emot samma inklistring.
 * Det är inte något som går att lösa inifrån komponenten, och det är därför
 * `paste` går att stänga av: en yta med två bilagor får välja vilken som lyssnar.
 *
 * ⛔ Bara inklistringar som bär FILER tas. Klistrar man in text i ett textfält
 * bär samma händelse text, och en filväljare som svalde den hade stulit
 * inklistringen från fältet man faktiskt skrev i.
 */

/**
 * ══ ⛔ FLERA FILER (0.149.0) ═════════════════════════════════════════════
 *
 * Appen behöver kvitton, och ett kvitto är ofta flera bilder ur bildbiblioteket. Väljaren tog en fil i taget, så fem sidor var fem omgångar
 * av Välj fil. `flera` är en ny, frivillig prop: `value` är då en lista av Bilaga och `onChange` får en lista.
 *
 * ⛔ UTAN `flera` ÄR BETEENDET EXAKT SOM I DAG. De två lägena är två komponenter bakom samma namn (`EnFil` och `FleraFiler`), så att ingenting i
 * det gamla läget delar kodväg med det nya. `flera` byter alltså också form på `value` och `onChange`, och ett byte av `flera` mitt i livet
 * monterar om väljaren.
 *
 * ⛔ VARJE FIL PRÖVAS FÖR SIG mot `maxChars` och `typer`. En avvisad fil ger ett besked med filens namn, och de andra tappas inte. Avvisas alla
 * ändras ingenting alls: `onChange` anropas inte, och i synnerhet inte med `null` eller en tom lista, för det hade tömt det som redan var valt.
 *
 * ⛔ FILERNA LÄGGS TILL OCH ERSÄTTER ALDRIG. Vald, inklistrad och indragen fil hamnar sist i listan, i den ordning de kom. Samma fil två gånger
 * är två rader: ramverket vet inte vad som är "samma" (två skärmbilder har samma namn), och appen avgör om en dubblett är ett fel.
 *
 * ⛔ DRAGNING FINNS BARA MED `flera`, och bara på väljarens egen yta. Utan `flera` har väljaren ingen yta för det, och att lägga till en hade
 * ändrat vad ett släpp gör för en app som inte bad om det. Med `knappPlats` har väljaren ingen egen yta (gemknappen sitter i appens fält), så där
 * finns ingen dragning; vald och inklistrad fil fungerar som vanligt.
 *
 * ⛔ Ramverket sätter inget tak på ANTALET filer. Taket per fil är `maxChars`; hur många som ryms i posten är appens, som ser listan i `onChange`.
 */

/**
 * @typedef {object} FilvaljareGrund
 * @property {number} maxChars Tak för data-URL:en i tecken, per fil. Plattformen äger talet: ramverket vet inte vad den lagrar i.
 * @property {string} [accept] Vad filväljaren erbjuder. ⛔ Ett filter, aldrig ett skydd: en fil kan alltid dras in eller klistras in ändå.
 * @property {readonly string[]} [typer] (0.73.0) Typerna en bilaga får ha. Det här ÄR ett skydd: en fil av annan typ avvisas med besked,
 *   hur den än kom in (vald, indragen eller inklistrad). Saknas listan tas alla typer, som förut.
 * @property {boolean} [paste] Ta emot inklistrade filer. Av när två väljare delar yta.
 * @property {string} [ariaLabel] Vad som ska bifogas, för den som inte ser knappen.
 * @property {{ select?: string, byt?: string, laggTill?: string, remove?: string, klistra?: string }} [labels] Utan `flera`: `select` ("Välj fil"), `byt` ("Byt fil"), `remove` och `klistra`. Med `flera`: `select` ("Välj filer"), `laggTill` ("Lägg till fler"), `remove` ("Ta bort", och filens namn efter för skärmläsaren) och `klistra` (en rad om att dra hit eller klistra in). ⛔ `byt` används inte med `flera`: det finns inget att byta, och att ge den betydelsen "lägg till" hade lurat en app som satt den för enfilsläget.
 * @property {HTMLElement | null} [knappPlats] (0.132.0) Gemknappen i stället för "Välj fil": en rund knapp med gemmen (`GemIkon`) och `ariaLabel` som namn, ritad i den plats ett fält gett (`bifogaPlats` på
 *   `OpsTextarea`), bredvid mikrofonen, som chattens skrivfält. Förhandsvisningen, Ta bort, felet och inklistringen är desamma som förut och ritas där väljaren står, under fältet. `null` är platsen som
 *   inte monterats än (ingen knapp ritas); utelämnad är väljaren som förut, med sin egen knapp "Välj fil". ⛔ Ett val av en fil är fortfarande bara ett val: filen skickas först när appen skickar.
 */

/**
 * @typedef {FilvaljareGrund & { flera?: false, value: import("../lib/file.js").Bilaga | null, onChange: (attachment: import("../lib/file.js").Bilaga | null) => void }} FilvaljareEn
 *   Utan `flera`: en fil. `onChange(null)` när den tas bort eller inte kunde läsas.
 */

/**
 * @typedef {FilvaljareGrund & { flera: true, value?: readonly import("../lib/file.js").Bilaga[] | null, onChange: (attachments: import("../lib/file.js").Bilaga[]) => void, sprak?: "sv" | "en" }} FilvaljareFlera
 *   Med `flera` (0.149.0): `value` är listan (`null` eller utelämnad är en tom lista) och `onChange` får hela den nya listan. `sprak`: språket för knapparna, annars `OpsSprakProvider`, annars svenska (`ORD_OPSFILEPICKER`).
 */

/**
 * Orden i väljaren med `flera`, svenska och engelska (0.149.0).
 *
 * ⛔ DET NYA LÄGET FICK SINA ORD I EN ORDBOK FRÅN FÖRSTA RADEN, och `check-sprak` var det som sade till: ett svenskt förval i parameterlistan
 * (`ariaLabel = "Bifoga filer"`) tog antalet över taket 112, och taket får bara sjunka. Läget utan `flera` är oförändrat och har kvar sina svenska
 * förval (de räknas redan i taket); att flytta dem hit ändrar vad en engelsk app ser och hör till ett eget beslut. `valdBilaga` är den enda
 * texten båda lägena delar, och läget utan `flera` läser den på svenska härifrån så att ordet bara står på ett ställe.
 *
 * Felen ur `lib/file.js` ("Filen är för stor ...") är svenska ännu och visas som de är. Appens egna `labels` och `ariaLabel` vinner alltid.
 */
export const ORD_OPSFILEPICKER = {
  bifogaFiler: { sv: "Bifoga filer", en: "Attach files" },
  valjFiler: { sv: "Välj filer", en: "Choose files" },
  laggTillFler: { sv: "Lägg till fler", en: "Add more" },
  taBort: { sv: "Ta bort", en: "Remove" },
  laser: { sv: "Läser", en: "Reading" },
  draEllerKlistra: { sv: "eller dra hit filer eller klistra in en skärmbild", en: "or drag files here or paste a screenshot" },
  draHit: { sv: "eller dra hit filer", en: "or drag files here" },
  kundeInteLasas: { sv: "Filen kunde inte läsas.", en: "The file could not be read." },
  valdBilaga: { sv: "Vald bilaga", en: "Selected attachment" },
};

/**
 * Välj en eller flera filer att bifoga. Se filhuvudet ovan.
 *
 * @param {FilvaljareEn | FilvaljareFlera} props
 */
export function OpsFilePicker(props) {
  return props.flera === true ? <FleraFiler {...props} /> : <EnFil {...props} />;
}

/** @param {number} maxChars */
function kravTak(maxChars) {
  if (!Number.isFinite(maxChars) || maxChars <= 0) {
    throw new Error(
      `OpsFilePicker: maxChars måste vara ett positivt tal, fick ${maxChars}. Utan tak skrivs filen till en lagring som avvisar den, och avslaget når användaren som "kunde inte spara".`,
    );
  }
}

/**
 * Läget utan `flera`: en fil. Oförändrat sedan före 0.149.0.
 *
 * @param {FilvaljareEn} props
 */
function EnFil({
  value,
  onChange,
  maxChars,
  accept,
  typer,
  paste = true,
  ariaLabel = "Bifoga fil",
  labels = {},
  knappPlats,
}) {
  const filRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [error, setError] = useState("");
  const [reading, setLaser] = useState(false);
  const errorId = useId();

  kravTak(maxChars);

  const ta = async (/** @type {File | Blob | null} */ file) => {
    if (!file) return;
    setError("");
    setLaser(true);
    try {
      onChange(await readAttachment(file, { maxChars, typer }));
    } catch (err) {
      onChange(null);
      setError(err instanceof Error ? err.message : "Filen kunde inte läsas.");
    } finally {
      setLaser(false);
    }
  };

  useEffect(() => {
    if (!paste) return undefined;
    /** @param {ClipboardEvent} e */
    const vid = (e) => {
      const filer = e.clipboardData ? Array.from(e.clipboardData.files || []) : [];
      if (!filer.length) return;
      // ⛔ Först när vi VET att det finns en fil. Ett `preventDefault` på varje
      // inklistring hade dödat vanlig textinklistring på hela sidan.
      e.preventDefault();
      ta(filer[0]);
    };
    document.addEventListener("paste", vid);
    return () => document.removeEventListener("paste", vid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paste, maxChars, typer]);

  const isImage = Boolean(value && arBildtyp(value.typ));
  const ikonlage = knappPlats !== undefined;

  if (ikonlage) {
    return (
      <>
        {/* Det råa fältet är dolt och namnlöst för skärmläsare: knappen i fältet är den enda ingången, och två saker som heter Bifoga vore ett fel. */}
        <input
          ref={filRef}
          type="file"
          accept={accept}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = "";
            ta(file);
          }}
          className="sr-only"
        />
        {knappPlats
          ? createPortal(<Faltknapp ikon={<GemIkon size={18} />} etikett={ariaLabel} onClick={() => filRef.current?.click()} placering="plats" disabled={reading} data={{ "data-bifoga": "" }} />, knappPlats)
          : null}
        {error || value ? (
          <div className="flex flex-col gap-2">
            {error ? (
              <p role="alert" className="m-0 text-etikett text-danger">
                {error}
              </p>
            ) : null}
            {value ? (
              <div className="flex flex-col gap-2">
                <Forhandsvisning value={value} isImage={isImage} valdBilaga={ordet(ORD_OPSFILEPICKER, "valdBilaga", "sv")} />
                <div>
                  <OpsButton variant="ghost" size="sm" onClick={() => onChange(null)}>
                    {labels.remove ?? "Ta bort"}
                  </OpsButton>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* ⛔ Det råa fältet är dolt och knappen är ramverkets. En
          `<input type="file">` går inte att forma, och en app som formar den
          själv har börjat bygga en egen knapp av ramverkets klasser. */}
      <input
        ref={filRef}
        type="file"
        accept={accept}
        aria-label={ariaLabel}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          // ⛔ Nollställ fältet direkt. Utan det går det inte att välja SAMMA fil
          // igen efter att man tagit bort den, eftersom `change` inte fyrar när
          // värdet är oförändrat.
          e.target.value = "";
          ta(file);
        }}
        className="sr-only"
      />

      <div className="flex flex-wrap items-center gap-2">
        <OpsButton variant="secondary" onClick={() => filRef.current?.click()} busy={reading}>
          {reading ? "Läser" : value ? labels.byt ?? "Byt fil" : labels.select ?? "Välj fil"}
        </OpsButton>
        {value ? (
          <OpsButton variant="ghost" onClick={() => onChange(null)}>
            {labels.remove ?? "Ta bort"}
          </OpsButton>
        ) : null}
        {/* ⛔ HINTEN GÖMS PÅ TELEFON, inte lyssnaren. Att ta en skärmbild och
            klistra in den är ett skrivbordsarbetssätt: en telefon har inget
            urklipp som når ett filfält, så texten hade lovat något som inte går
            att göra, på den skärm där utrymmet är minst.

            ⛔ Lyssnaren är kvar på alla bredder. En surfplatta med tangentbord är
            smalare än `sm` i liggande läge ibland, och en funktion som fungerar
            ska inte stängas av för att texten om den är gömd. */}
        {paste && !value ? (
          <span className="hidden items-center gap-1 text-etikett text-ink-muted sm:inline-flex">
            <GemIkon />
            {labels.klistra ?? "eller klistra in en skärmbild"}
          </span>
        ) : null}
      </div>

      {/* ⛔ `role="alert"` så orsaken LÄSES UPP. En röd rad som bara syns lämnar
          den som inte ser skärmen med en knapp som inte gjorde något. */}
      {error ? (
        <p id={errorId} role="alert" className="m-0 text-etikett text-danger">
          {error}
        </p>
      ) : null}

      {value ? <Forhandsvisning value={value} isImage={isImage} valdBilaga={ordet(ORD_OPSFILEPICKER, "valdBilaga", "sv")} /> : null}
    </div>
  );
}

/**
 * Hur länge en omgång väntar på att appen ska rita om med den nya listan innan den räknar ändringen som vägrad (se `vantaPaAppen`).
 * 300 ms är arton bildrutor vid 60 Hz: långt över hur lång en omritning tar, kort nog att en app som vägrar inte låter nästa inklistring hänga.
 */
const APPENS_TAK_MS = 300;

/** En tom lista med fast identitet, så att `value={null}` inte ger en ny lista vid varje ritning. */
const TOM = /** @type {readonly import("../lib/file.js").Bilaga[]} */ ([]);

/**
 * Läget med `flera` (0.149.0). Se filhuvudet.
 *
 * @param {FilvaljareFlera} props
 */
function FleraFiler({ value, onChange, maxChars, accept, typer, paste = true, ariaLabel, labels = {}, knappPlats, sprak }) {
  const kontext = useOpsSprak();
  const o = /** @type {Record<keyof typeof ORD_OPSFILEPICKER, string>} */ (forvalda(ORD_OPSFILEPICKER, sprak ?? kontext));
  const etikett = ariaLabel ?? o.bifogaFiler;
  const filRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [fel, setFel] = useState(/** @type {string[]} */ ([]));
  const [laser, setLaser] = useState(false);
  const [drar, setDrar] = useState(false);
  const errorId = useId();

  kravTak(maxChars);
  if (value != null && !Array.isArray(value)) {
    throw new Error(
      "OpsFilePicker: med flera måste value vara en lista av bilagor (eller null). Fick en enstaka bilaga eller något annat; en lista av en bilaga är [bilaga].",
    );
  }
  const lista = value ?? TOM;

  // ⛔ INGEN EGEN KOPIA AV LISTAN. Varje tillägg och varje borttagning utgår från det appen senast gav i `value`. Förut hade väljaren en egen
  // "senaste lista" som sattes direkt vid ett tillägg: vägrade appen tillägget (behöll samma `value`) låg de vägrade filerna kvar där och
  // kom med i nästa `onChange`. `nu` är en ref bara för att den asynkrona inläsningen ska läsa värdet när den är KLAR och inte det som gällde när
  // den startade; den sätts om vid varje ritning. Samma sak med `onChange`, som inklistringens lyssnare annars skulle hålla en gammal av.
  const nu = useRef(lista);
  nu.current = lista;
  const paChange = useRef(onChange);
  paChange.current = onChange;
  // ⛔ INLÄSNINGARNA GÅR I KÖ, en omgång i taget. Två omgångar i följd (två inklistringar) bygger på varandra bara om den andra läser appens lista
  // EFTER att appen visat den första: därför väntar nästa omgång tills den förra är klar och appen har ritat om med den nya listan.
  const kedja = useRef(/** @type {Promise<void>} */ (Promise.resolve()));
  // ⛔ NÄSTA OMGÅNG VÄNTAR PÅ APPENS COMMIT, INTE PÅ EN TIMER (#475). Förut väntade den ett `setTimeout(0)` efter `onChange`, i tron att appens omritning
  // hunnit före. Inklistringens lyssnare sitter på `document`, utanför Reacts händelser, och då schemalägger React 18 omritningen i sin egen
  // schemaläggare: under last kom timern först, nästa omgång läste en gammal `nu.current` och skrev `[...gammal lista, b]` över `[...gammal lista, a]`.
  // Nu skapas en väntan INNAN `onChange` anropas, och effekten nedan löser den i den commit där `value` blivit en annan lista än den som gällde då.
  /** @type {import("react").MutableRefObject<{ fran: readonly import("../lib/file.js").Bilaga[], klar: () => void } | null>} */
  const appens = useRef(null);
  // Hur många inläsningar som pågår, för "Läser".
  const pagar = useRef(0);

  /**
   * Ett löfte som löses när appen har ritat om med en annan lista än `fran`, eller efter `APPENS_TAK_MS`.
   *
   * ⛔ TAKET ÄR EN TIDSGRÄNS OCH INTE EN SIGNAL, och det finns ingen signal att ta i stället: en app som VÄGRAR ändringen (behåller `value`,
   * vilket flera-läget uttryckligen tillåter) gör ingenting alls, och inifrån väljaren ser det likadant ut som en app som är långsam.
   * Utan tak står kön still för alltid efter den första vägran. Löper taket ut behandlas det som en vägran: nästa omgång läser den lista appen
   * har, och inget fel visas, eftersom en vägran är appens rätt. Det som inte hanteras är en app som tar emot ändringen LÄNGRE efter än taket;
   * den får sina filer tappade i nästa omgång, och det är därför taket är satt till många bildrutor och inte till ett andetag.
   *
   * @param {readonly import("../lib/file.js").Bilaga[]} fran
   * @returns {Promise<void>}
   */
  const vantaPaAppen = (fran) =>
    new Promise((klar) => {
      const tak = setTimeout(() => post.klar(), APPENS_TAK_MS);
      const post = {
        fran,
        klar: () => {
          clearTimeout(tak);
          if (appens.current === post) appens.current = null;
          klar();
        },
      };
      appens.current = post;
    });

  // Efter varje commit där listan blivit en annan: appen har ritat om, och nästa omgång får läsa den. Vid avmontering släpps en väntande omgång, så
  // att ingen timer eller kedja hänger kvar.
  useEffect(() => {
    if (appens.current && lista !== appens.current.fran) appens.current.klar();
  }, [lista]);
  useEffect(
    () => () => {
      appens.current?.klar();
    },
    [],
  );

  /** @param {File[]} filer */
  const lasOmgang = async (filer) => {
    /** @type {import("../lib/file.js").Bilaga[]} */
    const nya = [];
    /** @type {string[]} */
    const nej = [];
    try {
      // En i taget och inte alla på en gång: tio kamerabilder avkodade samtidigt är tio dukar i minnet, på en telefon.
      for (const f of filer) {
        try {
          nya.push(await readAttachment(f, { maxChars, typer }));
        } catch (err) {
          nej.push(`${filensNamn(f)}: ${err instanceof Error ? err.message : o.kundeInteLasas}`);
        }
      }
      // ⛔ INGEN LYCKAD FIL BETYDER INGEN ÄNDRING. Ett onChange med den gamla listan hade fått appen att spara om något som inte ändrats.
      // Beskeden först: de hör till filerna som lästes och ska inte vänta på appen.
      if (nej.length > 0) setFel((f) => [...f, ...nej]);
      if (nya.length > 0) {
        const vantan = vantaPaAppen(nu.current);
        paChange.current([...nu.current, ...nya]);
        await vantan;
      }
    } finally {
      pagar.current -= 1;
      setLaser(pagar.current > 0);
    }
  };

  /** @param {File[]} filer */
  const taFiler = (filer) => {
    if (filer.length === 0) return;
    // Ett nytt val tar bort de gamla beskedena; beskeden från det som läses nu läggs till när det är klart.
    setFel([]);
    pagar.current += 1;
    setLaser(true);
    kedja.current = kedja.current.then(() => lasOmgang(filer));
  };
  const taRef = useRef(taFiler);
  taRef.current = taFiler;

  /**
   * ⛔ BORT PÅ IDENTITET OCH INTE PÅ PLATS, ur den lista appen gav. Den som trycker ser listan appen ritat, och ett index hade tagit bort fel rad
   * om listan hunnit ändras.
   *
   * @param {import("../lib/file.js").Bilaga} bilaga
   */
  const taBort = (bilaga) => {
    onChange(nu.current.filter((b) => b !== bilaga));
  };

  // ⛔ LYSSNAREN ANROPAR ALLTID SENASTE taFiler genom en ref och registreras bara om när `paste` ändras. Förut höll den ett taFiler från den
  // ritning som registrerade den, och beroendena (`paste`, `maxChars`, `typer`) saknade språket: efter ett språkbyte fick felets reservtext
  // det gamla språket. Nu finns inget kvar att glömma i listan.
  useEffect(() => {
    if (!paste) return undefined;
    /** @param {ClipboardEvent} e */
    const vid = (e) => {
      const filer = e.clipboardData ? Array.from(e.clipboardData.files || []) : [];
      if (!filer.length) return;
      // ⛔ Först när vi VET att det finns en fil, av samma skäl som i EnFil: ett preventDefault på varje inklistring dödar textinklistring.
      e.preventDefault();
      taRef.current(filer);
    };
    document.addEventListener("paste", vid);
    return () => document.removeEventListener("paste", vid);
  }, [paste]);

  /** @param {import("react").ChangeEvent<HTMLInputElement>} e */
  const valde = (e) => {
    // ⛔ KOPIERA FILERNA FÖRE NOLLSTÄLLNINGEN. `files` är en levande lista: sätter man `value = ""` först är den tom, och valet har gått förlorat.
    const filer = Array.from(e.target.files ?? []);
    e.target.value = "";
    taFiler(filer);
  };

  /** @param {import("react").DragEvent<HTMLElement>} e */
  const barFiler = (e) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  /** @param {import("react").DragEvent<HTMLElement>} e */
  const dragOver = (e) => {
    // ⛔ Bara filer. Text som dras över ytan är inte vår, och ett preventDefault på den hade förbjudit släppet i ett textfält intill.
    if (!barFiler(e)) return;
    e.preventDefault();
    setDrar(true);
  };
  /** @param {import("react").DragEvent<HTMLElement>} e */
  const slapp = (e) => {
    setDrar(false);
    const filer = Array.from(e.dataTransfer?.files ?? []);
    if (!filer.length) return;
    e.preventDefault();
    taFiler(filer);
  };

  const tillagg = lista.length > 0;
  const innehall = (
    <>
      {fel.length > 0 ? <Felrad fel={fel} id={errorId} /> : null}
      {tillagg ? <Filista lista={lista} taBortText={labels.remove ?? o.taBort} valdBilaga={o.valdBilaga} onTaBort={taBort} /> : null}
    </>
  );

  if (knappPlats !== undefined) {
    return (
      <>
        {/* Det råa fältet är dolt och namnlöst för skärmläsare: knappen i fältet är den enda ingången, och två saker som heter Bifoga vore ett fel. */}
        <input ref={filRef} type="file" multiple accept={accept} tabIndex={-1} aria-hidden="true" onChange={valde} className="sr-only" />
        {knappPlats
          ? createPortal(<Faltknapp ikon={<GemIkon size={18} />} etikett={etikett} onClick={() => filRef.current?.click()} placering="plats" disabled={laser} data={{ "data-bifoga": "" }} />, knappPlats)
          : null}
        {fel.length > 0 || tillagg ? <div className="flex flex-col gap-2">{innehall}</div> : null}
      </>
    );
  }

  return (
    <div
      data-filvaljare-flera=""
      onDragEnter={dragOver}
      onDragOver={dragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(/** @type {Node | null} */ (e.relatedTarget))) setDrar(false);
      }}
      onDrop={slapp}
      className={cx("flex flex-col gap-2", drar && "rounded-md outline-2 outline-offset-4 outline-dashed outline-accent")}
    >
      {/* ⛔ Det råa fältet är dolt och knappen är ramverkets, som i EnFil: en `<input type="file">` går inte att forma. */}
      <input
        ref={filRef}
        type="file"
        multiple
        accept={accept}
        aria-label={etikett}
        aria-describedby={fel.length > 0 ? errorId : undefined}
        onChange={valde}
        className="sr-only"
      />
      <div className="flex flex-wrap items-center gap-2">
        <OpsButton variant="secondary" onClick={() => filRef.current?.click()} busy={laser}>
          {laser ? o.laser : tillagg ? (labels.laggTill ?? o.laggTillFler) : (labels.select ?? o.valjFiler)}
        </OpsButton>
        {/* Som i EnFil gömd på telefon men inte avstängd: lyssnaren och släppet finns kvar på alla bredder. */}
        <span className="hidden items-center gap-1 text-etikett text-ink-muted sm:inline-flex">
          <GemIkon />
          {labels.klistra ?? (paste ? o.draEllerKlistra : o.draHit)}
        </span>
      </div>
      {innehall}
    </div>
  );
}

/**
 * Beskeden för de filer som avvisades, ett stycke per fil under en gemensam `role="alert"` så att allt läses upp i ett svep.
 *
 * @param {{ fel: readonly string[], id: string }} props
 */
function Felrad({ fel, id }) {
  return (
    <div id={id} role="alert" className="flex flex-col gap-1">
      {fel.map((f, i) => (
        <p key={`${i}-${f}`} className="m-0 text-etikett text-danger">
          {f}
        </p>
      ))}
    </div>
  );
}

/**
 * De valda filerna, en rad var med förhandsvisning och en egen Ta bort. Knappens synliga text är "Ta bort" och dess namn för skärmläsaren
 * börjar med samma ord och slutar med filens namn, så att tre knappar inte heter likadant.
 *
 * @param {{ lista: readonly import("../lib/file.js").Bilaga[], taBortText: string, valdBilaga: string, onTaBort: (bilaga: import("../lib/file.js").Bilaga) => void }} props
 */
function Filista({ lista, taBortText: taBort, valdBilaga, onTaBort }) {
  return (
    // `role="list"` är kvar med flit: Safari tappar listsemantiken på en lista utan punkter.
    <ul role="list" className="m-0 flex list-none flex-col gap-3 p-0">
      {lista.map((b, i) => (
        <li key={`${i}-${b.namn}`} className="flex flex-col gap-1">
          <Forhandsvisning value={b} isImage={arBildtyp(b.typ)} valdBilaga={valdBilaga} />
          <div>
            <OpsButton variant="ghost" size="sm" ariaLabel={`${taBort} ${b.namn}`} onClick={() => onTaBort(b)}>
              {taBort}
            </OpsButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Förhandsvisningen av den valda filen: en liten bild, eller namnet och storleken. Samma i väljarens båda lägen.
 * @param {{ value: import("../lib/file.js").Bilaga, isImage: boolean, valdBilaga: string }} props `valdBilaga`: början av bildens alternativtext ("Vald bilaga"), ur `ORD_OPSFILEPICKER`.
 */
function Forhandsvisning({ value, isImage, valdBilaga }) {
  return (
    <figure className="m-0">
      {isImage ? (
        // Förhandsvisningen är liten med flit: den ska bekräfta att rätt fil
        // valts, inte visa den i full storlek i ett formulär.
        <img src={value.dataUrl} alt={`${valdBilaga}: ${value.namn}`} className="max-h-40 rounded-md border border-line" />
      ) : (
        // ⛔ Ingen förhandsvisning av en PDF i en `<iframe>`. Den renderas
        // olika i varje webbläsare, kan vara flera sidor, och en ruta som
        // ibland är tom ser ut som att filen inte kom fram. Namnet och
        // storleken svarar på den enda fråga man har: blev det rätt fil?
        <div className="flex items-center gap-2 rounded-md border border-line bg-sunken px-3 py-2 text-ink">
          <FilIkon />
          <span className="min-w-0 truncate">{value.namn}</span>
        </div>
      )}
      <figcaption className="mt-1 text-etikett text-ink-muted">
        {isImage && value.bredd ? `${value.bredd} × ${value.hojd} px · ` : ""}
        {attachmentSize(value.tecken)}
      </figcaption>
    </figure>
  );
}
