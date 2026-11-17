import { createContext, useContext, useId, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { faltKlass, radBehallare, radKlass } from "../lib/radKlass.js";
import { useTalkfalt } from "./useTalkfalt.js";

/**
 * Fält, etikett, hjälptext och fel.
 *
 * ⛔ Felet hör till fältet, aldrig till en global banner högst upp. Den som ska
 * rätta något behöver se VAD som är fel utan att leta, och en banner som säger
 * "något gick fel" kräver att användaren gissar vilket av nio fält som menas.
 *
 * Kopplingen mellan etikett, fält, hjälptext och fel görs med id som ramverket
 * genererar. Det är precis den sortens arbete som blir fel när varje vy gör det
 * själv, och som ingen upptäcker förrän någon använder skärmläsare.
 */

/**
 * @typedef {object} FieldBinding
 * @property {string} id
 * @property {string} [etikettId] (0.104.0) Etikettens id, så att en yta som står i fältets plats kan bära fältets namn.
 * @property {string} [etikett] (0.230.0) Etikettens text, för TALK: "Till fältet {etikett}" (`useTalkfalt`).
 * @property {string} [describedBy]
 * @property {boolean} invalid
 * @property {boolean} required
 */

/** @type {import("react").Context<FieldBinding | null>} */
const FieldContext = createContext(/** @type {FieldBinding | null} */ (null));

/**
 * ⛔ TVÅ ETIKETTSTORLEKAR, FÖR ATT SESSIONSTUDIO HAR TVÅ (0.32.1).
 *
 * CP 2026-09-30, med en skärmbild av Profil på dator: "Typsnitten på profil är också fel. Storlek / typsnitt". Mätt i SS:
 * formulären (`ManageGroupModal.jsx:560`, `EventModal`) har `text-sm font-medium` (14/500), och det är ramverkets standard.
 * Profilen (`ProfileView.jsx:245`) har `text-[10px] text-[var(--color-text-muted)]`, alltså 10 px, vikt 400, dämpad. Samma
 * fält med två olika etiketter är SS eget val per yta, och en enda etikett i ramverket hade gjort den ena ytan fel.
 * `liten` är rollen `liten` (10 px) med vikt 400 som SS.
 */
/** @type {Record<string, string>} */
const ETIKETTER = {
  standard: "text-etikett font-medium text-ink-secondary",
  liten: "text-liten font-normal text-ink-muted",
};

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} [props.hint]
 * @param {string} [props.error] Sträng, inte boolean. Ett fält som bara vet ATT det är fel hjälper ingen.
 * @param {boolean} [props.required]
 * @param {"standard"|"liten"} [props.labelSize] `liten` (0.32.1) är SS profilens etikett, se `ETIKETTER`.
 * @param {{ text: string, over: boolean }} [props.raknare] (0.153.0, granskningen av PR 464) En längdräknare under fältet: kopplad till fältet med `aria-describedby`, och EN levande yta
 *   (`role="status"`, artig) också över taket. ⛔ Över taket är fältet ogiltigt (`aria-invalid`) utan att felet också står som `error`: en `role="alert"` bredvid räknarens status hade lästs upp vid
 *   varje tangent, två gånger. `error` är för felet som kommer en gång (ett sändfel), räknaren för det som ändras medan man skriver.
 * @param {import("react").ReactNode} props.children
 */
