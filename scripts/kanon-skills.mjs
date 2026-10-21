#!/usr/bin/env node
/**
 * Skriver ramverkets skills till konsumentens `.claude/skills/` och vaktar att kopian är i takt (0.136.0).
 *
 * ══ ⛔ VARFÖR (CP 2026-10-21) ═════════════════════════════════════════════════════════════════════
 *
 * CP bad om en skill för interaktionsdesign så att appens vyer blir användarvänliga och strukturerade. En skill i
 * `node_modules/ops-framework/skills/` når ingen: en agent som startar i en konsuments rot läser repots `CLAUDE.md` och
 * `.claude/skills/`, aldrig `node_modules`. Det är exakt felet som `check-kanon.mjs` i konsumenterna dokumenterade för
 * `CLAUDE.md` (mätt 2026-09-27: hänvisningen pekade på en sökväg som inte fanns, och reglerna gällde bara den som råkade veta
 * att de låg där). Skills följde samma väg och hade samma fel: mallens `CLAUDE.md` sa "ligger i node_modules, kopiera aldrig".
 *
 * Arbetsreglernas regel 2 säger vad som gäller: ETT hem plus en GENERERAD kopia med vakt, aldrig två handskrivna original.
 * Det förbjudna är den handskrivna kopian. Den genererade är föreskriven.
 *
 * ══ ⛔ VAD DEN GÖR ═══════════════════════════════════════════════════════════════════════════════════
 *
 *   node node_modules/ops-framework/scripts/kanon-skills.mjs            kontrollerar (exit 1 vid avvikelse)
 *   node node_modules/ops-framework/scripts/kanon-skills.mjs --skriv    skriver om kopian ur paketet
 *
 *   --rot=<katalog>     konsumentens rot (förval: nuvarande katalog). Kopian hamnar i <rot>/.claude/skills/<namn>/.
 *   --kalla=<katalog>   skills-katalogen att läsa ur (förval: paketets egen `skills/`).
 *
 * Vilka skills som följer med bestäms av ramverket: bara de vars `SKILL.md` har `konsument: true` i sin frontmatter. Övriga
 * skills är ramverkets egna (hur ramverket byggs och provas) och hör inte hemma hos en app. Flaggan står i skillen själv och
 * inte i en lista här: en lista i skriptet vore en andra sanning att hålla i takt.
 *
 * ⛔ HUR EN KOPIA KÄNNS IGEN. Varje kopierad fil får en rad överst (efter frontmatter i `SKILL.md`) som säger vad den är och
 * varifrån: `<!-- GENERERAD ur ops-framework skills/<namn>/<fil>. Rätta aldrig här. -->`. Raden är det som skiljer en kopia
 * från en handskriven skill med samma namn, och det som gör att en skill som tagits bort ur ramverket kan hittas och fällas.
 * Konsumentens egna skills (utan raden) rörs aldrig.
 *
 * ══ ⛔ VAD VAKTEN FÄLLER ═════════════════════════════════════════════════════════════════════════════
 *
 *   - en kopia som saknas, eller som skiljer sig från originalet (ramverket har ändrats och kopian ligger efter),
 *   - en fil i en kopierad skills mapp som ramverket inte längre har (en kvarglömd COMPONENTS.md),
 *   - en genererad kopia av en skill som ramverket tagit bort eller slutat distribuera (föräldralös),
 *   - en handskriven skill med samma namn som en distribuerad (den skulle skrivas över; flytta den eller byt namn).
 *
 * ⛔ GOLV: minst en distribuerad skill måste hittas. Ett ramverk utan en enda är grön av att inte ha läst något.
 *
 * Exit 0 grönt, 1 avvikelse med fil och åtgärd.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HAR = path.dirname(fileURLToPath(import.meta.url));

export const MARKOR = "GENERERAD ur ops-framework";

/**
 * @param {string} text
 * @returns {boolean} `konsument: true` i frontmatter.
 */
export function arKonsumentSkill(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return Boolean(m && /^konsument:\s*true\s*$/m.test(m[1]));
}

/**
 * Filen som den ska se ut i konsumenten: markören först, eller direkt efter frontmatter i en `SKILL.md`.
 * @param {string} namn @param {string} fil @param {string} text
 */
export function medMarkor(namn, fil, text) {
  const rad = `<!-- ${MARKOR} skills/${namn}/${fil}. Rätta aldrig här: ändra i ramverket och kör kanon-skills med --skriv. -->`;
  const f = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(text);
  if (f && fil === "SKILL.md") return `${f[0]}${rad}\n${text.slice(f[0].length)}`;
  return `${rad}\n${text}`;
}

/**
 * @param {string} kalla Paketets skills-katalog.
 * @returns {{ namn: string, filer: Map<string, string> }[]} De distribuerade skills och deras filer, som de ska se ut hos konsumenten.
 */
