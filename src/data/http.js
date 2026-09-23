import { createDataSource } from "./contract.js";

/**
 * Adapter mot ett eget API över HTTP, alltså REST.
 *
 * ⛔ DEN HÄR ÄR POÄNGEN MED HELA KONTRAKTET. Kontraktets fem operationer ÄR
 * CRUD, så mot ett REST-API är översättningen en rad var. Vad som står bakom
 * API:et, Postgres eller Firestore eller något tredje, syns inte här och ska
 * inte göra det: det är API:ets ensak.
 *
 * ```js
 * const kalla = createHttpSource({
 *   baseUrl: "https://api.example.se/v1",
 *   getToken: () => auth.currentUser.getIdToken(),
 * });
 * ```
 *
 * ⛔ `fetch` KASTAR INTE PÅ 404 ELLER 500. Den kastar bara när anropet aldrig
 * kom fram, alltså nätverksfel. Ett 500-svar är ett uppfyllt löfte med `ok:
 * false`, och den som skriver `await (await fetch(u)).json()` får serverns
 * felsida parsad som data, eller ett kryptiskt JSON-fel om felsidan var HTML.
 * Det är därför den här filen är 200 rader och inte 20, och varje rad som
 * kontrollerar `res.ok` finns för att kontraktets regel 2 ska hålla: fel kastas,
 * de returneras aldrig som tomhet.
 *
 * ⛔ 404 BETYDER OLIKA SAKER FÖR OLIKA OPERATIONS, och det är inte en detalj.
 * På `read` är det "finns inte", alltså `null` enligt kontraktets regel 3. På
 * `update` och `remove` är det ett fel: någon bad om en ändring av något som
 * inte finns, och ett tyst `undefined` hade fått anropsstället att tro att det
 * gick bra. Samma skillnad som Postgres-adaptern gör på noll ändrade rader.
 *
 * ⛔ INGEN `subscribe`, med flit (CP 2026-09-22: "Realtid räcker i ramverket.
 * Appen behöver det inte just nu"). Ett REST-API kan inte pusha, och kontraktets
 * regel 5 säger att en källa hellre säger "jag kan inte det" än låtsas med en
 * pollingloop. `useLiveCollection` frågar källan och rapporterar `realtime: false`,
 * alltså syns saknaden i stället för att anas. Den dagen fleranvändarstöd
 * behöver riktig realtid är det en egen adapter (SSE eller websocket), inte en
 * timer som smygs in här.
 *
 * ⛔ GRAPHQL ÄR EN ANNAN ADAPTER, inte ett läge i den här. GraphQL har EN
 * endpoint och ett frågedokument, och vilka fält som ska hämtas är appens
 * beslut och inte ramverkets. En `skapaGraphqlKalla` skulle alltså behöva ta
 * emot en fältuppsättning per samling, vilket är en helt annan konfiguration.
 * Att pressa in båda här hade gett en adapter där halva konfigurationen är död
 * beroende på läge.
 */

/**
 * ⛔ STYRPARAMETRARNA HAR UNDERSTRECK, och det är inte stil. `where` blir
 * vanliga frågeparametrar (`?status=oppen`), och en samling med ett fält som
 * heter `sortBy` hade annars krockat med sorteringen. Kollisionen märks inte
 * som ett fel utan som en sortering som ibland inte lyder.
 */
const KIND = "_sort";
const DIRECTION = "_order";
const LIMIT = "_limit";

