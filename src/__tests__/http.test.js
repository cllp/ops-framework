import { describe, expect, it, vi } from "vitest";
import { createHttpSource } from "../data/http.js";

/**
 * HTTP-adaptern. Varje prov är bevisat rött mot en planterad defekt, och den
 * står utskriven.
 */

/** Ett svar av det slag `fetch` faktiskt ger. @param {number} status @param {any} kropp */
function svar(status, kropp, { text } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => {
      if (text !== undefined) throw new SyntaxError("inte JSON");
      return kropp;
    },
    text: async () => (text !== undefined ? text : JSON.stringify(kropp)),
  };
}

/** @param {any[]} svaren */
function falskFetch(...svaren) {
  const request = [];
  const f = vi.fn(async (url, init) => {
    request.push({ url, ...init });
    return svaren.shift() ?? svar(200, []);
  });
  return { f, request };
}

const BAS = "https://api.example.se/v1";

describe("createHttpSource", () => {
  it("kräver en basUrl i stället för att bygga anrop mot undefined", () => {
    expect(() => createHttpSource(/** @type {any} */ (undefined))).toThrow(/basUrl/);
    expect(() => createHttpSource(/** @type {any} */ ({}))).toThrow(/basUrl/);
  });

  it("uppfyller kontraktets fem operationer", () => {
    const { f } = falskFetch();
    const k = createHttpSource({ basUrl: BAS, load: f });
    for (const op of ["read", "list", "create", "update", "remove"]) {
      expect(typeof k[op]).toBe("function");
    }
    /*
     * ⛔ OCH INGEN `subscribe`, vilket är ett beslut och inte en lucka
     * (CP 2026-09-22). Planterad defekt: lägg till en `subscribe` som pollar.
     * Då rapporterar `useLiveCollection` realtid som appen inte har.
     */
    expect(k.subscribe).toBeUndefined();
  });

  it("ger null på 404 vid läsning, och det är inte ett fel", async () => {
    /*
     * ⛔ KONTRAKTETS REGEL 3. Planterad defekt: ta bort `if (res.status === 404)`.
     * Då blir "posten finns inte" ett kastat fel, och vyn visar en röd
     * banderoll för något som bara inte fanns.
     */
    const { f } = falskFetch(svar(404, null, { text: "Not Found" }));
    const k = createHttpSource({ basUrl: BAS, load: f });
    await expect(k.read("kostnader", "abc")).resolves.toBeNull();
  });

  it("kastar på 500 i stället för att parsa felsidan som data", async () => {
    /*
     * ⛔ HELA SKÄLET TILL ATT FILEN FINNS. `fetch` kastar inte på 500.
     * Planterad defekt: ta bort `if (!res.ok)` ur `read`. Då returneras serverns
     * felsida som om den vore posten, och kontraktets regel 2 är bruten.
     */
    const { f } = falskFetch(svar(500, null, { text: "<html>Internal Error</html>" }));
    const k = createHttpSource({ basUrl: BAS, load: f });
    await expect(k.read("kostnader", "abc")).rejects.toThrow(/500/);
  });

  it("bär statuskoden på felet, så appen slipper läsa i texten", async () => {
    /*
     * ⛔ 401 OCH 500 KRÄVER OLIKA SAKER av appen: logga in igen, respektive
     * försök senare. Planterad defekt: ta bort `error.status = res.status`. Då
     * måste appen matcha på felets text, och texten ändras.
     */
    const { f } = falskFetch(svar(401, null, { text: "token expired" }));
    const k = createHttpSource({ basUrl: BAS, load: f });
    await expect(k.read("kostnader", "a")).rejects.toMatchObject({ status: 401 });
  });

  it("tar med serverns egen text i felet, avkortad", async () => {
    const { f } = falskFetch(svar(400, null, { text: "x".repeat(500) }));
    const k = createHttpSource({ basUrl: BAS, load: f });
    await expect(k.read("kostnader", "a")).rejects.toThrow(/x{200}\)/);
  });

  it("kastar när ett 200-svar inte är JSON", async () => {
    /*
     * ⛔ EN PROXY ELLER ETT INLOGGNINGSSKAL SVARAR 200 MED HTML, och då hade en
     * tyst `{}` blivit "inga poster" i vyn. Planterad defekt: fånga
     * parse-felet och returnera null.
     */
    const { f } = falskFetch(svar(200, null, { text: "<html>logga in</html>" }));
    const k = createHttpSource({ basUrl: BAS, load: f });
    await expect(k.read("kostnader", "a")).rejects.toThrow(/JSON/);
  });

  it("översätter frågan till frågeparametrar, med understreck på styrningen", async () => {
    /*
     * ⛔ KOLLISIONEN ÄR DET SVÅRA. Planterad defekt: döp `_sort` till `sort`.
     * En samling med ett fält som heter `sort` krockar då med sorteringen, och
     * symptomet är inte ett fel utan en lista som ibland inte lyder.
     */
    const { f, request } = falskFetch(svar(200, []));
    const k = createHttpSource({ basUrl: BAS, load: f });
    await k.list("kostnader", { where: { status: "oppen" }, sortBy: "forfaller", direction: "desc", limit: 20 });
    const url = new URL(request[0].url);
    expect(url.pathname).toBe("/v1/kostnader");
    expect(url.searchParams.get("status")).toBe("oppen");
    expect(url.searchParams.get("_sort")).toBe("forfaller");
    expect(url.searchParams.get("_order")).toBe("desc");
    expect(url.searchParams.get("_limit")).toBe("20");
  });

  it("skickar inte ett villkor som texten null", async () => {
    /*
     * ⛔ `String(null)` ÄR "null". Planterad defekt: ta bort kontrollen i
     * `textValue`. Då blir `{ where: { kategori: null } }` ett filter på texten
     * "null", alltså ett villkor som matchar fel i tysthet.
     */
    const { f, request } = falskFetch(svar(200, []));
    const k = createHttpSource({ basUrl: BAS, load: f });
    await k.list("kostnader", { where: { kategori: null } });
    expect(new URL(request[0].url).searchParams.has("kategori")).toBe(false);
  });

  it("säger ifrån när listan inte är en lista", async () => {
    /*
     * ⛔ ETT API SOM SVARAR `{ items: [...] }` ÄR VANLIGT, och att tyst plocka ut
     * `items` hade gjort adaptern beroende av ett namn ingen avtalat. Planterad
     * defekt: returnera `data.items ?? data`. Då fungerar det tills någon döper
     * fältet till `rows`, och då blir det noll rader utan fel.
     */
    const { f } = falskFetch(svar(200, { items: [{ id: "a" }] }));
    const k = createHttpSource({ basUrl: BAS, load: f });
    await expect(k.list("kostnader")).rejects.toThrow(/lista/);
  });

  it("kräver att den skapade posten kommer tillbaka med sitt id", async () => {
    /*
     * ⛔ KONTRAKTETS REGEL 4. Planterad defekt: returnera posten utan
     * id-kontrollen. En gissad nyckel går sönder först vid nästa läsning,
     * alltså långt från felet.
     */
    const { f } = falskFetch(svar(201, { name: "Adavo" }));
    const k = createHttpSource({ basUrl: BAS, load: f });
    await expect(k.create("kostnader", { name: "Adavo" })).rejects.toThrow(/id/);

    const { f: f2 } = falskFetch(svar(201, { id: "k1", name: "Adavo" }));
    const k2 = createHttpSource({ basUrl: BAS, load: f2 });
    await expect(k2.create("kostnader", { name: "Adavo" })).resolves.toEqual({ id: "k1", name: "Adavo" });
  });

  it("kastar på 404 vid uppdatering och borttagning, till skillnad från vid läsning", async () => {
    /*
     * ⛔ SAMMA KOD, MOTSATT BETYDELSE. Planterad defekt: kopiera in
     * `if (res.status === 404) return null` även här. Då ser en uppdatering av
     * något som inte finns ut att ha lyckats.
     */
    const { f } = falskFetch(svar(404, null, { text: "" }));
    await expect(createHttpSource({ basUrl: BAS, load: f }).update("kostnader", "a", { x: 1 })).rejects.toThrow(/404/);

    const { f: f2 } = falskFetch(svar(404, null, { text: "" }));
    await expect(createHttpSource({ basUrl: BAS, load: f2 }).remove("kostnader", "a")).rejects.toThrow(/404/);
  });

  it("parsar inte kroppen på en lyckad borttagning", async () => {
    /*
     * ⛔ 204 UTAN KROPP ÄR DET NORMALA SVARET. Planterad defekt: `await
     * res.json()` i `taBort`. Då blir varje lyckad borttagning ett JSON-fel.
     */
    const { f } = falskFetch(svar(204, null, { text: "" }));
    await expect(createHttpSource({ basUrl: BAS, load: f }).remove("kostnader", "a")).resolves.toBeUndefined();
  });

  it("hämtar token per anrop och inte en gång vid uppstart", async () => {
    /*
     * ⛔ EN TOKEN SOM HÄMTADES VID UPPSTART GÅR UT medan appen står öppen, och
     * symptomet är att allt slutar fungera efter en timme utan att något
     * ändrats. Planterad defekt: läs token en gång i `createHttpSource` och
     * återanvänd den.
     */
    const getToken = vi.fn(async () => "t" + getToken.mock.calls.length);
    const { f, request } = falskFetch(svar(200, { id: "a" }), svar(200, { id: "a" }));
    const k = createHttpSource({ basUrl: BAS, load: f, getToken });
    await k.read("kostnader", "a");
    await k.read("kostnader", "a");
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(request[0].headers.Authorization).toBe("Bearer t1");
    expect(request[1].headers.Authorization).toBe("Bearer t2");
  });

  it("kodar samling och id i sökvägen", async () => {
    /*
     * ⛔ ETT ID MED SNEDSTRECK hade annars blivit en annan sökväg, alltså ett
     * anrop mot något helt annat. Planterad defekt: ta bort encodeURIComponent.
     */
    const { f, request } = falskFetch(svar(200, { id: "a" }));
    await createHttpSource({ basUrl: BAS + "/", load: f }).read("kost nader", "a/b");
    expect(request[0].url).toBe("https://api.example.se/v1/kost%20nader/a%2Fb");
  });
});
