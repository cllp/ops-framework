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
 * @property {(fel: unknown, sammanhang?: Record<string, unknown>) => void | Promise<unknown>} fanga ⛔ (0.107.0) Skriver mottagaren
 *   asynkront ska den RETURNERA löftet: medan det inte avgjorts, högst `FELMOTTAGARE_HALL_MS`, går ett nytt fel bara till konsolen,
 *   inte tillbaka hit. Se
 *   `rapporteraFel` och "EN MOTTAGARE SOM RAPPORTERAR SINA EGNA FEL".
 * @property {(anvandare: { uid: string, groupId?: string } | null) => void} satt
 */

/**
 * ══ ⛔ EN MOTTAGARE SOM RAPPORTERAR SINA EGNA FEL (granskningen av PR 392, BÖR 1) ══
 *
 * Med en förvald mottagare når ett `rapporteraFel` utan tredje argument
 * mottagaren, också när det anropas inifrån mottagaren själv. Mätt av
 * granskaren: en `fanga` som anropade `rapporteraFel` gav 3 809 anrop av
 * `fanga` för ett enda fel, tills stacken tog slut. Den asynkrona formen är
 * husets vanliga mönster och loopar utan slut: `fanga(fel) { return
 * addDoc(...).catch((e) => rapporteraFel(e)) }`, där en skrivning som nekas
 * (reglerna ännu inte deployade) ger ett nytt fel som skrivs, som nekas.
 *
 * Därför: medan en mottagare hanterar ett fel går ett nytt fel till samma
 * mottagare bara till konsolen. "Hanterar" är medan `fanga` körs, och om den
 * lämnar ett löfte, tills löftet avgjorts. ⛔ GRÄNSEN: en `fanga` som startar
 * en skrivning utan att returnera löftet kan ramverket inte se, och då skyddas
 * den inte. Därför ska en asynkron mottagare returnera sitt löfte.
 *
 * ⛔ HÅLLET HAR ETT TAK, `FELMOTTAGARE_HALL_MS` (granskningen av PR 392 varv 2,
 * MÅSTE 1). Utan tak låste ett löfte som aldrig avgörs mottagaren för resten
 * av sidans liv, och det är det vanliga fallet för en skrivning utan nät:
 * `addDoc` löser sig först när servern kvitterat. Då hade varje senare fel,
 * också TALK:s diagnos, bara gått till konsolen, just när det är svårast att
 * mäta på annat sätt. Taket bryter ändå loopen: mottagarens `.catch` körs
 * innan dess löfte avgörs, alltså medan hållet står.
 */

/** Längsta tid en mottagare hålls medan löftet från `fanga` inte avgjorts. */
export const FELMOTTAGARE_HALL_MS = 5000;

/** Mottagare som hanterar ett fel, med en egen post per håll. @type {Map<Felmottagare, object>} */
const hallna = new Map();
/**
 * Håller mottagaren och lämnar en funktion som släpper just det hållet. Ett senare håll släpps inte av ett tidigare.
 * @param {Felmottagare} m
 */
const halla = (m) => {
  const post = {};
  hallna.set(m, post);
  return () => {
    if (hallna.get(m) === post) hallna.delete(m);
  };
};

/**
 * ══ ⛔ DEN FÖRVALDA MOTTAGAREN (0.107.0, cllp/lifehub.app#253) ═══════════
 *
 * CP 2026-10-15 på iPhone: efter agentens svar gick det inte att spela in
 * igen, och fältet sade att mikrofonen inte gav något ljud. OpsTalk skickade
 * en diagnos med `rapporteraFel(fel, sammanhang)`, men utan tredje argument,
 * och bara felgränsen i `OpsAppShell` fick appens mottagare. Diagnosen hamnade
 * alltså i konsolen på en telefon ingen kunde öppna utvecklarverktygen på, och
 * varje misslyckande var omätt (regel 3).
 *
 * Därför finns en förvald mottagare: appen ger den EN gång (`OpsAuthProvider`
 * eller `OpsAppShell` med `felmottagare`, eller `registreraFelmottagare` för
 * en app som inte använder någon av dem), och varje `rapporteraFel` utan
 * eget tredje argument når den. Ramverket känner fortfarande inget konto och
 * inget samlingsnamn: mottagaren är appens, och ramverket bär bara vidare.
 *
 * ⛔ EN STAPEL, INTE EN ENDA PLATS. Flera komponenter kan registrera samma
 * mottagare (en app ger den både till inloggningen och skalet), och en som
 * avmonteras får inte ta bort en annans. Den senast registrerade gäller, och
 * avregistreringen tar bara bort sin egen post.
 * @type {Array<{ felmottagare: Felmottagare }>}
 */
