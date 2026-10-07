/**
 * Hubben per grupp: vilka kort den aktiva gruppen visar, vilken modul och
 * vilken del en adress hör till, och vart en gammal adress leder (0.37.0, #184).
 *
 * ══ ⛔ TRE NIVÅER, OCH HUBBEN ÄR DEN MITTERSTA ═══════════════════════════
 *
 * CP 2026-09-30: "Ekonomi är EN modul. Inte massa moduler med komponenter."
 * En INSTANS (appen) har GRUPPER, och en grupp har MODULER. Hubben visar den
 * aktiva gruppens moduler, ett kort per modul, och en modul har en egen insida
 * med sin egen navigation. Före 0.37.0 var varje del av Ekonomi en rad i
 * hubbens meny (Översikt, Ekonomi, Liv, Schema, Cutover och så vidare), och
 * menyn var appens lista och inte gruppens.
 *
 * ⛔ DET FINNS ALLTID EXAKT EN AKTIV GRUPP (0.35.0, #190), så hubben visar EN
 * grupps moduler. Punkt 1 i #184 om "Alla mina grupper" utgick med läget.
 *
 * ══ ⛔ RAMVERKET VET ALDRIG VAD EKONOMI ÄR ══════════════════════════════
 *
 * Bara att en modul med id `ekonomi` finns och vad dess manifest säger (`hubb`
 * i `defineModule`). Allt här är härlett ur manifesten och gruppens lista,
 * aldrig ur en handskriven lista över sidor (arbetsreglernas punkt 2).
 *
 * ══ ⛔ BESLUTEN BOR HÄR OCH INTE I KOMPONENTERNA ════════════════════════
 *
 * Samma skäl som `grupplage.js`: ett beslut som bor i en komponent är ett
 * beslut som bara går att mäta genom att rita den. Här går det att pröva med en
 * lista, och appen kan pröva sina egna adresser mot samma funktion.
 */

import { text } from "./sprak.js";

/**
 * @typedef {import("./modul.js").Modul & { hubb: import("./modul.js").Hubbkort }} Hubbmodul
 */

/**
 * @typedef {object} Saknad
 * @property {string} id Modul-id:t gruppen pekar på.
 * @property {"inte-registrerad" | "inget-kort"} skal `inte-registrerad`: appen har ingen modul med det id:t. `inget-kort`: modulen finns men har `hubb: null`.
 */

/**
 * @typedef {object} Hubblage
 * @property {ReadonlyArray<Hubbmodul>} kort Modulerna hubben ritar, i gruppens ordning.
 * @property {ReadonlyArray<Saknad>} saknade Det gruppen pekar på som inte ritas, och varför.
 */

/**
 * Den aktiva gruppens kort i hubben.
 *
 * ⛔ ORDNINGEN ÄR GRUPPENS, INTE REGISTRETS. `moduler` på gruppen är skriven av
 * ägaren och är därmed ett beslut (samma regel som `navForGrupp`).
 *
 * ⛔ `saknade` SKRIVS UT OCH SLÄNGS INTE (arbetsreglernas punkt 5). En grupp som
 * pekar på en modul appen inte registrerat är en halv utrullning, och utan en
 * rad som säger det ser den ut precis som en grupp med färre kort.
 *
 * @param {object} arg
 * @param {{ id: string, moduler: ReadonlyArray<string> }} arg.grupp Den aktiva gruppen.
 * @param {ReadonlyArray<import("./modul.js").Modul>} arg.moduler Appens registrerade moduler, ur `validateModuler`.
 * @returns {Hubblage}
 */
export function hubbForGrupp({ grupp, moduler }) {
  if (!grupp || typeof grupp.id !== "string" || !Array.isArray(grupp.moduler)) {
    throw new Error(
      "hubbForGrupp: grupp krävs, med id och moduler. Det finns alltid exakt en aktiv grupp (0.35.0), och utan den har personen inga grupper: appen visar då OpsUtanMedlemskap, inte en hubb.",
    );
  }
  if (!Array.isArray(moduler)) {
    throw new Error("hubbForGrupp: moduler krävs och måste vara appens registrerade moduler, ur validateModuler. Även en tom lista är ett svar.");
  }
  const registrerade = new Map(moduler.map((m) => [m.id, m]));
  /** @type {Hubbmodul[]} */
  const kort = [];
  /** @type {Saknad[]} */
  const saknade = [];
  for (const id of grupp.moduler) {
    const m = registrerade.get(id);
    if (!m) saknade.push(Object.freeze({ id, skal: /** @type {const} */ ("inte-registrerad") }));
    else if (m.hubb) kort.push(/** @type {Hubbmodul} */ (m));
    // ⛔ 0.60.0 (#251): en modul utan kort men med tillägg saknas inte. Den syns på sina ytor, och en rad om att den "inte ritas"
    // hade varit fel besked om en app som gör precis det den ska.
    else if ((m.tillagg ?? []).length === 0) saknade.push(Object.freeze({ id, skal: /** @type {const} */ ("inget-kort") }));
  }
  return Object.freeze({ kort: Object.freeze(kort), saknade: Object.freeze(saknade) });
}

