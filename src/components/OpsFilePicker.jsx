import { useEffect, useId, useRef, useState } from "react";
import { isImage as arBildtyp, attachmentSize, readAttachment } from "../lib/file.js";
import { OpsButton } from "./OpsButton.jsx";
import { FilIkon, GemIkon } from "./icons.jsx";

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
 * @param {object} props
 * @param {import("../lib/file.js").Bilaga | null} props.value
 * @param {(attachment: import("../lib/file.js").Bilaga | null) => void} props.onChange
 * @param {number} props.maxChars Tak för data-URL:en i tecken. Plattformen äger talet: ramverket vet inte vad den lagrar i.
 * @param {string} [props.accept] Vad filväljaren erbjuder. ⛔ Ett filter, aldrig ett skydd: en fil kan alltid dras in eller klistras in ändå.
 * @param {boolean} [props.paste] Ta emot inklistrade filer. Av när två väljare delar yta.
 * @param {string} [props.ariaLabel] Vad som ska bifogas, för den som inte ser knappen.
 * @param {{ select?: string, byt?: string, remove?: string, klistra?: string }} [props.labels]
 */
export function OpsFilePicker({
  value,
  onChange,
  maxChars,
  accept,
  paste = true,
  ariaLabel = "Bifoga fil",
  labels = {},
}) {
  const filRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [error, setError] = useState("");
  const [reading, setLaser] = useState(false);
  const errorId = useId();

  if (!Number.isFinite(maxChars) || maxChars <= 0) {
    throw new Error(
      `OpsFilePicker: maxChars måste vara ett positivt tal, fick ${maxChars}. Utan tak skrivs filen till en lagring som avvisar den, och avslaget når användaren som "kunde inte spara".`,
    );
  }

  const ta = async (/** @type {File | Blob | null} */ file) => {
    if (!file) return;
    setError("");
    setLaser(true);
    try {
      onChange(await readAttachment(file, { maxChars: maxChars }));
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
  }, [paste, maxChars]);

  const isImage = Boolean(value && arBildtyp(value.typ));

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
        <OpsButton variant="secondary" onClick={() => filRef.current?.click()} disabled={reading}>
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
          <span className="hidden items-center gap-1 text-sm text-ink-muted sm:inline-flex">
            <GemIkon />
            {labels.klistra ?? "eller klistra in en skärmbild"}
          </span>
        ) : null}
      </div>

      {/* ⛔ `role="alert"` så orsaken LÄSES UPP. En röd rad som bara syns lämnar
          den som inte ser skärmen med en knapp som inte gjorde något. */}
      {error ? (
        <p id={errorId} role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {value ? (
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
          <figcaption className="mt-1 text-sm text-ink-muted">
            {isImage && value.bredd ? `${value.bredd} × ${value.hojd} px · ` : ""}
            {attachmentSize(value.tecken)}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
