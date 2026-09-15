#!/usr/bin/env node
/**
 * Vakt: `create-ops-app` producerar en app som FAKTISKT fungerar.
 *
 * ⛔ En boilerplate som inte går att starta är värre än ingen boilerplate. Den
 * ser ut som en genväg, kostar en halv dag att felsöka, och felen den ger är
 * uppsättningsfel vars meddelanden pekar långt från orsaken.
 *
 * Därför scaffoldar den här vakten på riktigt, installerar på riktigt och kör
 * appens egen grind på riktigt.
 *
 * Två detaljer som inte är godtyckliga:
 *
 *   1. `--install-links` gör att ramverket KOPIERAS som ett paket i stället för
 *      att symlänkas. Det provar samtidigt `files`-fältet: glömmer vi `dist`
 *      där fungerar allt lokalt och går sönder för alla andra. Med symlänk
 *      hade den buggen varit osynlig här.
 *   2. Vi läser den byggda CSS:en och kräver att ramverkets utilities finns i
 *      den. Det är enda sättet att bevisa att `@source`-raden mot node_modules
 *      gör sitt jobb, och den raden är den dyraste fällan i uppsättningen:
 *      saknas den blir appen helt ostylad UTAN felmeddelande.
 *
 * Kör: node scripts/check-scaffold.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arbetsmapp = fs.mkdtempSync(path.join(os.tmpdir(), "ops-scaffold-"));
const appmapp = path.join(arbetsmapp, "provapp");

/** @param {string} vad @param {string[]} argv @param {string} cwd */
function kor(vad, argv, cwd) {
  process.stdout.write(`  ${vad} ... `);
  const r = spawnSync(argv[0], argv.slice(1), { cwd, encoding: "utf8", env: { ...process.env, CI: "1" } });
  if (r.status !== 0) {
    console.log("MISSLYCKADES");
    console.error(`\ncheck-scaffold: "${argv.join(" ")}" gav ${r.status}\n`);
    console.error((r.stdout ?? "").slice(-3000));
    console.error((r.stderr ?? "").slice(-3000));
    fs.rmSync(arbetsmapp, { recursive: true, force: true });
    process.exit(1);
  }
  console.log("ok");
  return r.stdout ?? "";
}

console.log(`check-scaffold: ${appmapp}`);

kor("bygger ramverket", [process.execPath, path.join(rot, "scripts", "build.mjs")], rot);

kor(
  "skapar appen",
  [process.execPath, path.join(rot, "create-ops-app", "bin", "create-ops-app.mjs"), "provapp", "--dir", appmapp, "--framework", `file:${rot}`],
  arbetsmapp,
);

// ⛔ Kontrollera att namnbytena skedde. En mall som publiceras utan .gitignore
// får den nya appen att committa node_modules, och det upptäcks först när
// någon undrar varför repot är 400 MB.
for (const maste of [".gitignore", ".github/workflows/ci.yml", "src/index.css", "scripts/pre-push-gate.sh"]) {
  if (!fs.existsSync(path.join(appmapp, maste))) {
    console.error(`check-scaffold: ${maste} saknas i den skapade appen. Namnbytet i create-ops-app.mjs fungerar inte.`);
    fs.rmSync(arbetsmapp, { recursive: true, force: true });
    process.exit(1);
  }
}

// Platshållarna ska vara utbytta, inte kvar som text i en app någon ska leva med.
const appPaket = fs.readFileSync(path.join(appmapp, "package.json"), "utf8");
if (appPaket.includes("__APP_NAME__") || appPaket.includes("__FRAMEWORK_SPEC__")) {
  console.error("check-scaffold: platshållare kvar i package.json. Ersättningen i create-ops-app.mjs träffade inte.");
  fs.rmSync(arbetsmapp, { recursive: true, force: true });
  process.exit(1);
}

kor("installerar (som ett riktigt paket, inte symlänk)", ["npm", "install", "--install-links", "--no-audit", "--no-fund"], appmapp);
kor("kör appens grind", ["npm", "run", "check"], appmapp);

// ── Beviset för @source-raden ───────────────────────────────────────────────
const cssfiler = fs
  .readdirSync(path.join(appmapp, "dist", "assets"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => fs.readFileSync(path.join(appmapp, "dist", "assets", f), "utf8"));

if (cssfiler.length === 0) {
  console.error("check-scaffold: bygget producerade ingen CSS alls.");
  fs.rmSync(arbetsmapp, { recursive: true, force: true });
  process.exit(1);
}
const css = cssfiler.join("\n");

/** @type {string[]} */
const brott = [];
for (const v of [".bg-accent", ".text-ink", ".rounded-full", ".bg-identity-"]) {
  if (!css.includes(v)) {
    brott.push(
      `${v} finns inte i appens byggda CSS. Ramverkets klassnamn hittades alltså inte, nästan säkert för att @source-raden i src/index.css saknas eller pekar fel. Appen skulle bli helt ostylad utan ett enda felmeddelande.`,
    );
  }
}
if (css.includes(".bg-red-500")) {
  brott.push(".bg-red-500 finns i appens byggda CSS. Nollningen av Tailwinds palett nådde inte hela vägen genom en riktig installation.");
}

fs.rmSync(arbetsmapp, { recursive: true, force: true });

if (brott.length > 0) {
  console.error(`\ncheck-scaffold: ${brott.length} brott\n`);
  for (const b of brott) console.error(`  ${b}`);
  process.exit(1);
}

console.log(`\ncheck-scaffold: appen skapades, installerades, klarade sin egen grind och fick ${Math.round(css.length / 1024)} kB CSS med ramverkets utilities i sig`);