/**
 * Modulerna som en ägare kan välja i gruppens inställningar: alla registrerade (0.60.0, #251).
 *
 * ⛔ FÖRE 0.60.0 VAR EN MODUL MED `hubb: null` INTE ETT VAL, med skälet att en ägare som kryssade i den fick en rad i hubben om att
 * den inte ritas. Beslut 0003 (CP 2026-10-05) gjorde det osant: en app kan ha noll egna ytor och ändå synas, som ett tillägg på
 * händelserna. Inställningarna svarar på "vad har gruppen påslaget?" och visar därför alla appar, med raden "Syns på" (`synsPa`).
 * Skälet till den gamla regeln står kvar i `hubbForGrupp`: en modul utan kort OCH utan tillägg är fortfarande en `inget-kort`-rad.
 *
 * @param {ReadonlyArray<import("./modul.js").Modul>} moduler
 * @returns {import("./modul.js").Modul[]}
 */
export function valbaraModuler(moduler) {
  return [...(moduler ?? [])];
}

/**
 * Hubbens rader i toppradens rullgardin och bottenradens ark: EN rad per modul, inga delar.
 *
 * ⛔ HUBBENS MENY LISTAR BARA MODULER (#184 punkt 2). Delarna är modulens egen
 * navigation, på modulens sida. Därför inga `children` här, och skalets
 * rullgardin får samma lista som kortrutnätet (appen skickar resultatet till
 * båda, som `moduler` till `OpsAppShell`).
 *
 * @param {ReadonlyArray<Hubbmodul>} kort Ur `hubbForGrupp`.
 * @param {object} [val]
 * @param {string} [val.sprak] Förval `sv`.
 * @param {Readonly<Record<string, string | { sv: string, en?: string } | null>>} [val.info] Kortets infolinje per modul-id. En nyckel som saknas ritar ingen rad, `null` ritar "Inget nytt".
 * @param {Readonly<Record<string, number>>} [val.badge] Räknaren per modul-id.
 * @returns {import("./nav.js").NavPost[]}
 */
export function hubbPoster(kort, { sprak = "sv", info = {}, badge = {} } = {}) {
  return kort.map((m) => ({
    href: m.hubb.rutt,
    label: text(m.namn, sprak),
    icon: /** @type {import("react").ReactNode} */ (m.hubb.ikon),
    ...(Object.hasOwn(info, m.id) ? { info: info[m.id] } : {}),
    ...(typeof badge[m.id] === "number" ? { badge: badge[m.id] } : {}),
  }));
}

/**
 * Delar en adress i sökväg och resten (`?...#...`), och tar bort ett avslutande snedstreck.
 * @param {string} href
 * @returns {{ sokvag: string, rest: string }}
 */
