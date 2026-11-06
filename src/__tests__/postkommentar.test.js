import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { createPostkommentarer } from "../data/postkommentarer.js";
import { adresserIText, bibliotekslank, kommentarRotId, kommentarRotText, lasBibliotekslank, postIdUrRot, utanPostlank } from "../lib/postkommentar.js";
import { samtalsnyckel } from "../lib/samtal.js";

/**
 * Kommentarer på en bibliotekspost, genom gruppens chatt (0.191.0, cllp/lifehub.app#663): modellen, samtalskällans `skickaPaRot` och medlemmens källa.
 *
 * ⛔ HÄR MÄTS BETEENDE: vilket id roten får, att den andra kommentaren blir ett svar, och att två som skriver samtidigt inte skriver över varandra, både med `createNew` (minneskällan,
 * Admin SDK) och utan (webbklientens källa, där regeln nekar en andra skapelse). Reglerna är oförändrade: fixturerna i `rules/__fixturer__` är byte för byte lika.
 */

const BAS = "https://app.exempel.se/bibliotek";
const GRUPP = "kallan";
const SID = samtalsnyckel({ groupId: GRUPP, slag: "grupp" });
const NOT = { id: "p-not", groupId: GRUPP, typ: "anteckning", rubrik: "Anteckning" };
const ROT = "post~p-not";
const MEDDELANDEN = `samtal/${SID}/meddelanden`;
const SVAR = `samtal/${SID}/tradar/${ROT}/meddelanden`;

/**
 * Webbklientens källa, som reglerna ser den: `create` med ett id som redan finns är en uppdatering, och meddelanden har `allow update: if false`. Ingen `createNew`.
 * ⛔ PRÖVNINGEN ÄR SYNKRON, som på servern: två skapelser i samma ögonblick kan inte båda se ett ledigt id.
 */
function somWebbklienten() {
  const minne = createMemorySource({});
  const tagna = new Set();
  /** @type {any} */
  const k = { ...minne };
  delete k.createNew;
  k.create = async (/** @type {string} */ samling, /** @type {any} */ data) => {
    if (data?.id) {
      const nyckel = `${samling}/${data.id}`;
      if (tagna.has(nyckel) && samling.endsWith("/meddelanden")) throw new Error("Missing or insufficient permissions.");
      tagna.add(nyckel);
    }
    return minne.create(samling, data);
  };
  return { minne, k };
}

function kallor(kalla = createMemorySource({})) {
  const samtal = createSamtalskalla({ kalla, tradar: "tradar" });
  const namn = /** @type {Record<string, string>} */ ({ anna: "Anna Ek", bo: "Bo Lind" });
  const anna = createPostkommentarer({ samtal, groupId: GRUPP, uid: "anna", bas: BAS, namnFor: (u) => namn[u] });
  const bo = createPostkommentarer({ samtal, groupId: GRUPP, uid: "bo", bas: BAS, namnFor: (u) => namn[u] });
  return { kalla, samtal, anna, bo };
}

describe("modellen: id:t följer av posten, länken är appens form", () => {
  it("kommentarRotId och postIdUrRot är varandras omvändning, och bara ett postid går in", () => {
    expect(kommentarRotId("p-not")).toBe(ROT);
    expect(postIdUrRot(ROT)).toBe("p-not");
    expect(postIdUrRot("m_abc_1_x")).toBeNull();
    expect(postIdUrRot("post~")).toBeNull();
    for (const fel of ["", "a/b", "post~x", "x".repeat(200), undefined]) expect(() => kommentarRotId(/** @type {any} */ (fel))).toThrow(/postid/);
  });

  it("bibliotekslank och lasBibliotekslank: samma form som appens sökträff, och bara appens egen adress läses tillbaka", () => {
    const lank = bibliotekslank(BAS, { plats: "plats~kallan~demos", postId: "p-1" });
    expect(lank).toBe("https://app.exempel.se/bibliotek?plats=plats~kallan~demos&post=p-1");
    expect(lasBibliotekslank(BAS, lank)).toEqual({ plats: "plats~kallan~demos", postId: "p-1" });
    for (const annan of [
      "https://annan.exempel.se/bibliotek?plats=kallan&post=p-1",
      "https://app.exempel.se/kalender?plats=kallan&post=p-1",
      "https://app.exempel.se/bibliotek?plats=kallan&post=p-1&x=1",
      "https://app.exempel.se/bibliotek?plats=kallan",
      "https://app.exempel.se/bibliotek?plats=kallan&post=p-1#a",
      "inte en adress",
    ]) expect(lasBibliotekslank(BAS, annan), annan).toBeNull();
    expect(() => bibliotekslank("https://app.exempel.se/bibliotek/", { plats: "x", postId: "p" })).toThrow(/snedstreck/);
    expect(() => lasBibliotekslank("bibliotek", "x")).toThrow(/ingen adress/);
  });

  it("adresserIText hittar länkarna, utan skiljetecken på slutet, och utanPostlank tar bara bort postens egen rad", () => {
    const lank = bibliotekslank(BAS, { plats: GRUPP, postId: "p-not" });
    const text = kommentarRotText("  Bra anteckning, se också https://exempel.se/x.  ", lank);
    expect(text).toBe(`Bra anteckning, se också https://exempel.se/x.\n${lank}`);
    expect(adresserIText(text)).toEqual(["https://exempel.se/x", lank]);
    expect(utanPostlank(text, (u) => lasBibliotekslank(BAS, u)?.postId === "p-not")).toBe("Bra anteckning, se också https://exempel.se/x.");
  });
});

