import { createContext, useContext, useEffect } from "react";

/**
 * Vad ett formulär i skapa-panelen säger om sin egen väntan (0.129.0, cllp/lifehub.app#365).
 *
 * ══ ⛔ VARFÖR DET FINNS ═════════════════════════════════════════════════════════════════════════════════
 *
 * Panelens `Spara` är skalets (`type="submit" form={formId}`) och formuläret är appens eller ramverkets, så knappen kan inte se när
 * formuläret väntar: formulärets `onSubmit` är async och ger knappen inget löfte att läsa. CP 2026-10-19: "Det tar tid att skapa grupp och
 * ingen progress. ... Alla områden som handlar om att användaren skall vänta måste ha en progress." Läst i koden före 0.129.0 (`OpsGruppFormular`
 * och `OpsSkapaPanel`, inte mätt i en webbläsare): när "Ny grupp" sparades låstes fälten och en rad "Sparar" skrevs längst ned i formuläret,
 * men knappen, som är det blicken ligger på, var orörd och såg tryckbar ut, och raden kan i ett långt formulär ligga under det synliga.
 *
 * ⛔ FORMULÄRET RAPPORTERAR, PANELEN RITAR. Raden och snurran är panelens (en plats, så alla formulär får samma besked), men texten är
 * formulärets, eftersom bara det vet vad som pågår. Panelen gissar ingen text.
 *
 * ⛔ TEXTEN FÅR BARA SÄGA DET FORMULÄRET VET. Ingen procent, ingen "steg 2 av 4": ramverket ser bara att anropet gick iväg och att det
 * svarade, inte vad servern gör emellan (regel 3). Se CHANGELOG 0.129.0 om vad som mättes.
 *
 * ⛔ UTANFÖR EN PANEL GÖR ANROPET INGENTING. Ett formulär som ritas för sig (utan `OpsSkapaPanel`) har ingen att rapportera till och behåller
 * sin egen statusrad.
 *
 * @typedef {{ text: string } | null} SkapaStatus Väntar formuläret: texten som panelen skriver. Väntar det inte: `null`.
 */

/** @type {import("react").Context<((status: SkapaStatus) => void) | null>} */
export const SkapaPanelStatusKontext = createContext(/** @type {((status: SkapaStatus) => void) | null} */ (null));

/**
 * Formuläret säger att det är KLART till panelen (0.153.0, cllp/ops-framework#460 punkt 4, lifehub.app QA-fynd 12c).
 *
 * ══ ⛔ VARFÖR DET FINNS ═════════════════════════════════════════════════════════════════════════════════
 *
 * Panelens `Spara` och `Avbryt` är skalets och sitter fast längst ned. Väntan rapporterades (`useSkapaPanelStatus`), men inte att det var klart: när Nytt ärende hade sparat ritade formuläret ett kvitto med
 * "Lägg in en till", och panelens knappar stod kvar under det. `Spara` på ett kvitto sparar ingenting (eller en dubblett), och `Avbryt` på något som redan skapats är ett ord för något som inte går att avbryta.
 * QA-fynd 12c: "Panelens fasta Spara/Avbryt står kvar i kvittoläget."
 *
 * ⛔ KLART DÖLJER HELA KNAPPRADEN, OCH INGET ANNAT. Vägen ut är kvar: `Tillbaka` högst upp i panelen, och kvittot bär sina egna val. Formuläret rapporterar `false` igen när det startar om ("Lägg in en till"), och
 * knapparna kommer tillbaka. Utanför en panel gör anropet ingenting, som `useSkapaPanelStatus`.
 *
 * @type {import("react").Context<((klar: boolean) => void) | null>}
 */
export const SkapaPanelKlarKontext = createContext(/** @type {((klar: boolean) => void) | null} */ (null));

/**
 * Formuläret rapporterar sin väntan till panelen medan `vantar` är sant, och tar tillbaka rapporten när den inte är det eller när formuläret försvinner.
 *
 * @param {boolean} vantar
 * @param {string} text Det panelen skriver intill knappen medan formuläret väntar.
 * @returns {boolean} Sant när en panel tar emot rapporten, så att formuläret inte skriver samma besked en gång till.
 */
export function useSkapaPanelStatus(vantar, text) {
  const rapportera = useContext(SkapaPanelStatusKontext);
  useEffect(() => {
    if (!rapportera) return undefined;
    rapportera(vantar ? { text } : null);
    return () => rapportera(null);
  }, [rapportera, vantar, text]);
  return rapportera !== null;
}

/**
 * Formuläret rapporterar till panelen att det är klart medan `klar` är sant, och tar tillbaka rapporten när det inte är det eller när formuläret försvinner.
 *
 * @param {boolean} klar Sant när formuläret visar sitt kvitto och inte längre går att spara.
 * @returns {boolean} Sant när en panel tar emot rapporten.
 */
export function useSkapaPanelKlar(klar) {
  const rapportera = useContext(SkapaPanelKlarKontext);
  useEffect(() => {
    if (!rapportera) return undefined;
    rapportera(klar === true);
    return () => rapportera(false);
  }, [rapportera, klar]);
  return rapportera !== null;
}
