/**
 * Radkällor: en rad, en panel (0.145.0, cllp/ops-framework#446).
 *
 * ══ ⛔ VARFÖR (CP 2026-10-25 08:22, med en skärmbild av kalenderns dagruta) ═══════════════════════════════════════════
 *
 * "Varför kan man inte dela alla händelser? Och alla kalenderhändelser eller idag-listor kan man inte trycka på. Har inget id. Är det inte
 * bättre att det är likadant för allt?" Appen blandar sju sorters rader i Kalender, Idag och Dagen, och bara händelsen hade en egen sida.
 * En påminnelse, en faktura, en post från Apple och ett ärende gick varken att öppna eller att dela, och en rad som ser ut som de andra
 * men inte gör något lär den som tryckt att inget i listan gör något.
 *
 * ⛔ HETER `radkallor` OCH INTE `kallor`: `lib/kallor.js` är modulernas källkontrakt (en modul som lämnar rader till ramverkets ytor), en annan sak än vilken
 * sort en RAD i en lista är. Två "kallor" i samma ramverk hade fått den ena att läsas som den andra.
 *
 * ══ ⛔ TRE DELAR, OCH VEM SOM ÄGER VAD ═══════════════════════════════════════════════════════════════════════════════
 *
 *   1. RADENS ID, `<källa>:<id>` (`byggRadId`, `lasRadId`). Ramverket äger formen. Appen väljer källorna ("paminnelse", "ekonomi", "ical").
 *   2. PANELEN OCH KNAPPRADENS PLATS (`OpsRadPanel`, `OpsHandelsePanel knapprad`). Ramverket äger dem: rubrik, tid och "Från <källa>" överst,
 *      knappraden längst ned, på samma ställe på varje rad, med Dela sist.
 *   3. MANIFESTET (`radkallor`). Appen äger det: vad källan heter, vilka knappar en rad får och om den går att dela. Ramverket vet aldrig vad Ekonomi
 *      eller GitHub är; det ser en källa, en etikett och en lista knappar.
 *
 * ══ ⛔ MANIFESTETS FORM, OCH VARFÖR DEN ÄR DATA OCH INGA NODER ═══════════════════════════════════════════════════════════
 *
 *   radkallor = {
 *     paminnelse: { etikett: "Påminnelse", atgarder: (rad) => [{ id: "klar", etikett: "Klar", onClick: () => klar(rad) }], dela: () => ({ skal: "Påminnelser delas inte ännu.", istallet: "Skriv en händelse om andra ska se den." }) },
 *     ekonomi:    { etikett: "Ekonomi",    atgarder: (rad) => [{ id: "oppna", etikett: "Öppna i Ekonomi", href: ekonomiHref(rad) }] },
 *   }
 *
 *   - EN KARTA PER KÄLLA, NYCKLAD PÅ KÄLLAN, som `moduler` och ordböckerna (`ORD_*`) är nycklade: en ny källa är en ny nyckel och ingen annan kod
 *     ändras. Nyckeln är samma ord som står före kolonet i radens id, så en rad hittar sin källa utan att appen kopplar något.
 *   - `atgarder` OCH `dela` ÄR FUNKTIONER AV RADEN och inga fasta listor, eftersom knapparna beror på raden: ett ärende har en adress, en faktura
 *     ett nummer, en post från Apple går att kopiera bara om det finns en kalender att kopiera till. Samma erbjudandemönster som `flyttmal()` och
 *     `kopieraTill`: appen räknar ut vad som går, ramverket ritar det.
 *   - KNAPPARNA ÄR `{ id, etikett, ikon?, onClick | href }` OCH INGA FÄRDIGA NODER. Ramverket ritar knappen, så att formen, storleken och PLATSEN inte kan
 *     glida isär mellan källor (CP: knappraden ska alltid stå på samma ställe), och `onClick | href` är samma val som `OpsButton` redan har. Ger
 *     `onClick` ett löfte väntar knappen synligt (0.129.0). En nod hade låtit varje källa rita sin egen knapp, och då hade raden "alltid på samma
 *     ställe" bara gällt tills någon ritade en annan.
 *   - `dela` SVARAR ALLTID: en knapp (`{ onClick | href }`) eller ett skäl (`{ skal, istallet? }`). Ramverket skriver ut skälet i panelen, med vad man
 *     gör i stället (`istallet`), och ritar ingen död knapp. Saknas `dela` helt i en källa står ramverkets förvalda skäl (`delaStandardSkal`): Dela är
 *     aldrig en tyst frånvaro (arbetsreglernas punkt 5, "en knapp som saknas är ett svar ingen ser").
 *
 * ══ ⛔ RADEN SOM FÅR PANELEN ÄR RADEN SJÄLV ═════════════════════════════════════════════════════════════════════════════
 *
 * `atgarder(rad)` och `dela(rad)` får samma objekt som appen skickade till kalendern eller Idag (en `CalendarEntry` eller en `OpsEvent`), och
 * `lasRadId(rad.id)` ger källan och appens eget id. Ramverket bygger ingen tredje form som appen skulle behöva lära sig.
 *
 * ⛔ EN RAD MED `handelseId` ELLER `extern` GÅR ALDRIG HIT. Händelsen har sin panel (`OpsHandelsePanel`, `?handelse=<id>`) och en post från Apple eller Google
 * sin läspanel (`OpsExternPanel`); ett id som råkar börja med en källa i manifestet ändrar inte det. Det är därför "händelser beter sig som i dag".
 */

