/**
 * Inställningar per modul och grupp (0.88.0).
 *
 * ══ ⛔ EN MEKANISM, INTE EN PER MODUL ════════════════════════════════════
 *
 * CP 2026-10-09: grunden för appens inställningar ska vara gemensam. Ekonomi,
 * Bibliotek och varje modul som kommer sedan ska använda samma sak, och
 * "Visa i huvudmenyn" hör dit. En egen knapp i Bibliotek, eller ett fält som
 * bara Ekonomi känner, hade blivit två sanningar om samma gest.
 *
 * ══ ⛔ PINNEN BOR KVAR PÅ GRUPPEN ════════════════════════════════════════
 *
 * `groups.huvudmeny` (0.83.0) är listan över vilka moduler som har sin ikon i
 * huvudet. Huvudet läser den ur gruppen som redan är laddad, en gång, på varje
 * sida. Att flytta pinnen till en egen samling hade krävt en extra läsning
 * innan ikonen kan ritas, och två ställen som kan säga olika saker om samma
 * ikon (regel 2).
 *
 * Därför är `visaIHuvudmenyn` inte ett värde i modulens inställningsrad. Den
 * härleds ur `groups.huvudmeny`, och skrivs tillbaka dit. En modul får inte
 * deklarera samma id: det hade varit en andra kopia.
 *
 * ══ ⛔ ÖVRIGA INSTÄLLNINGAR ÄR MODULENS, I EN SAMLING APPEN NAMNGER ══════
 *
 * Manifestets `installningar` är en lista fält. Värdena sparas per grupp och
 * modul, i en samling appen namnger (`createModulinstallningskalla`,
 * `modulinstallningsregelfragment`). Ramverket känner aldrig samlingsnamnet.
 * Ägaren skriver. En medlem läser. Admin skriver inte, samma gräns som
 * `huvudmeny` och `moduler`.
 *
 * Saknas fältet i manifestet är listan tom. Modulen har ändå pinnen när den
 * har ett kort i hubben (`hubb`), eftersom ikonen i huvudet kommer ur kortet.
 */

import { ID_FORM } from "./katalog.js";

/** Id:t på den inbyggda pinnen. Reserverat: en modul får inte deklarera det. */
export const VISA_I_HUVUDMENYN = "visaIHuvudmenyn";

/** Tak i klienten och i regeln, samma tal. */
export const MAX_MODULINSTALLNINGAR = 8;
export const MAX_INSTALLNINGSID = 40;
export const MAX_INSTALLNINGSTEXT = 200;
export const MAX_INSTALLNINGSGRUPP = 80;

/** Fälten en deklarerad inställning får bära i manifestet. */
export const INSTALLNINGSDEKLARATIONFALT = /** @type {const} */ (["id", "namn", "hint", "typ", "forval"]);

/** Fälten en sparad post bär i samlingen. `id` på dokumentet räknas inte. */
export const MODULINSTALLNINGFALT = /** @type {const} */ (["groupId", "modulId", "varden", "uppdateradAv", "uppdaterad"]);

/** Fälten en post i `varden` bär. Båda värdefälten skrivs alltid, så regeln kan läsa dem. */
export const INSTALLNINGSVARDEFALT = /** @type {const} */ (["id", "typ", "bool", "text"]);

export const INSTALLNINGSTYPER = /** @type {const} */ (["boolean", "text"]);

/**
 * Orden för pinnen, ett hem. Gruppformuläret och inställningspanelen läser här.
 * @type {{ label: { sv: string, en: string }, hint: { sv: string, en: string } }}
 */
export const ORD_VISA_I_HUVUDMENYN = {
  label: { sv: "Visa i huvudmenyn", en: "Show in the main menu" },
  hint: { sv: "Appens ikon står i huvudet överst, på varje sida.", en: "The app's icon sits in the header, on every page." },
};