function dela(href) {
  const h = typeof href === "string" ? href : "";
  const i = h.search(/[?#]/);
  const sokvag = i < 0 ? h : h.slice(0, i);
  const rest = i < 0 ? "" : h.slice(i);
  return { sokvag: sokvag.length > 1 ? sokvag.replace(/\/+$/, "") : sokvag, rest };
}

/**
 * @typedef {object} Modullage
 * @property {Hubbmodul} modul
 * @property {import("./modul.js").Moduldel | null} del Delen adressen hör till. `null`: en sida i modulen som inte är en del av navigationen.
 */

/**
 * Vilken modul och vilken del en adress hör till, eller `null` när den inte ligger i någon modul.
 *
 * ⛔ MODULENS EGEN ADRESS ÄR STARTSIDAN. `/ekonomi` visar översikten, och
 * översikten är den aktiva fliken där.
 *
 * ⛔ EN UNDERSIDA TILL EN DEL HÖR TILL DELEN. `/ekonomi/kontakter/anna` markerar
 * fliken Kontakter; annars hade navigationen tappat var man är så fort man
 * öppnat en rad.
 *
 * @param {ReadonlyArray<import("./modul.js").Modul>} moduler
 * @param {string} href En adress, med eller utan `?` och `#`.
 * @returns {Modullage | null}
 */
export function modulLage(moduler, href) {
  const { sokvag } = dela(href);
  for (const m of moduler ?? []) {
    if (!m.hubb) continue;
    const h = m.hubb;
    if (sokvag === h.rutt) return { modul: /** @type {Hubbmodul} */ (m), del: h.delar.find((d) => d.id === h.startsida) ?? null };
    if (!sokvag.startsWith(`${h.rutt}/`)) continue;
    const del = h.delar.find((d) => sokvag === d.rutt || sokvag.startsWith(`${d.rutt}/`)) ?? null;
    return { modul: /** @type {Hubbmodul} */ (m), del };
  }
  return null;
}

/**
 * @typedef {object} Omdirigering
 * @property {string} fran Den gamla adressen.
 * @property {string} till Delens (eller modulens) adress i dag, härledd ur manifestet.
 * @property {string} modul Modulens id.
 * @property {string | null} del Delens id, eller `null` för modulens egen adress (startsidan).
 */

/**
 * Bygger appens omdirigeringar från gamla adresser till modulens delar, eller kastar med skälet.
 *
 * ══ ⛔ MÅLET ÄR ETT ID, INTE EN ADRESS ════════════════════════════════
 *
 * Appen skriver `{ fran: "/inkomster", till: { modul: "ekonomi", del: "inkomster" } }`,
 * och adressen härleds ur manifestet. En handskriven måladress hade varit en
 * andra kopia av delens adress, och den dag delen flyttar hade omdirigeringen
 * pekat på en sida som inte finns (arbetsreglernas punkt 2). Med ett id kastar
 * bygget i stället, vid uppstart.
 *
 * ⛔ `del: null` ÄR MODULENS EGEN ADRESS, alltså startsidan, och den skrivs ut.
 * En utelämnad `del` kastar: "jag menade startsidan" och "jag glömde delen" ser
 * annars likadana ut (arbetsreglernas punkt 5).
 *
 * ⛔ EN GAMMAL ADRESS FÅR INTE VARA EN ADRESS SOM LEVER. En omdirigering från
 * `/ekonomi/inkomster` hade skuggat delen den leder till, och från `/ekonomi`
 * hade den gjort modulen oåtkomlig.
 *
 * @param {ReadonlyArray<{ fran: string, till: { modul: string, del: string | null } }>} lista
 * @param {ReadonlyArray<import("./modul.js").Modul>} moduler Appens registrerade moduler.
 * @returns {ReadonlyArray<Omdirigering>}
 */
export function byggOmdirigeringar(lista, moduler) {
  if (!Array.isArray(lista)) throw new Error(`byggOmdirigeringar: listan måste vara en lista, inte ${typeof lista}. En app utan gamla adresser skickar [].`);
  const reg = new Map((moduler ?? []).map((m) => [m.id, m]));
  /** @type {Omdirigering[]} */
  const ut = [];
  lista.forEach((/** @type {any} */ rad, i) => {
    const var_ = (/** @type {string} */ skal) => new Error(`byggOmdirigeringar: rad ${i} ${JSON.stringify(rad?.fran ?? rad)} ${skal}`);
    if (!rad || typeof rad !== "object" || Array.isArray(rad)) throw var_("måste vara { fran, till: { modul, del } }.");
    const okanda = Object.keys(rad).filter((n) => n !== "fran" && n !== "till");
    if (okanda.length > 0) throw var_(`bär fälten ${okanda.join(", ")} som inte känns igen. En rad bär fran och till.`);
    const fran = typeof rad.fran === "string" ? rad.fran.trim() : "";
    if (!/^\/[^?#\s]*[^/?#\s]$/.test(fran)) throw var_("har ingen giltig fran: en adress som börjar med snedstreck och inte slutar med ett. / ensam är Idag och flyttas aldrig.");
    if (ut.some((x) => x.fran === fran)) throw var_("står två gånger. Vilket mål som gäller hade avgjorts av ordningen.");
    const till = rad.till;
    if (!till || typeof till !== "object" || typeof till.modul !== "string") throw var_("saknar till: { modul, del }. Målet är ett id, adressen härleds ur manifestet.");
    if (!("del" in till)) throw var_('saknar till.del. Skriv delens id, eller null för modulens egen adress (startsidan).');
    const m = reg.get(till.modul);
    if (!m) throw var_(`pekar på modulen "${till.modul}", som inte är registrerad. Registrerade: ${[...reg.keys()].join(", ") || "inga"}.`);
    if (!m.hubb) throw var_(`pekar på modulen "${till.modul}", som har hubb: null och alltså ingen insida att leda till.`);
    const del = till.del === null ? null : m.hubb.delar.find((d) => d.id === till.del);
    if (till.del !== null && !del) throw var_(`pekar på delen "${till.del}", som inte finns i "${m.id}". Delarna: ${m.hubb.delar.map((d) => d.id).join(", ")}.`);
    if (modulLage(moduler, fran)) throw var_("är en adress i en modul. En omdirigering därifrån hade skuggat en sida som lever.");
    /*
     * ⛔ OCH INTE EN ADRESS OVANFÖR EN MODUL. En undersida följer med i `omdirigera`,
     * så `/hub` som gammal adress hade flyttat `/hub/resor` om en modul bodde där.
     */
    const under = (moduler ?? []).find((x) => x.hubb && x.hubb.rutt.startsWith(`${fran}/`));
    if (under) throw var_(`ligger ovanför modulen "${under.id}" (${under.hubb?.rutt}). Undersidor följer med i en omdirigering, så modulens sidor hade flyttats bort från sig själva.`);
    ut.push(Object.freeze({ fran, till: del ? del.rutt : m.hubb.rutt, modul: m.id, del: del ? del.id : null }));
  });
  return Object.freeze(ut);
}

/**
 * Vart en adress ska, om den är en gammal adress. `null` när den inte är det.
 *
 * ⛔ `?` OCH `#` FÖLJER MED. En länk i Inkorgen till `/kostnader?ar=2026` ska
 * landa på samma urval, inte på delens förval.
 *
 * ⛔ EN UNDERSIDA FÖLJER MED. `/kontakter/anna` blir `/ekonomi/kontakter/anna`:
 * ett bokmärke till en rad är värt mer än ett till listan.
 *
 * @param {string} href
 * @param {ReadonlyArray<Omdirigering>} omdirigeringar Ur `byggOmdirigeringar`.
 * @returns {string | null}
 */
export function omdirigera(href, omdirigeringar) {
  const { sokvag, rest } = dela(href);
  for (const o of omdirigeringar) {
    if (sokvag === o.fran) return `${o.till}${rest}`;
    if (sokvag.startsWith(`${o.fran}/`)) return `${o.till}${sokvag.slice(o.fran.length)}${rest}`;
  }
  return null;
}

/**
 * Provet appen kör över sina gamla adresser: varje adress leder till en del av en modul, genom en omdirigering eller för att
 * den redan ligger i modulen, eller kastar med listan över dem som inte gör det.
 *
 * ⛔ LISTAN ÄR APPENS MÄTNING, INTE EN KOPIA AV OMDIRIGERINGARNA. Appen skriver
 * vilka adresser den hade (ur sin router, före flytten) och frågar om var och en
 * når en del. Jämförs omdirigeringarna mot sig själva kan provet inte bli rött
 * (arbetsreglernas punkt 4, "tautologisk lista"); jämförs de mot vad som fanns
 * blir en adress som glömts röd.
 *
 * ⛔ GOLV: minst en adress. En tom lista är ett prov som är grönt av att inget lästes.
 *
 * @param {object} arg
 * @param {ReadonlyArray<string>} arg.gamla Adresserna som fanns före flytten.
 * @param {ReadonlyArray<Omdirigering>} arg.omdirigeringar
 * @param {ReadonlyArray<import("./modul.js").Modul>} arg.moduler
 * @returns {ReadonlyArray<{ fran: string, till: string, modul: string, del: string }>}
 */
export function kontrolleraOmdirigeringar({ gamla, omdirigeringar, moduler }) {
  if (!Array.isArray(gamla) || gamla.length === 0) {
    throw new Error("kontrolleraOmdirigeringar: gamla krävs och måste ha minst en adress. Ett prov över en tom lista är grönt av att ingenting lästes.");
  }
  /** @type {{ fran: string, till: string, modul: string, del: string }[]} */
  const rader = [];
  /** @type {string[]} */
  const fel = [];
  for (const fran of gamla) {
    /*
     * ⛔ EN ADRESS SOM FORTFARANDE LEVER RÄKNAS OCKSÅ. `/ekonomi` var en sida före flytten och är
     * modulens egen adress efter den: den behöver ingen omdirigering, men den måste fortfarande leda till en del.
     */
    const till = omdirigera(fran, omdirigeringar) ?? (modulLage(moduler, fran) ? fran : null);
    if (till === null) {
      fel.push(`${fran}: ingen omdirigering, och adressen ligger inte i någon modul`);
      continue;
    }
    const lage = modulLage(moduler, till);
    if (!lage || !lage.del) {
      fel.push(`${fran} -> ${till}: målet är ingen del i en modul`);
      continue;
    }
    rader.push({ fran, till, modul: lage.modul.id, del: lage.del.id });
  }
  if (fel.length > 0) {
    throw new Error(`kontrolleraOmdirigeringar: ${fel.length} av ${gamla.length} gamla adresser leder ingenstans:\n  ${fel.join("\n  ")}`);
  }
  return Object.freeze(rader);
}
