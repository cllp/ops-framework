/**
 * GeoJSON till en karta (0.223.0, cllp/ops-framework#570).
 *
 * Ingen MapLibre här. Den hämtas av `OpsKartaVy` först när en karta ritas, och `check:delbarhet` mäter att `maplibre-gl` inte ligger i startfilen.
 * Den här filen går att prova utan en karta: läsning, simplestyle, palett, gränser och stilen.
 *
 * ⛔ FÄRGERNA ÄR ARGUMENT, ALDRIG TAL. Stilen tar en färgtabell som komponenten läst ur temats tokens (`lasKartFarger`). En hex här hade varit ett andra original bredvid `tokens.css`.
 *
 * ⛔ GLYFERNA ÄR NOTO SANS, MÄTT 2026-11-10. Ortnamn på ytan ska vara serif enligt CP:s tillägg, men OpenFreeMaps glyfserver
 * (`https://tiles.openfreemap.org/fonts/<namn>/0-255.pbf`) svarar 404 på Noto Serif och 200 på Noto Sans Regular, Bold och Italic.
 * MapLibre ritar ortnamn från glyfer, inte från CSS. Popupens rubrik använder `--font-karta-ort` (serif). Ytans ortnamn använder Noto Sans tills glyfservern har en serif.
 */

/**
 * @typedef {{ type: "Feature", id?: string | number, geometry: { type: string, coordinates?: unknown, geometries?: unknown[] } | null, properties?: Record<string, unknown> }} KartaFeature
 * @typedef {{ typ: string, etikett: string, farg: string }} KartaLagerHuvud
 * @typedef {{ titel: string, beskrivning: string, lager: KartaLagerHuvud[], fel: string[] }} KartaHuvud
 * @typedef {{ type: "FeatureCollection", features: KartaFeature[], karta?: KartaHuvud }} KartaSamling
 * @typedef {{ typ: string, etikett: string, farg: string, antal: number }} KartaLager
 */

/** Vektorbrickor, OpenMapTiles-schema, ingen nyckel. */
export const KARTA_UNDERLAG = "https://tiles.openfreemap.org/planet";

/** Glyfer hos samma leverantör. `{fontstack}` och `{range}` är MapLibres platshållare. */
export const KARTA_GLYFER = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

/**
 * Krediten i kartans hörn. OpenFreeMap kräver den, och OSM-datan likaså. MapLibre ritar den själv när den står på källan.
 * Den får inte tas bort: utan den är visningen ett brott mot datans licens.
 *
 * ⛔ LÄNKAR, INTE ADRESSER I TEXTEN (0.263.0, cllp/lifehub.app#967). Till 0.262.0 stod adresserna i parentes i texten, och krediten blev tre rader på en telefon,
 * mitt över kartan (mätt i montaget för #967). Samma tre namn och samma tre adresser, som länkar: en rad.
 */
export const KARTA_TILLHORIGHET = [kredit("© OpenStreetMap", "https://www.openstreetmap.org/copyright"), kredit("© OpenFreeMap", "https://openfreemap.org/"), kredit("© OpenMapTiles", "https://openmaptiles.org/")].join(" ");

/**
 * Kartgrunderna (0.258.0, cllp/lifehub.app#950 skiva 2). CP 2026-11-24: "Vi kör utan kostnader nu". Karta är OpenFreeMap som förut. Terräng är samma
 * stil med skuggad terräng ur fria höjddata och skog och gräs ur kartdatan, så att terrängen följer våra färger och ortnamn i stället för att vara en
 * annan karta. Satellit (Esri, inom gratisnivån) kommer i en egen skiva, när Groks konto och nyckel finns.
 */
export const KARTGRUNDER = Object.freeze(["karta", "terrang"]);

/**
 * Höjddata för terrängen: Mapterhorn (Copernicus GLO-30 och regionala källor), ingen nyckel, kommersiell användning tillåten enligt projektets egna
 * frågor och svar (läst i Fables granskning i #950). Adressen är den MapLibres egna exempel använder.
 *
 * ⛔ RESERVEN FINNS FRÅN BÖRJAN. Mapterhorn är ett litet projekt utan löfte om drift. Faller dess brickor byter kartan till AWS Terrain Tiles (samma
 * kodning, ingen nyckel, mätt härifrån 2026-11-24: HTTP 200 image/png), och faller också den säger kartan det i stället för att visa en grund utan
 * skuggning som om allt var bra (regel 5).
 */
export const TERRANG_UNDERLAG = "https://tiles.mapterhorn.com/tilejson.json";
export const TERRANG_RESERV = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const TERRANG_TILLHORIGHET = kredit("© Mapterhorn", "https://mapterhorn.com/attribution");
export const TERRANG_RESERV_TILLHORIGHET = kredit("© Mapzen, AWS Terrain Tiles", "https://registry.opendata.aws/terrain-tiles");

/** Lagren ur kartdatan som bara syns i Terräng. Skuggningen (`TERRANG_SKUGGA`) läggs till först när Terräng väljs. */
export const TERRANG_LAGER = Object.freeze(["mark-skog", "mark-gras"]);
export const TERRANG_SKUGGA = "terrang-skugga";

/**
 * En kredit som länk (0.263.0). MapLibre ritar källans `attribution` som HTML, och texten här är ramverkets egen, aldrig en fils. En deklaration (inte en pil) så att
 * krediterna ovanför kan använda den. ⛔ Den står direkt före en funktion: `check-utvecklarord` läser `a>` i mallen som JSX-text fram till nästa `{`, och skulle annars
 * läsa konstantnamnen efter mallen som användartext.
 * @param {string} text @param {string} adress
 */
function kredit(text, adress) {
  return `<a href="${adress}" target="_blank" rel="noopener noreferrer">${text}</a>`;
}