describe("medlemmens kommentarer: roten, svaret och samtidig skapelse", () => {
  it("⛔ en kommentar skapar roten i gruppchatten med det härledda id:t, texten och postens länk", async () => {
    const { kalla, anna } = kallor();
    const svar = /** @type {any} */ (await anna.kommentera(NOT, "Bra anteckning"));
    expect(svar.rot).toBe(true);
    const rot = await kalla.read(MEDDELANDEN, ROT);
    expect(rot).toMatchObject({ id: ROT, av: "anna", text: `Bra anteckning\n${BAS}?plats=${GRUPP}&post=p-not` });
    // Inget nytt fält på meddelandet: samma fält som ett vanligt meddelande.
    expect(Object.keys(/** @type {any} */ (rot)).sort()).toEqual(["av", "id", "text", "tid"]);
    expect(await kalla.list(SVAR)).toHaveLength(0);
    expect((await anna.las(NOT)).rader).toEqual([expect.objectContaining({ id: ROT, namn: "Anna Ek", text: "Bra anteckning", egen: true })]);
  });

  it("⛔ en andra kommentar blir ett svar i rotens tråd, och roten står kvar som den var", async () => {
    const { kalla, anna, bo } = kallor();
    await anna.kommentera(NOT, "Första");
    const svar = /** @type {any} */ (await bo.kommentera(NOT, "Andra"));
    expect(svar.rot).toBe(false);
    expect((await kalla.read(MEDDELANDEN, ROT))?.text).toMatch(/^Första\n/);
    expect((await kalla.list(SVAR)).map((m) => [m.av, m.text])).toEqual([["bo", "Andra"]]);
    expect(await kalla.read(`samtal/${SID}/tradar`, ROT)).toMatchObject({ id: ROT });
    const rader = (await anna.las(NOT)).rader;
    expect(rader.map((r) => [r.namn, r.text, Boolean(r.egen)])).toEqual([["Anna Ek", "Första", true], ["Bo Lind", "Andra", false]]);
  });

  it("⛔ samtidig skapelse med createNew: en rot och ett svar, ingen text förlorad", async () => {
    const { kalla, anna, bo } = kallor();
    const [a, b] = /** @type {any[]} */ (await Promise.all([anna.kommentera(NOT, "Från Anna"), bo.kommentera(NOT, "Från Bo")]));
    expect([a.rot, b.rot].sort()).toEqual([false, true]);
    const rot = await kalla.read(MEDDELANDEN, ROT);
    const svar = await kalla.list(SVAR);
    expect(svar).toHaveLength(1);
    expect([String(rot?.text).split("\n")[0], svar[0].text].sort()).toEqual(["Från Anna", "Från Bo"]);
  });

  it("⛔ samtidig skapelse i webbklientens källa (regeln nekar den andra skapelsen): den som får nej skriver som svar", async () => {
    const { minne, k } = somWebbklienten();
    const { anna, bo } = kallor(k);
    const [a, b] = /** @type {any[]} */ (await Promise.all([anna.kommentera(NOT, "Från Anna"), bo.kommentera(NOT, "Från Bo")]));
    expect([a.rot, b.rot].sort()).toEqual([false, true]);
    const rot = await minne.read(MEDDELANDEN, ROT);
    const svar = await minne.list(SVAR);
    expect(svar).toHaveLength(1);
    expect([String(rot?.text).split("\n")[0], svar[0].text].sort()).toEqual(["Från Anna", "Från Bo"]);
  });

  it("⛔ ett nej som inte beror på roten kastas vidare, och inget svar skrivs i dess ställe", async () => {
    const minne = createMemorySource({});
    /** @type {any} */
    const k = { ...minne };
    delete k.createNew;
    k.create = async (/** @type {string} */ s, /** @type {any} */ d) => {
      if (s === MEDDELANDEN) throw new Error("Missing or insufficient permissions.");
      return minne.create(s, d);
    };
    const { anna } = kallor(k);
    await expect(anna.kommentera(NOT, "Hej")).rejects.toThrow(/insufficient/);
    expect(await minne.list(SVAR)).toHaveLength(0);
  });

  it("Mitt bibliotek kommenteras inte, och en tom kommentar skriver ingenting", async () => {
    const { kalla, anna } = kallor();
    const mitt = { id: "p-mitt", groupId: "mitt~anna", typ: "anteckning" };
    expect(anna.kanKommentera?.(mitt)).toBe(false);
    expect(anna.kanKommentera?.(NOT)).toBe(true);
    await expect(anna.kommentera(mitt, "Hej")).rejects.toThrow(/Mitt bibliotek/);
    await expect(anna.kommentera(NOT, "   ")).rejects.toThrow(/tom/);
    expect(await kalla.read(MEDDELANDEN, ROT)).toBeNull();
  });
});
