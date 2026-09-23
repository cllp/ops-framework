import { describe, it, expect } from "vitest";
import { createCaseMirror } from "../node/caseMirror.js";
import { readCaseFlow } from "../lib/caseFlow.js";

/**
 * ⛔ PROVEN ANVÄNDER ETT PÅHITTAT REPO OCH EN PÅHITTAD ETIKETT. Ramverket får
 * inte kunna bero på den app som råkar adoptera modulen först, och ett prov som
 * säger `cllp/bolag-ops` eller `ops` gör det svårt att se när det börjar.
 */

const KONFIG = { owner: "nagon", repo: "nagot", label: "drift" };

/** En hämtare som svarar med det man ger den, i stället för att nå nätet. */
function answers(body, { ok = true, status = 200 } = {}) {
  const anrop = [];
  const fetcher = async (/** @type {string} */ url, /** @type {any} */ init) => {
    anrop.push({ url, init });
    return {
      ok,
      status,
      json: async () => body,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    };
  };
  return { fetcher, anrop };
}

/** @param {object} d */
const caseEntry = (d) => ({ number: 1, title: "Titel", state: "open", labels: [], updated_at: "2026-09-01T00:00:00Z", ...d });

describe("skapaArendespegel, konfigurationen", () => {
  it("kräver etikett, eftersom ett saknat urval ser ut som att speglingen fungerar", () => {
    // ⛔ Utan etikett speglas VARJE öppet ärende. Listan fylls, den fylls bara med
    // fel saker, och det syns inte som ett fel.
    expect(() => createCaseMirror({ owner: "a", repo: "r", label: "" })).toThrow(/label krävs/);
    expect(() => createCaseMirror({ owner: "a", repo: "", label: "e" })).toThrow(/repo krävs/);
    expect(() => createCaseMirror({ owner: "", repo: "r", label: "e" })).toThrow(/owner krävs/);
  });

  it("bygger en källa en människa kan öppna", () => {
    const mirror = createCaseMirror(KONFIG);
    expect(mirror.source).toBe("https://github.com/nagon/nagot/issues?q=is%3Aissue+is%3Aopen+label%3Adrift");
  });

  it("kodar en etikett med mellanslag i både anrop och länk", () => {
    // ⛔ En okodad etikett ger ett anrop som tystnar eller svarar med fel urval.
    const { fetcher, anrop } = answers([]);
    const mirror = createCaseMirror({ ...KONFIG, label: "att göra", fetcher });
    expect(mirror.source).toContain("att%20g%C3%B6ra");
    return mirror.hamta("t").then(() => {
      expect(anrop[0].url).toContain("labels=att%20g%C3%B6ra");
    });
  });
});

describe("hamta", () => {
  it("kastar vid fel svar i stället för att svara med en tom lista", async () => {
    // ⛔ Det egentliga provet. Ett 403 som blir `[]` ser exakt ut som "inga öppna
    // ärenden", och den som läser listan ser en tom lista i stället för ett
    // trasigt anrop.
    const { fetcher } = answers("Bad credentials", { ok: false, status: 403 });
    const mirror = createCaseMirror({ ...KONFIG, fetcher });
    await expect(mirror.hamta("t")).rejects.toThrow(/403/);
    await expect(mirror.hamta("t")).rejects.toThrow(/Bad credentials/);
  });

  it("kastar när svaret är ett objekt trots 200", async () => {
    // ⛔ GitHub svarar med en `message`-kropp i vissa fall. Ett `.filter` på det
    // kastar långt senare med ett fel som inte pekar hit.
    const { fetcher } = answers({ message: "Not Found" });
    const mirror = createCaseMirror({ ...KONFIG, fetcher });
    await expect(mirror.hamta("t")).rejects.toThrow(/annat än en lista/);
  });

  it("kräver en token", async () => {
    const mirror = createCaseMirror(KONFIG);
    await expect(mirror.hamta("")).rejects.toThrow(/token krävs/);
  });

  it("skickar etiketten och bara öppna ärenden", async () => {
    const { fetcher, anrop } = answers([]);
    const mirror = createCaseMirror({ ...KONFIG, fetcher });
    await mirror.hamta("hemlig");
    expect(anrop[0].url).toContain("labels=drift");
    expect(anrop[0].url).toContain("state=open");
    expect(anrop[0].init.headers.Authorization).toBe("Bearer hemlig");
  });
});