/**
 * Höjddatans källa, som läggs till först när någon väljer Terräng (0.258.0). ⛔ INTE I STILEN FRÅN BÖRJAN: en källa i stilen hämtar sin
 * beskrivning när kartan ritas, och då hade varje karta i Biblioteket skickat personens adress till Mapterhorn fast ingen valt Terräng
 * (Fables punkt om vem som får adressen). `reserv` ger AWS Terrain Tiles.
 *
 * @param {boolean} [reserv]
 */
export function terrangKalla(reserv = false) {
  return reserv
    ? { type: "raster-dem", tiles: [TERRANG_RESERV], tileSize: 256, maxzoom: 15, encoding: "terrarium", attribution: TERRANG_RESERV_TILLHORIGHET }
    : { type: "raster-dem", url: TERRANG_UNDERLAG, encoding: "terrarium", attribution: TERRANG_TILLHORIGHET };
}

/**
 * Skuggningens lager, i temats färger. Läggs under vattnet, så att havet inte skuggas.
 *
 * @param {Record<string, string>} farger
 */
export function terrangSkugga(farger) {
  return {
    id: TERRANG_SKUGGA,
    type: "hillshade",
    source: "terrang",
    paint: { "hillshade-shadow-color": farger.text, "hillshade-highlight-color": farger.papper, "hillshade-accent-color": farger.text, "hillshade-exaggeration": 0.35 },
  };
}

/** @param {Record<string, string>} farger */
export function skuggPensel(farger) {
  return [
    [TERRANG_SKUGGA, "hillshade-shadow-color", farger.text],
    [TERRANG_SKUGGA, "hillshade-highlight-color", farger.papper],
    [TERRANG_SKUGGA, "hillshade-accent-color", farger.text],
  ];
}

/**
 * Ortnamnens lager, i nivåer som mallen (0.258.0). Förr låg tätort, by och småort i ett lager från zoom 8 utan rangordning, så en småort kunde tränga
 * undan en tätort (Fables granskning). Nu har varje nivå sin zoom, och inom en nivå vinner den med lägst `rank`. Öar kom inte med alls förr.
 * Zoomgränserna är stilens, inte datans: vad brickorna bär på zoom 8 till 10 gick inte att mäta härifrån (OpenFreeMap svarar inte i den här miljön).
 */
export const ORTNAMN_LAGER = Object.freeze(["ort-land", "ort-stad", "ort-tator", "ort-by", "ort-smaort", "ort-o"]);

/** Lagren ett tryck frågar, överst först, så en punkt på en linje vinner. */
export const OBJEKT_LAGER = ["objekt-punkt", "objekt-linje", "objekt-yta"];

/**
 * Punkternas skugga (0.263.0, cllp/lifehub.app#967). Den går inte att trycka på, men den följer lagrets filter: ett avslaget lager tar med sig sina
 * skuggor, annars hade det stått mjuka fläckar kvar där punkterna var.
 */
export const PUNKT_SKUGGA = "objekt-punkt-skugga";

/** Lagren som lagrets filter sätts på: de tryckbara och punkternas skugga. */
export const OBJEKT_FILTERLAGER = [...OBJEKT_LAGER, PUNKT_SKUGGA];

/** Token per fält. Accenten är instansens, de andra är kartans egna. */
export const KARTA_FALT = [
  ["papper", "--color-karta-papper"],
  ["creme", "--color-karta-creme"],
  ["vatten", "--color-karta-vatten"],
  ["linje", "--color-karta-linje"],
  ["lera", "--color-karta-lera"],
  ["text", "--color-karta-text"],
  ["salvia", "--color-karta-salvia"],
  ["ockra", "--color-karta-ockra"],
  ["terrakotta", "--color-karta-terrakotta"],
  ["djuphav", "--color-karta-djuphav"],
  ["oliv", "--color-karta-oliv"],
  ["accent", "--color-accent"],
  ["ort", "--font-karta-ort"],
  ["etikett", "--font-karta-etikett"],
];

/**
 * Objektens palett, i den ordning lagren får färg (0.258.0, cllp/lifehub.app#950).
 *
 * ⛔ SEX FÄRGER, INTE TRE. Förr valdes färgen ur `typ` med en summa av teckenkoder mot tre färger, så två lager kunde få samma färg
 * redan vid två typer, och Sardinienkartan har sex lager med innehåll (Fables granskning i #950, mätt i v10). Nu får lagren färg i
 * ordning: kartans huvud först, sedan i den ordning typerna först förekommer. Djuphav och oliv kommer ur kartmallen som CP har sett,
 * och lera finns redan som kartans tystare ton. Först efter sex lager börjar paletten om.
 */
export const KARTA_PALETT = Object.freeze(["salvia", "ockra", "terrakotta", "djuphav", "oliv", "lera"]);
const PALETT = KARTA_PALETT;
const PUNKTER = new Set(["Point", "MultiPoint"]);
const LINJER = new Set(["LineString", "MultiLineString"]);
const YTOR = new Set(["Polygon", "MultiPolygon"]);
const KANDA = new Set([...PUNKTER, ...LINJER, ...YTOR]);
const RADIE = { small: 4, medium: 6, large: 10 };

/**
 * Läser kartans färger och typsnitt ur ett elements beräknade stil. Tomma fält räknas upp: en saknad token ska synas, inte ersättas med en gissning.
 *
 * @param {Element} [rot]
 * @returns {{ farger: Record<string, string>, saknas: string[] }}
 */
export function lasKartFarger(rot = document.documentElement) {
  const stil = getComputedStyle(rot);
  /** @type {Record<string, string>} */
  const farger = {};
  /** @type {string[]} */
  const saknas = [];
  for (const [nyckel, token] of KARTA_FALT) {
    const varde = stil.getPropertyValue(token).trim();
    farger[nyckel] = varde;
    if (!varde) saknas.push(token);
  }
  return { farger, saknas };
}

