import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "../lib/cx.js";
import { isImage as arBildtyp, attachmentSize, filensNamn, readAttachment } from "../lib/file.js";
import { OpsButton } from "./OpsButton.jsx";
import { FilIkon, GemIkon } from "./icons.jsx";
import { Faltknapp } from "./OpsRostinmatning.jsx";

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
 * @property {{ select?: string, byt?: string, remove?: string, klistra?: string }} [labels] Med `flera` är förvalen "Välj filer", "Lägg till fler", "Ta bort" (och filens namn efter, för skärmläsaren) och en rad om att dra hit eller klistra in.
 * @property {HTMLElement | null} [knappPlats] (0.132.0) Gemknappen i stället för "Välj fil": en rund knapp med gemmen (`GemIkon`) och `ariaLabel` som namn, ritad i den plats ett fält gett (`bifogaPlats` på
 *   `OpsTextarea`), bredvid mikrofonen, som chattens skrivfält. Förhandsvisningen, Ta bort, felet och inklistringen är desamma som förut och ritas där väljaren står, under fältet. `null` är platsen som
 *   inte monterats än (ingen knapp ritas); utelämnad är väljaren som förut, med sin egen knapp "Välj fil". ⛔ Ett val av en fil är fortfarande bara ett val: filen skickas först när appen skickar.
 */

/**
 * @typedef {FilvaljareGrund & { flera?: false, value: import("../lib/file.js").Bilaga | null, onChange: (attachment: import("../lib/file.js").Bilaga | null) => void }} FilvaljareEn
 *   Utan `flera`: en fil. `onChange(null)` när den tas bort eller inte kunde läsas.
 */

/**
 * @typedef {FilvaljareGrund & { flera: true, value?: readonly import("../lib/file.js").Bilaga[] | null, onChange: (attachments: import("../lib/file.js").Bilaga[]) => void }} FilvaljareFlera
 *   Med `flera` (0.149.0): `value` är listan (`null` eller utelämnad är en tom lista) och `onChange` får hela den nya listan.
 */

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
                <Forhandsvisning value={value} isImage={isImage} />
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

      {value ? <Forhandsvisning value={value} isImage={isImage} /> : null}
    </div>
  );
}

/** En tom lista med fast identitet, så att `value={null}` inte ger en ny lista vid varje ritning. */
const TOM = /** @type {readonly import("../lib/file.js").Bilaga[]} */ ([]);

/**
 * Läget med `flera` (0.149.0). Se filhuvudet.
 *
 * @param {FilvaljareFlera} props
 */