export function distribuerade(kalla) {
  /** @type {{ namn: string, filer: Map<string, string> }[]} */
  const ut = [];
  for (const post of fs.readdirSync(kalla, { withFileTypes: true })) {
    if (!post.isDirectory()) continue;
    const mapp = path.join(kalla, post.name);
    const skillFil = path.join(mapp, "SKILL.md");
    if (!fs.existsSync(skillFil) || !arKonsumentSkill(fs.readFileSync(skillFil, "utf8"))) continue;
    /** @type {Map<string, string>} */
    const filer = new Map();
    for (const f of fs.readdirSync(mapp, { withFileTypes: true })) {
      if (!f.isFile()) continue;
      const text = fs.readFileSync(path.join(mapp, f.name), "utf8");
      filer.set(f.name, f.name.endsWith(".md") ? medMarkor(post.name, f.name, text) : text);
    }
    ut.push({ namn: post.name, filer });
  }
  return ut.sort((a, b) => a.namn.localeCompare(b.namn));
}

/**
 * @param {{ kalla: string, rot: string, skriv: boolean }} val
 * @returns {{ avvikelser: string[], skrivna: string[], antal: number }}
 */
export function synka({ kalla, rot, skriv }) {
  const skills = distribuerade(kalla);
  /** @type {string[]} */
  const avvikelser = [];
  /** @type {string[]} */
  const skrivna = [];
  const mal = path.join(rot, ".claude", "skills");
  const namnen = new Set(skills.map((s) => s.namn));

  for (const s of skills) {
    const dir = path.join(mal, s.namn);
    const skillFil = path.join(dir, "SKILL.md");
    // En handskriven skill med samma namn: den skulle skrivas över, och det är aldrig vakten som får välja bort någons arbete.
    if (fs.existsSync(skillFil) && !fs.readFileSync(skillFil, "utf8").includes(MARKOR)) {
      avvikelser.push(`${path.relative(rot, skillFil)}: en handskriven skill med samma namn som ramverkets "${s.namn}". Flytta eller byt namn på den, och kör sedan med --skriv. Den skrivs inte över.`);
      continue;
    }
    for (const [fil, innehall] of s.filer) {
      const abs = path.join(dir, fil);
      const finns = fs.existsSync(abs);
      const lika = finns && fs.readFileSync(abs, "utf8") === innehall;
      if (lika) continue;
      if (skriv) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(abs, innehall);
        skrivna.push(path.relative(rot, abs));
      } else {
        avvikelser.push(`${path.relative(rot, abs)}: ${finns ? "ligger efter originalet i ramverket" : "saknas"}. Kör: node node_modules/ops-framework/scripts/kanon-skills.mjs --skriv`);
      }
    }
    // Filer i den genererade mappen som ramverket inte längre har.
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (s.filer.has(f)) continue;
        const abs = path.join(dir, f);
        if (skriv) {
          fs.rmSync(abs, { recursive: true, force: true });
          skrivna.push(`${path.relative(rot, abs)} (borttagen)`);
        } else avvikelser.push(`${path.relative(rot, abs)}: finns inte längre i ramverkets skill "${s.namn}". Kör med --skriv.`);
      }
    }
  }

  // Föräldralösa kopior: en genererad skill som ramverket inte längre distribuerar.
  if (fs.existsSync(mal)) {
    for (const post of fs.readdirSync(mal, { withFileTypes: true })) {
      if (!post.isDirectory() || namnen.has(post.name)) continue;
      const skillFil = path.join(mal, post.name, "SKILL.md");
      if (!fs.existsSync(skillFil) || !fs.readFileSync(skillFil, "utf8").includes(MARKOR)) continue;
      if (skriv) {
        fs.rmSync(path.join(mal, post.name), { recursive: true, force: true });
        skrivna.push(`${path.relative(rot, path.join(mal, post.name))} (föräldralös, borttagen)`);
      } else avvikelser.push(`${path.relative(rot, skillFil)}: en genererad kopia av en skill som ramverket inte längre distribuerar. Kör med --skriv.`);
    }
  }
  return { avvikelser, skrivna, antal: skills.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const flagga = (/** @type {string} */ n) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const rot = path.resolve(flagga("rot") ?? process.cwd());
  const kalla = path.resolve(flagga("kalla") ?? path.join(HAR, "..", "skills"));
  const skriv = argv.includes("--skriv");
  if (!fs.existsSync(kalla)) {
    console.error(`kanon-skills: ${kalla} finns inte. Fel sökväg, inte ett godkänt utfall.`);
    process.exit(1);
  }
  const { avvikelser, skrivna, antal } = synka({ kalla, rot, skriv });
  if (antal < 1) {
    console.error(`kanon-skills: ingen skill i ${kalla} har "konsument: true". Ett ramverk utan en distribuerad skill är grönt av att inte ha läst något.`);
    process.exit(1);
  }
  if (avvikelser.length > 0) {
    console.error(`kanon-skills: ${avvikelser.length} avvikelse(r) i ${path.join(rot, ".claude", "skills")}.\n  ⛔ RÄTTA ALDRIG KOPIAN FÖR HAND. Ändringen hör hemma i ramverket.\n${avvikelser.map((a) => `  - ${a}`).join("\n")}`);
    process.exit(1);
  }
  console.log(
    skriv
      ? `kanon-skills: ${skrivna.length === 0 ? "inget att skriva, kopian var redan i takt" : `skrev ${skrivna.length} fil(er):\n  ${skrivna.join("\n  ")}`} (${antal} skill).`
      : `kanon-skills: ${antal} skill i takt med ramverket (.claude/skills/).`,
  );
}