/** Giltigt namn på en källa: det som står före första kolonet i radens id. Inget kolon, inga blanksteg. */
export const KALLA_FORM = /^[A-Za-z0-9_-]+$/;

/**
 * Radens id: `<källa>:<id>`.
 * @param {string} kalla Källans nyckel i manifestet.
 * @param {string} id Appens eget id för raden. Får innehålla kolon (`kalender:2026-10-28:Attest`): källan är allt före det FÖRSTA.
 * @returns {string}
 */
export function byggRadId(kalla, id) {
  if (typeof kalla !== "string" || !KALLA_FORM.test(kalla)) {
    throw new Error(`byggRadId: källan "${String(kalla)}" är inte ett giltigt namn. Bokstäver, siffror, bindestreck och understreck, utan kolon: kolonet är det som skiljer källan från id:t.`);
  }
  if (typeof id !== "string" || id === "") throw new Error("byggRadId: id krävs, en sträng som inte är tom. Ett id utan sin egen del går inte att slå upp.");
  return `${kalla}:${id}`;
}

/**
 * Källan och appens id ur ett rad-id, eller `null` när strängen inte har formen.
 * ⛔ `null` och inget kast: ett id som `h.id` från en app som inte följer formen är bara en rad utan källa, och beter sig som förut.
 * @param {unknown} radId
 * @returns {{ kalla: string, id: string } | null}
 */
export function lasRadId(radId) {
  if (typeof radId !== "string") return null;
  const i = radId.indexOf(":");
  if (i <= 0) return null;
  const kalla = radId.slice(0, i);
  const id = radId.slice(i + 1);
  if (!KALLA_FORM.test(kalla) || id === "") return null;
  return { kalla, id };
}

/**
 * @typedef {object} Atgard En knapp i panelens knapprad.
 * @property {string} id Unik i radens lista. Provas mot och blir `key`.
 * @property {string} etikett Orden på knappen, appens.
 * @property {import("react").ReactNode} [ikon] Före etiketten. Etiketten står alltid kvar: en ikon ensam är en gåta.
 * @property {(event: any) => void | Promise<unknown>} [onClick] Ger det ett löfte väntar knappen synligt (0.129.0). ⛔ 0.147.0: lyckas löftet stänger panelen, och avslås det står texten ur avslaget i knappraden (`role="alert"`) med panelen kvar. Ger det inget löfte görs åtgärden direkt och panelen står kvar. Exakt en av `onClick` och `href`.
 * @property {string} [href] En adress. Exakt en av `onClick` och `href`.
 * @property {boolean} [nyFlik] Bara med `href`: öppnas i en ny flik.
 * @property {string} [pagarEtikett] (0.147.0, cllp/ops-framework#451) Verbet i pågående form medan ett löfte från `onClick` väntar: "Bockar av…", "Sparar…". Utelämnad står etiketten kvar bredvid snurran.
 */

/**
 * @typedef {object} Delning Svaret från `dela(rad)`: en knapp som delar (exakt en av `onClick` och `href`), eller skälet till att raden inte går att dela (`skal`) och vad man gör i stället (`istallet`).
 * @property {(event: any) => void | Promise<unknown>} [onClick] Delar raden. Ger det ett löfte väntar knappen synligt.
 * @property {string} [href] Delar raden via en adress.
 * @property {boolean} [nyFlik] Bara med `href`.
 * @property {string} [skal] Varför raden inte går att dela, i appens ord. Då ritas ingen knapp utan skälet i klartext.
 * @property {string} [istallet] Vad man gör i stället ("Dela fakturan i Ekonomi"). Bara med `skal`.
 */

