/**
 * HTML-dokument i Biblioteket: den avspärrade rutan, utskriften och versionerna (0.156.0, cllp/ops-framework#472).
 *
 * CP 2026-10-29: "Ja, och ja kod får köras i rutan. Man kan ju också be en agent om att uppdatera en artefakt i så fall ... eftersom det är text." Och: "Se till att det funkar via API också. Jätteviktigt."
 * Skälet: slippa exportera en ny PDF varje gång. En rapport eller ett diagram ska ligga i Biblioteket och öppnas direkt, också i telefonen, och agenten ska kunna ändra den.
 *
 * ══ ⛔ RUTAN: VARFÖR `sandbox="allow-scripts allow-modals"` OCH INGET MER ═══════════════════════════════════════════════
 *
 * En HTML-fil kan köra kod. Ritad i appens eget ursprung kan koden läsa inloggningen hos den som öppnar filen och handla i hens namn: vem som helst i gruppen kunde ta över de andras konton genom att ladda upp en fil.
 *
 *   `allow-scripts`          dokumentet får köra sin kod (interaktiva diagram fungerar). Det är CP:s ja.
 *   `allow-modals`           `window.print()` kräver det (knappen Spara som PDF). Ger ingen väg till appens ursprung.
 *   SAKNAS: `allow-same-origin`        utan den får rutan ett eget, anonymt ursprung och når varken appens inloggning, lagring, kakor eller fönster. DET ÄR HELA SKYDDET. Med den (och `allow-scripts`) kan koden i rutan ta bort sandlådan ur sin egen ram.
 *   SAKNAS: `allow-top-navigation`     koden byter inte appens sida (ingen dold omdirigering till en falsk inloggning).
 *   SAKNAS: `allow-popups`             koden öppnar inga fönster.
 *   SAKNAS: `allow-forms`              koden skickar inga formulär.
 *
 * ⛔ INNEHÅLLET GES SOM `srcdoc` UR TEXTEN SOM REDAN HÄMTATS (med inloggningen, `hamtaFil`), ALDRIG SOM EN ADRESS TILL APPENS EGET URSPRUNG. Ett `src` mot appen hade gett rutan appens ursprung.
 * En direktlänk till själva filen laddas ned (`lagringsContentDisposition` i `bibliotek.js`, `attachment`) och ritas aldrig.
 *
 * ⛔ APPENS CSP GÄLLER OCKSÅ RUTAN (hypotes, ska mätas i appen). Ett `srcdoc` ärver sidans Content-Security-Policy. En app som inte tillåter inline-skript i `script-src` stoppar också dokumentets egna skript och
 * skriptet som tar emot utskriftsmeddelandet; texten och formatet visas ändå. Ramverket ändrar ingen CSP.
 *
 * ══ ⛔ SPARA SOM PDF: UTSKRIFT, VÄG 1 ═══════════════════════════════════════════════════════════════════════════════════
 *
 * Knappen vid rutan skickar ett `postMessage` till rutan. Visningen har lagt in ett litet skript FÖRST i `srcdoc` (`HTML_UTSKRIFTSSKRIPT`) som tar emot meddelandet och anropar `window.print()` i rutan.
 * PDF väljs i webbläsarens utskrift. Skriptet svarar bara på ett meddelande vars avsändare är fönstret som ritar rutan (`event.source === parent`): ett meddelande från något annat fönster gör ingenting.
 *
 * ⛔ HYPOTES, INTE MÄTT: iOS Safari kan skriva ut hela sidan i stället för rutan. Mäts på en riktig iPhone innan knappen lovas där. Server-PDF (väg 2) är inte byggd.
 *
 * ══ ⛔ VERSIONERNA ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Att uppdatera ett HTML-dokument skapar en NY VERSION. Den förra finns kvar och kan återställas. Modellen:
 *
 *   POSTEN (en bibliotekspost av typen fil, MIME text/html) är dokumentet och pekar på den NUVARANDE versionens fil (`fil`). Fältet `version` ({ nr, av, tid }) säger vilken version det är och vem som skrev den; det saknas på version 1.
 *   VERSIONSDOKUMENT   ett dokument per ERSATT version, i en samling appen namnger (ramverket känner inte samlingsnamnet), med nyckeln `<postId>|<nr>`: `{ groupId, postId, nr, fil, av, tid }`. Skrivs bara (reglerna nekar ändring och radering).
 *   FILERNA            varje version är ett eget objekt i lagringen (`<mapp>/v<nr>-<namn>`), och ett HTML-objekt ändras aldrig (Storage-regeln nekar en överskrivning). En återställning pekar på det gamla objektet i stället för att kopiera det.
 *
 * ⛔ EN SANNING (regel 2): den nuvarande versionens fil står BARA på posten, och en ersatt versions fil står bara i dess versionsdokument. Listan över versioner är härledd: de ersatta ur samlingen och den nuvarande ur posten (`versionslista`).
 *
 * ⛔ NYCKELN ÄR EN RIKTIG CONSTRAINT. Två som uppdaterar samtidigt ur samma version vill båda skriva `<postId>|<nr>`: bara en får det. Den andra får en konflikt, aldrig en tyst överskrivning.
 *
 * ⛔ REGLERNA TVINGAR SAMBANDET (`bibliotekregelfragment` med `versioner`, `versionsregelfragment`): en HTML-fils sökväg byts bara tillsammans med att nästa versions nummer sätts OCH att versionsdokumentet för den ersatta versionen skrivs i samma skrivning, med exakt
 * den fil och de uppgifter som posten hade. Ett versionsdokument skrivs bara om posten samtidigt går vidare till nästa nummer. Ingen klient kan alltså byta ut en HTML-fil och lämna historiken efter sig.
 *
 * Ramverket ger modellen och de rena funktionerna nedan, och (för servern) `createHtmlDokumentService` i `ops-framework/node`, så att appens API och agent kan läsa innehållet som text, skriva en ny version, lista versioner och återställa.
 */

