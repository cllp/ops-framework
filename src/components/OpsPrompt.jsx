import { useState } from "react";
import { OpsButton } from "./OpsButton.jsx";
import { OpsField, OpsTextarea } from "./OpsField.jsx";
import { OpsMarkdown } from "./OpsMarkdown.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";

/**
 * Promptruta: en fråga in, ett svar ut.
 *
 * ── ⛔ VAD SOM ÄR RAMVERKETS OCH VAD SOM ÄR APPENS ──────────────────────
 *
 * Ramverket äger rutan, väntetillståndet, felplatsen och hur svaret ritas.
 * Appen äger vad som frågas, vilken modell som svarar och vad som får skickas
 * med. Gränsen går vid `createPromptSource` (se `lib/prompt.js`), och den här
 * komponenten vet inte vilken leverantör som ligger bakom.
 *
 * ── ⛔ SVARET RENDERAS SOM MARKDOWN, INTE SOM TEXT ─────────────────────
 *
 * En modell svarar i markdown, alltid, om man inte ber den låta bli. Renderas
 * det som ren text får läsaren `## Rubrik` och `- punkt` rakt av, vilket är
 * precis det fel bolag-ops #249 finns för. `OpsMarkdown` gör ingen HTML av en
 * sträng och länkar bara http och https, så ett svar kan inte köra kod.
 *
 * ── ⛔ FEL VISAS DÄR MAN KAN GÖRA NÅGOT ÅT DEM ─────────────────────────
 *
 * Ett fel som "frågan är för lång" hör till fältet, och det är `OpsField`s
 * jobb. Ett fel som "anropet gick sönder" hör till svarsytan, eftersom det är
 * där man väntade på något. Blandas de två får man en banner som säger "något
 * gick fel" och en användare som får gissa vilket.
 *
 * ── ⛔ FÖRRA SVARET LIGGER KVAR TILLS ETT NYTT KOMMER ──────────────────
 *
 * Tömdes ytan när man trycker skicka skulle skärmen blinka till tomhet, och en
 * sida som töms ser ut att ha tappat bort sig. Svaret byts ut när det nya är
 * framme, och under tiden står en snurra bredvid knappen.
 *
 * ⛔ Går anropet sönder står förra svaret KVAR under felet. Det som stod där
 * var sant innan, och att kasta bort det straffar användaren för ett fel som
 * inte var hens.
 */

/**
 * @param {object} props
 * @param {import("../lib/prompt.js").Promptkalla} props.source Från `createPromptSource`.
 * @param {string} props.label Vad rutan frågar om. ⛔ Krävs: ett fält utan etikett är
 *   osynligt för skärmläsaren, och en promptruta utan ämne är en tom uppmaning.
 * @param {string} [props.hint] En rad om vad rutan kan svara på.
 * @param {string} [props.placeholder]
 * @param {any} [props.sammanhang] Skickas med varje fråga, ogenomskinligt för ramverket.
 * @param {string} [props.skickaLabel]
 * @param {string} [props.waitingLabel] Vad snurran säger. Läses upp, syns inte.
 * @param {string[]} [props.forslag] Färdiga frågor att trycka på. ⛔ De SKRIVS IN i fältet
 *   och skickas inte direkt: ett förslag som skickar sig självt gör ett klick till ett anrop
 *   man inte hann läsa, och man kan inte längre ändra ett ord innan man frågar.
 * @param {(svar: import("../lib/prompt.js").Promptsvar) => void} [props.onSvar] Anropas när ett
 *   svar kommit. Appen kan logga tokens där, ramverket gör det aldrig.
 */
export function OpsPrompt({
  source,
  label,
  hint,
  placeholder,
  sammanhang,
  skickaLabel = "Fråga",
  waitingLabel = "Väntar på svar",
  forslag = [],
  onSvar,
}) {
  if (!source || typeof source.fraga !== "function") {
    throw new Error(
      "OpsPrompt: kalla måste komma från createPromptSource. Utan den vet rutan inte var frågan ska skickas, och det syns först när någon trycker.",
    );
  }
  if (!label) {
    throw new Error("OpsPrompt: label krävs. Ett fält utan etikett är osynligt för skärmläsaren.");
  }

  const [text, setText] = useState("");
  const [vantar, setVantar] = useState(false);
  const [svar, setSvar] = useState(/** @type {import("../lib/prompt.js").Promptsvar | null} */ (null));
  const [faltfel, setFaltfel] = useState("");
  const [svarsfel, setSvarsfel] = useState("");

  const fraga = async () => {
    // ⛔ Dubbeltryck ignoreras här och inte bara genom en avstängd knapp:
    // Enter i fältet går förbi knappen, och två anrop för samma fråga är två
    // fakturor för ett svar.
    if (vantar) return;

    setFaltfel("");
    setSvarsfel("");
    setVantar(true);
    try {
      const nytt = await source.fraga({ prompt: text, sammanhang });
      setSvar(nytt);
      onSvar?.(nytt);
    } catch (error) {
      const meddelande = error instanceof Error ? error.message : String(error);
      // ⛔ Längdfel och tomhet hör till FÄLTET, resten till svarsytan. Källan
      // kastar båda sorterna, och skillnaden är om användaren kan rätta det
      // själv där hen står.
      if (/Skriv en fråga|tecken/.test(meddelande)) setFaltfel(meddelande);
      else setSvarsfel(meddelande);
    } finally {
      setVantar(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <OpsField label={label} hint={hint} error={faltfel || undefined}>
        <OpsTextarea
          value={text}
          onChange={setText}
          /*
           * ⛔ GENVÄGEN GÅR FÖRBI KNAPPEN, och det är skälet till att `fraga`
           * har en egen vakt mot dubbelkörning. Mutationsprovet visade att
           * vakten var ONÅBAR innan genvägen fanns: kommentaren påstod att
           * Enter gick förbi knappen, men ingen tangenthanterare existerade.
           * En vakt som inte går att nå är inte en vakt, den är en kommentar.
           */
          onSkicka={fraga}
          placeholder={placeholder}
          rows={3}
          disabled={vantar}
          maxLength={source.maxTecken}
        />
      </OpsField>

      {forslag.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {forslag.map((f) => (
            <OpsButton key={f} variant="secondary" size="sm" onClick={() => setText(f)} disabled={vantar}>
              {f}
            </OpsButton>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <OpsButton onClick={fraga} disabled={vantar || text.trim().length === 0}>
          {skickaLabel}
        </OpsButton>
        {/* ⛔ Snurran står BREDVID knappen och inte i den. En knapp som byter
            innehåll till en snurra ändrar bredd, och raden under hoppar. */}
        {vantar ? <OpsSpinner size="sm" tone="muted" label={waitingLabel} /> : null}
      </div>

      {svarsfel ? (
        <p className="m-0 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          {svarsfel}
        </p>
      ) : null}

      {svar ? (
        <div aria-busy={vantar || undefined} aria-live="polite">
          <OpsMarkdown text={svar.text} />
        </div>
      ) : null}
    </div>
  );
}
