import { skapaDatakalla } from "./kontrakt.js";

/**
 * Adapter mot ett eget API över HTTP, alltså REST.
 *
 * ⛔ DEN HÄR ÄR POÄNGEN MED HELA KONTRAKTET. Kontraktets fem operationer ÄR
 * CRUD, så mot ett REST-API är översättningen en rad var. Vad som står bakom
 * API:et, Postgres eller Firestore eller något tredje, syns inte här och ska
 * inte göra det: det är API:ets ensak.
 *
 * ```js
 * const kalla = skapaHttpKalla({
 *   basUrl: "https://api.example.se/v1",
 *   hamtaToken: () => auth.currentUser.getIdToken(),
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
 * ⛔ 404 BETYDER OLIKA SAKER FÖR OLIKA OPERATIONER, och det är inte en detalj.
 * På `las` är det "finns inte", alltså `null` enligt kontraktets regel 3. På
 * `uppdatera` och `taBort` är det ett fel: någon bad om en ändring av något som
 * inte finns, och ett tyst `undefined` hade fått anropsstället att tro att det
 * gick bra. Samma skillnad som Postgres-adaptern gör på noll ändrade rader.
 *
 * ⛔ INGEN `prenumerera`, med flit (CP 2026-09-22: "Realtid räcker i ramverket.
 * Appen behöver det inte just nu"). Ett REST-API kan inte pusha, och kontraktets
 * regel 5 säger att en källa hellre säger "jag kan inte det" än låtsas med en
 * pollingloop. `useSamlingLive` frågar källan och rapporterar `realtid: false`,
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
 * ⛔ STYRPARAMETRARNA HAR UNDERSTRECK, och det är inte stil. `dar` blir
 * vanliga frågeparametrar (`?status=oppen`), och en samling med ett fält som
 * heter `sortera` hade annars krockat med sorteringen. Kollisionen märks inte
 * som ett fel utan som en sortering som ibland inte lyder.
 */
const SORT = "_sort";
const ORDNING = "_order";
const ANTAL = "_limit";