import { HTML_MIME, MAX_BIBLIOTEKFIL, MAX_HTMLVERSION, POSTIDFORM, arHtmlMime, avkodaTextfil } from "./bibliotek.js";
import { byggSkapare } from "./skapare.js";

/**
 * Sandlådan runt ett HTML-dokument. EXAKT de här två, och inget mer: se filhuvudet. Ett prov mäter strängen, och att `allow-same-origin` saknas.
 */
export const HTML_SANDBOX = "allow-scripts allow-modals";

/** Meddelandet som knappen Spara som PDF skickar till rutan. Typen är det enda i det; rutan svarar inte. */
export const HTML_UTSKRIFTSMEDDELANDE = "ops-framework:skriv-ut";

/**
 * Skriptet som läggs först i rutans `srcdoc`. Det tar emot utskriftsmeddelandet och anropar `window.print()`.
 *
 * ⛔ `event.source === parent` ÄR VILLKORET. I rutan är `parent` fönstret som ritar den (appen). Ett meddelande från en annan ram, ett annat fönster eller dokumentets egen kod har en annan avsändare och ignoreras.
 * `parent` är ett fönster och inget ursprung: rutan har ett anonymt ursprung och kan inte jämföra på det, och `postMessage` till den måste därför gå till `"*"`. Meddelandet bär ingenting som är hemligt.
 */
export const HTML_UTSKRIFTSSKRIPT = `window.addEventListener("message",function(e){if(e.source!==parent)return;var d=e.data;if(d&&d.typ===${JSON.stringify(HTML_UTSKRIFTSMEDDELANDE)}){window.print();}});`;

/** Meddelandet som rutan skickar när en extern länk i dokumentet trycks (0.165.0). Bär bara adressen; fönstret som ritar rutan prövar den (`oppnaExternLank`) och öppnar den i en ny flik. */
export const HTML_LANKMEDDELANDE = "ops-framework:oppna-lank";