/**
 * GeoJSON ur ett objekt eller en JSON-sträng. Svarar en FeatureCollection, eller `ok: false` och ett felord (`json` eller `form`). Kastar inte: en fil en människa lagt in är inte ett programmeringsfel.
 *
 * @param {unknown} data
 * @returns {{ ok: true, samling: KartaSamling } | { ok: false, fel: "json" | "form" }}
 */
export function lasGeojson(data) {
  let varde = data;
  if (typeof data === "string") {
    try {
      varde = JSON.parse(data);
    } catch {
      return { ok: false, fel: "json" };
    }
  }
  const samling = tillSamling(varde);
  if (!samling) return { ok: false, fel: "form" };
  samling.karta = lasHuvud(/** @type {any} */ (varde)?.karta);
  return { ok: true, samling };
}

/**
 * Kartans huvud (0.258.0, cllp/lifehub.app#950): titel, beskrivning och lagren med etikett och färg, i fältet `karta` på samlingen.
 *
 * ⛔ HUVUDET ÄR VALFRITT. En vanlig GeoJSON utan huvud får ändå lager: varje `typ` blir ett lager med sitt värde som etikett
 * (`kartansLager`). Huvudet behövs bara för att byta etikett, färg eller ordning. Det är Fables ändring 1 i #950: lagret är `typ`,
 * inte ett nytt fält, eftersom två fält för samma sak glider isär (regel 2).
 *
 * ⛔ FÄRGEN ÄR ETT PALETTNAMN, ALDRIG EN HEX. En hex i datan hade varit ett andra original bredvid temat och sett fel ut i mörkt läge.
 * Det som inte går att använda står i `fel`, aldrig tyst (regel 5): ett okänt palettnamn, ett lager utan typ, och samma typ två gånger.
 *
 * @param {unknown} varde
 * @returns {KartaHuvud}
 */
export function lasHuvud(varde) {
  /** @type {KartaHuvud} */
  const huvud = { titel: "", beskrivning: "", lager: [], fel: [] };
  if (varde === undefined || varde === null) return huvud;
  if (typeof varde !== "object" || Array.isArray(varde)) {
    huvud.fel.push("huvud:form");
    return huvud;
  }
  const h = /** @type {Record<string, unknown>} */ (varde);
  huvud.titel = text(h.titel);
  huvud.beskrivning = text(h.beskrivning);
  if (h.lager === undefined) return huvud;
  if (!Array.isArray(h.lager)) {
    huvud.fel.push("lager:form");
    return huvud;
  }
  const sedda = new Set();
  for (const rad of h.lager) {
    const r = rad && typeof rad === "object" ? /** @type {Record<string, unknown>} */ (rad) : {};
    const typ = text(r.typ);
    if (!typ) {
      huvud.fel.push("lager:utan-typ");
      continue;
    }
    if (sedda.has(typ)) {
      huvud.fel.push(`lager:dubblett:${typ}`);
      continue;
    }
    sedda.add(typ);
    let farg = text(r.farg);
    if (farg && !PALETT.includes(farg)) {
      huvud.fel.push(`farg:okand:${farg}`);
      farg = "";
    }
    huvud.lager.push({ typ, etikett: text(r.etikett) || typ, farg });
  }
  return huvud;
}

/**
 * Kartans lager, i den ordning de ska visas (0.258.0, cllp/lifehub.app#950). Ett objekt hör till exakt ett lager: sin `typ` (eller `type`).
 *
 * Ordningen: huvudets lager först, också de som saknar objekt (antal 0 är ett svar, regel 5), sedan övriga typer i den ordning de först
 * förekommer, och sist objekten utan typ (`typ` är då tom, och etiketten väljer vyn). Färgen är huvudets palettnamn, annars nästa lediga
 * färg i `KARTA_PALETT`. Objekt utan typ har ingen palettfärg: de ritas i instansens accent, som förut.
 *
 * @param {KartaSamling} samling
 * @returns {KartaLager[]}
 */
export function kartansLager(samling) {
  const huvud = samling.karta ?? lasHuvud(undefined);
  /** @type {Map<string, number>} */
  const antal = new Map();
  /** @type {string[]} */
  const ordning = [];
  for (const feature of samling.features) {
    const typ = typAv(egenskaperAv(feature));
    if (!antal.has(typ)) ordning.push(typ);
    antal.set(typ, (antal.get(typ) ?? 0) + 1);
  }
  /** @type {KartaLager[]} */
  const lager = huvud.lager.map((l) => ({ typ: l.typ, etikett: l.etikett, farg: l.farg, antal: antal.get(l.typ) ?? 0 }));
  const iHuvudet = new Set(lager.map((l) => l.typ));
  for (const typ of ordning) if (typ && !iHuvudet.has(typ)) lager.push({ typ, etikett: typ, farg: "", antal: antal.get(typ) ?? 0 });
  const upptagna = new Set(lager.map((l) => l.farg).filter(Boolean));
  let nasta = 0;
  for (const l of lager) {
    if (l.farg) continue;
    const ledig = PALETT.find((f) => !upptagna.has(f));
    l.farg = ledig ?? PALETT[nasta++ % PALETT.length];
    upptagna.add(l.farg);
  }
  if (antal.has("")) lager.push({ typ: "", etikett: "", farg: "", antal: antal.get("") ?? 0 });
  return lager;
}

