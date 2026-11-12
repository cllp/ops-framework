/**
 * Var på ljushetsskalan en färg i en palett håller, och vad granskningens fynd betyder för den som väljer färgen
 * (0.219.0, cllp/lifehub.app#798).
 *
 * ══ ⛔ HÄNDELSEN ═════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * CP 2026-11-12 14.02, med en skärmbild av Hubbens färger i SessionStudio-appen: "Den här är lite krånglig. Lyckades spara en
 * färg i mörkt, växlade till ljust och sedan funkade den inte. När jag gick till mörkt stannade den kvar på felmeddelandet." Och:
 * "vi behöver en color picker och reglage som kommer upp när man trycker på rutan. Låt det vara möjligt att skriva in hex också,
 * men bra att kunna välja. Det måste vara tydligare var på skalan man är fel, om det behöver vara ljusare eller mörkare."
 *
 * Mätt i koden samma dag: felet gällde ljust läge (accenten #94a37e mot kortet, 2,62:1 där 3:1 behövs). `granskaPalett` prövar
 * båda lägena, så felet stod kvar i mörkt läge, och meningen sade kvoten men inte åt vilket håll färgen skulle ändras.
 *
 * ══ ⛔ SKALAN RÄKNAS HÄR, INTE I KOMPONENTEN, OCH GENOM GRANSKNINGEN ═════════════════════════════════════════════════
 *
 * `hallbarLjushet` prövar varje ljushet genom `granskaLage`, alltså samma par och samma ribbor som `granskaPalett` och
 * `check-kontrast` (arbetsreglernas punkt 2). En egen formel för "var håller accenten" hade kunnat säga att en ljushet håller
 * som granskningen sedan nekar, och då hade Spara varit avstängd fast skalan sade grönt.
 *
 * ⛔ BARA FYNDEN SOM HÄNGER PÅ FÄRGEN RÄKNAS. Ett fynd som en annan färg orsakar (texten mot bakgrunden när accenten väljs) står
 * kvar vid varje ljushet av accenten, och hade gjort hela skalan röd för något accenten inte kan laga. Vilka token en färg
 * påverkar läses ur `harledLage` självt (`beroendeToken`), inte ur en lista här.
 *
 * ══ ⛔ VARFÖR HSL OCH INTE OKLCH ════════════════════════════════════════════════════════════════════════════════════
 *
 * OKLCH:s ljushet följer ögat bättre, men en kulör vid en viss ljushet och mättnad finns inte alltid i sRGB (se `oklch.js`), och
 * då måste mättnaden sänkas eller kanalerna klippas: reglaget för ljushet hade ändrat mättnaden, och färgen hade hoppat. I HSL är
 * varje punkt en riktig `#rrggbb`, och vid fast kulör och mättnad stiger luminansen med ljusheten. Ett par håller då i högst en
 * mörk och en ljus del av skalan, och det är just det som ska synas: "gör den ljusare" eller "gör den mörkare".
 *
 * ⛔ SKALAN PRÖVAS I STEG OM EN PROCENT, och kanterna förfinas mellan ett steg som håller och ett som inte gör det. En del som
 * håller och är smalare än en procent kan alltså saknas på skalan. Färgen själv prövas alltid exakt (`haller`).
 */

import { PAR } from "./kontrastpar.js";
import { PALETT_LAGEN, PALETT_NYCKLAR, ORDNINGENS_NYCKLAR, granskaLage, granskaPalett, harledLage, lasPalett, normaliseraHex } from "./palett.js";

/**
 * @typedef {import("./palett.js").Palett} Palett
 * @typedef {import("./palett.js").Palettlage} Palettlage
 * @typedef {import("./palett.js").PalettNyckel} PalettNyckel
 * @typedef {import("./palett.js").Lagesfarger} Lagesfarger
 * @typedef {import("./palett.js").Kontrastfynd} Kontrastfynd
 * @typedef {{ sv: string, en: string }} Tvasprakig
 */

