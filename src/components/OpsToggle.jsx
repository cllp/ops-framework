import { useId } from "react";
import { cx } from "../lib/cx.js";
import { BockIkon } from "./icons.jsx";

/**
 * Kryssruta och reglage.
 *
 * ⛔ Båda bygger på en riktig `<input type="checkbox">`, som ligger kvar i
 * DOM:en och bara är visuellt dold. Ett `<div>` med `role="checkbox"` måste
 * annars återimplementera fokus, mellanslagstangenten, formulärinlämning och
 * webbläsarens autofyll, och det blir fel på minst ett av fyra sätt varje gång.
 *
 * `sr-only` och inte `display: none`: ett gömt fält med `display: none` går
 * inte att fokusera och skickas inte med i formuläret.
 *
 * ⛔ Skillnaden mellan de två är BETYDELSE, inte utseende. En kryssruta väljer
 * något som träder i kraft när man sparar. Ett reglage slår om något direkt.
 * Använder man reglage för det första undrar användaren varför inget hände.
 *
 * ⛔ TRÄFFYTAN ÄR RADEN, INTE RUTAN, och raden är 44 px på telefon.
 *
 * Rutan är 20 px och reglaget 24. Båda är långt under den minsta yta en tumme
 * träffar pålitligt, och det går inte att lösa genom att rita dem större: då
 * blir de klumpiga på skrivbordet, där en muspekare är exakt.
 *
 * Lösningen är att `<label>` omsluter både rutan och texten, så hela raden är
 * klickbar, och att raden får ett höjdgolv på telefon. På `md` och uppåt släpps
 * golvet så att ett formulär med tio kryssrutor inte blir en halv skärm luft.
 * Samma uppdelning som datumväljarens dagknappar redan använder.
 *
 * Utan golvet var felet det tystaste som finns: allt fungerar, men var femte
 * tryckning missar, och användaren tror att appen hänger sig.
 */

/** @param {{ label: string, checked: boolean, onChange: (v: boolean) => void, disabled?: boolean, hint?: string }} props */
export function OpsCheckbox({ label, checked, onChange, disabled = false, hint }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={cx("flex min-h-11 cursor-pointer items-center gap-2 text-base text-ink md:min-h-0", disabled && "cursor-not-allowed opacity-55")}
      >
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden="true"
          className={cx(
            // ⛔ 0.31.0: 18 px och 1,5 px kant, SS `forms/Checkbox.jsx:47` (`w-[18px] h-[18px] border-[1.5px]`). Var 20 px och 1 px.
            "inline-flex size-4.5 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-line-strong bg-surface text-accent-contrast",
            "peer-checked:border-accent peer-checked:bg-accent",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          )}
        >
          {checked ? <BockIkon size={14} /> : null}
        </span>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="pl-7 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** @param {{ label: string, checked: boolean, onChange: (v: boolean) => void, disabled?: boolean, hint?: string }} props */
export function OpsSwitch({ label, checked, onChange, disabled = false, hint }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={cx("flex min-h-11 cursor-pointer items-center gap-3 text-base text-ink md:min-h-0", disabled && "cursor-not-allowed opacity-55")}
      >
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden="true"
          className={cx(
            /*
             * ⛔ SPÅRET HAR EN KANT, OCH DET ÄR DÄRFÖR DET SYNS ALLS.
             *
             * CP 2026-09-26, med bild från mobilen i mörkt läge: "Går ej att se
             * kontrast på toggle". Mätt mot tokens, och det gällde BÅDA temana:
             *
             *   mörkt: spår av (sunken #1f1f25) mot panelen (raised #1f1f28)  1,00:1
             *   ljust: spår av (sunken #f0ede8) mot panelen (raised #ffffff)  1,17:1
             *
             * Fyllningen KAN inte bära kravet: `sunken` är per definition en
             * yta som ligger nära den den vilar på. Kanten bär det i stället,
             * och `ink-secondary` ger 9,47:1 i ljust och 5,10:1 i mörkt.
             *
             * ⛔ KANTEN SITTER KVAR I BÅDA LÄGENA. Bara i av-läget hade gjort
             * själva kanten till en lägesmarkör, alltså en andra signal som
             * säger samma sak som knoppens position, och en kontroll som byter
             * form mellan lägen är svårare att känna igen än en som byter färg.
             * I på-läget behövs den dessutom: `accent` mot `raised` ger 2,99:1
             * i ljust, alltså strax under 3.
             */
            "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-ink-secondary bg-sunken",
            "transition-colors duration-(--duration-fast) ease-standard",
            "peer-checked:bg-accent",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          )}
        >
          <span
            className={cx(
              /*
               * ⛔ KNOPPEN HAR OCKSÅ EN KANT, av samma skäl. `bg-canvas` mot
               * `bg-sunken` är 1,14:1 i mörkt och 1,09:1 i ljust, alltså samma
               * färg i praktiken. Det var det CP faktiskt såg: inte en knopp
               * som var svår att se, utan en knopp som inte fanns.
               *
               * ⛔ FYLLNINGEN ÄR `raised` OCH INTE `canvas`. Knoppen ska läsas
               * som något som ligger OVANPÅ spåret, och `raised` är tokenet för
               * just det. Det ger dessutom 12,46:1 mot `accent` i mörkt läge,
               * vilket är det enda paret där kanten inte räcker (2,44:1).
               *
               * ⛔ OCH LÄGET AVGÖRS INTE AV FÄRG ENSAM (WCAG 1.4.1). Knoppen
               * flyttar sig fyra steg i sidled, och den rörelsen är hela
               * skillnaden för den som inte skiljer tonerna åt.
               */
              "absolute left-0.5 size-5 rounded-full border border-ink-secondary bg-raised shadow-sm",
              "transition-transform duration-(--duration-fast) ease-standard",
              checked && "translate-x-4",
            )}
          />
        </span>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="pl-13 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
