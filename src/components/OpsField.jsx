import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { forvalda } from "../lib/ord.js";
import { faltKlass } from "../lib/radKlass.js";
import { Mikrofonknapp, Rostyta, useRostfokus, useRostinmatning } from "./OpsRostinmatning.jsx";
import { useOpsSprak } from "./OpsSprak.jsx";
import { webblasarensIgenkanning } from "../lib/talk.js";

/**
 * Appens utskrift av inspelat ljud, för textfältens tal (#264, CP 2026-10-16 07:07).
 *
 * ⛔ RESERVEN PÅ SAFARI OCH iOS. Där finns ingen pålitlig taligenkänning i webbläsaren (`arWebKit`, #253), så ett fält med förvalt
 * tal spelar i stället in, lämnar ljudet till appens `onTranscribe` och skriver in texten i fältet. Gäller tills en egen app finns.
 * Utan provider och utan igenkänning har fältet ingen mikrofon, som förut.
 */
const TranskriberingKontext = createContext(/** @type {((blob: Blob) => Promise<string>) | null} */ (null));

/**
 * Ger alla textfält under sig en utskrift av ljud (#264). Läggs runt appen av den som har en server som skriver ut tal.
 * @param {{ onTranscribe: (blob: Blob) => Promise<string>, children?: import("react").ReactNode }} props
 */
export function OpsTranskriberingProvider({ onTranscribe, children }) {
  if (typeof onTranscribe !== "function") throw new Error("OpsTranskriberingProvider: onTranscribe ska vara en funktion som ger texten.");
  return <TranskriberingKontext.Provider value={onTranscribe}>{children}</TranskriberingKontext.Provider>;
}

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
    <FieldContext.Provider value={{ id, etikettId: `${id}-etikett`, describedBy, invalid: Boolean(error) || Boolean(raknare?.over), required: required }}>
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

/** @returns {{ id?: string, etikettId?: string, describedBy?: string, invalid: boolean, required: boolean }} */
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
 * @param {boolean | Textfaltstal} [props.tal] (0.106.0, #386 skiva 8) Tal i fältet, som i `OpsTextarea`: en ljudvåg vid fältets slut,
 *   och Klar skriver in det sagda där markören stod. ⛔ PÅ SOM FÖRVAL för `text` när fältet har `onChange` och webbläsaren har
 *   taligenkänning (se `talForval`). `tal={false}` stänger av. ⛔ ALDRIG för `password`, `email`, `number`, `search`, `tel` och `url`
 *   (`UTAN_TAL`): ett `tal` på dem kastar.
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
}) {
  if (!TILLATNA_TYPER.includes(type)) {
    throw new Error(
      `OpsInput: typen "${type}" är inte tillåten. Giltiga: ${TILLATNA_TYPER.join(", ")}. ` +
        "Webbläsarens egna datum- och färgväljare ser olika ut i varje webbläsare och går inte att tokenisera.",
    );
  }
  const f = useFieldBinding();
  const utskrift = useContext(TranskriberingKontext);
  if ((/** @type {readonly string[]} */ (UTAN_TAL)).includes(type)) {
    if (tal !== undefined && tal !== false) {
      throw new Error(`OpsInput: tal finns inte för type="${type}". ${UTAN_TAL_SKAL} Utelämna tal, eller ge false.`);
    }
  } else {
    const t = talForval(tal, onChange, readOnly, "OpsInput", utskrift);
    if (t) {
      return <TalFalt slag="input" f={f} value={value ?? ""} onChange={/** @type {(v: string) => void} */ (onChange)} placeholder={placeholder} name={name} disabled={disabled} readOnly={readOnly} maxLength={maxLength} ariaLabel={ariaLabel} typ={type} autoComplete={autoComplete} tal={t} />;
    }
  }
  return (
    <input
      id={f.id}
      className={faltKlass({ invalid: f.invalid })}
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
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
    />
  );
}