/**
 * Objektets id för det som ska överleva en ändring i filen, som en stjärna (0.258.0, cllp/lifehub.app#950).
 *
 * ⛔ BARA ETT ID SOM STÅR I FILEN. `properties.id` först (MapLibre behåller bara heltal som feature-id), sedan `feature.id`. Radnumret
 * är aldrig ett id här: det flyttar när filen ändras, och då hamnar stjärnan på fel plats (Fables ändring 4). Saknas id är svaret
 * `null`, och den som vill stjärnmärka säger att det inte går.
 *
 * @param {KartaFeature} feature
 * @returns {string | null}
 */
export function objektId(feature) {
  for (const v of [egenskaperAv(feature).id, feature.id]) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/**
 * @param {unknown} varde
 * @returns {KartaSamling | null}
 */
function tillSamling(varde) {
  if (!varde || typeof varde !== "object") return null;
  const post = /** @type {any} */ (varde);
  if (post.type === "FeatureCollection" && Array.isArray(post.features)) {
    return { type: "FeatureCollection", features: post.features.flatMap((/** @type {any} */ f) => dela(f)) };
  }
  if (post.type === "Feature") return { type: "FeatureCollection", features: dela(post) };
  if (KANDA.has(post.type) || post.type === "GeometryCollection") {
    return { type: "FeatureCollection", features: dela({ type: "Feature", geometry: post, properties: {} }) };
  }
  return null;
}

/**
 * Ett objekt blir en eller flera features. GeometryCollection delas, och en geometri som inte är punkt, linje eller yta släpps.
 *
 * @param {any} feature
 * @returns {KartaFeature[]}
 */
function dela(feature) {
  if (!feature || feature.type !== "Feature" || !feature.geometry) return [];
  const geometri = feature.geometry;
  const egenskaper = egenskaperAv(feature);
  if (geometri.type === "GeometryCollection" && Array.isArray(geometri.geometries)) {
    return geometri.geometries.flatMap((/** @type {any} */ g) => dela({ type: "Feature", geometry: g, properties: egenskaper, id: feature.id }));
  }
  if (!KANDA.has(geometri.type) || !Array.isArray(geometri.coordinates)) return [];
  return [{ type: "Feature", id: feature.id, geometry: geometri, properties: egenskaper }];
}

/** @param {any} feature */
function egenskaperAv(feature) {
  const p = feature?.properties;
  return p && typeof p === "object" && !Array.isArray(p) ? p : {};
}

/**
 * Färgerna ett objekt ritas med, ur simplestyle, annars ur `typ`/`type` mot paletten, annars instansens accent.
 *
 * @param {KartaFeature} feature
 * @param {Record<string, string>} farger
 * @param {Map<string, string>} [lagerFarg] Palettnamn per typ, ur `kartansLager`. Utan den räknas lagret ut för objektet ensamt.
 */
export function objektFarg(feature, farger, lagerFarg = fargPerTyp({ type: "FeatureCollection", features: [feature] })) {
  const p = egenskaperAv(feature);
  const slag = feature.geometry?.type ?? "";
  const fyllNycklar = YTOR.has(slag) ? ["fill", "marker-color", "stroke"] : PUNKTER.has(slag) ? ["marker-color", "stroke", "fill"] : ["stroke", "marker-color", "fill"];
  const streckNycklar = YTOR.has(slag) ? ["stroke", "marker-color", "fill"] : fyllNycklar;
  const fyll = valj(farger, p, fyllNycklar, lagerFarg);
  const streck = valj(farger, p, streckNycklar, lagerFarg);
  const markor = valj(farger, p, ["marker-color", "stroke", "fill"], lagerFarg);
  return {
    _fyll: fyll,
    _streck: streck,
    _markor: markor,
    _fyllOpacitet: opacitet(p["fill-opacity"]) ?? 0.6,
    _streckOpacitet: opacitet(p["stroke-opacity"]) ?? 1,
    _streckBredd: bredd(p["stroke-width"]) ?? 2,
    _radie: radieAv(p["marker-size"]),
  };
}

/**
 * En kopia där varje objekt bär sina färger. Anroparens data rörs inte.
 *
 * @param {KartaSamling} samling
 * @param {Record<string, string>} farger
 */
export function berika(samling, farger) {
  const lagerFarg = fargPerTyp(samling);
  return {
    type: "FeatureCollection",
    features: samling.features.map((feature, i) => ({
      type: "Feature",
      id: feature.id ?? i,
      geometry: feature.geometry,
      properties: { ...egenskaperAv(feature), ...objektFarg(feature, farger, lagerFarg), _lager: typAv(egenskaperAv(feature)) },
    })),
  };
}

/**
 * @param {KartaSamling} samling
 * @returns {Map<string, string>}
 */
function fargPerTyp(samling) {
  return new Map(kartansLager(samling).filter((l) => l.typ).map((l) => [l.typ, l.farg]));
}

/**
 * @param {Record<string, string>} farger
 * @param {Record<string, unknown>} p
 * @param {string[]} nycklar
 * @param {Map<string, string>} lagerFarg
 */
function valj(farger, p, nycklar, lagerFarg) {
  for (const nyckel of nycklar) {
    const h = hex(p[nyckel]);
    if (h) return h;
  }
  const palettnamn = lagerFarg.get(typAv(p));
  if (palettnamn) return farger[palettnamn];
  return farger.accent;
}

/** @param {Record<string, unknown>} p */
function typAv(p) {
  const t = p.typ ?? p.type;
  return typeof t === "string" && t.trim() ? t.trim() : "";
}

/** @param {unknown} varde */
function hex(varde) {
  if (typeof varde !== "string") return "";
  const s = varde.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s) ? s : "";
}

/** @param {unknown} varde */
function opacitet(varde) {
  const n = tal(varde);
  return n === null || n < 0 || n > 1 ? null : n;
}

/** @param {unknown} varde */
function radieAv(varde) {
  if (varde === "small" || varde === "large") return RADIE[varde];
  return RADIE.medium;
}