/**
 * @typedef {object} Radkalla En källa i manifestet.
 * @property {string | ((rad: any) => string)} etikett Källans namn i appens ord, "Ekonomi", "Apple", "Påminnelse". Står i "Från <etikett>" överst i panelen. En FUNKTION av raden när namnet
 *   beror på raden: Apple och Google ligger under samma källa (`ical`), och raden bär vilken kalender den kommer ur (`(rad) => rad.kalenderNamn`). Den ska ge en text som inte är tom.
 * @property {(rad: any) => ReadonlyArray<Atgard>} [atgarder] Knapparna för raden, i den ordning de ska stå. Tom lista: ingen knapp utom Dela.
 * @property {(rad: any) => Delning} [dela] Om raden går att dela. Saknas den står ramverkets förvalda skäl.
 */

/**
 * @typedef {Record<string, Radkalla>} Radkallor Manifestet: en karta från källans nyckel till källan.
 */

/**
 * @param {string} v
 * @returns {boolean}
 */
function farligAdress(v) {
  return /^\s*(javascript|data|vbscript):/i.test(v);
}

/**
 * Manifestet, kontrollerat. Kastar hellre än ritar en rad som ser tryckbar ut och inte gör något.
 * @param {unknown} kallor
 * @param {string} komponent Vem som frågar, för felets skull.
 * @returns {Radkallor | null} `null` när manifestet utelämnats (då gäller allt som förut).
 */
export function validateRadkallor(kallor, komponent) {
  if (kallor === undefined || kallor === null) return null;
  if (typeof kallor !== "object" || Array.isArray(kallor)) {
    throw new Error(`${komponent}: radkallor måste vara en karta { [källa]: { etikett, atgarder?, dela? } }, eller utelämnas.`);
  }
  for (const [nyckel, k] of Object.entries(/** @type {Record<string, any>} */ (kallor))) {
    if (!KALLA_FORM.test(nyckel)) {
      throw new Error(`${komponent}: källan "${nyckel}" är inte ett giltigt namn. Nyckeln är det som står före kolonet i radens id (\`<källa>:<id>\`), så den får inte innehålla kolon eller blanksteg.`);
    }
    if (!k || typeof k !== "object" || !(typeof k.etikett === "function" || (typeof k.etikett === "string" && k.etikett.trim() !== ""))) {
      throw new Error(`${komponent}: källan "${nyckel}" saknar etikett. Panelen säger "Från <etikett>", och en källa utan namn är en rad som inte säger varifrån den kommer.`);
    }
    if (k.atgarder !== undefined && typeof k.atgarder !== "function") {
      throw new Error(`${komponent}: ${nyckel}.atgarder måste vara en funktion (rad) => lista med knappar, eller utelämnas.`);
    }
    if (k.dela !== undefined && typeof k.dela !== "function") {
      throw new Error(`${komponent}: ${nyckel}.dela måste vara en funktion (rad) => { onClick | href } eller { skal, istallet? }, eller utelämnas.`);
    }
  }
  return /** @type {Radkallor} */ (kallor);
}

/**
 * Raden på sin källa, eller `null` när raden saknar en källa i manifestet.
 * ⛔ `null` är "beter sig som förut": en rad vars id inte har formen, eller vars källa manifestet inte känner, görs inte tryckbar.
 * @param {Radkallor | null | undefined} kallor
 * @param {unknown} radId
 * @returns {{ kalla: string, id: string, manifest: Radkalla } | null}
 */
export function kallaForRad(kallor, radId) {
  if (!kallor) return null;
  const l = lasRadId(radId);
  if (!l) return null;
  if (!Object.prototype.hasOwnProperty.call(kallor, l.kalla)) return null;
  return { kalla: l.kalla, id: l.id, manifest: kallor[l.kalla] };
}

/**
 * Källans namn för en rad: `etikett`, eller vad funktionen ger för raden. Kastar på ett tomt svar: "Från " utan namn är en rad som inte säger varifrån den kommer.
 * @param {Radkalla} manifest
 * @param {{ id: string }} rad
 * @param {string} komponent
 * @returns {string}
 */