// ── HSL ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * En färg i formen som kulör (grader, 0 till under 360), mättnad och ljushet (procent, 0 till 100).
 * ⛔ Grått, svart och vitt har ingen kulör, och får 0. Färgväljaren behåller därför sin egen kulör när färgen är grå.
 * @param {string} hex `#rrggbb`
 * @returns {{ kulor: number, mattnad: number, ljushet: number }}
 */
export function hexTillHsl(hex) {
  const form = normaliseraHex(hex);
  if (!form) throw new Error(`hexTillHsl: "${String(hex)}" är inte en färg i formen #rrggbb.`);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(form.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { kulor: 0, mattnad: 0, ljushet: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { kulor: (h * 60 + 360) % 360, mattnad: s * 100, ljushet: l * 100 };
}

/**
 * Kulör, mättnad och ljushet som `#rrggbb`. Värden utanför spannet läggs i kanten.
 * @param {number} kulor @param {number} mattnad @param {number} ljushet
 * @returns {string}
 */
export function hslTillHex(kulor, mattnad, ljushet) {
  const h = (((kulor % 360) + 360) % 360) / 60;
  const s = Math.min(100, Math.max(0, mattnad)) / 100;
  const l = Math.min(100, Math.max(0, ljushet)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

// ── Vad en färg påverkar ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Tokenen som ändras när färgen `nyckel` ändras, läst ur `harledLage` själv: ett token beror på färgen om det blir olika med
 * färgen svart och färgen vit. Accentens kontrastfärg (svart eller vitt) byter också mellan de två ändarna.
 * @param {Lagesfarger} f @param {PalettNyckel} nyckel
 * @returns {Set<string>}
 */
function beroendeToken(f, nyckel) {
  const svart = harledLage({ ...f, [nyckel]: "#000000" });
  const vitt = harledLage({ ...f, [nyckel]: "#ffffff" });
  return new Set(Object.keys(svart).filter((t) => svart[t] !== vitt[t]));
}

/**
 * Fynden som hänger på färgen.
 * @param {Kontrastfynd[]} fynd @param {PalettNyckel} nyckel @param {Set<string>} beroende
 */
function fyndFor(fynd, nyckel, beroende) {
  return fynd.filter((x) =>
    x.text === "ordning"
      ? /** @type {readonly string[]} */ (ORDNINGENS_NYCKLAR).includes(nyckel)
      : beroende.has(x.text) || beroende.has(x.yta) || (x.bas !== undefined && beroende.has(x.bas)),
  );
}

// ── Skalan ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Ljushetsomfang
 * @property {Palettlage} lage
 * @property {PalettNyckel} nyckel
 * @property {string} farg Färgen som prövades, i formen.
 * @property {number} kulor Skalans kulör, grader.
 * @property {number} mattnad Skalans mättnad, procent.
 * @property {number} ljushet Färgens ljushet, procent.
 * @property {{ fran: number, till: number }[]} intervall Delarna av ljushetsskalan (procent, 0 till 100) där varje par med
 *   färgen håller, vid skalans kulör och mättnad, i stigande ordning. ⛔ TOM LISTA BETYDER ATT INGEN LJUSHET HÅLLER med den
 *   kulören och mättnaden, inte att skalan inte räknats.
 * @property {boolean} haller Färgen själv: inget par med den är under sin ribba.
 * @property {"ljusare" | "morkare" | null} riktning Åt vilket håll närmaste ljushet som håller ligger. `null` när färgen
 *   håller, och när ingen ljushet gör det.
 * @property {string | null} narmaste Närmaste färg som håller, samma kulör och mättnad: färgen själv när den håller, `null` när
 *   ingen ljushet håller.
 * @property {number | null} narmasteLjushet Dess ljushet, procent.
 * @property {Kontrastfynd[]} fynd Fynden som hänger på färgen just nu, med de mätta kvoterna.
 */

/** Steg på skalan, i procent. Se filhuvudet. */
const STEG = 1;
/** Halveringar mellan ett steg som håller och ett som inte gör det. 2^-14 av ett steg är långt under en hexsiffra. */
const FORFINA = 14;

/**
 * Var på ljushetsskalan färgen `nyckel` i läget `lage` håller mot palettens andra färger, och åt vilket håll den ska ändras.
 *
 * @param {Palett} palett Paletten, med de andra färgerna. Dess egen `palett[lage][nyckel]` ersätts av `farg`.
 * @param {Palettlage} lage
 * @param {PalettNyckel} nyckel
 * @param {string} farg Färgen som prövas, en färgkod (`normaliseraHex` tar `#abc` och versaler).
 * @param {{ kulor: number, mattnad: number }} [skala] Kulören och mättnaden för skalan. Utelämnad: färgens egna. Färgväljaren skickar
 *   sina, eftersom svart, vitt och grått inte har någon kulör att läsa ut.
 * @returns {Ljushetsomfang}
 */
export function hallbarLjushet(palett, lage, nyckel, farg, skala) {
  const p = lasPalett(palett);
  if (!p) throw new Error("hallbarLjushet: det här är inte en palett i formen { ljus, mork } med fyra #rrggbb var.");
  if (!PALETT_LAGEN.includes(lage)) throw new Error(`hallbarLjushet: ${JSON.stringify(lage)} är varken ${PALETT_LAGEN.map((l) => JSON.stringify(l)).join(" eller ")}.`);
  if (!PALETT_NYCKLAR.includes(nyckel)) throw new Error(`hallbarLjushet: ${JSON.stringify(nyckel)} är inte en av palettens färger (${PALETT_NYCKLAR.join(", ")}).`);
  const form = normaliseraHex(farg);
  if (!form) throw new Error(`hallbarLjushet: "${String(farg)}" är inte en färg i formen #rrggbb.`);

  const egen = hexTillHsl(form);
  const kulor = skala ? skala.kulor : egen.kulor;
  const mattnad = skala ? skala.mattnad : egen.mattnad;
  const ljushet = egen.ljushet;
  const f = p[lage];
  const beroende = beroendeToken(f, nyckel);
  // Bara paren som hänger på färgen prövas (se `granskaLage`), och `fyndFor` håller samma gräns för temats ordning.
  const val = {
    par: PAR.filter((x) => beroende.has(x.text) || beroende.has(x.yta) || (x.bas !== undefined && beroende.has(x.bas))),
    ordning: /** @type {readonly string[]} */ (ORDNINGENS_NYCKLAR).includes(nyckel),
  };
  const prova = (/** @type {string} */ h) => fyndFor(granskaLage(lage, { ...f, [nyckel]: h }, val), nyckel, beroende);
  const haller = (/** @type {number} */ l) => prova(hslTillHex(kulor, mattnad, l)).length === 0;

  const fynd = prova(form);
  const ok = fynd.length === 0;

  /** Kanten mellan `fel` (håller inte) och `bra` (håller), som en ljushet vars färg håller. */
  const kant = (/** @type {number} */ fel, /** @type {number} */ bra) => {
    for (let i = 0; i < FORFINA; i++) {
      const mitt = (fel + bra) / 2;
      if (haller(mitt)) bra = mitt;
      else fel = mitt;
    }
    return bra;
  };

  /** @type {{ fran: number, till: number }[]} */
  const intervall = [];
  const steg = [];
  for (let l = 0; l <= 100; l += STEG) steg.push({ l, ok: haller(l) });
  for (let i = 0; i < steg.length; i++) {
    if (!steg[i].ok) continue;
    let j = i;
    while (j + 1 < steg.length && steg[j + 1].ok) j++;
    const fran = i === 0 ? 0 : kant(steg[i - 1].l, steg[i].l);
    const till = j === steg.length - 1 ? 100 : kant(steg[j + 1].l, steg[j].l);
    intervall.push({ fran, till });
    i = j;
  }

  let narmasteLjushet = /** @type {number | null} */ (null);
  if (ok) narmasteLjushet = ljushet;
  else {
    let bast = Infinity;
    for (const { fran, till } of intervall) {
      const kandidat = ljushet < fran ? fran : ljushet > till ? till : null;
      if (kandidat === null) continue;
      const avstand = Math.abs(kandidat - ljushet);
      if (avstand < bast) {
        bast = avstand;
        narmasteLjushet = kandidat;
      }
    }
  }
  const narmaste = ok ? form : narmasteLjushet === null ? null : hslTillHex(kulor, mattnad, narmasteLjushet);
  const riktning = ok || narmasteLjushet === null ? null : narmasteLjushet > ljushet ? "ljusare" : "morkare";

  return { lage, nyckel, farg: form, kulor, mattnad, ljushet, intervall, haller: ok, riktning, narmaste, narmasteLjushet, fynd };
}

// ── Beskeden ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Färgernas namn i bestämd form, med versal först, och lägena som de sägs i en mening.
 *
 * ⛔ "TEMA" OCH INTE "LÄGE" i det användaren läser, fast ärendet skrev "ljust läge": granskningens egna meningar säger "Ljust tema",
 * appens växel säger "Vilket tema du ändrar", och "läge" är statusens ord i ramverkets taxonomi (`check-statusord`). Två ord för
 * samma sak i samma vy hade fått läsaren att tro att det var två saker.
 */
const NAMN = Object.freeze({
  bakgrund: { sv: "Bakgrunden", en: "The background" },
  yta: { sv: "Ytan", en: "The surface" },
  text: { sv: "Texten", en: "The text" },
  accent: { sv: "Accenten", en: "The accent" },
});
const I_LAGET = Object.freeze({ ljus: { sv: "i ljust tema", en: "in light mode" }, mork: { sv: "i mörkt tema", en: "in dark mode" } });
const LAGET = Object.freeze({ ljus: { sv: "Ljust tema", en: "Light mode" }, mork: { sv: "Mörkt tema", en: "Dark mode" } });

/**
 * Det korta beskedet om åt vilket håll färgen ska ändras, utan färgens namn. Färgväljaren skriver det under reglaget.
 * @param {Pick<Ljushetsomfang, "haller" | "riktning">} omfang
 * @returns {Tvasprakig}
 */
export function riktningsbesked(omfang) {
  if (omfang.haller) return { sv: "Färgen går att läsa mot de andra färgerna.", en: "The colour is readable against the other colours." };
  if (omfang.riktning === "morkare") return { sv: "För ljus. Gör den mörkare.", en: "Too light. Make it darker." };
  if (omfang.riktning === "ljusare") return { sv: "För mörk. Gör den ljusare.", en: "Too dark. Make it lighter." };
  return {
    sv: "Ingen ljushet håller med den här kulören och mättnaden. Ändra kulören eller mättnaden, eller någon av de andra färgerna.",
    en: "No lightness works with this hue and saturation. Change the hue or saturation, or one of the other colours.",
  };
}

/** Hur långt färgen har till närmaste ljushet som håller; ingen sådan sist. @param {Ljushetsomfang} o */
function avstand(o) {
  return o.narmasteLjushet === null ? Infinity : Math.abs(o.narmasteLjushet - o.ljushet);
}

/**
 * @typedef {object} Fargbesked
 * @property {Palettlage} lage
 * @property {PalettNyckel} nyckel
 * @property {Tvasprakig} text Rubriken för användaren: "Accenten i ljust tema är för ljus. Gör den mörkare."
 * @property {"ljusare" | "morkare" | null} riktning
 * @property {string | null} narmaste Närmaste färg som håller, för knappen "Använd närmaste som fungerar". `null` när ingen ljushet håller.
 * @property {Kontrastfynd[]} fynd Fynden med de mätta kvoterna, för den som vill läsa dem. ⛔ Inte rubriken.
 */

/**
 * @typedef {object} Palettbesked
 * @property {Fargbesked[]} rader En rad per färg och läge som inte håller, i palettens ordning (ljust först, sedan mörkt).
 * @property {Palettlage[]} lagenMedFel Lägena som har fynd, för en röd prick på lägets flik. ⛔ TOM LISTA: paletten håller i båda.
 * @property {{ ljus: Tvasprakig | null, mork: Tvasprakig | null }} iAnnatLage Raden som står i ett läge när det ANDRA har fel:
 *   `iAnnatLage.mork` visas i mörkt läge och säger att ljust behöver ändras. `null` när det andra läget håller.
 * @property {Kontrastfynd[]} ovriga Fynd som ingen enskild färg kunde knytas till. Ska vara tom; står de här visas de med sina
 *   egna meningar i stället för att tyst försvinna (arbetsreglernas punkt 5).
 */

/**
 * Granskningens fynd som besked per läge och färg. `granskaPalett` säger VILKA par som faller och med hur mycket; det här säger
 * VILKEN färg i VILKET läge, och åt vilket håll den ska ändras.
 *
 * ⛔ ETT FYND KAN HÄNGA PÅ TVÅ FÄRGER (texten mot kortet hänger på både texten och ytan), och då står båda, var och en med sitt
 * håll: att göra någon av dem ändrar paret. Färgen själv prövas med samma fynd som granskningen, så en färg står här precis när
 * granskningen har ett fynd den kan laga.
 *
 * @param {Palett} palett
 * @returns {Palettbesked}
 */
export function palettBesked(palett) {
  const p = lasPalett(palett);
  if (!p) throw new Error("palettBesked: det här är inte en palett i formen { ljus, mork } med fyra #rrggbb var.");
  const alla = granskaPalett(p);
  const nyckelAv = (/** @type {Kontrastfynd} */ x) => `${x.lage}|${x.text}|${x.yta}|${x.bas ?? ""}`;
  /** @type {Fargbesked[]} */
  const rader = [];
  const tackta = new Set();
  for (const lage of PALETT_LAGEN) {
    if (!alla.some((x) => x.lage === lage)) continue;
    // ⛔ FÄRGEN SOM BEHÖVER MINST ÄNDRING FÖRST, och en färg står bara om den lagar något som ingen före den lagar. Mätt på CP:s
    // palett (accenten #94a37e i ljust läge): accenten mot sidan hänger också på bakgrunden, men ingen ljushet av bakgrunden lagar
    // det. Utan ordningen hade raden "Bakgrunden håller inte" stått först, fast det är accenten som ska ändras.
    const kandidater = PALETT_NYCKLAR.map((nyckel) => hallbarLjushet(p, lage, nyckel, p[lage][nyckel]))
      .filter((o) => !o.haller)
      .sort((a, b) => avstand(a) - avstand(b));
    for (const omfang of kandidater) {
      if (!omfang.fynd.some((x) => !tackta.has(nyckelAv(x)))) continue;
      for (const x of omfang.fynd) tackta.add(nyckelAv(x));
      const { nyckel } = omfang;
      const n = NAMN[nyckel];
      const i = I_LAGET[lage];
      const r = riktningsbesked(omfang);
      const text =
        omfang.riktning === null
          ? {
              sv: `${n.sv} ${i.sv} håller inte med den här kulören och mättnaden. Ändra kulören eller mättnaden, eller någon av de andra färgerna.`,
              en: `${n.en} ${i.en} does not work with this hue and saturation. Change the hue or saturation, or one of the other colours.`,
            }
          : {
              sv: `${n.sv} ${i.sv} är ${r.sv.charAt(0).toLowerCase()}${r.sv.slice(1)}`,
              en: `${n.en} ${i.en} is ${r.en.charAt(0).toLowerCase()}${r.en.slice(1)}`,
            };
      rader.push({ lage, nyckel, text, riktning: omfang.riktning, narmaste: omfang.narmaste, fynd: omfang.fynd });
    }
  }
  const lagenMedFel = PALETT_LAGEN.filter((l) => alla.some((x) => x.lage === l));
  const annat = (/** @type {Palettlage} */ l) => (l === "ljus" ? "mork" : "ljus");
  /** @param {Palettlage} visat */
  const rad = (visat) => {
    const andra = annat(visat);
    if (!lagenMedFel.includes(andra)) return null;
    return { sv: `${LAGET[andra].sv} behöver ändras innan du kan spara.`, en: `${LAGET[andra].en} needs changes before you can save.` };
  };
  return {
    rader,
    lagenMedFel,
    iAnnatLage: { ljus: rad("ljus"), mork: rad("mork") },
    ovriga: alla.filter((x) => !tackta.has(nyckelAv(x))),
  };
}