describe("tillFlode", () => {
  const mirror = createCaseMirror(KONFIG);
  const nu = () => "2026-09-17";

  it("filtrerar bort pull requests", () => {
    // ⛔ GitHubs issues-API returnerar dem som ärenden med ett `pull_request`-fält.
    // Utan filtret hamnar varje öppen PR i uppgiftslistan, och en PR är arbete som
    // redan är gjort och väntar på granskning, inte en uppgift.
    const flow = mirror.tillFlode([caseEntry({ number: 1 }), caseEntry({ number: 2, pull_request: { url: "x" } })], { nu });
    expect(flow.items.map((p) => p.number)).toEqual([1]);
  });

  it("sorterar på senast ändrad, med numret som andrahandsnyckel", () => {
    const rows = [
      caseEntry({ number: 10, updated_at: "2026-09-01T00:00:00Z" }),
      caseEntry({ number: 11, updated_at: "2026-09-05T00:00:00Z" }),
      caseEntry({ number: 12, updated_at: "2026-09-01T00:00:00Z" }),
    ];
    expect(mirror.tillFlode(rows, { nu }).items.map((p) => p.number)).toEqual([11, 12, 10]);
  });

  it("ger tom sammanfattning utan en sammanfattningsfunktion, aldrig första raden", () => {
    // ⛔ Första raden är ofta en rubrik eller en tom rad, och en automatiskt
    // plockad mening ser ut som en skriven sammanfattning.
    const utan = mirror.tillFlode([caseEntry({ body: "## Rubrik\n\nEn mening om något." })], { nu });
    expect(utan.items[0].summary).toBe("");

    const med = createCaseMirror({ ...KONFIG, summary: (t) => t.split("\n").pop() || "" });
    expect(med.tillFlode([caseEntry({ body: "## Rubrik\n\nEn mening om något." })], { nu }).items[0].summary).toBe(
      "En mening om något.",
    );
  });

  it("läser etiketter både som objekt och som strängar", () => {
    // ⛔ GitHub svarar med objekt, men en handskriven fixtur och vissa
    // API-varianter ger strängar. Att bara läsa `l.name` gav `undefined` i listan,
    // alltså en etikett som finns men inte matchar något filter.
    const flow = mirror.tillFlode([caseEntry({ labels: [{ name: "drift" }, "bradskande"] })], { nu });
    expect(flow.items[0].labels).toEqual(["drift", "bradskande"]);
  });

  it("bygger en länk när GitHub inte skickar en", () => {
    const flow = mirror.tillFlode([caseEntry({ number: 42, html_url: undefined })], { nu });
    expect(flow.items[0].url).toBe("https://github.com/nagon/nagot/issues/42");
  });

  it("skriver inget live-fält", () => {
    // ⛔ Det stod `live: true` i den app modulen ersätter, och skrevs omedelbart
    // över med `false` av den som anropade. Ett fält som sätts av två parter med
    // motsatta värden är en fråga ingen bestämt vem som äger.
    const flow = mirror.tillFlode([caseEntry({})], { nu });
    expect("live" in flow).toBe(false);
  });

  it("appens extra fält följer med per post", () => {
    const med = createCaseMirror({
      ...KONFIG,
      extraFields: (entry) => ({ roller: entry.number === 1 ? ["manniska"] : ["agent"] }),
    });
    const flow = med.tillFlode([caseEntry({ number: 1 }), caseEntry({ number: 2 })], { nu });
    expect(flow.items.map((p) => /** @type {any} */ (p).roller)).toEqual([["agent"], ["manniska"]]);
  });

  it("tål en tom och en saknad lista", () => {
    expect(mirror.tillFlode([], { nu }).items).toEqual([]);
    expect(mirror.tillFlode(/** @type {any} */ (null), { nu }).items).toEqual([]);
  });
});

describe("spegeln och läsaren hänger ihop", () => {
  it("det spegeln skriver kan läsaren läsa", () => {
    // ⛔ Provet finns för att de två är ett kontrakt i två filer på var sin sida av
    // en gräns som en vakt håller isär. Glider formen isär blir följden en tom
    // lista i vyn, alltså "inga uppgifter", vilket är felklassen `readCaseFlow`
    // byggdes för att stoppa.
    const mirror = createCaseMirror(KONFIG);
    const flow = mirror.tillFlode([caseEntry({ number: 7 })], { nu: () => "2026-09-17" });
    const last = readCaseFlow(flow);
    expect(last.error).toBeNull();
    expect(last.existed).toBe(true);
    expect(last.updatedAt).toBe("2026-09-17");
    expect(last.entries.map((p) => p.number)).toEqual([7]);
  });

  it("och även efter en tur genom JSON", () => {
    const mirror = createCaseMirror(KONFIG);
    const flow = mirror.tillFlode([caseEntry({ number: 7 })], { nu: () => "2026-09-17" });
    const last = readCaseFlow(JSON.stringify(flow));
    expect(last.existed).toBe(true);
    expect(last.entries.map((p) => p.number)).toEqual([7]);
  });
});