const registrerade = [];

/**
 * Gör `felmottagare` till den förvalda mottagaren för `rapporteraFel`.
 * Kastar när den inte har `fanga`: en mottagare som inte går att anropa hade
 * sett ut som en kopplad felkanal och tappat varje fel tyst (regel 5).
 *
 * @param {Felmottagare} felmottagare
 * @returns {() => void} Avregistrerar just den här registreringen.
 */
export function registreraFelmottagare(felmottagare) {
  if (!felmottagare || typeof felmottagare.fanga !== "function" || typeof felmottagare.satt !== "function") {
    // ⛔ OCKSÅ `satt` (granskningen av PR 392, KAN 3): `OpsAuthProvider` anropar `satt` vid varje inloggningsbyte utan att pröva den,
    // och en mottagare utan den hade kastat där i stället för här, där felet säger vad som saknas.
    throw new Error("registreraFelmottagare: mottagaren ska ha formen { fanga, satt }, två funktioner. Utan fanga hade varje fel tappats tyst, och utan satt kastar inloggningen vid varje byte.");
  }
  const post = { felmottagare };
  registrerade.push(post);
  return () => {
    const i = registrerade.indexOf(post);
    if (i !== -1) registrerade.splice(i, 1);
  };
}

/** Den förvalda mottagaren just nu, eller `null`. @returns {Felmottagare | null} */
export function forvaldFelmottagare() {
  return registrerade.length > 0 ? registrerade[registrerade.length - 1].felmottagare : null;
}

/**
 * Rapporterar ett fel. Skriver ALLTID till konsolen, och vidarebefordrar
 * ALLTID till mottagaren när en sådan finns: den som ges här, annars den
 * förvalda (`registreraFelmottagare`).
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
 * @param {Felmottagare | null | undefined} [felmottagare] Utan den (eller med `null`) gäller den förvalda.
 */
export function rapporteraFel(fel, sammanhang, felmottagare) {
  // eslint-disable-next-line no-console -- det HÄR är loggpunkten. Se filhuvudet.
  console.error("ops-framework:", fel, sammanhang ?? {});
  const mottagare = felmottagare ?? forvaldFelmottagare();
  if (!mottagare || typeof mottagare.fanga !== "function") return;
  if (hallna.has(mottagare)) {
    // eslint-disable-next-line no-console
    console.error("ops-framework: felet kom medan felmottagaren hanterade ett annat fel, och gick bara till konsolen");
    return;
  }
  const slapp = halla(mottagare);
  let asynkron = false;
  try {
    const svar = /** @type {unknown} */ (mottagare.fanga(fel, sammanhang));
    if (svar && typeof (/** @type {any} */ (svar).then) === "function") {
      /** @type {Promise<unknown>} */ (svar).then(slapp, (mottagarfel) => {
        slapp();
        // eslint-disable-next-line no-console
        console.error("ops-framework: felmottagaren själv föll", mottagarfel);
      });
      // ⛔ Asynkron först när `then` tagit emot utan att kasta (varv 2, MÅSTE 1). Ett thenable vars `then` kastar låste förut för gott.
      asynkron = true;
      setTimeout(slapp, FELMOTTAGARE_HALL_MS);
    }
  } catch (mottagarfel) {
    // eslint-disable-next-line no-console
    console.error("ops-framework: felmottagaren själv kastade", mottagarfel);
  } finally {
    if (!asynkron) slapp();
  }
}