/**
 * Tal i ett textfält (0.104.0): det `OpsTextarea` tar emot i `tal`.
 *
 * @typedef {object} Textfaltstal
 * @property {import("../lib/talk.js").Igenkanning | boolean} [igenkanning] Text medan man pratar, som TALK:s `igenkanning`. ⛔ AV SOM
 *   FÖRVAL i objektformen, eftersom webbläsaren skickar talet till Googles eller Apples taltjänst och det är appens val. `tal={true}`
 *   är samma sak som `{ igenkanning: true }`.
 * @property {(blob: Blob) => Promise<string>} [onTranscribe] Appens utskrift av ljudet. Reserven: används bara när igenkänningen inte
 *   gav någon text, eller där webbläsaren saknar den.
 * @property {import("../lib/talk.js").Inspelare} [inspelare] Bara för prov. Förval: webbläsarens `MediaRecorder`.
 */

/** Nycklarna `tal` får ha. Ett okänt namn är ett stavfel, och ett stavfel i `onTranscribe` hade tagit bort reserven tyst. */
const TALNYCKLAR = ["igenkanning", "onTranscribe", "inspelare"];

/**
 * Fälttyper där tal aldrig erbjuds (0.106.0, #386 skiva 8).
 *
 * ⛔ CP bad om tal i alla textfält, men inte i lösenord, e-post, nummer, datum och sök. Datum finns inte som `OpsInput` (det är
 * `OpsDatePicker`). Lösenord: det sagda hade gått till Googles eller Apples taltjänst. E-post, nummer: en taltjänst skriver "anna
 * snabel-a exempel punkt se" och "tjugo", inte adressen och talet. Sök: rutan ger svar medan man skriver, och en yta som tar fältets
 * plats bryter det. (bedömning) `tel` och `url` av samma skäl som e-post och nummer.
 */
const UTAN_TAL = /** @type {const} */ (["password", "email", "number", "search", "tel", "url"]);
const UTAN_TAL_SKAL = "Taltjänsten skriver ord, inte lösenord, adresser, tal eller sökningar.";

/**
 * Vad `tal` blir (0.106.0, #386 skiva 8).
 *
 * ⛔ PÅ SOM FÖRVAL. CP 2026-10-14: tal i alla textfält. Utelämnat `tal` är `{ igenkanning: true }` när fältet har `onChange` och inte är
 * skrivskyddat, och ljudvågen står bara där webbläsaren har taligenkänning (`SpeechRecognition`, i Chrome och Safari
 * `webkitSpeechRecognition`): utan den hade knappen bara kunnat ge ett fel. ⛔ WEBBLÄSAREN SKICKAR TALET TILL GOOGLES ELLER APPLES
 * TALTJÄNST, och fram till 0.105.0 var det därför av som förval. Ingenting skickas förrän personen trycker på ljudvågen och pratar,
 * och ingenting skrivs in förrän hen trycker Klar. En app som inte vill det ger `tal={false}` per fält.
 *
 * @param {boolean | Textfaltstal | undefined} tal
 * @param {unknown} onChange
 * @param {boolean} skrivskyddat
 * @param {string} vem
 * @param {((blob: Blob) => Promise<string>) | null} [utskrift]
 * @returns {Textfaltstal | null}
 */