/**
 * Skriptet för dokumentets länkar, läggs i `srcdoc` direkt efter utskriftsskriptet (0.165.0, lifehub.app: "interna länkar funkar inte, typ innehållsförteckning").
 *
 * ⛔ VARFÖR: ett `srcdoc` har adressen `about:srcdoc` men ärver BASADRESSEN från fönstret som ritar det. `href="#avsnitt"` blir då appens egen adress plus `#avsnitt`, ett annat dokument än rutan, och ett tryck
 * laddade appens sida i rutan i stället för att skrolla. Skriptet tar trycket på en länk:
 *
 *   `#…`                         skrollar till elementet med det id:t (eller namnet) i rutan. `#` ensam och `#top` skrollar till början. Inget lämnar rutan.
 *   `http(s):`, `mailto:`, `tel:`  skickas som `HTML_LANKMEDDELANDE` till fönstret som ritar rutan, som öppnar den i en ny flik med `noopener`. Rutan får fortfarande inte öppna fönster själv (`allow-popups` saknas).
 *   allt annat (relativa sökvägar, `javascript:`, `data:`)   stoppas: det hade pekat på appens ursprung eller kört kod, och dokumentet har inga andra sidor.
 *
 * ⛔ SÄKERHETEN ÄR OFÖRÄNDRAD: sandlådan är densamma (`HTML_SANDBOX`). Fönstret prövar avsändaren (rutans eget fönster) och adressens protokoll själv; vad skriptet påstår räcker inte.
 */
export const HTML_LANKSKRIPT = `window.addEventListener("click",function(e){if(e.defaultPrevented||e.button>0)return;var t=e.target;if(t&&t.nodeType!==1)t=t.parentElement;var a=t&&t.closest?t.closest("a[href]"):null;if(!a)return;var h=(a.getAttribute("href")||"").trim();if(h.charAt(0)==="#"){e.preventDefault();var id=h.slice(1);try{id=decodeURIComponent(id)}catch(x){}var m=id?document.getElementById(id)||document.getElementsByName(id)[0]:null;if(m){m.scrollIntoView({block:"start"});}else if(!id||id.toLowerCase()==="top"){window.scrollTo(0,0);}return;}e.preventDefault();if(/^(https?:|mailto:|tel:)/i.test(h)){parent.postMessage({typ:${JSON.stringify(HTML_LANKMEDDELANDE)},href:h},"*");}});`;

/**
 * Adressen som fönstret ska öppna för ett `HTML_LANKMEDDELANDE`, eller `""` när den inte får öppnas. Bara `http:`, `https:`, `mailto:` och `tel:`; aldrig `javascript:`, `data:` eller `blob:`.
 * @param {unknown} data Meddelandets innehåll.
 * @returns {string}
 */
