import { useState } from "react";
import { useKallor } from "../data/useKallor.jsx";
import { OpsView, OpsViewHeader } from "./OpsView.jsx";
import { OpsField, OpsInput } from "./OpsField.jsx";
import { OpsList, OpsListRow } from "./OpsList.jsx";
import { OpsEmpty } from "./OpsEmpty.jsx";
import { OpsBanner } from "./OpsBanner.jsx";
import { OpsSpinner } from "./OpsSpinner.jsx";
import { OpsPill } from "./OpsPill.jsx";

/**
 * Sök: ett fält, och modulernas träffar.
 *
 * ══ ⛔ RAMVERKET INDEXERAR INTE (#140) ═════════════════════════════════
 *
 * Ingen egen sökmotor, inget index. Ramverket frågar källorna och visar vad de
 * ger. Hur en modul söker är modulens sak, och den vet något ramverket inte
 * vet: vad dess data betyder. Ett index här hade dessutom varit en andra kopia
 * av modulens data, alltså något att hålla i takt.
 *
 * ⛔ TOMHET ÄR ETT SVAR MED SIN FRÅGA I. "Inga träffar" utan sökordet lämnar
 * läsaren att undra om fältet ens lästes. "Inga träffar för fakura" visar
 * dessutom stavfelet, vilket är den vanligaste orsaken till noll träffar.
 *
 * ⛔ INGEN SÖKNING FÖRE FÖRSTA TECKNET. Ett tomt fält är inte en fråga, och en
 * modul som får en tom söksträng skulle rimligen svara med allt den har. Det
 * är inte ett sökresultat, det är en lista som ser ut som ett.
 */

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../lib/kallor.js").skapaKallregister> | null} props.register
 * @param {{ groupId: string }} props.grupp ⛔ Gruppen vars källor frågas.
 * @param {(href: string) => void} [props.onOppna]
 * @param {string} [props.rubrik]
 * @param {string} [props.faltEtikett]
 * @param {string} [props.platshallare]
 * @param {string} [props.borjaText] Innan något skrivits.
 * @param {(text: string) => string} [props.ingaTraffarText]
 * @param {Record<string, string>} [props.modulnamn] Modul-id till visningsnamn.
 */
export function OpsSok({
  register,
  grupp,
  onOppna,
  rubrik = "Sök",
  faltEtikett = "Sök",
  platshallare = "Skriv för att söka",
  borjaText = "Skriv något för att söka.",
  ingaTraffarText = (text) => `Inga träffar för "${text}".`,
  modulnamn = {},
}) {
  const [text, setText] = useState("");
  const fraga = text.trim();

  /*
   * ⛔ FRÅGAN SKICKAS BARA NÄR DET FINNS EN. `useKallor` anropas ändå på varje
   * rendering, eftersom en hook inte får hoppas över, så tomheten hanteras
   * med en fråga som registret aldrig ser: utan `register` hämtar hooken inte.
   */
  const { rader, laddar, fel } = useKallor(fraga ? register : null, "sok", { ...grupp, text: fraga });

  /** @type {Map<string, Record<string, any>[]>} */
  const perModul = new Map();
  for (const rad of rader) {
    const lista = perModul.get(rad.modulId) ?? [];
    lista.push(rad);
    perModul.set(rad.modulId, lista);
  }

  return (
    <OpsView>
      <OpsViewHeader title={rubrik} />
      <OpsField label={faltEtikett}>
        <OpsInput value={text} onChange={setText} type="search" placeholder={platshallare} />
      </OpsField>

      {!fraga ? <OpsEmpty title={borjaText} /> : null}
      {fraga && fel ? <OpsBanner tone="danger" title="Sökningen gick inte att genomföra">{fel.message}</OpsBanner> : null}
      {fraga && !fel && laddar ? <OpsSpinner label="Söker" /> : null}
      {fraga && !fel && !laddar && rader.length === 0 ? <OpsEmpty title={ingaTraffarText(fraga)} /> : null}

      {/*
        ⛔ GRUPPERAT PER MODUL, inte en lång lista. Två träffar med samma titel
        ur olika moduler betyder olika saker, och utan avsändaren måste läsaren
        öppna båda för att se vilken som var rätt.
      */}
      {[...perModul.entries()].map(([modulId, traffar]) => (
        <section key={modulId}>
          <OpsList divided ariaLabel={modulnamn[modulId] ?? modulId}>
            {traffar.map((t) => (
              <OpsListRow key={`${modulId}-${t.id}`} interactive={Boolean(t.href && onOppna)} onClick={t.href && onOppna ? () => onOppna(t.href) : undefined}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{t.titel}</span>
                  {t.text ? <span className="block truncate text-etikett text-ink-secondary">{t.text}</span> : null}
                </span>
                <OpsPill tone="neutral">{modulnamn[modulId] ?? modulId}</OpsPill>
              </OpsListRow>
            ))}
          </OpsList>
        </section>
      ))}
    </OpsView>
  );
}