/**
 * Hur många appar man får VÄLJA till huvudmenyn (0.177.0). Hur många som SYNS i toppraden beror på bredden, se `HUVUDMENY_BREDDSTEG`.
 *
 * ══ ⛔ BESLUTET OCH MÄTNINGEN (CP 2026-11-02, "4, kör") ═════════════════════════════════════════════════════════════════════
 * CP 2026-11-02 20:58, med en skärmbild från telefonen: "för många ikoner i topraden, de måste kunna flyttas", och sedan: "Vi kanske skall ha ett max
 * antal ikoner så att användaren får prioritera själv?" Gruppens ägare kunde slå på "Visa i huvudmenyn" för hur många appar som helst (CP:s grupp hade
 * sju), och toppraden har en bredd. `ATGARDER_SMAL` tar bort åtgärder ur raden, men appikonerna bär `kvarIHuvudet` och flyttas aldrig: den sista klipptes
 * vid högerkanten.
 *
 * Ett tak på det som ryms vid 360 px hade blivit 2, och det är för lite för en dator. Därför är det två tal: taket för vad man får välja är 4 (CP:s beslut),
 * och vad som syns följer bredden, mätt. Scenen är huvudet som lifehub.app bygger det: hemikon (44), gruppmärke (44), Inkorg som åtgärd, N appikoner,
 * avatar (44), med en räknare på en av dem. Varje ikon är 44 px med 2 px emellan. "Ryms" betyder att raden inte rullar i sidled, att ingenting överlappar
 * och att klungan inte tränger in i radens högerpadding (samma mått som `ATGARDER_SMAL_HEM` bygger på). Största antal appikoner som ryms
 * (`scripts/huvudmeny-matt.mjs`, byggd dist, Chromium):
 *
 *   bredd            appikoner som ryms     hur skalet gör
 *   320 - 359        1                      ikon 0 syns, ikon 1-3 ligger i Meny
 *   360 - 389        2                      ikon 0-1 syns
 *   390 - 1023       3                      ikon 0-2 syns (768 px rymmer 3, inte 4: flikarna Idag/Kalender/Appar delar raden)
 *   1024 och mer     6 (1024), 8 (1280)     alla fyra syns
 *
 * Dolt görs med CSS (Tailwind-brytpunkter) och inte med mätning i JS: en mätning vid körning ger en layout som hoppar, och klasserna bor i markeringen så att
 * mätningen kan kontrollera exakt dem. Samma bredder styr raderna i Meny, omvända: en app står på exakt ett ställe på varje bredd.
 *
 * Taket gäller på tre ställen, och de läser alla den här konstanten: skrivvägen (`byggGrupp` och `sattHuvudmeny` nekar fler), reglaget "Visa i
 * huvudmenyn" (`OpsModulRam`, går inte att slå på när raden är full) och läsvägen (`OpsAppShell` ritar de första 4 och lägger resten i Meny på alla
 * bredder, så en grupp som redan har fler än taket förlorar ingen app). Ingen data migreras.
 */
export const HUVUDMENY_MAX = 4;

/**
 * Hur ikon k (0-räknat, i appens ordning) döljs i toppraden och visas i Meny i stället, ur mätningen ovan. `dold` sitter på ikonen, `imeny` på raden i Meny: samma bredd,
 * omvänd riktning. Ikon 0 syns alltid (1 ryms vid 320 px). `iHuvudmenyn` är sant när ikonen döljs på en bredd där huvudets meny finns (från `md`): raden ska då stå
 * i den menyn också, annars bara i bottenradens Meny (under `md`).
 * ⛔ Tailwind 4 gör `max-[360px]` till `width < 360px` och `max-lg` till `width < 64rem`, och `min-[360px]` till `width >= 360px`. Därför är gränsen skriven som talet där
 * ikonen FÖRST ryms (360, 390), och klasserna är varandras motsatser på pixeln: mätt i `scripts/huvudmeny-matt.mjs` vid 359, 360, 389 och 390 px. Ett första utkast med
 * `max-[359px]` dolde ikonen först under 359 px, och mätningen visade den på två ställen vid 359 och 389.
 * ⛔ Strängarna står hela, aldrig ihopsatta: Tailwind hittar bara klasser som står i källan.
 * @type {ReadonlyArray<{ dold: string, imeny: string, iHuvudmenyn: boolean } | null>}
 */
