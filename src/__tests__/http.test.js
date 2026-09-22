import { describe, expect, it, vi } from "vitest";
import { skapaHttpKalla } from "../data/http.js";

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
  const anrop = [];
  const f = vi.fn(async (url, init) => {
    anrop.push({ url, ...init });
    return svaren.shift() ?? svar(200, []);
  });
  return { f, anrop };
}

const BAS = "https://api.example.se/v1";

describe("skapaHttpKalla", () => {
  it("kräver en basUrl i stället för att bygga anrop mot undefined", () => {
    expect(() => skapaHttpKalla(/** @type {any} */ (undefined))).toThrow(/basUrl/);
    expect(() => skapaHttpKalla(/** @type {any} */ ({}))).toThrow(/basUrl/);
  });

  it("uppfyller kontraktets fem operationer", () => {
    const { f } = falskFetch();
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    for (const op of ["las", "lista", "skapa", "uppdatera", "taBort"]) {
      expect(typeof k[op]).toBe("function");
    }
    /*
     * ⛔ OCH INGEN `prenumerera`, vilket är ett beslut och inte en lucka
     * (CP 2026-09-22). Planterad defekt: lägg till en `prenumerera` som pollar.
     * Då rapporterar `useSamlingLive` realtid som appen inte har.
     */
    expect(k.prenumerera).toBeUndefined();
  });

  it("ger null på 404 vid läsning, och det är inte ett fel", async () => {
    /*
     * ⛔ KONTRAKTETS REGEL 3. Planterad defekt: ta bort `if (res.status === 404)`.
     * Då blir "posten finns inte" ett kastat fel, och vyn visar en röd
     * banderoll för något som bara inte fanns.
     */
    const { f } = falskFetch(svar(404, null, { text: "Not Found" }));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    await expect(k.las("kostnader", "abc")).resolves.toBeNull();
  });

  it("kastar på 500 i stället för att parsa felsidan som data", async () => {
    /*
     * ⛔ HELA SKÄLET TILL ATT FILEN FINNS. `fetch` kastar inte på 500.
     * Planterad defekt: ta bort `if (!res.ok)` ur `las`. Då returneras serverns
     * felsida som om den vore posten, och kontraktets regel 2 är bruten.
     */
    const { f } = falskFetch(svar(500, null, { text: "<html>Internal Error</html>" }));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    await expect(k.las("kostnader", "abc")).rejects.toThrow(/500/);
  });

  it("bär statuskoden på felet, så appen slipper läsa i texten", async () => {
    /*
     * ⛔ 401 OCH 500 KRÄVER OLIKA SAKER av appen: logga in igen, respektive
     * försök senare. Planterad defekt: ta bort `fel.status = res.status`. Då
     * måste appen matcha på felets text, och texten ändras.
     */
    const { f } = falskFetch(svar(401, null, { text: "token expired" }));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    await expect(k.las("kostnader", "a")).rejects.toMatchObject({ status: 401 });
  });

  it("tar med serverns egen text i felet, avkortad", async () => {
    const { f } = falskFetch(svar(400, null, { text: "x".repeat(500) }));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    await expect(k.las("kostnader", "a")).rejects.toThrow(/x{200}\)/);
  });

  it("kastar när ett 200-svar inte är JSON", async () => {
    /*
     * ⛔ EN PROXY ELLER ETT INLOGGNINGSSKAL SVARAR 200 MED HTML, och då hade en
     * tyst `{}` blivit "inga poster" i vyn. Planterad defekt: fånga
     * parse-felet och returnera null.
     */
    const { f } = falskFetch(svar(200, null, { text: "<html>logga in</html>" }));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    await expect(k.las("kostnader", "a")).rejects.toThrow(/JSON/);
  });

  it("översätter frågan till frågeparametrar, med understreck på styrningen", async () => {
    /*
     * ⛔ KOLLISIONEN ÄR DET SVÅRA. Planterad defekt: döp `_sort` till `sort`.
     * En samling med ett fält som heter `sort` krockar då med sorteringen, och
     * symptomet är inte ett fel utan en lista som ibland inte lyder.
     */
    const { f, anrop } = falskFetch(svar(200, []));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    await k.lista("kostnader", { dar: { status: "oppen" }, sortera: "forfaller", riktning: "ner", antal: 20 });
    const url = new URL(anrop[0].url);
    expect(url.pathname).toBe("/v1/kostnader");
    expect(url.searchParams.get("status")).toBe("oppen");
    expect(url.searchParams.get("_sort")).toBe("forfaller");
    expect(url.searchParams.get("_order")).toBe("desc");
    expect(url.searchParams.get("_limit")).toBe("20");
  });

  it("skickar inte ett villkor som texten null", async () => {
    /*
     * ⛔ `String(null)` ÄR "null". Planterad defekt: ta bort kontrollen i
     * `textvarde`. Då blir `{ dar: { kategori: null } }` ett filter på texten
     * "null", alltså ett villkor som matchar fel i tysthet.
     */
    const { f, anrop } = falskFetch(svar(200, []));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    await k.lista("kostnader", { dar: { kategori: null } });
    expect(new URL(anrop[0].url).searchParams.has("kategori")).toBe(false);
  });

  it("säger ifrån när listan inte är en lista", async () => {
    /*
     * ⛔ ETT API SOM SVARAR `{ items: [...] }` ÄR VANLIGT, och att tyst plocka ut
     * `items` hade gjort adaptern beroende av ett namn ingen avtalat. Planterad
     * defekt: returnera `data.items ?? data`. Då fungerar det tills någon döper
     * fältet till `rows`, och då blir det noll rader utan fel.
     */
    const { f } = falskFetch(svar(200, { items: [{ id: "a" }] }));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    await expect(k.lista("kostnader")).rejects.toThrow(/lista/);
  });

  it("kräver att den skapade posten kommer tillbaka med sitt id", async () => {
    /*
     * ⛔ KONTRAKTETS REGEL 4. Planterad defekt: returnera posten utan
     * id-kontrollen. En gissad nyckel går sönder först vid nästa läsning,
     * alltså långt från felet.
     */
    const { f } = falskFetch(svar(201, { namn: "Adavo" }));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f });
    await expect(k.skapa("kostnader", { namn: "Adavo" })).rejects.toThrow(/id/);

    const { f: f2 } = falskFetch(svar(201, { id: "k1", namn: "Adavo" }));
    const k2 = skapaHttpKalla({ basUrl: BAS, hamta: f2 });
    await expect(k2.skapa("kostnader", { namn: "Adavo" })).resolves.toEqual({ id: "k1", namn: "Adavo" });
  });

  it("kastar på 404 vid uppdatering och borttagning, till skillnad från vid läsning", async () => {
    /*
     * ⛔ SAMMA KOD, MOTSATT BETYDELSE. Planterad defekt: kopiera in
     * `if (res.status === 404) return null` även här. Då ser en uppdatering av
     * något som inte finns ut att ha lyckats.
     */
    const { f } = falskFetch(svar(404, null, { text: "" }));
    await expect(skapaHttpKalla({ basUrl: BAS, hamta: f }).uppdatera("kostnader", "a", { x: 1 })).rejects.toThrow(/404/);

    const { f: f2 } = falskFetch(svar(404, null, { text: "" }));
    await expect(skapaHttpKalla({ basUrl: BAS, hamta: f2 }).taBort("kostnader", "a")).rejects.toThrow(/404/);
  });

  it("parsar inte kroppen på en lyckad borttagning", async () => {
    /*
     * ⛔ 204 UTAN KROPP ÄR DET NORMALA SVARET. Planterad defekt: `await
     * res.json()` i `taBort`. Då blir varje lyckad borttagning ett JSON-fel.
     */
    const { f } = falskFetch(svar(204, null, { text: "" }));
    await expect(skapaHttpKalla({ basUrl: BAS, hamta: f }).taBort("kostnader", "a")).resolves.toBeUndefined();
  });

  it("hämtar token per anrop och inte en gång vid uppstart", async () => {
    /*
     * ⛔ EN TOKEN SOM HÄMTADES VID UPPSTART GÅR UT medan appen står öppen, och
     * symptomet är att allt slutar fungera efter en timme utan att något
     * ändrats. Planterad defekt: läs token en gång i `skapaHttpKalla` och
     * återanvänd den.
     */
    const hamtaToken = vi.fn(async () => "t" + hamtaToken.mock.calls.length);
    const { f, anrop } = falskFetch(svar(200, { id: "a" }), svar(200, { id: "a" }));
    const k = skapaHttpKalla({ basUrl: BAS, hamta: f, hamtaToken });
    await k.las("kostnader", "a");
    await k.las("kostnader", "a");
    expect(hamtaToken).toHaveBeenCalledTimes(2);
    expect(anrop[0].headers.Authorization).toBe("Bearer t1");
    expect(anrop[1].headers.Authorization).toBe("Bearer t2");
  });

  it("kodar samling och id i sökvägen", async () => {
    /*
     * ⛔ ETT ID MED SNEDSTRECK hade annars blivit en annan sökväg, alltså ett
     * anrop mot något helt annat. Planterad defekt: ta bort encodeURIComponent.
     */
    const { f, anrop } = falskFetch(svar(200, { id: "a" }));
    await skapaHttpKalla({ basUrl: BAS + "/", hamta: f }).las("kost nader", "a/b");
    expect(anrop[0].url).toBe("https://api.example.se/v1/kost%20nader/a%2Fb");
  });
});