/** @param {unknown} varde */
function bredd(varde) {
  const n = tal(varde);
  return n === null || n < 0 || n > 24 ? null : n;
}

/** @param {unknown} varde */
function tal(varde) {
  const n = typeof varde === "number" ? varde : typeof varde === "string" && varde.trim() !== "" ? Number(varde) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Namn och beskrivning ur properties. simplestyle heter `title` och `description`, en svensk fil heter `namn` och `beskrivning`. Första träffen som är en icke-tom sträng vinner.
 *
 * @param {KartaFeature} feature
 */
export function popupTexter(feature) {
  const p = egenskaperAv(feature);
  return {
    namn: text(p.namn) || text(p.name) || text(p.title),
    beskrivning: text(p.beskrivning) || text(p.description),
  };
}

/** @param {unknown} varde */
function text(varde) {
  return typeof varde === "string" ? varde.trim() : "";
}

/**
 * Popupens innehåll som element. Texten sätts med `textContent`, aldrig som HTML: namn och beskrivning kommer ur en fil.
 *
 * @param {KartaFeature} feature
 * @returns {HTMLElement | null} `null` när både namn och beskrivning saknas. En tom ruta hade sett ut som ett fel.
 */
export function popupElement(feature) {
  const { namn, beskrivning } = popupTexter(feature);
  if (!namn && !beskrivning) return null;
  const rot = document.createElement("div");
  rot.className = "grid gap-1";
  if (namn) {
    const rubrik = document.createElement("p");
    // ⛔ TEXTEN FÖLJER APPENS TOKEN, INTE KARTANS (0.234.0). CP 2026-11-16, med en skärmbild i mörkt läge: "kontrasterna funkar inte på locations". Rubriken var
    // `text-karta-text`, som är ljus i mörkt läge, på MapLibres vita ruta. Rutan bär nu appens yta (`--color-raised`, se `KARTPOPUP_CSS`) och texten appens bläck.
    rubrik.className = "m-0 font-karta-ort text-rubrik text-ink";
    rubrik.textContent = namn;
    rot.append(rubrik);
  }
  if (beskrivning) {
    const brod = document.createElement("p");
    brod.className = "m-0 font-karta-etikett text-etikett text-ink-secondary wrap-anywhere";
    brod.textContent = beskrivning;
    rot.append(brod);
  }
  return rot;
}

/**
 * [[väst, syd], [öst, nord]], eller `null` när inget koordinatpar går att läsa.
 *
 * @param {KartaSamling} samling
 * @returns {[[number, number], [number, number]] | null}
 */
export function granser(samling) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let n = 0;
  for (const feature of samling.features) {
    gaKoordinater(feature.geometry && "coordinates" in feature.geometry ? feature.geometry.coordinates : null, (x, y) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      n += 1;
    });
  }
  if (!n) return null;
  return [[minX, minY], [maxX, maxY]];
}

/** @param {unknown} koord @param {(x: number, y: number) => void} cb */
function gaKoordinater(koord, cb) {
  if (!Array.isArray(koord)) return;
  if (typeof koord[0] === "number" && typeof koord[1] === "number") {
    if (Number.isFinite(koord[0]) && Number.isFinite(koord[1])) cb(koord[0], koord[1]);
    return;
  }
  for (const del of koord) gaKoordinater(del, cb);
}

const GLYF_ORT = ["Noto Sans Regular"];
const GLYF_ORT_STOR = ["Noto Sans Bold"];
const GLYF_ETIKETT = ["Noto Sans Regular"];
const GLYF_VATTEN = ["Noto Sans Italic"];

const ortText = ["coalesce", ["get", "name:sv"], ["get", "name"], ["get", "name_en"]];

/**
 * Baslagrens färger, samma värden som `byggStil` skriver. Temabytet sätter om dem utan att bygga om kartan.
 *
 * @param {Record<string, string>} farger
 * @returns {Array<[string, string, string]>}
 */
export function basPensel(farger) {
  const ort = [farger.text, farger.papper];
  return [
    ["bakgrund", "background-color", farger.papper],
    ["vatten", "fill-color", farger.vatten],
    ["vattendrag", "line-color", farger.vatten],
    ["kust", "line-color", farger.lera],
    ["vag-stor", "line-color", farger.linje],
    ["vag-mellan", "line-color", farger.linje],
    ["vag-liten", "line-color", farger.linje],
    ["grans", "line-color", farger.linje],
    ["byggnad", "fill-color", farger.creme],
    ["byggnad", "fill-outline-color", farger.linje],
    ["ort-land", "text-color", ort[0]],
    ["ort-land", "text-halo-color", ort[1]],
    ["ort-stad", "text-color", ort[0]],
    ["ort-stad", "text-halo-color", ort[1]],
    ["ort-tator", "text-color", ort[0]],
    ["ort-tator", "text-halo-color", ort[1]],
    ["ort-by", "text-color", ort[0]],
    ["ort-by", "text-halo-color", ort[1]],
    ["ort-smaort", "text-color", ort[0]],
    ["ort-smaort", "text-halo-color", ort[1]],
    ["ort-o", "text-color", ort[0]],
    ["ort-o", "text-halo-color", ort[1]],
    ["mark-skog", "fill-color", farger.salvia],
    ["mark-gras", "fill-color", farger.salvia],
    ["vag-namn", "text-color", farger.lera],
    ["vag-namn", "text-halo-color", farger.papper],
    ["vatten-namn", "text-color", farger.text],
    ["vatten-namn", "text-halo-color", farger.papper],
  ];
}

