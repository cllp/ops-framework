/**
 * GeoJSON till en karta (0.214.0, cllp/ops-framework#570).
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
 * @typedef {{ type: "FeatureCollection", features: KartaFeature[] }} KartaSamling
 */

/** Vektorbrickor, OpenMapTiles-schema, ingen nyckel. */
export const KARTA_UNDERLAG = "https://tiles.openfreemap.org/planet";

/** Glyfer hos samma leverantör. `{fontstack}` och `{range}` är MapLibres platshållare. */
export const KARTA_GLYFER = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

/**
 * Krediten i kartans hörn. OpenFreeMap kräver den, och OSM-datan likaså. MapLibre ritar den själv när den står på källan.
 * Den får inte tas bort: utan den är visningen ett brott mot datans licens.
 */
export const KARTA_TILLHORIGHET = "© OpenStreetMap (https://www.openstreetmap.org/copyright) © OpenFreeMap (https://openfreemap.org/) © OpenMapTiles (https://openmaptiles.org/)";

/** Lagren ett tryck frågar, överst först, så en punkt på en linje vinner. */
export const OBJEKT_LAGER = ["objekt-punkt", "objekt-linje", "objekt-yta"];

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
  ["accent", "--color-accent"],
  ["ort", "--font-karta-ort"],
  ["etikett", "--font-karta-etikett"],
];

const PALETT = ["salvia", "ockra", "terrakotta"];
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
  return { ok: true, samling };
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
 */
export function objektFarg(feature, farger) {
  const p = egenskaperAv(feature);
  const slag = feature.geometry?.type ?? "";
  const fyllNycklar = YTOR.has(slag) ? ["fill", "marker-color", "stroke"] : PUNKTER.has(slag) ? ["marker-color", "stroke", "fill"] : ["stroke", "marker-color", "fill"];
  const streckNycklar = YTOR.has(slag) ? ["stroke", "marker-color", "fill"] : fyllNycklar;
  const fyll = valj(farger, p, fyllNycklar);
  const streck = valj(farger, p, streckNycklar);
  const markor = valj(farger, p, ["marker-color", "stroke", "fill"]);
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
  return {
    type: "FeatureCollection",
    features: samling.features.map((feature, i) => ({
      type: "Feature",
      id: feature.id ?? i,
      geometry: feature.geometry,
      properties: { ...egenskaperAv(feature), ...objektFarg(feature, farger) },
    })),
  };
}

/**
 * @param {Record<string, string>} farger
 * @param {Record<string, unknown>} p
 * @param {string[]} nycklar
 */
function valj(farger, p, nycklar) {
  for (const nyckel of nycklar) {
    const h = hex(p[nyckel]);
    if (h) return h;
  }
  const typ = typAv(p);
  if (typ) return farger[PALETT[palettIndex(typ)]];
  return farger.accent;
}

/** @param {string} typ */
function palettIndex(typ) {
  let n = 0;
  for (const tecken of typ) n = (n + (tecken.codePointAt(0) ?? 0)) % PALETT.length;
  return n;
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
    rubrik.className = "m-0 font-karta-ort text-rubrik text-karta-text";
    rubrik.textContent = namn;
    rot.append(rubrik);
  }
  if (beskrivning) {
    const brod = document.createElement("p");
    brod.className = "m-0 font-karta-etikett text-etikett text-karta-text wrap-anywhere";
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
    ["vag-namn", "text-color", farger.lera],
    ["vag-namn", "text-halo-color", farger.papper],
    ["vatten-namn", "text-color", farger.text],
    ["vatten-namn", "text-halo-color", farger.papper],
  ];
}

/**
 * Objektlagrens färguttryck. Accenten ligger sist i `coalesce`, så ett objekt utan egen färg följer instansen, också efter ett temabyte.
 *
 * @param {Record<string, string>} farger
 */
export function objektPensel(farger) {
  return [
    ["objekt-yta", "fill-color", ["coalesce", ["get", "_fyll"], farger.accent]],
    ["objekt-linje", "line-color", ["coalesce", ["get", "_streck"], farger.accent]],
    ["objekt-punkt", "circle-color", ["coalesce", ["get", "_markor"], farger.accent]],
    ["objekt-punkt", "circle-stroke-color", farger.text],
  ];
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
    layout: { "text-field": ortText, "text-font": font, "text-size": min >= 8 ? 13 : 15, "text-max-width": 8 },
    paint: { "text-color": p(id, "text-color"), "text-halo-color": p(id, "text-halo-color"), "text-halo-width": 1.5 },
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
      { id: "vatten", type: "fill", source: "openmaptiles", "source-layer": "water", filter: ["!=", ["get", "brunnel"], "tunnel"], paint: { "fill-color": p("vatten", "fill-color") } },
      { id: "vattendrag", type: "line", source: "openmaptiles", "source-layer": "waterway", filter: ["!=", ["get", "brunnel"], "tunnel"], paint: { "line-color": p("vattendrag", "line-color"), "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 16, 3] } },
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
      ort("ort-tator", ["town", "village", "hamlet"], GLYF_ORT, 8, 24),
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
        id: "objekt-punkt",
        type: "circle",
        source: "objekt",
        filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
        paint: {
          "circle-color": ["coalesce", ["get", "_markor"], farger.accent],
          "circle-radius": ["coalesce", ["get", "_radie"], 6],
          "circle-stroke-color": farger.text,
          "circle-stroke-width": 1.5,
        },
      },
    ],
  };
}
