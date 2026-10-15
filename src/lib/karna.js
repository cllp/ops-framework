/**
 * Kärnmoduler: appar som hör till ramverket och alltid finns i varje grupp (0.106.0, #386 skiva 1).
 *
 * ══ ⛔ VARFÖR (CP 2026-10-14) ═════════════════════════════════════════════════════════════════════════════════════
 *
 * "En sak om chatten/meddelanden. Den måste ju alltid följa med ramverket, blir inget man måste installera. Finns alltid med
 * då den är en grundfunktion som vilar på den." Meddelanden bär agenten, TALK:s Agent och agentens förslag. Före 0.106.0
 * var den en modul bland andra: en ägare kunde avinstallera den i Redigera grupp och i appens inställningar, och LifeHub
 * höll den på plats med en egen förvalsregel (`meddelandenForval.js`) som skrev märken i `huvudmeny` för att skilja "aldrig
 * påslagen" från "avinstallerad med flit".
 *
 * ══ ⛔ EN EGENSKAP I MANIFESTET, OCH LÄSNINGEN LÄGGER TILLBAKA DEN ═══════════════════════════════════════════════════
 *
 * `karna: true` i `defineModule`. Ramverket respekterar den på varje ställe där en grupps `moduler` läses: en kärnmodul
 * räknas alltid som installerad (`medKarna`), den står aldrig bland det som kan installeras eller tas bort, och en sparad
 * lista som saknar den får tillbaka den när den läses.
 *
 * ⛔ LÄGGS TILL VID LÄSNING, INTE MED EN MIGRERING. En grupp som sparats utan Meddelanden (en äldre grupp, eller en ägare
 * som avinstallerade den före 0.106.0) har ingen rad att rätta: listan läses med kärnan. Nästa gång ägaren sparar
 * ordningen eller gruppen skrivs den med, eftersom vyerna sparar det de läste. Ingen andra lista över vad som är på
 * (regel 2): `moduler` är fortfarande den enda, och kärnan är en egenskap hos modulen, inte hos gruppen.
 *
 * ⛔ SIST, NÄR DEN SAKNAS. En kärnmodul som saknas läggs efter de andra, i registrets ordning: samma plats som en app som
 * slås på (`sattModul`). Står den redan i listan står den kvar där ägaren ställt den. (bedömning) Först hade flyttat
 * varje grupps första app ett steg utan att någon bett om det.
 *
 * ⛔ INGA BEROENDEN. Filen läses av `modul.js`, `hubb.js`, `apparark.js`, `tillagg.js` och vyerna, och `modul.js` läser
 * `tillagg.js`. En import åt andra hållet hade gett en cirkel.
 */

/**
 * Sant när modulen är en kärnmodul.
 * @param {{ karna?: boolean } | null | undefined} m
 */
export function arKarna(m) {
  return Boolean(m && m.karna === true);
}

/**
 * Id:na på appens kärnmoduler, i registrets ordning.
 * @param {ReadonlyArray<{ id: string, karna?: boolean }> | null | undefined} moduler
 * @returns {string[]}
 */
export function karnmoduler(moduler) {
  return (moduler ?? []).filter(arKarna).map((m) => m.id);
}

/**
 * En grupps `moduler` med kärnmodulerna: listan som den står, och de kärnmoduler som saknas sist.
 *
 * ⛔ DET HÄR ÄR LÄSVÄGEN. Varje ställe i ramverket som frågar "vilka appar har gruppen?" går genom den, så att svaret är
 * detsamma i hubben, arket, huvudmenyn, hjälpen, tilläggen, navigationen och inställningarna.
 *
 * @param {ReadonlyArray<string> | null | undefined} ids Gruppens `moduler`.
 * @param {ReadonlyArray<{ id: string, karna?: boolean }> | null | undefined} moduler Appens registrerade moduler.
 * @returns {string[]}
 */
export function medKarna(ids, moduler) {
  const lista = Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  const saknas = karnmoduler(moduler).filter((id) => !lista.includes(id));
  return saknas.length ? [...lista, ...saknas] : [...lista];
}