export const HUVUDMENY_BREDDSTEG = Object.freeze([
  null,
  { dold: "max-[360px]:hidden", imeny: "min-[360px]:hidden", iHuvudmenyn: false },
  { dold: "max-[390px]:hidden", imeny: "min-[390px]:hidden", iHuvudmenyn: false },
  { dold: "max-lg:hidden", imeny: "lg:hidden", iHuvudmenyn: true },
]);

/**
 * Orden när huvudmenyn är full. `{antal}` är `HUVUDMENY_MAX`. ⛔ Ett nej som tyst ignoreras är förbjudet (arbetsreglernas punkt 5): reglaget är avstängt
 * och säger varför, och skrivvägen kastar med samma ord.
 * @type {{ full: { sv: string, en: string } }}
 */
export const ORD_HUVUDMENY_FULL = {
  full: { sv: "Toppraden rymmer {antal}. Ta bort en först.", en: "The top bar holds {antal}. Remove one first." },
};

/**
 * @typedef {object} Installningsdeklaration
 * @property {string} id
 * @property {{ sv: string, en: string }} namn
 * @property {{ sv: string, en: string } | null} hint
 * @property {"boolean" | "text"} typ
 * @property {boolean | string} forval
 * @property {"huvudmeny" | "samling"} hem Pinnen skrivs på gruppen. Övriga skrivs i samlingen.
 */

/**
 * Dokumentets id, ett per grupp och modul.
 *
 * ⛔ LÄNGDEN FÖRST, SEDAN ETT TILDE. Grupp-id och modul-id får innehålla `_`
 * och `-` (`ID_FORM`), så ett understreck mellan dem går inte att dela igen.
 * Tilde finns inte i den formen. Längden gör id:t entydigt även om någon av
 * delarna senare skulle få ett tilde.
 *
 * @param {string} groupId
 * @param {string} modulId
 */
export function modulinstallningsId(groupId, modulId) {
  return `${groupId.length.toString(36)}~${groupId}~${modulId}`;
}

/**
 * @param {unknown} varde
 * @param {(falt: string, skal: string) => Error} var_
 * @returns {ReadonlyArray<Installningsdeklaration>}
 */