/**
 * Objektlagrens färguttryck. Accenten ligger sist i `coalesce`, så ett objekt utan egen färg följer instansen, också efter ett temabyte.
 *
 * ⛔ PUNKTEN HAR EN LJUS RING OCH EN MJUK SKUGGA (0.263.0, cllp/lifehub.app#967), som markörerna i Sardinienkartan CP ställde bredvid appens. Till 0.262.0
 * hade punkten en ring i textens färg. Ringen är nu papper, och skuggan i textens färg ger kanten mot den ljusa grunden: det är den som gör att också
 * ockra (under 3:1 mot papper, `karta.test.js`) syns.
 *
 * @param {Record<string, string>} farger
 */
export function objektPensel(farger) {
  return [
    ["objekt-yta", "fill-color", ["coalesce", ["get", "_fyll"], farger.accent]],
    ["objekt-linje", "line-color", ["coalesce", ["get", "_streck"], farger.accent]],
    ["objekt-punkt", "circle-color", ["coalesce", ["get", "_markor"], farger.accent]],
    ["objekt-punkt", "circle-stroke-color", farger.papper],
    [PUNKT_SKUGGA, "circle-color", farger.text],
  ];
}

/**
 * Vilka lager som syns i en kartgrund och med ortnamnen av eller på (0.258.0). Svaret är `[lager, "visible" | "none"]` för varje lager grunden styr,
 * så att vyn sätter allt i ett svep och ingenting står kvar från förra grunden.
 *
 * @param {string} grund En av `KARTGRUNDER`.
 * @param {boolean} ortnamn
 * @returns {[string, "visible" | "none"][]}
 */
export function grundensSynlighet(grund, ortnamn) {
  const terrang = grund === "terrang";
  return [
    ...TERRANG_LAGER.map((id) => /** @type {[string, "visible" | "none"]} */ ([id, terrang ? "visible" : "none"])),
    ...ORTNAMN_LAGER.map((id) => /** @type {[string, "visible" | "none"]} */ ([id, ortnamn ? "visible" : "none"])),
  ];
}

/**
 * Filtret på objektlagren när några lager är avslagna (0.258.0, skiva 3). Grundfiltret (geometrin) ligger kvar, och lagret läses ur `_lager`, som
 * `berika` sätter ur objektets typ. Utan avslagna lager är filtret bara grundfiltret, så ingenting ändras för den som inte rör panelen.
 *
 * @param {unknown} grundfilter Lagrets filter ur `byggStil`.
 * @param {string[]} avslagna Typerna som är avslagna. Tom typ är objekten utan typ.
 */
export function lagerFilter(grundfilter, avslagna) {
  if (!avslagna.length) return grundfilter;
  return ["all", grundfilter, ["!", ["in", ["get", "_lager"], ["literal", avslagna]]]];
}

/**
 * MapLibre-stil. Underlaget är OpenFreeMaps planet. Objekten ligger sist, med färgerna ur `berika`.
 *
 * @param {Record<string, string>} farger
 * @param {KartaSamling} samling
 */