function talForval(tal, onChange, skrivskyddat, vem, utskrift = null) {
  if (tal === false) return null;
  // Utan taligenkänning i webbläsaren blir förvalet ett vanligt fält, med samma DOM som förut: ingen omslutning, ingen knapp.
  // ⛔ #264: utan igenkänning men med appens utskrift (`OpsTranskriberingProvider`) spelar fältet in och servern skriver ut.
  if (tal === undefined) {
    if (typeof onChange !== "function" || skrivskyddat) return null;
    if (webblasarensIgenkanning() !== null) return { igenkanning: true };
    return utskrift ? { onTranscribe: utskrift } : null;
  }
  if (tal !== true && (!tal || typeof tal !== "object" || Array.isArray(tal))) {
    // ⛔ VAD DET VAR, INTE `typeof` (0.104.0, granskningen av PR 384, KAN 8): `typeof null` är "object", och "fick object" om null
    // säger ingenting om felet.
    const fick = tal === null ? "null. Utelämna tal, eller ge false, för ett fält utan mikrofon" : Array.isArray(tal) ? "en lista" : typeof tal === "string" ? JSON.stringify(tal) : String(tal);
    throw new Error(`${vem}: tal ska vara true eller { igenkanning?, onTranscribe?, inspelare? }, fick ${fick}.`);
  }
  if (typeof onChange !== "function") {
    throw new Error(`${vem}: tal kräver onChange. Det sagda skrivs in i fältet genom den, och utan den hade Klar inte gjort något.`);
  }
  if (tal === true) return { igenkanning: true };
  const okanda = Object.keys(tal).filter((k) => !TALNYCKLAR.includes(k));
  if (okanda.length) throw new Error(`${vem}: okända nycklar i tal: ${okanda.join(", ")}. Tillåtna: ${TALNYCKLAR.join(", ")}.`);
  if (tal.onTranscribe !== undefined && typeof tal.onTranscribe !== "function") throw new Error(`${vem}: tal.onTranscribe ska vara en funktion.`);
  if (!tal.igenkanning && !tal.onTranscribe) {
    throw new Error(`${vem}: tal behöver igenkanning eller onTranscribe. Utan någon av dem finns inget som kan göra text av det sagda, och mikrofonen hade bara kunnat ge ett fel.`);
  }
  return tal;
}

/**
 * ⛔ FÄLTETS ORD PÅ BÅDA SPRÅKEN. TALK:s egen yta (`OpsInspelning`) har sina ord; de här är fältets: knappens namn, Klars namn,
 * statusraderna och det fältet säger när det sagda inte fick plats.
 */
export const ORD_OPSTEXTAREA_TAL = {
  prataIn: { sv: "Prata in", en: "Dictate" },
  klar: { sv: "Klar, skriv in det du sagt", en: "Done, insert what you said" },
  lamnar: { sv: "Skriver in…", en: "Inserting…" },
  skriverUt: { sv: "Skriver ut det inspelade…", en: "Transcribing the recording…" },
  transkriptionFel: { sv: "Det inspelade kunde inte skrivas ut.", en: "The recording could not be transcribed." },
  ingenUtskrift: { sv: "Ingen utskrift finns.", en: "No transcription is available." },
  ingetHordes: { sv: "Inget hördes i det inspelade.", en: "Nothing was heard in the recording." },
  lamnaFel: { sv: "Det du sa kunde inte skrivas in.", en: "What you said could not be inserted." },
  textFel: { sv: "Texten kan inte visas just nu. Det du säger spelas in ändå och skrivs ut när du är klar.", en: "The text can't be shown right now. What you say is still recorded and transcribed when you finish." },
  kapat: { sv: "Det du sa kortades: fältet rymmer {max} tecken.", en: "What you said was shortened: the field holds {max} characters." },
  fullt: { sv: "Fältet är fullt ({max} tecken), så inget av det du sa fick plats.", en: "The field is full ({max} characters), so none of what you said fit." },
  fickInte: { sv: "Fältet rymmer {max} tecken, och det du sa fick inte plats.", en: "The field holds {max} characters, and what you said did not fit." },
};

/**
 * Texten kapad till högst `n` tecken, vid ett ordslut och utan blanksteg sist (0.104.0, granskningen av PR 384, KAN 6). Ett enda ord
 * som är längre än `n` kapas mitt i, eftersom ingenting av det annars hade kommit med.
 * @param {string} text @param {number} n
 */
function kapaVidOrd(text, n) {
  if (text.length <= n) return text;
  const snitt = text.slice(0, n);
  if (/\s/.test(text[n])) return snitt.trimEnd();
  const ordslut = snitt.search(/\s\S*$/);
  return (ordslut > 0 ? snitt.slice(0, ordslut) : snitt).trimEnd();
}