export function byggModulinstallningar(varde, var_) {
  if (varde === undefined) return Object.freeze([]);
  if (!Array.isArray(varde)) {
    throw var_("installningar", `måste vara en lista, inte ${varde === null ? "null" : typeof varde}. En modul utan egna inställningar utelämnar fältet eller skriver installningar: [].`);
  }
  if (varde.length > MAX_MODULINSTALLNINGAR) {
    throw var_("installningar", `har ${varde.length} fält. Taket är ${MAX_MODULINSTALLNINGAR}, samma tal som regeln rullar ut.`);
  }
  /** @type {Installningsdeklaration[]} */
  const ut = [];
  varde.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
    if (!f || typeof f !== "object" || Array.isArray(f)) {
      throw var_(`installningar[${i}]`, `måste vara ett objekt { ${INSTALLNINGSDEKLARATIONFALT.join(", ")} }.`);
    }
    /*
     * ⛔ `hem` ÄR HÄRLETT, OCH defineModule MÅSTE GÅ ATT KÖRA TVÅ GÅNGER.
     * validateModuler tar emot en redan byggd modul (exempelmodulen är
     * defineModule:s resultat). Bygget skriver hem: "samling" och hint: null.
     * En andra genomgång som avvisar de fälten fäller exemplet, inte ett
     * felaktigt manifest. Ett annat hem avvisas: pinnen bor på gruppen, och
     * en modul ska inte kunna välja var värdet skrivs.
     */
    if (f.hem !== undefined && f.hem !== "samling") {
      throw var_(
        `installningar[${i}].hem ${JSON.stringify(f.hem)}`,
        `hör inte till manifestet. Hemmet sätts av ramverket till "samling". Pinnen skrivs på gruppen (groups.huvudmeny), inte här.`,
      );
    }
    const okanda = Object.keys(f).filter((n) => n !== "hem" && !INSTALLNINGSDEKLARATIONFALT.includes(/** @type {any} */ (n)));
    if (okanda.length > 0) {
      throw var_(`installningar[${i}]`, `bär fälten ${okanda.join(", ")} som inte känns igen. En inställning bär ${INSTALLNINGSDEKLARATIONFALT.join(", ")}.`);
    }
    const id = typeof f.id === "string" ? f.id.trim() : "";
    if (!id || !ID_FORM.test(id) || id.length > MAX_INSTALLNINGSID) {
      throw var_(`installningar[${i}].id ${JSON.stringify(f.id)}`, `måste vara ett id med små bokstäver, siffror, bindestreck och understreck, högst ${MAX_INSTALLNINGSID} tecken.`);
    }
    if (id === VISA_I_HUVUDMENYN) {
      throw var_(
        `installningar[${i}].id "${id}"`,
        "är reserverat. Pinnen till huvudmenyn är ramverkets, och den skrivs på gruppen (groups.huvudmeny), inte som en egen inställning.",
      );
    }
    if (ut.some((x) => x.id === id)) throw var_(`installningar[${i}].id "${id}"`, "står två gånger i samma modul.");
    const namn = namnPar(f.namn, var_, `installningar[${i}].namn för "${id}"`);
    const hint = f.hint === undefined || f.hint === null ? null : namnPar(f.hint, var_, `installningar[${i}].hint för "${id}"`);
    if (!INSTALLNINGSTYPER.includes(f.typ)) {
      throw var_(`installningar[${i}].typ ${JSON.stringify(f.typ)} för "${id}"`, `måste vara ${INSTALLNINGSTYPER.join(" eller ")}.`);
    }
    if (f.typ === "boolean" && typeof f.forval !== "boolean") {
      throw var_(`installningar[${i}].forval för "${id}"`, "måste vara true eller false när typen är boolean.");
    }
    if (f.typ === "text" && (typeof f.forval !== "string" || f.forval.length > MAX_INSTALLNINGSTEXT)) {
      throw var_(`installningar[${i}].forval för "${id}"`, `måste vara en text på högst ${MAX_INSTALLNINGSTEXT} tecken när typen är text.`);
    }
    ut.push(Object.freeze({
      id,
      namn,
      hint,
      typ: f.typ,
      forval: f.forval,
      hem: "samling",
    }));
  });
  return Object.freeze(ut);
}

/**
 * @param {unknown} varde
 * @param {(falt: string, skal: string) => Error} var_
 * @param {string} falt
 * @returns {{ sv: string, en: string }}
 */
function namnPar(varde, var_, falt) {
  const o = varde && typeof varde === "object" && !Array.isArray(varde) ? /** @type {any} */ (varde) : null;
  const sv = typeof o?.sv === "string" ? o.sv.trim() : "";
  const en = typeof o?.en === "string" ? o.en.trim() : "";
  if (!sv || !en) {
    throw var_(falt, `måste vara { sv, en } med båda språken, och ${!sv && !en ? "båda saknas" : !sv ? "sv saknas" : "en saknas"}.`);
  }
  return Object.freeze({ sv, en });
}