export function OpsField({ label, hint, error, required = false, labelSize = "standard", raknare, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-fel` : undefined;
  const raknarId = raknare ? `${id}-raknare` : undefined;
  const describedBy = cx(hintId, errorId, raknarId) || undefined;
  const etikettKlass = ETIKETTER[labelSize];
  if (!etikettKlass) {
    throw new Error(`OpsField: okänd labelSize "${labelSize}". Giltiga: ${Object.keys(ETIKETTER).join(", ")}.`);
  }

  return (
    <FieldContext.Provider value={{ id, etikettId: `${id}-etikett`, etikett: label, describedBy, invalid: Boolean(error) || Boolean(raknare?.over), required: required }}>
      <div className="flex flex-col gap-1">
        {/* ⛔ #167: font-medium, inte font-semibold. Samma mätning som
            OpsStat/OpsTable, se OpsStat.jsx. */}
        <label id={`${id}-etikett`} htmlFor={id} className={etikettKlass}>
          {label}
          {required ? (
            <span className="text-danger" aria-hidden="true">
              {" *"}
            </span>
          ) : null}
        </label>
        {children}
        {hint ? (
          <p id={hintId} className="text-hjalp text-ink-muted">
            {hint}
          </p>
        ) : null}
        {error ? (
          // role="alert" gör att felet läses upp när det dyker upp, inte bara
          // när någon råkar navigera förbi det.
          <p id={errorId} role="alert" className="text-hjalp text-danger">
            {error}
          </p>
        ) : null}
        {raknare ? (
          <p id={raknarId} role="status" data-langdraknare={raknare.over ? "over" : "nara"} className={cx("m-0 text-right text-liten tabular-nums", raknare.over ? "text-danger" : "text-ink-muted")}>
            {raknare.text}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/** @returns {{ id?: string, etikettId?: string, etikett?: string, describedBy?: string, invalid: boolean, required: boolean }} */
export function useFieldBinding() {
  return useContext(FieldContext) ?? { invalid: false, required: false };
}

// ⛔ `text-md` (16px) på telefon, `md:text-base` (14px) på desktop. Under 16px
// zoomar iOS Safari in fältet vid fokus och lämnar användaren utzoomad efteråt.
// Densiteten på desktop är oförändrad.
// 0.31.0: fältets klasser bor i `faltKlass` (radKlass.js), en gång för alla fält.


/**
 * ⛔ `date`, `time`, `datetime-local`, `month`, `week` och `color` saknas
 * medvetet. De renderas av webbläsaren, ser olika ut i var och en, går inte att
 * tokenisera och kan inte översättas. Ett förbud utan ersättare är bara gnäll,
 * så ramverket levererar `OpsSelect` och (nästa steg) en datumväljare.
 */
const TILLATNA_TYPER = ["text", "email", "search", "tel", "url", "password", "number"];

/**
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {"text"|"email"|"search"|"tel"|"url"|"password"|"number"} [props.type]
 * @param {string} [props.placeholder]
 * @param {string} [props.name]
 * @param {string} [props.autoComplete]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.readOnly]
 * @param {number} [props.maxLength]
 * @param {string} [props.ariaLabel] Bara när fältet står utanför en OpsField.
 * @param {false} [props.tal] (0.230.0) Finns inte längre: TALK är den enda röstknappen, och står markören i fältet när man trycker på TALK
 *   skrivs det sagda in där (`useTalkfalt`). `tal={false}` accepteras tyst i 0.230.0 (appar som stängde av ljudvågen), och försvinner helt i
 *   nästa större version. ⛔ `tal={true}` eller ett objekt kastar. Fältet är registrerat för TALK när det har `onChange`, inte är `disabled`
 *   eller `readOnly`, och inte är av en typ i `UTAN_TAL` (`password`, `email`, `number`, `search`, `tel`, `url`).
 * @param {"kant" | "fylld"} [props.yta] (0.196.0) `fylld`: ingen synlig kant, en fylld yta (se `faltKlass`). Gästens sida. Förval `kant`.
 * @param {ReadonlyArray<{ id: string, etikett: string, under?: string }>} [props.forslag] (cllp/lifehub.app#871) Förslag under fältet medan man skriver,
 *   till exempel personer man redan delar en grupp med. Fältet blir en kombinationsruta (`role="combobox"`): pilarna markerar, Enter väljer,
 *   Escape stänger. ⛔ APPEN FILTRERAR, INTE FÄLTET: fältet visar listan det får och vet inget om varifrån den kom eller vem som får se den.
 *   En tom lista ritar ingenting. Högst åtta visas. Skriv vidare och markeringen släpps, så att Enter skickar det som står i fältet.
 *   ⛔ SKICKA EN LISTA, ALDRIG `undefined` MEDAN FÄLTET ANVÄNDS: utanför ett skal med TALK får fältet ett omslag först när `forslag` finns,
 *   och ett träd som byter form monterar om fältet och tar fokus (samma fel som 0.232.0). Tom lista när inget passar.
 * @param {(id: string) => void} [props.onValjForslag] Krävs med `forslag`: anropas med förslagets id när det väljs.
 */
export function OpsInput({
  value,
  onChange,
  type = "text",
  placeholder,
  name,
  autoComplete,
  disabled = false,
  readOnly = false,
  maxLength,
  ariaLabel,
  tal,
  yta = "kant",
  forslag,
  onValjForslag,
}) {
  if (forslag && typeof onValjForslag !== "function") {
    throw new Error("OpsInput: forslag kräver onValjForslag. Ett förslag som inte går att välja är en lista som lovar något som inte händer.");
  }
  if (!TILLATNA_TYPER.includes(type)) {
    throw new Error(
      `OpsInput: typen "${type}" är inte tillåten. Giltiga: ${TILLATNA_TYPER.join(", ")}. ` +
        "Webbläsarens egna datum- och färgväljare ser olika ut i varje webbläsare och går inte att tokenisera.",
    );
  }
  const f = useFieldBinding();
  avvisaTal(tal, "OpsInput");
  const ruta = useRef(/** @type {HTMLInputElement | null} */ (null));
  const talk = useTalkfalt(ruta, { slag: "input", typ: type, value, onChange, disabled, readOnly, maxLength, etikett: f.etikett, ariaLabel, placeholder });
  const listId = useId();
  const medForslag = Boolean(forslag);
  const [fokus, setFokus] = useState(false);
  // ⛔ STÄNGD ÄR INTE SAMMA SAK SOM UTAN FOKUS (granskningen av 0.236.0): Escape stänger listan men fältet har kvar fokus. Med en egen flagga
  // öppnar nästa tecken eller ArrowDown listan igen, utan att man måste lämna fältet och komma tillbaka.
  const [stangd, setStangd] = useState(false);
  const [markerat, setMarkerat] = useState(-1);
  const synliga = (forslag ?? []).slice(0, 8);
  const visaLista = Boolean(forslag) && fokus && !stangd && synliga.length > 0 && !disabled && !readOnly;
  const markeratNu = markerat < synliga.length ? markerat : -1;
  /** @param {string} id */
  const valj = (id) => {
    setMarkerat(-1);
    onValjForslag?.(id);
  };
  /** @param {import("react").KeyboardEvent<HTMLInputElement>} e */
  const tangent = (e) => {
    if (!visaLista) {
      // Stängd med Escape: ArrowDown öppnar igen och markerar det första.
      if (e.key === "ArrowDown" && stangd && synliga.length > 0 && !disabled && !readOnly) {
        e.preventDefault();
        setStangd(false);
        setMarkerat(0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarkerat((m) => (m + 1) % synliga.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarkerat((m) => (m <= 0 ? synliga.length - 1 : m - 1));
    } else if (e.key === "Enter" && markeratNu >= 0) {
      e.preventDefault();
      valj(synliga[markeratNu].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setStangd(true);
      setMarkerat(-1);
    }
  };
  const falt = (
    <input
      ref={ruta}
      id={f.id}
      className={cx(faltKlass({ invalid: f.invalid, yta }), talk.medOmslag && "block", talk.medMik && "pe-12")}
      type={type}
      value={value}
      onChange={
        onChange
          ? (e) => {
              // ⛔ (granskningen av 0.236.0) Den som skriver vidare har lämnat förslaget: markeringen släpps, annars väljer Enter en person
              // i stället för att skicka det som står i fältet, och en lista som filtrerats om pekar på någon annan.
              if (medForslag) {
                setMarkerat(-1);
                setStangd(false);
              }
              onChange(e.target.value);
            }
          : undefined
      }
      placeholder={placeholder}
      name={name}
      autoComplete={autoComplete}
      disabled={disabled}
      readOnly={readOnly}
      maxLength={maxLength}
      required={f.required || undefined}
      aria-label={ariaLabel}
      aria-invalid={f.invalid || undefined}
      aria-describedby={f.describedBy}
      {...(medForslag
        ? {
            role: "combobox",
            "aria-autocomplete": /** @type {"list"} */ ("list"),
            "aria-expanded": visaLista,
            "aria-controls": listId,
            "aria-activedescendant": visaLista && markeratNu >= 0 ? `${listId}-${markeratNu}` : undefined,
            onFocus: () => {
              setFokus(true);
              setStangd(false);
            },
            onBlur: () => {
              setFokus(false);
              setMarkerat(-1);
            },
            onKeyDown: tangent,
          }
        : {})}
    />
  );
  // ⛔ LISTAN ÄR ETT SYSKON TILL FÄLTET, INTE ETT BARN, och trycket på ett förslag tar `onMouseDown` med preventDefault: annars tappar fältet
  // fokus före klicket, listan stängs och klicket landar ingenstans.
  const lista = visaLista ? (
    <ul id={listId} role="listbox" aria-labelledby={f.etikett ? f.etikettId : undefined} aria-label={f.etikett ? undefined : ariaLabel} data-falt-forslag="" className={cx("absolute top-full right-0 left-0 z-(--z-dropdown) mt-1 flex list-none flex-col p-1", radBehallare())}>
      {synliga.map((fs, i) => (
        <li
          key={fs.id}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === markeratNu}
          onMouseDown={(e) => {
            e.preventDefault();
            valj(fs.id);
          }}
          className={cx(radKlass({ active: i === markeratNu }), "flex min-w-0 flex-col items-start")}
        >
          <span className="max-w-full truncate text-etikett text-ink">{fs.etikett}</span>
          {fs.under ? <span className="max-w-full truncate text-meta text-ink-muted">{fs.under}</span> : null}
        </li>
      ))}
    </ul>
  ) : null;
  if (medForslag) {
    return (
      <div data-falt-omslag="" className="relative w-full min-w-0">
        {falt}
        {talk.medOmslag ? talk.mik("rad-falt") : null}
        {lista}
      </div>
    );
  }
  if (!talk.medOmslag) return falt;
  // ⛔ (0.232.0) Ett omslag bara i ett skal med TALK: `w-full` som fältet självt, så att en rad där fältet stod direkt som flex-barn behåller
  // sin bredd. Utanför ett skal (tam, gästen) är fältet exakt som förut. ⛔ (granskningen av PR 605) Omslaget står där OAVSETT om fältet går
  // att skriva i just nu: ett träd som byter form när `disabled` växlar monterar om fältet. (0.233.0) Mikrofonen står i fältet hela tiden
  // (`medMik`), och `pe-12` håller texten borta från den.
  return (
    <div data-falt-omslag="" className="relative w-full min-w-0">
      {falt}
      {talk.mik("rad-falt")}
    </div>
  );
}

/**
 * ⛔ `tal` FINNS INTE LÄNGRE (0.230.0, cllp/ops-framework#602). CP 2026-11-15: en röstknapp, och den är TALK. `tal={false}` är det en app
 * som stängde av ljudvågen har skrivit, och det accepteras tyst i den här versionen (appen har fyra sådana). Allt annat (`true`, ett
 * objekt, vad som helst) kastar: en app som bad om ljudvågen ska få veta att den är borta, och inte tro att den ritas.
 *
 * @param {unknown} tal @param {string} vem
 */
function avvisaTal(tal, vem) {
  if (tal === undefined || tal === false) return;
  throw new Error(
    `${vem}: tal finns inte längre (0.230.0). TALK är den enda röstknappen: står markören i fältet när man trycker på TALK skrivs det sagda in där. Ta bort tal (tal={false} accepteras ännu i den här versionen).`,
  );
}

/**
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {string} [props.placeholder]
 * @param {string} [props.name]
 * @param {number} [props.rows]
 * @param {boolean} [props.disabled]
 * @param {number} [props.maxLength]
 * @param {string} [props.ariaLabel]
 * @param {() => void} [props.onSend] Anropas på Cmd eller Ctrl plus Enter.
 *
 *   ⛔ EN NAMNGIVEN GENVÄG OCH INTE EN RÅ `onKeyDown`. Tog fältet emot godtyckliga
 *   tangenthanterare skulle varje app välja sin egen genväg, och samma ruta skickas
 *   med Enter i den ena appen och med Cmd plus Enter i den andra. Det är samma sorts
 *   drift som ett `className` ger, fast i beteende.
 *
 *   ⛔ ENTER ENSAMT SKICKAR ALDRIG. En textarea bär flera rader, och en ruta där
 *   Enter skickar gör radbrytning omöjlig utan att man först lärt sig en genväg.
 * @param {false} [props.tal] (0.230.0) Finns inte längre, se `OpsInput`: TALK skriver in det sagda där markören står. `tal={false}` accepteras tyst
 *   i 0.230.0, `tal={true}` och objekt kastar.
 * @param {(plats: HTMLElement | null) => void} [props.bifogaPlats] (0.132.0) En plats i fältets nedre kant, bredvid mikrofonen, för en knapp som bifogar en fil. Ramverket ger platsen (en ref-callback: `useState`s
 *   setter duger) och `OpsFilePicker` med `knappPlats` ritar gemknappen i den. Fältet lämnar plats för knappen (`pe-14`, och `pe-28` med mikrofonen). Utan propen är fältet som förut.
 */
export function OpsTextarea({ value, onChange, placeholder, name, rows = 4, disabled = false, maxLength, ariaLabel, onSend, tal, bifogaPlats }) {
  const f = useFieldBinding();
  avvisaTal(tal, "OpsTextarea");
  const ruta = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const talk = useTalkfalt(ruta, { slag: "textarea", value, onChange, disabled, maxLength, etikett: f.etikett, ariaLabel, placeholder });
  const falt = (
    <textarea
      ref={ruta}
      onKeyDown={sendGenvag(onSend)}
      id={f.id}
      className={cx(faltKlass({ invalid: f.invalid }), "resize-y", (bifogaPlats || talk.medOmslag) && "block", talk.medMik && bifogaPlats ? "pe-28" : (talk.medMik || bifogaPlats) && "pe-14")}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      name={name}
      rows={rows}
      disabled={disabled}
      maxLength={maxLength}
      required={f.required || undefined}
      aria-label={ariaLabel}
      aria-invalid={f.invalid || undefined}
      aria-describedby={f.describedBy}
    />
  );
  if (!bifogaPlats && !talk.medOmslag) return falt;
  // ⛔ (0.232.0) Mikrofonen står till vänster om gemknappen när båda finns. (0.233.0) Den står där hela tiden (`medMik`), inte bara vid fokus.
  return (
    <div data-falt-omslag="" className={cx("relative min-w-0", !bifogaPlats && "w-full")}>
      {falt}
      {bifogaPlats && !disabled ? <div ref={bifogaPlats} data-bifoga-plats="" className="absolute end-3 bottom-0.5" /> : null}
      {talk.medMik ? bifogaPlats ? <div className="absolute end-15 bottom-0.5">{talk.mik("plats")}</div> : talk.mik("falt") : null}
    </div>
  );
}

/** @param {(() => void) | undefined} onSend */
function sendGenvag(onSend) {
  if (!onSend) return undefined;
  return (/** @type {import("react").KeyboardEvent} */ e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSend();
    }
  };
}