/**
 * Var det sagda skrivs in, och vad som fick plats.
 *
 * ⛔ DÄR MARKÖREN STOD, ELLER SIST. En markering ersätts, som när man skriver. Ett mellanslag läggs till där det sagda annars hade
 * suttit ihop med ett ord på någon sida, så att "Beskriv" och "en app" inte blir "Beskriven app".
 *
 * ⛔ `maxLength` GÄLLER ÄVEN DET SAGDA. Webbläsaren håller taket bara för det som skrivs; ett värde som sätts av koden hade gått förbi
 * det tyst. Det som inte får plats kapas vid ett ordslut, och `kapat` säger att det hände (regel 5). Avskiljarna släpps aldrig: får det
 * sagda bara plats ihop med ett ord kommer det inte in alls, värdet står kvar, och `kapat` är `fickInte` (eller `fullt` när fältet är
 * fullt).
 *
 * @param {string} varde
 * @param {{ start: number, slut: number } | null} markor `null`: markören har aldrig stått i fältet, och det sagda hamnar sist.
 * @param {string} ut Det sagda, utan blanksteg i kanterna.
 * @param {number | undefined} max
 * @returns {{ varde: string, markor: number, kapat: "nej" | "kapat" | "fullt" | "fickInte" }}
 */
export function skrivInTal(varde, markor, ut, max) {
  const start = markor ? Math.min(Math.max(0, markor.start), varde.length) : varde.length;
  const slut = markor ? Math.min(Math.max(start, markor.slut), varde.length) : varde.length;
  const fore = varde.slice(0, start);
  const efter = varde.slice(slut);
  const fram = fore && !/\s$/.test(fore) ? " " : "";
  const bak = efter && !/^\s/.test(efter) ? " " : "";
  let mitt = `${fram}${ut}${bak}`;
  /** @type {"nej" | "kapat" | "fullt" | "fickInte"} */
  let kapat = "nej";
  if (typeof max === "number" && max >= 0) {
    const plats = Math.max(0, max - fore.length - efter.length);
    if (mitt.length > plats) {
      // ⛔ AVSKILJARNA FÅR ALDRIG SLÄPPAS (andra granskningsvarvet av PR 384, BÖR). En tidigare rättelse släppte mellanslaget före eller
      // efter för att få det sagda att rymmas, och "Hej världen" fick "stora" som "Hej storavärlden" utan besked: en tyst väg
      // (regel 5). Det sagda kapas nu inom det som blir kvar när avskiljarna fått sin plats.
      const rum = plats - fram.length - bak.length;
      const del = rum > 0 ? kapaVidOrd(ut, rum) : "";
      if (del) {
        mitt = `${fram}${del}${bak}`;
        kapat = "kapat";
      } else {
        // Inget kommer in, så inget tas bort heller: en markering står kvar. `fullt` bara när fältet verkligen är fullt.
        return { varde, markor: start, kapat: plats === 0 ? "fullt" : "fickInte" };
      }
    }
  }
  return { varde: `${fore}${mitt}${efter}`, markor: fore.length + mitt.length, kapat };
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
 * @param {boolean | Textfaltstal} [props.tal] (0.104.0) Tal i fältet: en ljudvåg i fältets nedre hörn. Ett tryck visar TALK:s yta med
 *   texten medan den hörs, Klar skriver in det sagda där markören stod (eller sist), och Avbryt ändrar ingenting. Fältet skickar
 *   inget. Se `Textfaltstal` och `TalFalt`. ⛔ Kräver `onChange`: det sagda skrivs in genom den, som allt annat i fältet.
 *   ⛔ PÅ SOM FÖRVAL SEDAN 0.106.0 (#386 skiva 8), när fältet har `onChange` och webbläsaren har taligenkänning (`talForval`).
 *   `tal={false}` stänger av.
 * @param {(plats: HTMLElement | null) => void} [props.bifogaPlats] (0.132.0) En plats i fältets nedre kant, bredvid mikrofonen, för en knapp som bifogar en fil. Ramverket ger platsen (en ref-callback: `useState`s
 *   setter duger) och `OpsFilePicker` med `knappPlats` ritar gemknappen i den. Fältet lämnar plats för knappen (`pe-14`, och `pe-28` med mikrofonen). Utan propen är fältet som förut.
 */
export function OpsTextarea({ value, onChange, placeholder, name, rows = 4, disabled = false, maxLength, ariaLabel, onSend, tal, bifogaPlats }) {
  const f = useFieldBinding();
  const utskrift = useContext(TranskriberingKontext);
  const t = talForval(tal, onChange, false, "OpsTextarea", utskrift);
  if (t) {
    return <TalFalt slag="textarea" f={f} value={value ?? ""} onChange={/** @type {(v: string) => void} */ (onChange)} placeholder={placeholder} name={name} rows={rows} disabled={disabled} maxLength={maxLength} ariaLabel={ariaLabel} onSend={onSend} tal={t} bifogaPlats={bifogaPlats} />;
  }
  const falt = (
    <textarea
      onKeyDown={sendGenvag(onSend)}
      id={f.id}
      className={cx(faltKlass({ invalid: f.invalid }), "resize-y", bifogaPlats && "block pe-14")}
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
  if (!bifogaPlats) return falt;
  return (
    <div className="relative min-w-0">
      {falt}
      {disabled ? null : <div ref={bifogaPlats} data-bifoga-plats="" className="absolute end-3 bottom-0.5" />}
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

/**
 * `OpsTextarea` och `OpsInput` med tal (0.104.0, `OpsInput` och förvalet 0.106.0).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-10-14, med en skärmbild av Skapa app i lifehub.app (ett `OpsTextarea` med "Beskriv appen du vill ha"): "Jag vill gärna ha
 * TALK funktionen även här på skapa app." Talet bodde då bara i chattens skrivfält. Nu är det ramverkets: samma inspelning, samma yta
 * och samma regler (`useRostinmatning`), och den enda skillnaden är vad Klar gör. Chatten skickar, fältet skriver in.
 *
 * ⛔ MIKROFONEN FINNS BARA NÄR DEN KAN GE TEXT: med appens `onTranscribe`, eller med igenkänning som webbläsaren har. En knapp som
 * bara kan ge ett fel är sämre än ingen knapp. Den står i fältets nedre hörn, och fältet har plats för den till höger (`pe-14`), så att
 * texten aldrig går in under den. Den står 12 px från fältets högra kant och inte i hörnet, så att handtaget som ändrar fältets höjd
 * (`resize-y`) fortfarande går att ta i. Fältet är `block`: som `inline-block` stod det på textraden, och rutan runt det blev några pixlar
 * högre än fältet, så att knappen hamnade under fältets nederkant (mätt i `check-skalyta`, avsnitt 45).
 *
 * ⛔ YTAN STÅR I FÄLTETS PLATS MEDAN RÖSTEN ARBETAR, som i chatten. Fältets text ligger kvar orörd hos appen och kommer tillbaka med
 * det sagda inskrivet, eller oförändrad efter Avbryt. Fokus går tillbaka till fältet i båda fallen, med markören efter det inskrivna.
 *
 * ⛔ ETT FÄLT PÅ EN RAD (0.106.0, #386 skiva 8): ljudvågen står vid fältets slut, mitt i höjden, och fältet har plats för den (`pe-12`).
 * Det sagda skrivs in på en rad: radbrytningar i det taltjänsten gav blir mellanslag, eftersom ett `input` inte bär dem.
 *
 * @param {{ slag: "textarea" | "input", f: { id?: string, etikettId?: string, describedBy?: string, invalid: boolean, required: boolean }, value: string, onChange: (v: string) => void, placeholder?: string, name?: string, rows?: number, disabled: boolean, readOnly?: boolean, maxLength?: number, ariaLabel?: string, onSend?: () => void, typ?: string, autoComplete?: string, tal: Textfaltstal, bifogaPlats?: (plats: HTMLElement | null) => void }} props
 */
function TalFalt({ slag, f, value, onChange, placeholder, name, rows, disabled, readOnly = false, maxLength, ariaLabel, onSend, typ, autoComplete, tal, bifogaPlats }) {
  const sprak = useOpsSprak();
  const o = /** @type {Record<keyof typeof ORD_OPSTEXTAREA_TAL, string>} */ (forvalda(ORD_OPSTEXTAREA_TAL, sprak));
  const ruta = useRef(/** @type {HTMLTextAreaElement & HTMLInputElement | null} */ (null));
  const ytaRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const besked = useId();
  /** Markören senast den stod i fältet. `null` tills den gjort det: då hamnar det sagda sist. */
  const markor = useRef(/** @type {{ start: number, slut: number } | null} */ (null));
  /**
   * Var markören ska stå när fältet kommer tillbaka: efter det inskrivna, eller där den stod före Avbryt.
   *
   * ⛔ `varde` ÄR VÄRDET DEN POSITIONEN GÄLLER (0.104.0, granskningen av PR 384, KAN 4). Avvisar appen det inskrivna (värdet blir inte
   * det väntade) läggs markören tillbaka där den stod (`annars`) och inte efter en text som aldrig kom in. Utan det hoppade den fram i
   * en oförändrad text, och positionen låg kvar och kunde läggas när fältet senare växte av något annat.
   *
   * ⛔ INGEN TÖMNING I `onChange` (andra granskningsvarvet av PR 384, KAN 3). Där tömdes positionen vid varje ändring, men det gjorde
   * ingenting: positionen läggs bara när värdet är exakt `varde`, så en avvisad position som ligger kvar läggs aldrig. Den skrivs över
   * nästa gång mikrofonen trycks.
   */
  const tillbakaTill = useRef(/** @type {{ start: number, slut: number, varde?: string, annars?: { start: number, slut: number } | null } | null} */ (null));
  const [kapat, setKapat] = useState(/** @type {"nej" | "kapat" | "fullt" | "fickInte"} */ ("nej"));
  const vardeRef = useRef(value);
  vardeRef.current = value;
  const andraRef = useRef(onChange);
  andraRef.current = onChange;
  const rost = useRostinmatning({
    onTranscribe: tal.onTranscribe,
    inspelare: tal.inspelare,
    igenkanning: tal.igenkanning,
    texter: o,
    onTal: (sagt) => {
      const ut = slag === "input" ? sagt.replace(/\s*[\r\n]+\s*/g, " ").trim() : sagt;
      const r = skrivInTal(vardeRef.current, markor.current, ut, maxLength);
      setKapat(r.kapat);
      tillbakaTill.current = { start: r.markor, slut: r.markor, varde: r.varde, annars: markor.current };
      if (r.varde !== vardeRef.current) andraRef.current(r.varde);
    },
  });
  /** Ger fältet fokus och lägger markören. Värdet kan komma en rendering efter ytan; då läggs markören om när det kommer. */
  const lagg = () => {
    const el = ruta.current;
    const m = tillbakaTill.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    // Värdet kan komma en rendering senare: står det inte där än läggs markören där den stod, och effekten nedan flyttar den när det kommer.
    const dit = m && (m.varde === undefined || el.value === m.varde) ? m : m?.annars;
    if (dit) {
      el.setSelectionRange(Math.min(dit.start, el.value.length), Math.min(dit.slut, el.value.length));
      markor.current = { start: el.selectionStart ?? dit.start, slut: el.selectionEnd ?? dit.slut };
    }
  };
  useRostfokus(rost, ytaRef, lagg);
  useEffect(() => {
    if (!rost.yta && tillbakaTill.current && ruta.current && document.activeElement === ruta.current) {
      const m = tillbakaTill.current;
      if ((m.varde === undefined || ruta.current.value === m.varde) && m.slut <= ruta.current.value.length) {
        ruta.current.setSelectionRange(m.start, m.slut);
        markor.current = { start: m.start, slut: m.slut };
        tillbakaTill.current = null;
      }
    }
  }, [value, rost.yta]);
  /*
   * ⛔ ETT SKRIVSKYDDAT FÄLT FÅR INGEN MIKROFON (granskningen av PR 390). `readOnly` följde inte med hit: `tal={true}` på ett fält med
   * `readOnly` gav ett skrivbart fält, och talknappen skrev in text i det. Utan knapp finns heller ingen väg till talytan.
   */
  const kanGeText = !readOnly && (Boolean(tal.onTranscribe) || rost.medText);
  const kapattext = kapat === "nej" ? "" : o[kapat].replace("{max}", String(maxLength));
  return (
    <div data-textfalt-tal="" className="flex min-w-0 flex-col gap-1">
      {rost.yta ? (
        <Rostyta rost={rost} klarEtikett={o.klar} ytaRef={ytaRef} ram="falt" namn={f.etikettId ? { etikettId: f.etikettId } : ariaLabel ? { text: ariaLabel } : undefined} />
      ) : (
        <div className="relative min-w-0">
          {(() => {
            const egenskaper = {
              ref: ruta,
              onSelect: (/** @type {any} */ e) => {
                const el = /** @type {HTMLTextAreaElement} */ (e.target);
                markor.current = { start: el.selectionStart ?? el.value.length, slut: el.selectionEnd ?? el.value.length };
              },
              id: f.id,
              value,
              onChange: (/** @type {any} */ e) => {
                if (kapat !== "nej") setKapat("nej");
                markor.current = { start: e.target.selectionStart ?? e.target.value.length, slut: e.target.selectionEnd ?? e.target.value.length };
                onChange(e.target.value);
              },
              placeholder,
              name,
              disabled,
              readOnly,
              maxLength,
              required: f.required || undefined,
              "aria-label": ariaLabel,
              "aria-invalid": f.invalid || undefined,
              "aria-describedby": cx(f.describedBy, kapattext && besked) || undefined,
            };
            return slag === "input" ? (
              <input {...egenskaper} type={typ ?? "text"} autoComplete={autoComplete} className={cx(faltKlass({ invalid: f.invalid }), "block", kanGeText && "pe-12")} />
            ) : (
              <textarea {...egenskaper} onKeyDown={sendGenvag(onSend)} rows={rows} className={cx(faltKlass({ invalid: f.invalid }), "block resize-y", kanGeText && bifogaPlats ? "pe-28" : (kanGeText || bifogaPlats) && "pe-14")} />
            );
          })()}
          {kanGeText && !disabled ? (
            <Mikrofonknapp
              lage={rost.lage}
              etikett={o.prataIn}
              placering={slag === "input" ? "rad-falt" : "falt"}
              onClick={() => {
                setKapat("nej");
                tillbakaTill.current = markor.current;
                rost.starta();
              }}
            />
          ) : null}
          {/* Bifogaplatsen (0.132.0): gemknappen bredvid mikrofonen, eller längst ut när fältet saknar mikrofon. Fältet är skrivbart, annars finns ingen att bifoga till. */}
          {bifogaPlats && !disabled && !readOnly ? <div ref={bifogaPlats} data-bifoga-plats="" className={cx("absolute bottom-0.5", kanGeText ? "end-15" : "end-3")} /> : null}
        </div>
      )}
      {/* ⛔ STATUSRADEN FINNS HELA TIDEN OCH BYTER TEXT (samma skäl som TALK:s, 0.97.0): en region som föds med innehåll läses inte
          alltid upp. Tom är den dold. */}
      <p id={besked} role="status" aria-live="polite" data-tal-kapat={kapat === "nej" ? undefined : kapat} className={kapattext ? "m-0 text-hjalp text-ink-muted" : "sr-only"}>
        {kapattext}
      </p>
    </div>
  );
}