/** Pinnen, samma objekt för varje modul som har ett kort. */
function pinne() {
  return Object.freeze({
    id: VISA_I_HUVUDMENYN,
    namn: ORD_VISA_I_HUVUDMENYN.label,
    hint: ORD_VISA_I_HUVUDMENYN.hint,
    typ: /** @type {const} */ ("boolean"),
    forval: false,
    hem: /** @type {const} */ ("huvudmeny"),
  });
}

/**
 * Det panelen visar: pinnen först när modulen har ett kort, sedan modulens egna fält.
 *
 * @param {{ id: string, hubb: unknown, installningar?: ReadonlyArray<Installningsdeklaration> }} modul
 * @returns {ReadonlyArray<Installningsdeklaration>}
 */
export function installningarFor(modul) {
  const egna = modul.installningar ?? [];
  const lista = modul.hubb ? [pinne(), ...egna] : [...egna];
  return Object.freeze(lista);
}

/**
 * Lägger till eller tar bort ett modul-id i huvudmenyn, utan att röra ordningen på de andra.
 *
 * ⛔ Kastar när `pa` är sant, modulen inte redan står i listan och listan redan har `HUVUDMENY_MAX` poster (0.177.0). Att ta bort kastar aldrig.
 *
 * @param {ReadonlyArray<string> | null | undefined} huvudmeny
 * @param {string} modulId
 * @param {boolean} pa
 * @returns {string[]}
 */
export function sattHuvudmeny(huvudmeny, modulId, pa) {
  const lista = Array.isArray(huvudmeny) ? [...huvudmeny] : [];
  if (pa) {
    if (lista.includes(modulId)) return lista;
    // ⛔ SKRIVVÄGEN NEKAR FLER ÄN TAKET (0.177.0), och nekar med ord. En lista som tyst lämnades oförändrad hade fått reglaget att se ut att fungera.
    if (lista.length >= HUVUDMENY_MAX) throw new Error(`sattHuvudmeny: ${ORD_HUVUDMENY_FULL.full.sv.replace("{antal}", String(HUVUDMENY_MAX))} "${modulId}" lades inte till.`);
    return [...lista, modulId];
  }
  return lista.filter((id) => id !== modulId);
}

/**
 * Huvudmenyn som delmängd av de moduler gruppen faktiskt har. En avinstallerad
 * modul tas ur listan i samma sparning, så ikonen inte leder till en sida utan kort.
 *
 * @param {ReadonlyArray<string> | null | undefined} huvudmeny
 * @param {ReadonlyArray<string>} moduler
 * @returns {string[]}
 */
export function huvudmenyInom(huvudmeny, moduler) {
  const tillatna = new Set(moduler);
  return (Array.isArray(huvudmeny) ? huvudmeny : []).filter((id) => tillatna.has(id));
}

/**
 * Värdena panelen visar. Pinnen läses ur gruppen. Övriga läses ur det som sparats,
 * och ett fält som saknas får sitt förval (tomhet är ett svar, inte en gissning:
 * förvalet är det modulen skrev).
 *
 * @param {object} arg
 * @param {{ id: string, hubb: unknown, installningar?: ReadonlyArray<Installningsdeklaration> }} arg.modul
 * @param {{ huvudmeny?: ReadonlyArray<string> | null } | null} arg.grupp
 * @param {Readonly<Record<string, boolean | string>> | null | undefined} arg.sparade
 * @returns {Record<string, boolean | string>}
 */
export function installningsVarden({ modul, grupp, sparade }) {
  /** @type {Record<string, boolean | string>} */
  const ut = {};
  for (const f of installningarFor(modul)) {
    if (f.hem === "huvudmeny") {
      ut[f.id] = Array.isArray(grupp?.huvudmeny) && grupp.huvudmeny.includes(modul.id);
    } else if (sparade && Object.hasOwn(sparade, f.id)) {
      ut[f.id] = sparade[f.id];
    } else {
      ut[f.id] = f.forval;
    }
  }
  return ut;
}