export function byggStil(farger, samling) {
  const pensel = Object.fromEntries(basPensel(farger).map((/** @type {[string, string, string]} */ rad) => [`${rad[0]}.${rad[1]}`, rad[2]]));
  /** @param {string} id @param {string} prop */
  const p = (id, prop) => pensel[`${id}.${prop}`];
  /** @param {string} id @param {string[]} klasser @param {number} tunn @param {number} tjock */
  const vag = (id, klasser, tunn, tjock) => ({
    id,
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
    filter: ["all", ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false], ["match", ["get", "class"], klasser, true, false]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": p(id, "line-color"), "line-width": ["interpolate", ["linear"], ["zoom"], 5, tunn, 14, tjock] },
  });
  /** @param {string} id @param {string[]} klasser @param {string[]} font @param {number} min @param {number} max */
  const ort = (id, klasser, font, min, max) => ({
    id,
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "place",
    minzoom: min,
    maxzoom: max,
    filter: ["match", ["get", "class"], klasser, true, false],
    layout: { "text-field": ortText, "text-font": font, "text-size": min >= 8 ? 13 : 15, "text-max-width": 8, "symbol-sort-key": ["coalesce", ["get", "rank"], 99] },
    paint: { "text-color": p(id, "text-color"), "text-halo-color": p(id, "text-halo-color"), "text-halo-width": 1.5 },
  });
  /** @param {string} id @param {string[]} klasser @param {number} tathet */
  const mark = (id, klasser, tathet) => ({
    id,
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landcover",
    filter: ["match", ["get", "class"], klasser, true, false],
    layout: { visibility: "none" },
    paint: { "fill-color": p(id, "fill-color"), "fill-opacity": tathet },
  });
  return {
    version: 8,
    name: "ops-karta",
    glyphs: KARTA_GLYFER,
    sources: {
      openmaptiles: { type: "vector", url: KARTA_UNDERLAG, attribution: KARTA_TILLHORIGHET },
      objekt: { type: "geojson", data: berika(samling, farger) },
    },
    layers: [
      { id: "bakgrund", type: "background", paint: { "background-color": p("bakgrund", "background-color") } },
      mark("mark-skog", ["wood", "forest"], 0.16),
      mark("mark-gras", ["grass", "scrub", "farmland"], 0.08),
      { id: "vatten", type: "fill", source: "openmaptiles", "source-layer": "water", filter: ["!=", ["get", "brunnel"], "tunnel"], paint: { "fill-color": p("vatten", "fill-color") } },
      { id: "vattendrag", type: "line", source: "openmaptiles", "source-layer": "waterway", filter: ["!=", ["get", "brunnel"], "tunnel"], paint: { "line-color": p("vattendrag", "line-color"), "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 16, 3] } },
      // ⛔ KUSTEN ÄR ETT STRECK (0.263.0, cllp/lifehub.app#967). Sardinienkartan ritar landet med en kant i drivved (`weight: 1.2`), och det är den som gör
      // ön till en tydlig form mot det ljusa havet. Strecket är vattenytornas kant i lera, tunt på avstånd och tydligare nära.
      { id: "kust", type: "line", source: "openmaptiles", "source-layer": "water", filter: ["!=", ["get", "brunnel"], "tunnel"], layout: { "line-join": "round" }, paint: { "line-color": p("kust", "line-color"), "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 10, 1, 16, 1.6] } },
      vag("vag-stor", ["motorway", "trunk", "primary"], 0.6, 5),
      vag("vag-mellan", ["secondary", "tertiary"], 0.4, 3.5),
      vag("vag-liten", ["minor", "service", "street", "street_limited", "track", "path", "pedestrian"], 0.2, 2),
      {
        id: "grans",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": p("grans", "line-color"), "line-dasharray": [2, 1], "line-width": 1 },
      },
      {
        id: "byggnad",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        paint: { "fill-color": p("byggnad", "fill-color"), "fill-outline-color": p("byggnad", "fill-outline-color") },
      },
      ort("ort-land", ["country", "state"], GLYF_ORT_STOR, 1, 8),
      ort("ort-stad", ["city"], GLYF_ORT_STOR, 4, 24),
      ort("ort-tator", ["town"], GLYF_ORT, 8, 24),
      ort("ort-o", ["island"], GLYF_ORT, 9, 24),
      ort("ort-by", ["village"], GLYF_ORT, 10, 24),
      ort("ort-smaort", ["hamlet"], GLYF_ORT, 12, 24),
      {
        id: "vag-namn",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 13,
        filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
        layout: { "symbol-placement": "line", "text-field": ortText, "text-font": GLYF_ETIKETT, "text-size": 12 },
        paint: { "text-color": p("vag-namn", "text-color"), "text-halo-color": p("vag-namn", "text-halo-color"), "text-halo-width": 1.25 },
      },
      {
        id: "vatten-namn",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "water_name",
        minzoom: 6,
        layout: { "text-field": ortText, "text-font": GLYF_VATTEN, "text-size": 13, "text-max-width": 6 },
        paint: { "text-color": p("vatten-namn", "text-color"), "text-halo-color": p("vatten-namn", "text-halo-color"), "text-halo-width": 1.25 },
      },
      {
        id: "objekt-yta",
        type: "fill",
        source: "objekt",
        filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
        paint: { "fill-color": ["coalesce", ["get", "_fyll"], farger.accent], "fill-opacity": ["coalesce", ["get", "_fyllOpacitet"], 0.6] },
      },
      {
        id: "objekt-linje",
        type: "line",
        source: "objekt",
        filter: ["match", ["geometry-type"], ["LineString", "MultiLineString", "Polygon", "MultiPolygon"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["coalesce", ["get", "_streck"], farger.accent], "line-opacity": ["coalesce", ["get", "_streckOpacitet"], 1], "line-width": ["coalesce", ["get", "_streckBredd"], 2] },
      },
      {
        id: PUNKT_SKUGGA,
        type: "circle",
        source: "objekt",
        filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
        paint: {
          "circle-color": farger.text,
          "circle-radius": ["+", ["coalesce", ["get", "_radie"], 6], 3.5],
          "circle-opacity": 0.3,
          "circle-blur": 0.6,
          "circle-translate": [0, 1],
        },
      },
      {
        id: "objekt-punkt",
        type: "circle",
        source: "objekt",
        filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
        paint: {
          "circle-color": ["coalesce", ["get", "_markor"], farger.accent],
          "circle-radius": ["coalesce", ["get", "_radie"], 6],
          "circle-stroke-color": farger.papper,
          "circle-stroke-width": 2,
        },
      },
    ],
  };
}

/** Klassen på kartans popup (MapLibres `className`), som `KARTPOPUP_CSS` styr. */
export const KARTPOPUP_KLASS = "ops-karta-popup";

/** Id:t på stilen som `OpsKartaVy` lägger i dokumentet en gång. */
export const KARTPOPUP_STIL_ID = "ops-karta-popup-stil";

/**
 * Popupens yta och pil i appens token (0.234.0). CP 2026-11-16, i mörkt läge: "kontrasterna funkar inte på locations". MapLibres förval är en vit ruta och en
 * vit pil, och rubriken stod i nästan vit text på den.
 *
 * ⛔ UTANFÖR LAGREN, MED HÖGRE VIKT ÄN MAPLIBRES. `maplibre-gl.css` ligger utanför alla `@layer`, och en regel i ett lager förlorar mot den oavsett vikt. Stilen läggs därför
 * som en egen `<style>` i dokumentet, och väljarna har en klass mer än MapLibres. Bara token: yta `--color-raised`, bläck `--color-ink`, kant `--color-line`, rundning och skugga.
 * ⛔ PILEN FÖLJER YTAN, för varje sida popupen kan stå på (MapLibre byter `maplibregl-popup-anchor-*` när kartan flyttas).
 */
export const KARTPOPUP_CSS = [
  `.${KARTPOPUP_KLASS} .maplibregl-popup-content{background:var(--color-raised);color:var(--color-ink);border:1px solid var(--color-line);border-radius:var(--radius-base);box-shadow:var(--shadow-md);padding:12px 48px 12px 14px}`,
  ...[
    [["top", "top-left", "top-right"], "bottom"],
    [["bottom", "bottom-left", "bottom-right"], "top"],
    [["left"], "right"],
    [["right"], "left"],
  ].map(([ankare, kant]) => `${/** @type {string[]} */ (ankare).map((a) => `.${KARTPOPUP_KLASS}.maplibregl-popup-anchor-${a} .maplibregl-popup-tip`).join(",")}{border-${kant}-color:var(--color-raised)}`),
].join("\n");

/**
 * Kartvyns egna regler över MapLibres CSS (0.263.0, cllp/lifehub.app#967), i samma `<style>` som popupen och av samma skäl: `maplibre-gl.css` ligger utanför
 * lagren, så en regel i ett lager förlorar mot den.
 *
 * ⛔ MAPLIBRES POSITIONSKNAPP SYNS INTE. CP 2026-11-25 om de vita fyrkanterna och positionens röda snedstreck: "Ser bara lite 90-tal buggigt ut." Vyn ritar
 * zoom och Min position med ramverkets knappar. Positionens logik (följ-läge, punkten och träffsäkerhetens cirkel) är fortfarande `GeolocateControl`, som
 * måste ligga på kartan för att fungera, så dess grupp döljs här i stället för att inte läggas till.
 * ⛔ KREDITEN STÅR KVAR OCH SYNS (licensen), men i helskärm ovanför infofältet på telefon och innanför säkra zonen, så att fältet aldrig täcker den.
 */
export const KARTVY_CSS = [
  "[data-karta-yta] .maplibregl-ctrl-group:has(.maplibregl-ctrl-geolocate){display:none}",
  "[data-karta-helskarm] .maplibregl-ctrl-bottom-right{right:var(--safe-right,0px);bottom:calc(var(--safe-bottom,0px) + 0.25rem)}",
  "[data-karta-helskarm][data-karta-bred='nej'] .maplibregl-ctrl-bottom-right{bottom:calc(var(--safe-bottom,0px) + 4rem)}",
].join("\n");

/**
 * Högst så många punkter i en rutt till Google Maps: start, slut och mellan dem jämnt fördelade punkter (0.234.0). Googles vägbeskrivning tar högst nio
 * mellanpunkter, och en mobil webbläsare färre, så rutten glesas ut till nio punkter totalt, vilket ryms överallt.
 */
export const KARTLANK_MAX_PUNKTER = 9;

/**
 * Ett koordinatpar ur GeoJSON (`[lng, lat]`) som `lat,lng`, eller `null` när paret inte är en giltig position.
 * @param {unknown} par
 * @returns {string | null}
 */
function latLng(par) {
  if (!Array.isArray(par)) return null;
  const [lng, lat] = par;
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return `${lat},${lng}`;
}

/**
 * Glesar ut en lista till högst `max` element: första och sista står alltid kvar, och mellan dem väljs jämnt fördelade.
 * @template T
 * @param {ReadonlyArray<T>} lista
 * @param {number} [max]
 * @returns {T[]}
 */
export function glesaRutt(lista, max = KARTLANK_MAX_PUNKTER) {
  if (!Number.isInteger(max) || max < 2) throw new Error(`glesaRutt: max ska vara ett heltal från 2, inte ${String(max)}.`);
  if (lista.length <= max) return [...lista];
  const ut = [];
  for (let i = 0; i < max; i += 1) ut.push(lista[Math.round((i * (lista.length - 1)) / (max - 1))]);
  return ut;
}

/**
 * Länkarna "Öppna i Kartor" och "Öppna i Google Maps" för ett objekt på kartan (0.234.0). CP 2026-11-16: "Samt en länk, öppna rutt eller position i
 * telefonens Kartor eller Google Maps om det är installerat." Båda är universella länkar: telefonen öppnar appen när den finns, annars webben.
 *
 * En punkt ger positionen (`lat,lng`, namnet kodat som sökord i Apples länk). En linje (en rutt) ger en vägbeskrivning: Google med start, slut och
 * jämnt fördelade mellanpunkter (högst `KARTLANK_MAX_PUNKTER` totalt), Apple med start och slut. ⛔ Apples `daddr` med flera `to:` är inte provat i
 * en telefon, och en länk som öppnar fel väg är sämre än en som visar start och slut. En yta, och ett objekt utan giltiga koordinater, ger `null`.
 *
 * @param {{ geometry?: { type?: string, coordinates?: unknown } | null, properties?: Record<string, unknown> | null }} feature
 * @returns {{ apple: string, google: string } | null}
 */
export function kartlankar(feature) {
  const geo = feature?.geometry;
  if (!geo) return null;
  const namn = popupTexter(/** @type {any} */ (feature)).namn;
  if (geo.type === "Point") {
    const ll = latLng(geo.coordinates);
    if (!ll) return null;
    return {
      apple: `https://maps.apple.com/?ll=${ll}&q=${encodeURIComponent(namn || ll)}`,
      google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ll)}`,
    };
  }
  if (geo.type === "LineString" || geo.type === "MultiLineString") {
    const linje = /** @type {unknown[]} */ (geo.type === "LineString" ? geo.coordinates : Array.isArray(geo.coordinates) ? geo.coordinates.flat() : []);
    const punkter = (Array.isArray(linje) ? linje : []).map(latLng).filter((p) => p !== null);
    if (punkter.length < 2) return null;
    const rutt = glesaRutt(/** @type {string[]} */ (punkter));
    const start = /** @type {string} */ (rutt[0]);
    const slut = /** @type {string} */ (rutt[rutt.length - 1]);
    const mellan = rutt.length > 2 ? `&waypoints=${encodeURIComponent(rutt.slice(1, -1).join("|"))}` : "";
    return {
      apple: `https://maps.apple.com/?saddr=${start}&daddr=${slut}`,
      google: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(slut)}${mellan}`,
    };
  }
  return null;
}

/**
 * Om enheten är en Apple-enhet, där Kartor finns (iPhone, iPad, Mac). En iPad i skrivbordsläge säger "Macintosh", och räknas därför med.
 * @param {{ userAgent?: string } | undefined} [nav]
 * @returns {boolean}
 */
export function arAppleEnhet(nav = typeof navigator === "undefined" ? undefined : navigator) {
  return /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(String(nav?.userAgent ?? ""));
}
