#!/usr/bin/env node
/**
 * Bakfyllnaden av medlemskapens namn (0.40.1, cllp/ops-framework#218): ger varje personmedlemskap som saknar `namn` det
 * namn profilraden (`users/{uid}`) har. Torrkörning är förval, `--skarpt` skriver.
 *
 * ══ ⛔ ÄR DET HÄR RAMVERKETS ELLER APPENS SKRIPT? RAMVERKETS ════════════════════════════════════════════
 *
 * Ramverket äger `memberships` och deras `namn` (#138), och beslutet "ett tomt namn fylls ur profilen, ett ifyllt rörs aldrig" är
 * ramverkets modell: det bor i `bakfyllMedlemsnamn` (`src/node/profil.js`) och prövas där. Det här är bara en tunn omslag: läs
 * flaggor, bygg en Admin-källa, anropa, skriv ut. Appens enda bidrag är SAMLINGSNAMNEN och PROJEKTET, som ramverket aldrig
 * känner (`--projekt` är obligatoriskt, det finns inget förval att skriva över produktionen med av misstag).
 *
 * ══ ⛔ UTSKRIFTEN SÄGER ALLTID ALLT (arbetsreglernas punkt 5) ═══════════════════════════════════════════
 *
 * lästa, saknar, att fylla, fyllda, utan profilnamn, utan användare och fel skrivs också när de är 0. Det som INTE går att fylla
 * listas med uid och skäl: det är de personerna som måste öppna Profil och spara sitt namn, och en rapport som bara sade "3 kvar"
 * hade lämnat frågan vilka.
 *
 * Kör, från appens rot, efter att ramverket pinnats om till 0.40.1:
 *
 *   node web/node_modules/ops-framework/scripts/bakfyll-medlemsnamn.mjs --projekt <projekt-id>
 *   node web/node_modules/ops-framework/scripts/bakfyll-medlemsnamn.mjs --projekt <projekt-id> --skarpt
 *
 * Valfria: `--anvandare users` och `--medlemskap memberships` om appen heter samlingarna något annat.
 * Inloggning: Admin SDK med "application default credentials" (`gcloud auth application-default login`, eller
 * `GOOGLE_APPLICATION_CREDENTIALS`). `firebase-admin` hittas under `functions/` i katalogen skriptet körs ifrån.
 */

import process from "node:process";
import { bakfyllMedlemsnamn } from "../src/node/profil.js";

/**
 * @param {string[]} argv
 * @param {string} namn
 */
function flagga(argv, namn) {
  const i = argv.indexOf(`--${namn}`);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) throw new Error(`--${namn} kräver ett värde.`);
  return v;
}

/**
 * @param {string[]} argv
 * @returns {{ projekt: string, skarpt: boolean, anvandare: string, medlemskap: string }}
 */
export function lasFlaggor(argv) {
  const projekt = flagga(argv, "projekt");
  if (!projekt) {
    throw new Error("--projekt <projekt-id> krävs. Ramverket känner aldrig projekt-id, och ett förval hade kunnat skriva i fel projekt.");
  }
  return {
    projekt,
    skarpt: argv.includes("--skarpt"),
    anvandare: flagga(argv, "anvandare") ?? "users",
    medlemskap: flagga(argv, "medlemskap") ?? "memberships",
  };
}

/**
 * Utskriften, en rad per mått och alltid alla rader.
 *
 * @param {import("../src/node/profil.js").BakfyllnadSvar} svar
 * @returns {string[]}
 */
export function rapport(svar) {
  const rader = [
    svar.skarpt ? "SKARPT: raderna skrevs." : "TORRKÖRNING. Inget skrevs. Kör med --skarpt för att skriva.",
    `lästa:            ${svar.lasta}`,
    `saknar namn:      ${svar.saknar}`,
    `att fylla:        ${svar.attFylla}`,
    `fyllda:           ${svar.fyllda}`,
    `utan profilnamn:  ${svar.utanProfilnamn}`,
    `utan användare:   ${svar.utanAnvandare}`,
    `fel:              ${svar.fel.length}`,
  ];
  for (const k of svar.kvar) rader.push(`  kvar: ${k.id}   ${k.skal === "utan-profilnamn" ? "profilen har inget namn: personen sparar sitt namn i Profil" : "ingen profilrad finns"}`);
  for (const f of svar.fel) rader.push(`  fel: ${f}`);
  return rader;
}

async function kor() {
  const { projekt, skarpt, anvandare, medlemskap } = lasFlaggor(process.argv.slice(2));
  console.log(`projekt: ${projekt}   samlingar: ${anvandare}, ${medlemskap}`);
  // Dynamisk import: `firebase-admin` dras bara in när skriptet KÖRS, aldrig när det importeras i ett prov.
  const { adminKalla } = await import("./lib/adminKalla.mjs");
  const kalla = await adminKalla(projekt);
  const svar = await bakfyllMedlemsnamn({ kalla: /** @type {any} */ (kalla), skarpt, samlingar: { anvandare, medlemskap } });
  for (const rad of rapport(svar)) console.log(rad);
  if (svar.fel.length > 0) process.exit(1);
}

// Körs bara som skript, aldrig vid import: lasFlaggor och rapport provas för sig.
if (process.argv[1] && process.argv[1].endsWith("bakfyll-medlemsnamn.mjs")) {
  kor().catch((e) => {
    console.error(`bakfyll-medlemsnamn: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