export function radkallaEtikett(manifest, rad, komponent) {
  const e = typeof manifest.etikett === "function" ? manifest.etikett(rad) : manifest.etikett;
  if (typeof e !== "string" || e.trim() === "") {
    throw new Error(`${komponent}: etikett(rad) för "${rad.id}" måste ge en text som inte är tom. Panelen säger "Från <etikett>", och utan namnet säger den inte varifrån raden kommer.`);
  }
  return e;
}

/**
 * Knapparna för en rad, kontrollerade: det som panelen ritar i knappraden.
 *
 * @param {Radkalla} manifest
 * @param {{ id: string }} rad
 * @param {string} komponent
 * @returns {{ atgarder: ReadonlyArray<Atgard>, dela: Delning | null }} `dela: null` när källan inte svarar (ramverkets förvalda skäl gäller).
 */
export function losKnapprad(manifest, rad, komponent) {
  const lista = manifest.atgarder ? manifest.atgarder(rad) : [];
  if (!Array.isArray(lista)) {
    throw new Error(`${komponent}: atgarder(rad) för "${rad.id}" måste ge en lista (tom om raden inte har några knappar), inte ${lista === undefined ? "inget alls" : typeof lista}. Ett glömt return hade gett en panel utan knappar som ser ut som en panel utan åtgärder.`);
  }
  const sedda = new Set();
  for (const a of lista) {
    if (!a || typeof a.id !== "string" || a.id === "" || typeof a.etikett !== "string" || a.etikett.trim() === "") {
      throw new Error(`${komponent}: en åtgärd för "${rad.id}" har formen { id, etikett, ikon?, onClick | href }. En knapp utan namn går inte att nå med röst eller skärmläsare.`);
    }
    if (sedda.has(a.id)) throw new Error(`${komponent}: åtgärden "${a.id}" finns två gånger för "${rad.id}". Id:t är knappens nyckel.`);
    sedda.add(a.id);
    const harKlick = typeof a.onClick === "function";
    const harHref = typeof a.href === "string" && a.href !== "";
    if (harKlick === harHref) {
      throw new Error(`${komponent}: åtgärden "${a.id}" måste ha exakt en av onClick och href. En knapp utan åtgärd är en död knapp, och en med båda vet inte vad den ska göra.`);
    }
    if (a.pagarEtikett !== undefined && (typeof a.pagarEtikett !== "string" || a.pagarEtikett.trim() === "")) {
      throw new Error(`${komponent}: åtgärden "${a.id}" har en pagarEtikett som är tom. Den är verbet medan knappen väntar ("Bockar av…"), eller utelämnas så står etiketten kvar.`);
    }
    if (harHref && farligAdress(a.href)) throw new Error(`${komponent}: åtgärden "${a.id}" har en adress som kör kod (${a.href.slice(0, 12)}…). Bara adresser som öppnar en sida.`);
  }
  if (!manifest.dela) return { atgarder: lista, dela: null };
  const d = manifest.dela(rad);
  if (!d || typeof d !== "object") {
    throw new Error(`${komponent}: dela(rad) för "${rad.id}" måste svara med { onClick | href } eller { skal, istallet? }. Inget svar hade sett ut som en rad som går att dela.`);
  }
  if ("skal" in d && d.skal !== undefined) {
    if (typeof d.skal !== "string" || d.skal.trim() === "") throw new Error(`${komponent}: dela(rad) för "${rad.id}" ger ett skal som är tomt. Skälet är hela poängen med att knappen inte finns.`);
    if (d.istallet !== undefined && typeof d.istallet !== "string") throw new Error(`${komponent}: dela(rad).istallet för "${rad.id}" måste vara en text (vad man gör i stället), eller utelämnas.`);
    return { atgarder: lista, dela: { skal: d.skal, ...(d.istallet ? { istallet: d.istallet } : {}) } };
  }
  const harKlick = typeof d.onClick === "function";
  const harHref = typeof d.href === "string" && d.href !== "";
  if (harKlick === harHref) {
    throw new Error(`${komponent}: dela(rad) för "${rad.id}" måste ha exakt en av onClick, href och skal. Dela-knappen ska göra något, eller så ska panelen säga varför den inte gör det.`);
  }
  if (harHref && farligAdress(/** @type {string} */ (d.href))) throw new Error(`${komponent}: dela(rad) för "${rad.id}" har en adress som kör kod.`);
  return { atgarder: lista, dela: d };
}
