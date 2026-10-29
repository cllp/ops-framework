#!/usr/bin/env node
/**
 * Mätning i produktion: bryter något befintligt dokument i `users/{uid}/minaKalendrar` eller `users/{uid}/kalenderposter` mot formen reglerna kräver från 0.153.0? (cllp/ops-framework#463)
 *
 * ══ ⛔ BARA LÄSNING ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Skriptet läser två samlingsgrupper (`collectionGroup`) och skriver ingenting. Det kan köras av vem som helst som har läsrätt (Grok, via `gcloud auth application-default login`). Svaret är en räkning per slags avvikelse
 * och några exempel; personernas id kortas till sex tecken, så att utskriften går att klistra in i ett ärende.
 *
 * ══ ⛔ VAD SVARET AVGÖR ═══════════════════════════════════════════════════════════════════════════════════════
 *
 *   - NOLL avvikelser i alla slag, `id` inräknat: ingen kan låsas ute. Reglerna kan deployas, och läkningen i `createKalenderkalla` behövs bara som skydd. Slutkoden är då 0.
 *   - NÅGON avvikelse i `ikon`, `ordning`, `forvald`, `iFlodet`, `arkiverad`, `beskrivning`, `plats` eller `blockerar`: dokumentet kan inte skrivas om som det står (nekas av reglerna). `lasMinKalender` och `lasKalenderpost` läker raden vid
 *     läsning, så den som öppnar appen i 0.153.0 skriver en frisk rad; ändå ska antalet vara känt INNAN reglerna deployas, och de dokumenten rättas av en bakfyllnad om appen läser dem på ett annat sätt än ramverkets.
 *   - `id` (utanför `ID_FORM` eller över 80 tecken): prövas bara vid create, så ingen låses ute. Men `byggMinKalender` och `byggKalenderpost` kastar på ett sådant id vid läsning, så ett dokument med det är redan i dag
 *     oläsligt för ramverket; antalet ska vara 0, och det ger slutkod 1 som varje annan avvikelse.
 *   - Ett dokument över `--stor` byte (förval 20 000) räknas som stort: det är det kostnadshålet #463 beskriver, och det syns här även om formen är rätt. ⛔ `stor` ensam ger INTE slutkod 1: det låser inte ute någon.
 *
 * ⛔ SLUTKODEN (`kalenderformSlutkod`, provad i `src/__tests__/kalendrar-lasning.test.js`): 1 när någon samling lästes som tom eller något dokument bär en avvikelse som reglerna nekar (också `id`), 0 annars.
 *   Före granskningen av PR 464 räknade skriptet inte `id` men räknade `stor`, alltså tvärtom mot vad CHANGELOG 0.153.0 säger.
 *
 * Formen kommer ur `kalenderformFel` (`src/lib/kalendrar.js`), härledd ur samma konstanter som reglerna och provad mot emulatorn i `rules/__tests__/kalendertak.test.mjs`.
 *
 * Kör, från appens rot:
 *
 *   node web/node_modules/ops-framework/scripts/mat-kalenderdokument.mjs --projekt <projekt-id>
 *
 * Valfria: `--minaKalendrar minaKalendrar`, `--kalenderposter kalenderposter` (samlingsnamnen appen valt), `--stor 20000`, `--exempel 5`.
 * Inloggning: Admin SDK med "application default credentials". `firebase-admin` hittas under `functions/` i katalogen skriptet körs ifrån.
 */

import process from "node:process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { kalenderformMatning, kalenderformSlutkod } from "../src/lib/kalendrar.js";

/** @param {string[]} argv @param {string} namn */
function flagga(argv, namn) {
  const i = argv.indexOf(`--${namn}`);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) throw new Error(`--${namn} kräver ett värde.`);
  return v;
}

/** @param {string} sokvag Kortar uid:t i `users/<uid>/...` till sex tecken. */
const kortad = (sokvag) => {
  const delar = sokvag.split("/");
  return delar.length > 1 ? [delar[0], `${delar[1].slice(0, 6)}...`, ...delar.slice(2)].join("/") : sokvag;
};

/** Dokumentets storlek ungefär: längden på dess JSON. Inte Firestores egen räkning, men samma storleksordning, och nog för att hitta det som väger hundratals kilobyte. */
const jsonByte = (/** @type {unknown} */ data) => JSON.stringify(data ?? {}).length;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  const projekt = flagga(argv, "projekt");
  if (!projekt) {
    console.error("mat-kalenderdokument: --projekt <projekt-id> är obligatoriskt. Ramverket känner aldrig projekt-id, och det finns inget förval.");
    process.exit(2);
  }
  const namn = { minaKalendrar: flagga(argv, "minaKalendrar") ?? "minaKalendrar", kalenderposter: flagga(argv, "kalenderposter") ?? "kalenderposter" };
  const stor = Number(flagga(argv, "stor") ?? 20_000);
  const exempel = Number(flagga(argv, "exempel") ?? 5);

  const kravFran = createRequire(join(process.cwd(), "functions", "package.json"));
  const { initializeApp, applicationDefault } = await import(pathToFileURL(kravFran.resolve("firebase-admin/app")).href);
  const { getFirestore } = await import(pathToFileURL(kravFran.resolve("firebase-admin/firestore")).href);
  initializeApp({ credential: applicationDefault(), projectId: projekt });
  const db = getFirestore();

  /** @type {Array<{ lasta: number, perKod: Record<string, number> }>} */
  const svaren = [];
  for (const [slag, samling] of /** @type {const} */ ([["kalender", namn.minaKalendrar], ["post", namn.kalenderposter]])) {
    const snap = await db.collectionGroup(samling).get();
    const dokument = snap.docs.map((d) => ({ sokvag: d.ref.path, id: d.id, data: d.data(), byte: jsonByte(d.data()) }));
    const svar = kalenderformMatning(dokument, { slag, stor, exempel });
    svaren.push(svar);
    // ⛔ UTSKRIFTEN SÄGER ALLTID ALLT (arbetsreglernas punkt 5): också noll skrivs ut, med vad nollan gäller.
    console.log(`\n${samling}: ${svar.lasta} dokument lästa, ${svar.medAvvikelse} med avvikelse, ${svar.stora} över ${stor} byte.`);
    const koder = Object.entries(svar.perKod);
    console.log(`  ${svar.personer} personer, flest dokument hos en person: ${svar.flestHosEnPerson}. (Antalet per person har inget tak i reglerna; siffran är underlaget för ett.)`);
    if (koder.length === 0 && svar.lasta > 0) console.log("  Inga avvikelser: varje dokument klarar reglerna från 0.153.0.");
    for (const [k, n] of koder.sort()) console.log(`  ${k}: ${n}`);
    for (const e of svar.exempel) console.log(`  exempel ${kortad(e.sokvag)}: ${e.koder.join(", ")}`);
    if (svar.lasta === 0) {
      console.log("  ⛔ NOLL dokument lästa. Det är inte ett svar: kontrollera projekt-id och samlingsnamn innan du läser det som att ingen kan låsas ute.");
    }
  }
  const kod = kalenderformSlutkod(svaren);
  console.log(`\nSlutkod ${kod}: ${kod === 0 ? "inga avvikelser som reglerna nekar, också id. Reglerna kan deployas. (\`stor\` låser inte ute någon och ger inte kod 1; siffran ovan är underlaget för ett tak.)" : "minst en avvikelse som reglerna nekar (eller en samling utan dokument). Deploya inte reglerna förrän den är förklarad."}`);
  process.exit(kod);
}