/**
 * Listan som skrivs i samlingen, ur en karta med bara modulens egna fält.
 * Kastar när kartan bär pinnen, ett okänt id eller fel typ.
 *
 * @param {{ installningar?: ReadonlyArray<Installningsdeklaration> }} modul
 * @param {Readonly<Record<string, boolean | string>>} varden
 * @returns {{ id: string, typ: "boolean" | "text", bool: boolean, text: string }[]}
 */
export function byggInstallningsvarden(modul, varden) {
  if (!varden || typeof varden !== "object" || Array.isArray(varden)) {
    throw new Error("Modulens inställningar: värdena måste vara ett objekt, ett fält per id.");
  }
  if (Object.hasOwn(varden, VISA_I_HUVUDMENYN)) {
    throw new Error(`Modulens inställningar: "${VISA_I_HUVUDMENYN}" skrivs på gruppen (groups.huvudmeny), inte i samlingen.`);
  }
  const deklarerade = new Map((modul.installningar ?? []).filter((f) => f.hem === "samling").map((f) => [f.id, f]));
  const nycklar = Object.keys(varden);
  if (nycklar.length > MAX_MODULINSTALLNINGAR) {
    throw new Error(`Modulens inställningar: ${nycklar.length} fält. Taket är ${MAX_MODULINSTALLNINGAR}.`);
  }
  return nycklar.map((id) => {
    const dek = deklarerade.get(id);
    if (!dek) throw new Error(`Modulens inställningar: "${id}" är inte ett fält modulen deklarerat.`);
    const varde = varden[id];
    if (dek.typ === "boolean") {
      if (typeof varde !== "boolean") throw new Error(`Modulens inställningar: "${id}" ska vara true eller false.`);
      return { id, typ: /** @type {const} */ ("boolean"), bool: varde, text: "" };
    }
    if (typeof varde !== "string" || varde.length > MAX_INSTALLNINGSTEXT) {
      throw new Error(`Modulens inställningar: "${id}" ska vara en text på högst ${MAX_INSTALLNINGSTEXT} tecken.`);
    }
    return { id, typ: /** @type {const} */ ("text"), bool: false, text: varde };
  });
}

/**
 * Kartan ur den sparade listan, eller ett skäl när raden inte går att läsa.
 *
 * @param {unknown} lista
 * @returns {{ varden: Record<string, boolean | string> } | { fel: string }}
 */
export function lasInstallningsvarden(lista) {
  if (!Array.isArray(lista)) return { fel: "Värdena är inte en lista." };
  if (lista.length > MAX_MODULINSTALLNINGAR) return { fel: `Värdena är ${lista.length} poster. Taket är ${MAX_MODULINSTALLNINGAR}.` };
  /** @type {Record<string, boolean | string>} */
  const varden = {};
  for (const post of lista) {
    if (!post || typeof post !== "object") return { fel: "En post i värdena är inte ett objekt." };
    const p = /** @type {any} */ (post);
    const okanda = Object.keys(p).filter((k) => !INSTALLNINGSVARDEFALT.includes(/** @type {any} */ (k)));
    if (okanda.length > 0) return { fel: `En post bär fälten ${okanda.join(", ")}.` };
    if (typeof p.id !== "string" || !p.id) return { fel: "En post saknar id." };
    if (p.id === VISA_I_HUVUDMENYN) return { fel: `"${VISA_I_HUVUDMENYN}" hör inte hemma i samlingen.` };
    if (Object.hasOwn(varden, p.id)) return { fel: `"${p.id}" står två gånger.` };
    if (p.typ === "boolean" && typeof p.bool === "boolean" && p.text === "") varden[p.id] = p.bool;
    else if (p.typ === "text" && typeof p.text === "string" && p.text.length <= MAX_INSTALLNINGSTEXT && p.bool === false) varden[p.id] = p.text;
    else return { fel: `"${p.id}" har en typ och ett värde som inte hör ihop.` };
  }
  return { varden };
}
