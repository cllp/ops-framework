/**
 * Loggpunkten: ett fel försvinner aldrig tyst (#159).
 *
 * ══ ⛔ VARFÖR DEN FINNS ═══════════════════════════════════════════════════
 *
 * CP: "Skall Sentry vara default eller optional i framework?" Architects
 * rekommendation, CP:s svar "Allt perfekt": VALFRITT, MEN FÄRDIGKOPPLAT.
 * Ramverket känner inga externa konton (samma princip som samlingsnamnen och
 * bucketnamnet: appen skickar in dem), men det som alltid ska gälla, med
 * eller utan ett sådant konto, är att ett fel aldrig försvinner utan ett
 * ljud. Arbetsreglernas punkt 5: en tyst nedsläppsväg är värre än ett fel.
 *
 * ══ ⛔ `console.error` ÄR INTE ETT FÖRVAL SOM VÄNTAR PÅ NÅGOT BÄTTRE ══════
 *
 * Det är den GARANTERADE golvet. Utan en mottagare, i VARJE miljö (utveckling
 * OCH produktion), skrivs felet till konsolen. En app som aldrig kopplar in
 * något får ändå ett spår: den som öppnar utvecklarverktygen på en klagande
 * kunds dator ser felet, i stället för att gissa.
 *
 * ══ ⛔ MOTTAGAREN ÄR ETT KONTRAKT, INTE EN SDK ═══════════════════════════
 *
 * `Felmottagare` är formen `{ fanga, satt }`, ingenting mer. Ramverket
 * importerar ingen felrapporteringstjänst i sin kärna, precis som det inte
 * importerar Firebase eller Postgres. `sentryMottagare` (egen ingång,
 * `ops-framework/sentry`) är EN implementation av kontraktet; en app
 * som vill använda en annan tjänst skriver sin egen på samma form.
 *
 * ⛔ `satt` TAR UID OCH GROUPID, ALDRIG E-POST. E-posten är personlig
 * information som inte behövs för att koppla ett fel till en person eller en
 * grupp, och att skicka den vidare till ett tredjepartskonto ramverket inte
 * äger är precis den sortens läcka en policy ska förhindra, inte möjliggöra.
 */

/**
 * @typedef {object} Felmottagare
 * @property {(fel: unknown, sammanhang?: Record<string, unknown>) => void} fanga
 * @property {(anvandare: { uid: string, groupId?: string } | null) => void} satt
 */

/**
 * Rapporterar ett fel. Skriver ALLTID till konsolen, och vidarebefordrar
 * ALLTID till mottagaren när en sådan finns.
 *
 * ⛔ SKRIVER TILL KONSOLEN ÄVEN NÄR EN MOTTAGARE FINNS, och det är medvetet.
 * En loggpunkt som bara pratar med mottagaren gör felsökning UTAN nätverk
 * (offline, en trasig DSN, en blockerad tredjepartsdomän) omöjlig: den enda
 * platsen felet syns är i ett konto ingen kan nå just då. Konsolen kostar
 * ingenting extra och är alltid tillgänglig.
 *
 * ⛔ KASTAR ALDRIG SJÄLV. En loggpunkt som kan kasta kan sänka det jobb den
 * loggar, exakt samma regel som `createActivityWriter`. Ett fel i mottagaren
 * fångas och skrivs till konsolen i stället, det tystas inte.
 *
 * @param {unknown} fel
 * @param {Record<string, unknown>} [sammanhang]
 * @param {Felmottagare | null | undefined} [felmottagare]
 */
export function rapporteraFel(fel, sammanhang, felmottagare) {
  // eslint-disable-next-line no-console -- det HÄR är loggpunkten. Se filhuvudet.
  console.error("ops-framework:", fel, sammanhang ?? {});
  if (!felmottagare || typeof felmottagare.fanga !== "function") return;
  try {
    felmottagare.fanga(fel, sammanhang);
  } catch (mottagarfel) {
    // eslint-disable-next-line no-console
    console.error("ops-framework: felmottagaren själv kastade", mottagarfel);
  }
}