function FleraFiler({ value, onChange, maxChars, accept, typer, paste = true, ariaLabel = "Bifoga filer", labels = {}, knappPlats }) {
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

  // ⛔ SENASTE LISTAN OCH SENASTE onChange LIGGER I REFS. Inläsningen är asynkron och inklistringens lyssnare sitter på dokumentet och läser
  // sin omgivning en gång: utan refs lägger ett andra tillägg till på en lista som är äldre än det första, och det första tappas tyst.
  // Efter ett tillägg gäller den nya listan direkt, innan appen hunnit rita om. Ritar appen om med något annat är det appens lista som gäller.
  const senast = useRef(lista);
  const paChange = useRef(onChange);
  paChange.current = onChange;
  useEffect(() => {
    senast.current = lista;
  }, [lista]);
  // Hur många inläsningar som pågår, för "Läser". Två val i följd kan överlappa.
  const pagar = useRef(0);

  /** @param {File[]} filer */
  const taFiler = async (filer) => {
    if (filer.length === 0) return;
    // Ett nytt val tar bort de gamla beskedena; beskeden från det som läses nu läggs till när det är klart.
    setFel([]);
    pagar.current += 1;
    setLaser(true);
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
          nej.push(`${filensNamn(f)}: ${err instanceof Error ? err.message : "Filen kunde inte läsas."}`);
        }
      }
      // ⛔ INGEN LYCKAD FIL BETYDER INGEN ÄNDRING. Ett onChange med den gamla listan hade fått appen att spara om något som inte ändrats.
      if (nya.length > 0) {
        const ny = [...senast.current, ...nya];
        senast.current = ny;
        paChange.current(ny);
      }
      if (nej.length > 0) setFel((f) => [...f, ...nej]);
    } finally {
      pagar.current -= 1;
      setLaser(pagar.current > 0);
    }
  };

  /**
   * ⛔ BORT PÅ IDENTITET OCH INTE PÅ PLATS. Den som trycker ser listan appen ritat om, och senaste listan kan innehålla fler (ett tillägg som appen
   * ännu inte hunnit visa). Ett index hade tagit bort fel rad ur den längre listan.
   *
   * @param {import("../lib/file.js").Bilaga} bilaga
   */
  const taBort = (bilaga) => {
    const ny = senast.current.filter((b) => b !== bilaga);
    senast.current = ny;
    onChange(ny);
  };

  useEffect(() => {
    if (!paste) return undefined;
    /** @param {ClipboardEvent} e */
    const vid = (e) => {
      const filer = e.clipboardData ? Array.from(e.clipboardData.files || []) : [];
      if (!filer.length) return;
      // ⛔ Först när vi VET att det finns en fil, av samma skäl som i EnFil: ett preventDefault på varje inklistring dödar textinklistring.
      e.preventDefault();
      taFiler(filer);
    };
    document.addEventListener("paste", vid);
    return () => document.removeEventListener("paste", vid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paste, maxChars, typer]);

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
      {tillagg ? <Filista lista={lista} labels={labels} onTaBort={taBort} /> : null}
    </>
  );

  if (knappPlats !== undefined) {
    return (
      <>
        {/* Det råa fältet är dolt och namnlöst för skärmläsare: knappen i fältet är den enda ingången, och två saker som heter Bifoga vore ett fel. */}
        <input ref={filRef} type="file" multiple accept={accept} tabIndex={-1} aria-hidden="true" onChange={valde} className="sr-only" />
        {knappPlats
          ? createPortal(<Faltknapp ikon={<GemIkon size={18} />} etikett={ariaLabel} onClick={() => filRef.current?.click()} placering="plats" disabled={laser} data={{ "data-bifoga": "" }} />, knappPlats)
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
        aria-label={ariaLabel}
        aria-describedby={fel.length > 0 ? errorId : undefined}
        onChange={valde}
        className="sr-only"
      />
      <div className="flex flex-wrap items-center gap-2">
        <OpsButton variant="secondary" onClick={() => filRef.current?.click()} busy={laser}>
          {laser ? "Läser" : tillagg ? (labels.byt ?? "Lägg till fler") : (labels.select ?? "Välj filer")}
        </OpsButton>
        {/* Som i EnFil gömd på telefon men inte avstängd: lyssnaren och släppet finns kvar på alla bredder. */}
        <span className="hidden items-center gap-1 text-etikett text-ink-muted sm:inline-flex">
          <GemIkon />
          {labels.klistra ?? (paste ? "eller dra hit filer eller klistra in en skärmbild" : "eller dra hit filer")}
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
 * @param {{ lista: readonly import("../lib/file.js").Bilaga[], labels: { remove?: string }, onTaBort: (bilaga: import("../lib/file.js").Bilaga) => void }} props
 */
function Filista({ lista, labels, onTaBort }) {
  const taBort = labels.remove ?? "Ta bort";
  return (
    // `role="list"` är kvar med flit: Safari tappar listsemantiken på en lista utan punkter.
    <ul role="list" className="m-0 flex list-none flex-col gap-3 p-0">
      {lista.map((b, i) => (
        <li key={`${i}-${b.namn}`} className="flex flex-col gap-1">
          <Forhandsvisning value={b} isImage={arBildtyp(b.typ)} />
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
 * @param {{ value: import("../lib/file.js").Bilaga, isImage: boolean }} props
 */
function Forhandsvisning({ value, isImage }) {
  return (
    <figure className="m-0">
      {isImage ? (
        // Förhandsvisningen är liten med flit: den ska bekräfta att rätt fil
        // valts, inte visa den i full storlek i ett formulär.
        <img src={value.dataUrl} alt={`Vald bilaga: ${value.namn}`} className="max-h-40 rounded-md border border-line" />
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