/** @param {unknown} v */
function textValue(v) {
  // ⛔ `String(null)` ger "null" och `String(undefined)` ger "undefined", alltså
  // ett filter på texten "null". Utelämna i stället: ett villkor som inte går
  // att uttrycka ska inte skickas som en gissning.
  if (v === null || v === undefined) return null;
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/**
 * @param {Response} res
 * @param {string} vad Anropet i klartext, för felmeddelandet.
 * @returns {Promise<Error & { status?: number }>}
 */
async function errorFromResponse(res, vad) {
  /*
   * ⛔ SERVERNS EGEN TEXT MED, och avkortad. Utan den står det bara "500" i
   * banderollen, och då är nästa steg att öppna nätverksfliken, vilket inte går
   * på en telefon. Med hela texten kan en felsida i HTML lägga tusentals tecken
   * i en banderoll som ska rymmas på en rad.
   */
  let body = "";
  try {
    body = (await res.text()).trim().slice(0, 200);
  } catch {
    body = "";
  }
  const error = /** @type {Error & { status?: number }} */ (
    new Error(`${vad}: ${res.status} ${res.statusText}${body ? ` (${body})` : ""}`)
  );
  // ⛔ Statusen ligger kvar på felet. Appen ska kunna skilja 401 (logga in igen)
  // från 500 (försök senare) utan att läsa i felets text, för texten ändras.
  error.status = res.status;
  return error;
}

/**
 * @template {{ id: string }} T
 * @param {{
 *   baseUrl: string,
 *   getToken?: () => Promise<string | null> | string | null,
 *   load?: typeof fetch,
 *   headers?: Record<string, string>,
 * }} config
 * @returns {import("./contract.js").DataSource<T>}
 */
export function createHttpSource(config) {
  // Destrukturering i kroppen, av samma skäl som i Postgres-adaptern: ett anrop
  // utan argument ska mötas av valideringen nedan och inte av en destruktur.
  const { baseUrl, getToken, load, headers } = config ?? /** @type {any} */ ({});
  if (typeof baseUrl !== "string" || baseUrl === "") {
    throw new Error('createHttpSource: basUrl krävs, till exempel "https://api.example.se/v1".');
  }
  const base = baseUrl.replace(/\/+$/, "");
  const doFetch = load ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    throw new Error("createHttpSource: ingen fetch finns. Skicka in en med `load` i miljöer utan global fetch.");
  }

  /**
   * @param {string} method @param {string} path @param {unknown} [body]
   * @returns {Promise<Response>}
   */
  async function request(method, path, body) {
    /*
     * ⛔ TOKEN HÄMTAS PER ANROP och sparas inte i en closure. En token som
     * hämtades vid uppstart går ut medan appen står öppen, och symptomet är att
     * allting slutar fungera efter en timme utan att något ändrats. Appens
     * `getToken` får själv cacha, den vet när den går ut.
     */
    const token = getToken ? await getToken() : null;
    return doFetch(`${base}${path}`, {
      method: method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  /** @param {Response} res @param {string} vad */
  async function json(res, vad) {
    try {
      return await res.json();
    } catch {
      /*
       * ⛔ ETT 200-SVAR SOM INTE ÄR JSON ÄR ETT FEL. Det låter otänkbart tills
       * en proxy eller ett inloggningsskal svarar 200 med en HTML-sida, och då
       * hade en tyst `{}` blivit "inga poster" i vyn.
       */
      throw new Error(`${vad}: svaret gick inte att läsa som JSON.`);
    }
  }

  /** @param {string} collectionName @param {string} id */
  const pathFor = (collectionName, id) => `/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}`;

  return createDataSource({
    name: "http",

    async read(collectionName, id) {
      const vad = `GET ${collectionName}/${id}`;
      const res = await request("GET", pathFor(collectionName, id));
      // ⛔ 404 är "finns inte" och inte ett fel. Kontraktets regel 3.
      if (res.status === 404) return null;
      if (!res.ok) throw await errorFromResponse(res, vad);
      return json(res, vad);
    },

    async list(collectionName, query) {
      const p = new URLSearchParams();
      if (query?.where) {
        for (const [field, value] of Object.entries(query.where)) {
          const t = textValue(value);
          if (t !== null) p.set(field, t);
        }
      }
      if (query?.sortBy) {
        p.set(KIND, query.sortBy);
        p.set(DIRECTION, query.direction === "desc" ? "desc" : "asc");
      }
      if (typeof query?.limit === "number") p.set(LIMIT, String(query.limit));

      const queryString = p.toString();
      const vad = `GET ${collectionName}`;
      const res = await request("GET", `/${encodeURIComponent(collectionName)}${queryString ? `?${queryString}` : ""}`);
      if (!res.ok) throw await errorFromResponse(res, vad);
      const data = await json(res, vad);
      /*
       * ⛔ EN LISTA SKA VARA EN LISTA. Ett API som svarar `{ items: [...] }` är
       * vanligt, och att tyst plocka ut `items` hade gjort adaptern beroende av
       * ett namn ingen avtalat. Att säga ifrån pekar mot API:et, som är det som
       * ska ändras, i stället för mot vyn som fick noll rader.
       */
      if (!Array.isArray(data)) {
        throw new Error(
          `${vad}: svaret är inte en lista. Kontraktets \`lista\` ger rader, alltså ska API:et svara med en JSON-array.`,
        );
      }
      return data;
    },

    async create(collectionName, data) {
      const vad = `POST ${collectionName}`;
      const res = await request("POST", `/${encodeURIComponent(collectionName)}`, data);
      if (!res.ok) throw await errorFromResponse(res, vad);
      const entry = await json(res, vad);
      /*
       * ⛔ KONTRAKTETS REGEL 4: posten kommer tillbaka MED sitt id. Ett API som
       * svarar 201 utan kropp tvingar annars anropsstället att gissa, och en
       * gissad nyckel går sönder först vid nästa läsning, långt från felet.
       */
      if (!entry || typeof entry.id !== "string") {
        throw new Error(`${vad}: svaret saknar id. API:et ska svara med den skapade posten, id inräknat.`);
      }
      return entry;
    },

    async update(collectionName, id, data) {
      const vad = `PATCH ${collectionName}/${id}`;
      const res = await request("PATCH", pathFor(collectionName, id), data);
      // ⛔ HÄR ÄR 404 ETT FEL, till skillnad från i `read`. Se filens huvud.
      if (!res.ok) throw await errorFromResponse(res, vad);
      return json(res, vad);
    },

    async remove(collectionName, id) {
      const vad = `DELETE ${collectionName}/${id}`;
      const res = await request("DELETE", pathFor(collectionName, id));
      if (!res.ok) throw await errorFromResponse(res, vad);
      // ⛔ Ingen `json()` här: 204 utan kropp är det normala svaret, och att
      // parsa det hade gjort en lyckad borttagning till ett fel.
    },
  });
}