export function externLankAdress(data) {
  if (!data || typeof data !== "object" || /** @type {any} */ (data).typ !== HTML_LANKMEDDELANDE) return "";
  const href = /** @type {any} */ (data).href;
  if (typeof href !== "string" || href.length > 4096) return "";
  try {
    const u = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

/**
 * Är posten ett HTML-dokument? En fil med MIME `text/html`.
 * @param {{ typ?: unknown, fil?: { mime?: unknown } | null } | null | undefined} post
 * @returns {boolean}
 */
export function arHtmlDokument(post) {
  return post?.typ === "fil" && arHtmlMime(post.fil?.mime);
}

/**
 * Adressen till helfönstervyn för ett HTML-dokument, ur appens `oppnaHtml(post)` (0.159.0), eller `""` när posten inte ska öppnas så.
 *
 * ⛔ BARA ETT HTML-DOKUMENT MED EN FIL (`arHtmlDokument` och en sökväg). För allt annat är svaret `""` utan att funktionen anropas: appens funktion ska aldrig behöva svara på "är det här HTML?".
 * ⛔ ADRESSEN ÄR EN SIDA I APPEN, ALDRIG FILEN OCH ALDRIG EN `blob:`- ELLER `data:`-ADRESS. Den ska börja med ett snedstreck (en sida i samma app) eller `https://`/`http://`. Allt annat kastar, med skälet:
 * en `javascript:`-, `data:`- eller `blob:`-adress i en länk som öppnas i ett nytt fönster hade kört dokumentets kod med appens rättigheter, och en adress som tyst ignorerades hade lämnat en länk som ser trasig ut utan
 * att någon vet varför. Svarar funktionen `null`, `undefined` eller en tom text gäller posten som förut (nedladdning), och det är ett svar och inget fel.
 *
 * @param {unknown} oppnaHtml `(post) => string | null | undefined`, eller något annat (då `""`).
 * @param {{ typ?: unknown, fil?: { mime?: unknown, sokvag?: unknown } | null } | null | undefined} post
 * @returns {string}
 */
export function htmlVyAdress(oppnaHtml, post) {
  if (typeof oppnaHtml !== "function") return "";
  if (!arHtmlDokument(post) || typeof post?.fil?.sokvag !== "string" || post.fil.sokvag === "") return "";
  const svar = oppnaHtml(post);
  if (svar === null || svar === undefined || svar === "") return "";
  if (typeof svar !== "string" || !HTML_VYADRESSFORM.test(svar)) {
    throw new Error(`oppnaHtml: svaret ska vara adressen till en sida i appen (börja med / eller https://), fick ${typeof svar === "string" ? JSON.stringify(svar.slice(0, 40)) : typeof svar}. En blob-, data- eller javascript-adress är aldrig tillåten: den kör dokumentets kod med appens rättigheter.`);
  }
  return svar;
}

/** Formen på en vy-adress: en sida i appen (`/…`, inte `//…`) eller en `http(s)`-adress. */
const HTML_VYADRESSFORM = /^(?:\/(?!\/)|https?:\/\/)\S*$/;

/**
 * HTML-texten som rutan ritar (`srcdoc`): skriptet för utskriften FÖRST, sedan dokumentet. Har dokumentet en inledande doctype hamnar skriptet direkt efter den: ett `srcdoc` ritas i standardläge av sig självt, men en doctype
 * efter ett skript hade blivit en ignorerad rad, och dokumentet skulle se ut att sakna en.
 *
 * @param {string} html
 * @returns {string}
 */
export function byggSrcdoc(html) {
  const text = typeof html === "string" ? html : "";
  const skript = `<script>${HTML_UTSKRIFTSSKRIPT}${HTML_LANKSKRIPT}</script>`;
  const doctype = /^(?:﻿)?\s*<!doctype[^>]*>/i.exec(text);
  return doctype ? text.slice(0, doctype[0].length) + skript + text.slice(doctype[0].length) : skript + text;
}

/**
 * Filens byte som HTML-text: UTF-8, och Windows-1252 när byten inte är giltig UTF-8 (`avkodaTextfil`). Hela filen, inget avkortas: en halv HTML-fil är inget dokument.
 * @param {Uint8Array | ArrayBuffer} bytes
 * @returns {string}
 */
export function htmlText(bytes) {
  return avkodaTextfil(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

/**
 * Texten som byte att ladda upp (UTF-8), eller ett fel med skälet. Prövar att texten inte är tom och ryms i taket (`MAX_BIBLIOTEKFIL`, som för text).
 *
 * @param {unknown} text
 * @returns {Uint8Array}
 */
export function htmlBytes(text) {
  if (typeof text !== "string") throw new Error("HTML-dokumentet ska vara en text.");
  if (text.trim() === "") throw new Error("HTML-dokumentet är tomt. En ny version med tomt innehåll skrivs inte.");
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_BIBLIOTEKFIL) throw new Error(`HTML-dokumentet är ${bytes.length} byte. Taket är ${MAX_BIBLIOTEKFIL}.`);
  return bytes;
}

// ── Versionerna ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Fälten i ett versionsdokument. Samma lista i regelfragmentet (`versionsregelfragment`). */
export const VERSIONSFALT = /** @type {const} */ (["groupId", "postId", "nr", "fil", "av", "tid"]);

/** Skiljetecknet i versionsdokumentets nyckel, `<postId>|<nr>`. Samma som en katalograds och en plats nyckel. Ett postid kan inte innehålla det (`POSTIDFORM`). */
export const VERSIONSAVGRANSARE = "|";

/**
 * Nyckeln för versionsdokumentet till en ersatt version: `<postId>|<nr>`. Nyckeln ÄR constrainten: ett andra dokument med samma nyckel kan inte finnas, så två som uppdaterar ur samma version kan inte båda få den.
 *
 * @param {unknown} postId
 * @param {unknown} nr
 * @returns {string}
 */
export function versionsnyckel(postId, nr) {
  const id = typeof postId === "string" ? postId : "";
  if (!POSTIDFORM.test(id)) throw new Error(`versionsnyckel: "${id}" är inte ett postid (bokstäver, siffror, - och _, utan snedstreck och |).`);
  if (!Number.isInteger(nr) || /** @type {number} */ (nr) < 1 || /** @type {number} */ (nr) >= MAX_HTMLVERSION) {
    throw new Error(`versionsnyckel: versionen ska vara ett heltal från 1 till ${MAX_HTMLVERSION - 1}, fick ${String(nr)}.`);
  }
  return `${id}${VERSIONSAVGRANSARE}${nr}`;
}

/**
 * Vilken version dokumentet är på nu, vem som skrev den och när. En post som aldrig uppdaterats (inget fält `version`) är version 1, skriven av den som skapade posten, när den skapades.
 *
 * @param {Record<string, any>} post Ett HTML-dokument.
 * @returns {{ nr: number, av: import("./skapare.js").Skapare, tid: number }}
 */
export function nuvarandeVersion(post) {
  if (!arHtmlDokument(post)) throw new Error("nuvarandeVersion: bara ett HTML-dokument (en filpost med MIME text/html) har versioner.");
  const v = post.version;
  if (v && typeof v === "object") return { nr: v.nr, av: byggSkapare(v.av), tid: v.tid };
  return { nr: 1, av: byggSkapare(post.skapadAv), tid: post.skapad };
}

/** Mappen en sökväg ligger i (allt före sista snedstrecket). */
const mapp = (/** @type {string} */ sokvag) => sokvag.slice(0, sokvag.lastIndexOf("/"));

/**
 * Sökvägen nästa version läggs på: i samma mapp som den nuvarande (`grupper/<plats>/bibliotek/<post>/`), som `v<nr>-<slump>-<filens namn>`. Numret är unikt per post, så två versioner delar aldrig objekt, och ett objekt ändras aldrig.
 *
 * ⛔ `slump` GÖR SÖKVÄGEN UNIK PER FÖRSÖK. Två som skriver samtidigt ur samma version vill båda ha nummer plus ett: utan slump hade de skrivit till samma objekt, och den som förlorar hade skrivit över vinnarens fil. Med slump blir förlorarens objekt skräp
 * som inget pekar på, och vinnarens står kvar. Utan `slump` utelämnas den (proven och de som själva garanterar att numret är deras).
 *
 * @param {Record<string, any>} post Ett HTML-dokument.
 * @param {string} [slump] Några tecken ur `[a-z0-9]`.
 * @returns {string}
 */
export function nastaVersionssokvag(post, slump) {
  const nu = nuvarandeVersion(post);
  if (slump !== undefined && !/^[a-z0-9]{1,16}$/.test(slump)) throw new Error("nastaVersionssokvag: slump är 1 till 16 tecken ur a-z och 0-9.");
  return `${mapp(String(post.fil.sokvag))}/v${nu.nr + 1}-${slump ? `${slump}-` : ""}${String(post.fil.namn)}`;
}

/**
 * Byter ut det som en ny version består av: den ersatta versionens dokument och postens nya fält. Rena fält, inget skrivs här.
 *
 * ⛔ DE ERSATTA UPPGIFTERNA ÄR POSTENS EGNA, SÅ SOM DE STÅR (`fil` kopieras oförändrad, `av` och `tid` är de nuvarande versionens). Regeln kräver exakt det, och en historik som bygger på vad anroparen minns är en gissning.
 *
 * @param {object} d
 * @param {Record<string, any>} d.post Dokumentet som det står nu (med `groupId` och `fil`).
 * @param {string} d.postId Postens id.
 * @param {string} d.sokvag Den nya versionens fil (`nastaVersionssokvag` ger den för en ny text; en återställning ger det gamla objektets).
 * @param {number} d.byte Den nya versionens storlek.
 * @param {Record<string, unknown>} d.av Den som skriver, en person (`byggSkapare`, med `via` när en nyckel skriver åt hen).
 * @param {number} d.nu Klockan, millisekunder.
 * @returns {{ id: string, nr: number, version: Record<string, any>, post: { fil: Record<string, any>, version: { nr: number, av: Record<string, any>, tid: number }, andrad: number } }}
 *   `id` och `version` är versionsdokumentet för den ERSATTA versionen, `nr` dess nummer. `post` är fälten att skriva på posten.
 */
export function byggNyVersion(d) {
  const post = d?.post;
  if (!arHtmlDokument(post)) throw new Error("byggNyVersion: bara ett HTML-dokument (en filpost med MIME text/html) har versioner.");
  if (post.fil?.klar === false) throw new Error("byggNyVersion: dokumentets fil är inte uppladdad än. Ett dokument som laddas upp får ingen ny version förrän det är klart.");
  const nuvarande = nuvarandeVersion(post);
  if (nuvarande.nr + 1 > MAX_HTMLVERSION) throw new Error(`Dokumentet har redan ${nuvarande.nr} versioner. Taket är ${MAX_HTMLVERSION}.`);
  const sokvag = typeof d.sokvag === "string" ? d.sokvag : "";
  if (!sokvag || sokvag.startsWith("/") || sokvag.includes("\\") || sokvag.split("/").includes("..")) throw new Error("byggNyVersion: sökvägen går inte att läsa.");
  if (sokvag === post.fil.sokvag) throw new Error("byggNyVersion: den nya versionen har samma fil som den nuvarande. Då finns ingen ny version.");
  if (mapp(sokvag) !== mapp(String(post.fil.sokvag))) throw new Error("byggNyVersion: en ny version läggs i samma mapp som den nuvarande (dokumentets egen).");
  if (!Number.isInteger(d.byte) || d.byte < 1) throw new Error("byggNyVersion: filen är tom.");
  if (d.byte > MAX_BIBLIOTEKFIL) throw new Error(`byggNyVersion: filen är ${d.byte} byte. Taket är ${MAX_BIBLIOTEKFIL}.`);
  if (!Number.isInteger(d.nu) || d.nu < 0) throw new Error("byggNyVersion: nu ska vara millisekunder.");
  const av = byggSkapare(/** @type {any} */ (d.av));
  if (!av.uid) throw new Error("byggNyVersion: en version saknar vem som skrev den.");
  if (av.typ !== "manniska") throw new Error("byggNyVersion: en version skrivs av en medlem, och typen på den som skriver är manniska.");
  const id = versionsnyckel(d.postId, nuvarande.nr);
  // ⛔ `tid` ÄR POSTENS NYA `andrad`: regeln kräver att de är samma, så att "när" står på ett ställe.
  const tid = Math.max(d.nu, Number.isInteger(post.andrad) ? post.andrad : 0);
  return {
    id,
    nr: nuvarande.nr,
    version: { groupId: String(post.groupId), postId: String(d.postId), nr: nuvarande.nr, fil: { ...post.fil }, av: nuvarande.av, tid: nuvarande.tid },
    post: {
      fil: { sokvag, namn: String(post.fil.namn), mime: HTML_MIME, byte: d.byte, klar: true },
      version: { nr: nuvarande.nr + 1, av, tid },
      andrad: tid,
    },
  };
}

/**
 * Skälet till att ett versionsdokument inte håller, eller `null`. Samma prövning som reglerna, så servern och regeln är överens.
 *
 * @param {unknown} v
 * @returns {string | null}
 */
export function versionFel(v) {
  if (!v || typeof v !== "object") return "Versionen saknas.";
  const d = /** @type {Record<string, any>} */ (v);
  const okanda = Object.keys(d).filter((k) => k !== "id" && !(/** @type {readonly string[]} */ (VERSIONSFALT).includes(k)));
  if (okanda.length > 0) return `Versionen har fälten ${okanda.join(", ")}, och de hör inte dit.`;
  for (const f of VERSIONSFALT) if (!(f in d)) return `Versionen saknar fältet ${f}.`;
  if (typeof d.groupId !== "string" || d.groupId === "") return "Versionen saknar plats.";
  if (typeof d.postId !== "string" || !POSTIDFORM.test(d.postId)) return "Versionens postid går inte att läsa.";
  if (!Number.isInteger(d.nr) || d.nr < 1 || d.nr >= MAX_HTMLVERSION) return `Versionens nr ska vara ett heltal från 1 till ${MAX_HTMLVERSION - 1}.`;
  if (!Number.isInteger(d.tid) || d.tid < 0) return "Versionens tid ska vara millisekunder.";
  if (!d.fil || typeof d.fil !== "object" || typeof d.fil.sokvag !== "string" || !arHtmlMime(d.fil.mime) || !Number.isInteger(d.fil.byte)) return "Versionens fil går inte att läsa.";
  if (!d.av || typeof d.av !== "object" || !d.av.uid) return "Versionen saknar vem som skrev den.";
  return null;
}

/**
 * @typedef {object} Versionsrad
 * @property {number} nr
 * @property {boolean} nuvarande Sant för den version dokumentet visar nu.
 * @property {{ sokvag: string, namn: string, mime: string, byte: number, klar?: boolean } | null} fil `null` när versionens dokument saknas.
 * @property {Record<string, any> | null} av Den som skrev versionen, eller `null` när dokumentet saknas.
 * @property {number | null} tid När versionen skrevs, eller `null` när dokumentet saknas.
 * @property {boolean} saknas Sant när versionen borde finnas (numret är före den nuvarande) men dess dokument inte gör det. Det visas, och tigs inte om (arbetsreglernas punkt 5).
 */

/**
 * Versionerna i ordning, den nyaste först: den nuvarande ur posten och de ersatta ur versionsdokumenten. ⛔ HÄRLEDD: inget lagras som en lista (regel 2).
 *
 * Ett dokument som inte hör till posten (annan plats eller annat postid) räknas inte med, och en version som borde finnas men inte gör det kommer med som `saknas: true` i stället för att utelämnas.
 *
 * @param {object} d
 * @param {Record<string, any>} d.post
 * @param {string} d.postId
 * @param {ReadonlyArray<Record<string, any>>} d.versioner Versionsdokumenten som hämtats för posten (i valfri ordning).
 * @returns {{ nuvarande: number, versioner: Versionsrad[], saknas: number[] }}
 */
export function versionslista(d) {
  const post = d.post;
  const nuv = nuvarandeVersion(post);
  /** @type {Map<number, Record<string, any>>} */
  const per = new Map();
  for (const v of d.versioner ?? []) {
    if (versionFel(v) || v.postId !== d.postId || v.groupId !== post.groupId) continue;
    per.set(v.nr, v);
  }
  /** @type {Versionsrad[]} */
  const rader = [{ nr: nuv.nr, nuvarande: true, fil: { ...post.fil }, av: nuv.av, tid: nuv.tid, saknas: false }];
  /** @type {number[]} */
  const saknas = [];
  for (let nr = nuv.nr - 1; nr >= 1; nr -= 1) {
    const v = per.get(nr);
    if (v) rader.push({ nr, nuvarande: false, fil: { ...v.fil }, av: { ...v.av }, tid: v.tid, saknas: false });
    else {
      saknas.push(nr);
      rader.push({ nr, nuvarande: false, fil: null, av: null, tid: null, saknas: true });
    }
  }
  return { nuvarande: nuv.nr, versioner: rader, saknas };
}

/**
 * En återställning till en tidigare version, som en NY version (nummer plus ett) som pekar på den gamla versionens objekt. Historiken är rak och inget skrivs över: att återställa version 2 när dokumentet är på 4 ger version 5
 * med version 2:s innehåll, och 3 och 4 finns kvar.
 *
 * @param {object} d
 * @param {Record<string, any>} d.post
 * @param {string} d.postId
 * @param {ReadonlyArray<Record<string, any>>} d.versioner
 * @param {number} d.nr Versionen som ska tillbaka.
 * @param {Record<string, unknown>} d.av
 * @param {number} d.nu
 * @returns {ReturnType<typeof byggNyVersion>}
 */
export function byggAterstallning(d) {
  const lista = versionslista(d);
  if (!Number.isInteger(d.nr) || d.nr < 1) throw new Error(`byggAterstallning: versionen ska vara ett heltal från 1, fick ${String(d.nr)}.`);
  if (d.nr === lista.nuvarande) throw new Error(`byggAterstallning: version ${d.nr} är redan den nuvarande.`);
  const rad = lista.versioner.find((v) => v.nr === d.nr);
  if (!rad) throw new Error(`byggAterstallning: dokumentet har ${lista.nuvarande} versioner och ingen version ${d.nr}.`);
  if (rad.saknas || !rad.fil) throw new Error(`byggAterstallning: version ${d.nr} saknas i historiken och går inte att återställa.`);
  if (rad.fil.sokvag === d.post.fil.sokvag) throw new Error(`byggAterstallning: den nuvarande versionen har redan version ${d.nr}:s innehåll.`);
  return byggNyVersion({ post: d.post, postId: d.postId, sokvag: rad.fil.sokvag, byte: rad.fil.byte, av: d.av, nu: d.nu });
}