/** @param {unknown} v */
function textvarde(v) {
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
async function felAvSvar(res, vad) {
  /*
   * ⛔ SERVERNS EGEN TEXT MED, och avkortad. Utan den står det bara "500" i
   * banderollen, och då är nästa steg att öppna nätverksfliken, vilket inte går
   * på en telefon. Med hela texten kan en felsida i HTML lägga tusentals tecken
   * i en banderoll som ska rymmas på en rad.
   */
  let kropp = "";
  try {
    kropp = (await res.text()).trim().slice(0, 200);
  } catch {
    kropp = "";
  }
  const fel = /** @type {Error & { status?: number }} */ (
    new Error(`${vad}: ${res.status} ${res.statusText}${kropp ? ` (${kropp})` : ""}`)
  );
  // ⛔ Statusen ligger kvar på felet. Appen ska kunna skilja 401 (logga in igen)
  // från 500 (försök senare) utan att läsa i felets text, för texten ändras.
  fel.status = res.status;
  return fel;
}

/**
 * @template {{ id: string }} T
 * @param {{
 *   basUrl: string,
 *   hamtaToken?: () => Promise<string | null> | string | null,
 *   hamta?: typeof fetch,
 *   huvuden?: Record<string, string>,
 * }} konfig
 * @returns {import("./kontrakt.js").Datakalla<T>}
 */
export function skapaHttpKalla(konfig) {
  // Destrukturering i kroppen, av samma skäl som i Postgres-adaptern: ett anrop
  // utan argument ska mötas av valideringen nedan och inte av en destruktur.
  const { basUrl, hamtaToken, hamta, huvuden } = konfig ?? /** @type {any} */ ({});
  if (typeof basUrl !== "string" || basUrl === "") {
    throw new Error('skapaHttpKalla: basUrl krävs, till exempel "https://api.example.se/v1".');
  }
  const bas = basUrl.replace(/\/+$/, "");
  const fetcha = hamta ?? globalThis.fetch;
  if (typeof fetcha !== "function") {
    throw new Error("skapaHttpKalla: ingen fetch finns. Skicka in en med `hamta` i miljöer utan global fetch.");
  }

  /**
   * @param {string} metod @param {string} vag @param {unknown} [kropp]
   * @returns {Promise<Response>}
   */
  async function anrop(metod, vag, kropp) {
    /*
     * ⛔ TOKEN HÄMTAS PER ANROP och sparas inte i en closure. En token som
     * hämtades vid uppstart går ut medan appen står öppen, och symptomet är att
     * allting slutar fungera efter en timme utan att något ändrats. Appens
     * `hamtaToken` får själv cacha, den vet när den går ut.
     */
    const token = hamtaToken ? await hamtaToken() : null;
    return fetcha(`${bas}${vag}`, {
      method: metod,
      headers: {
        ...(kropp === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(huvuden ?? {}),
      },
      ...(kropp === undefined ? {} : { body: JSON.stringify(kropp) }),
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

  /** @param {string} samling @param {string} id */
  const vagen = (samling, id) => `/${encodeURIComponent(samling)}/${encodeURIComponent(id)}`;

  return skapaDatakalla({
    namn: "http",

    async las(samling, id) {
      const vad = `GET ${samling}/${id}`;
      const res = await anrop("GET", vagen(samling, id));
      // ⛔ 404 är "finns inte" och inte ett fel. Kontraktets regel 3.
      if (res.status === 404) return null;
      if (!res.ok) throw await felAvSvar(res, vad);
      return json(res, vad);
    },

    async lista(samling, fraga) {
      const p = new URLSearchParams();
      if (fraga?.dar) {
        for (const [falt, varde] of Object.entries(fraga.dar)) {
          const t = textvarde(varde);
          if (t !== null) p.set(falt, t);
        }
      }
      if (fraga?.sortera) {
        p.set(SORT, fraga.sortera);
        p.set(ORDNING, fraga.riktning === "ner" ? "desc" : "asc");
      }
      if (typeof fraga?.antal === "number") p.set(ANTAL, String(fraga.antal));

      const fragestrang = p.toString();
      const vad = `GET ${samling}`;
      const res = await anrop("GET", `/${encodeURIComponent(samling)}${fragestrang ? `?${fragestrang}` : ""}`);
      if (!res.ok) throw await felAvSvar(res, vad);
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

    async skapa(samling, data) {
      const vad = `POST ${samling}`;
      const res = await anrop("POST", `/${encodeURIComponent(samling)}`, data);
      if (!res.ok) throw await felAvSvar(res, vad);
      const post = await json(res, vad);
      /*
       * ⛔ KONTRAKTETS REGEL 4: posten kommer tillbaka MED sitt id. Ett API som
       * svarar 201 utan kropp tvingar annars anropsstället att gissa, och en
       * gissad nyckel går sönder först vid nästa läsning, långt från felet.
       */
      if (!post || typeof post.id !== "string") {
        throw new Error(`${vad}: svaret saknar id. API:et ska svara med den skapade posten, id inräknat.`);
      }
      return post;
    },

    async uppdatera(samling, id, data) {
      const vad = `PATCH ${samling}/${id}`;
      const res = await anrop("PATCH", vagen(samling, id), data);
      // ⛔ HÄR ÄR 404 ETT FEL, till skillnad från i `las`. Se filens huvud.
      if (!res.ok) throw await felAvSvar(res, vad);
      return json(res, vad);
    },

    async taBort(samling, id) {
      const vad = `DELETE ${samling}/${id}`;
      const res = await anrop("DELETE", vagen(samling, id));
      if (!res.ok) throw await felAvSvar(res, vad);
      // ⛔ Ingen `json()` här: 204 utan kropp är det normala svaret, och att
      // parsa det hade gjort en lyckad borttagning till ett fel.
    },
  });
}
