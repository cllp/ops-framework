import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { handelseBibliotek, mittBibliotek } from "../lib/bibliotek.js";
import {
  ADRESSSEGMENT,
  DELNINGSORSAKER,
  FELKOD_FONSTER_MS,
  FELKOD_MAX,
  HANDELSESVARSFALT,
  HANDELSEFILFALT,
  MAX_HANDELSEFILER,
  SLUMPSLUTFORM,
} from "../lib/delning.js";
import { medlemskapsId } from "../lib/grupp.js";
import { adressId, byggAdressdelning, byggDelning, createDelningService, delningsNyckel, hashaKod, kodStammer, nyttDelningstoken, nyttSlumpslut } from "../node/delning.js";

/**
 * Delning med adress, kod och händelse (0.125.0, lifehub.app#377): den läsbara adressen som nyckel, slumpslutet, koden och räknaren för felaktiga koder,
 * en händelses sida, och att en gammal tokenlänk från 0.119.0 till 0.124.0 fortfarande öppnas.
 *
 * ⛔ UTAN NÄTVERK OCH UTAN FIREBASE: minneskällan och en låtsaslagring. Varje säkerhetsvillkor har bevisats rött med koden muterad (arbetsreglernas punkt 4);
 * mutationerna och utfallen står i PR-texten.
 */

const NU = 1_800_000_000_000;
const DYGN = 24 * 60 * 60 * 1000;
const GRUPP = "kallan";
const ANNAN_GRUPP = "grannen";
const AGARE = "uid-agare";
const ADMIN = "uid-admin";
const MEDLEM = "uid-medlem";
const ANNAN = "uid-annan";
const REDAKTOR = "uid-redaktor";
const UTOMSTAENDE = "uid-utanfor";
const HEMLIG = "HEMLIG-INTERN-TEXT";

const medlemskap = (uid, groupId, roll, extra = {}) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn: `Namn ${uid}`, ...extra });
const PLATS = handelseBibliotek(GRUPP, "h1");
const fil = (id, groupId, av, extra = {}) => ({
  id,
  groupId,
  typ: "fil",
  rubrik: `Rubrik ${id}`,
  skapadAv: { uid: av, namn: "Skaparen", typ: "manniska", kalla: "bibliotek" },
  skapad: NU - 1000,
  andrad: NU - 1000,
  fil: { sokvag: `grupper/${groupId}/bibliotek/${id}/${id}.pdf`, namn: `${id}.pdf`, mime: "application/pdf", byte: 2048, klar: true },
  ...extra,
});
const handelse = (extra = {}) => ({
  id: "h1",
  groupId: GRUPP,
  rubrik: "Resa med kusiner",
  text: "Vi åker på tisdag.\nTa med pass.",
  plats: "Visby",
  datum: "2026-12-26",
  slutDatum: "2027-01-10",
  tid: "09:00",
  slutTid: "17:00",
  kravSvar: true,
  skapadAv: { uid: MEDLEM, namn: "Hemlig skapare" },
  svar: [{ uid: ANNAN, svar: "kommer" }],
  kommentarer: [HEMLIG],
  intern: HEMLIG,
  ...extra,
});

function bygg({ poster = [], handelser = [handelse()], extraMedlemskap = [], omslut = (k) => k, farDelaHandelse, utanHandelser = false } = {}) {
  const grundkalla = createMemorySource({
    memberships: [
      medlemskap(AGARE, GRUPP, "agare"),
      medlemskap(ADMIN, GRUPP, "admin"),
      medlemskap(MEDLEM, GRUPP, "medlem"),
      medlemskap(ANNAN, GRUPP, "medlem"),
      medlemskap(REDAKTOR, GRUPP, "medlem"),
      medlemskap(UTOMSTAENDE, ANNAN_GRUPP, "agare"),
      ...extraMedlemskap,
    ],
    bibliotek: [fil("p-medlem", GRUPP, MEDLEM), fil("p-annan", GRUPP, ANNAN), fil("p-mitt", mittBibliotek(MEDLEM), MEDLEM), ...poster],
    handelser,
    delningar: [],
  });
  const kalla = omslut(grundkalla);
  const signeradAdress = vi.fn(async ({ sokvag, sekunder, disposition }) => `https://lagring.test/${sokvag}?s=${sekunder}&d=${encodeURIComponent(disposition)}`);
  let nu = NU;
  const tjanst = createDelningService({
    kalla,
    lagring: { signeradAdress },
    samlingar: { delningar: "delningar", bibliotek: "bibliotek", ...(utanHandelser ? {} : { handelser: "handelser" }) },
    ...(utanHandelser ? {} : { handelseSida: (h) => ({ titel: h.rubrik, beskrivning: h.text, plats: h.plats, intern: h.intern }) }),
    ...(farDelaHandelse ? { farDelaHandelse } : {}),
    klocka: () => nu,
  });
  return { kalla: grundkalla, tjanst, signeradAdress, tid: (ny) => { nu = ny; } };
}

const delaFil = (tjanst, extra = {}) =>
  tjanst.skapa({ uid: MEDLEM, postId: "p-medlem", groupId: GRUPP, dagar: 7, gruppdel: "travel", fildel: "biljetter", ...extra });
const delaHandelse = (tjanst, extra = {}) =>
  tjanst.skapa({ uid: MEDLEM, handelseId: "h1", gruppdel: "travel", handelsedel: "resa-med-kusiner", ...extra });

describe("adressen: nyckeln och slumpslutet", () => {
  it("⛔ utan kod får sista delen ett slumpat slut på minst 8 tecken, och två länkar får olika", async () => {
    const { tjanst } = bygg();
    const a = await delaFil(tjanst);
    const b = await delaFil(tjanst);
    for (const svar of [a, b]) {
      const [grupp, segment, sista] = svar.adress.split("/");
      expect(grupp).toBe("travel");
      expect(segment).toBe(ADRESSSEGMENT.post);
      expect(sista).toMatch(/^biljetter-[a-z0-9]{8}$/);
      expect(sista.slice("biljetter-".length)).toMatch(SLUMPSLUTFORM);
    }
    expect(a.adress).not.toBe(b.adress);
    const h = await delaHandelse(tjanst);
    expect(h.adress).toMatch(/^travel\/event\/resa-med-kusiner-[a-z0-9]{8}$/);
    expect(h.sokvag).toBe(`/g/${h.adress}`);
  });

  it("⛔ med kod är adressen exakt det personen skrev, utan slut", async () => {
    const { tjanst } = bygg();
    const f = await delaFil(tjanst, { kod: "hemligt1" });
    expect(f.adress).toBe("travel/lib/biljetter");
    expect(f.harKod).toBe(true);
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    expect(h.adress).toBe("travel/event/resa-med-kusiner");
    expect(h.harKod).toBe(true);
  });

  it("id:t är SHA-256 av adressen, adressen står i raden, och typsegmentet skiljer fil från händelse", async () => {
    const { tjanst, kalla } = bygg();
    const f = await delaFil(tjanst, { kod: "hemligt1" });
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    expect(f.id).toBe(createHash("sha256").update("travel/lib/biljetter").digest("hex"));
    expect(h.id).toBe(createHash("sha256").update("travel/event/resa-med-kusiner").digest("hex"));
    expect(f.id).toBe(adressId("travel/lib/biljetter"));
    expect(f.id).not.toBe(h.id);
    expect(await kalla.read("delningar", f.id)).toMatchObject({ adress: "travel/lib/biljetter", slag: "post" });
    expect(await kalla.read("delningar", h.id)).toMatchObject({ adress: "travel/event/resa-med-kusiner", slag: "handelse", handelseId: "h1", groupId: GRUPP });
  });

  it("⛔ en upptagen adress med kod är ett eget fel, och den som låg där rörs inte", async () => {
    const { tjanst, kalla } = bygg();
    const forsta = await delaHandelse(tjanst, { kod: "hemligt1" });
    const fore = await kalla.read("delningar", forsta.id);
    await expect(delaHandelse(tjanst, { uid: ANNAN, kod: "annan-kod1" })).rejects.toMatchObject({ kod: "adress-upptagen" });
    expect(await kalla.read("delningar", forsta.id)).toEqual(fore);
    expect(await kalla.list("delningar")).toHaveLength(1);
  });

  it("⛔ två samtidiga delningar under samma adress: precis en lyckas (createNew, ingen läs-sedan-skriv)", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await Promise.allSettled([
      delaHandelse(tjanst, { kod: "kod-ett-1" }),
      delaHandelse(tjanst, { uid: ANNAN, kod: "kod-tva-22" }),
      delaHandelse(tjanst, { uid: ADMIN, kod: "kod-tre-33" }),
    ]);
    expect(svar.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    expect(svar.filter((s) => s.status === "rejected").every((s) => s.reason.kod === "adress-upptagen")).toBe(true);
    expect(await kalla.list("delningar")).toHaveLength(1);
  });

  it("⛔ en stängd adress blir aldrig ledig: en gammal länk kan inte börja visa något annat", async () => {
    const { tjanst } = bygg();
    const forsta = await delaHandelse(tjanst, { kod: "hemligt1" });
    await tjanst.aterkalla({ uid: MEDLEM, id: forsta.id });
    await expect(delaHandelse(tjanst, { kod: "hemligt1" })).rejects.toMatchObject({ kod: "adress-upptagen" });
    expect(await tjanst.hamta(forsta.adress, { kod: "hemligt1" })).toEqual({ ok: false, orsak: "stangd" });
  });

  it("en krock på slumpslutet försöks om med ett nytt, och ger upp med ett eget fel", async () => {
    let krockar = 2;
    const forsta = bygg({
      omslut: (k) => ({ ...k, createNew: async (samling, data) => (krockar-- > 0 ? { created: false, row: data } : k.createNew(samling, data)) }),
    });
    const svar = await delaHandelse(forsta.tjanst);
    expect(svar.adress).toMatch(/^travel\/event\/resa-med-kusiner-[a-z0-9]{8}$/);
    expect(await forsta.kalla.list("delningar")).toHaveLength(1);

    const alltidUpptaget = bygg({ omslut: (k) => ({ ...k, createNew: async (_s, data) => ({ created: false, row: data }) }) });
    await expect(delaHandelse(alltidUpptaget.tjanst)).rejects.toMatchObject({ kod: "adress-upptagen" });
  });

  it("⛔ en adress som inte har rätt form nekas med ogiltig-adress, och inget skrivs", async () => {
    const { tjanst, kalla } = bygg();
    for (const handelsedel of ["Resa", "resa med", "resa.ver2", "a/b", "../x", "-resa", "resa-", "resa--x", "", " ", "å", "a".repeat(41), undefined, null, 4]) {
      await expect(delaHandelse(tjanst, { handelsedel }), String(handelsedel)).rejects.toMatchObject({ kod: "ogiltig-adress" });
    }
    for (const gruppdel of ["Travel", "tra vel", "", "a".repeat(41), undefined]) {
      await expect(delaHandelse(tjanst, { gruppdel }), String(gruppdel)).rejects.toMatchObject({ kod: "ogiltig-adress" });
    }
    await expect(delaFil(tjanst, { fildel: "bubbelglasen.ver2" })).rejects.toMatchObject({ kod: "ogiltig-adress" });
    await expect(delaFil(tjanst, { fildel: undefined })).rejects.toMatchObject({ kod: "ogiltig-adress" });
    expect(await kalla.list("delningar")).toHaveLength(0);
  });

  it("slumpslutet har rätt form och blir inte samma två gånger", () => {
    const slut = new Set(Array.from({ length: 200 }, () => nyttSlumpslut()));
    expect(slut.size).toBe(200);
    for (const s of slut) expect(s).toMatch(SLUMPSLUTFORM);
    expect(new Set([...slut].join("")).size).toBeGreaterThan(30);
  });

  it("nyckeln för uppslag och räknare är samma för ett token och en adress, och null för skräp", () => {
    const token = nyttDelningstoken();
    expect(delningsNyckel(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(delningsNyckel("travel/event/resa-xxxxxxxx")).toBe(adressId("travel/event/resa-xxxxxxxx"));
    expect(delningsNyckel("TRAVEL/Event/Resa-XXXXXXXX/")).toBe(adressId("travel/event/resa-xxxxxxxx"));
    for (const skrap of ["", "x", null, undefined, 4, "a/b", "a/x/b", "a/event", "../../etc/passwd", "a/event/b/c", `${"a".repeat(42)}!`]) {
      expect(delningsNyckel(skrap), String(skrap)).toBeNull();
    }
  });
});

describe("koden", () => {
  it("⛔ koden sparas aldrig i klartext: scrypt med eget salt per länk", async () => {
    const { tjanst, kalla } = bygg();
    const a = await delaFil(tjanst, { kod: "samma-kod-1" });
    const b = await delaHandelse(tjanst, { kod: "samma-kod-1" });
    const ra = await kalla.read("delningar", a.id);
    const rb = await kalla.read("delningar", b.id);
    for (const rad of [ra, rb]) {
      expect(JSON.stringify(rad)).not.toContain("samma-kod-1");
      expect(rad.kod.salt).toMatch(/^[0-9a-f]{32}$/);
      expect(rad.kod.hash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(ra.kod.salt).not.toBe(rb.kod.salt);
    expect(ra.kod.hash).not.toBe(rb.kod.hash);
    expect(await kodStammer(ra.kod, "samma-kod-1")).toBe(true);
    expect(await kodStammer(ra.kod, "samma-kod-2")).toBe(false);
    expect(await kodStammer(ra.kod, "")).toBe(false);
    expect(await kodStammer(null, "samma-kod-1")).toBe(false);
    expect(await kodStammer({ salt: "zz", hash: "00" }, "samma-kod-1")).toBe(false);
  });

  it("koden normaliseras (NFC, blanksteg i ändarna) och räknas i tecken", async () => {
    const lagrad = await hashaKod("  blåbär-kod  ");
    expect(await kodStammer(lagrad, "blåbär-kod")).toBe(true);
    expect(await kodStammer(lagrad, "blåbär-kod".normalize("NFD"))).toBe(true);
    await expect(hashaKod("kort")).rejects.toThrow(/minst 6/);
  });

  it("⛔ en länk med kod ger kod-kravs utan kod, fel-kod med fel kod, och öppnas med rätt", async () => {
    const { tjanst } = bygg();
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    const utan = await tjanst.hamta(h.adress);
    expect(utan).toEqual({ ok: false, orsak: "kod-kravs" });
    expect(await tjanst.hamta(h.adress, { kod: "" })).toEqual({ ok: false, orsak: "kod-kravs" });
    expect(await tjanst.hamta(h.adress, { kod: "   " })).toEqual({ ok: false, orsak: "kod-kravs" });
    expect(await tjanst.hamta(h.adress, { kod: "fel-kod-1" })).toEqual({ ok: false, orsak: "fel-kod" });
    expect(await tjanst.hamta(h.adress, { kod: 12345678 })).toEqual({ ok: false, orsak: "kod-kravs" });
    const ratt = await tjanst.hamta(h.adress, { kod: "hemligt1" });
    expect(ratt.ok).toBe(true);
    expect(ratt.delning.titel).toBe("Resa med kusiner");
    // Svaret utan rätt kod säger ingenting om händelsen.
    expect(JSON.stringify([utan, await tjanst.hamta(h.adress, { kod: "fel-kod-1" })])).not.toMatch(/Resa|Visby|2026|titel/);
  });

  it("⛔ samma kod på en fillänk", async () => {
    const { tjanst } = bygg();
    const f = await delaFil(tjanst, { kod: "hemligt1" });
    expect(await tjanst.hamta(f.adress)).toEqual({ ok: false, orsak: "kod-kravs" });
    expect(await tjanst.hamta(f.adress, { kod: "nope-nope" })).toEqual({ ok: false, orsak: "fel-kod" });
    const ratt = await tjanst.hamta(f.adress, { kod: "hemligt1" });
    expect(ratt.ok).toBe(true);
    expect(ratt.delning.rubrik).toBe("Rubrik p-medlem");
  });

  it("en kod som är för kort eller för lång nekas med ogiltig-kod, och en skyddad länk blir aldrig öppen av det", async () => {
    const { tjanst, kalla } = bygg();
    for (const kod of ["abc", "12345", "x".repeat(65), 12345678, {}]) {
      await expect(delaHandelse(tjanst, { kod }), String(kod)).rejects.toMatchObject({ kod: "ogiltig-kod" });
    }
    expect(await kalla.list("delningar")).toHaveLength(0);
    // Ingen kod alls är ingen kod: undefined, null och tom text ger en öppen länk med slumpslut.
    for (const kod of [undefined, null, "", "   "]) expect((await delaHandelse(tjanst, { kod })).harKod, String(kod)).toBe(false);
  });

  it("en länk utan kod ignorerar en kod som skickas ändå", async () => {
    const { tjanst } = bygg();
    const h = await delaHandelse(tjanst);
    expect((await tjanst.hamta(h.adress, { kod: "onödig-kod" })).ok).toBe(true);
  });
});

describe("felaktiga koder räknas per länk", () => {
  it("⛔ efter FELKOD_MAX fel svarar länken for-manga, också på rätt kod", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    for (let i = 0; i < FELKOD_MAX; i++) expect(await tjanst.hamta(h.adress, { kod: `fel-kod-${i}` }), String(i)).toEqual({ ok: false, orsak: "fel-kod" });
    expect(await tjanst.hamta(h.adress, { kod: "fel-kod-x" })).toEqual({ ok: false, orsak: "for-manga" });
    expect(await tjanst.hamta(h.adress, { kod: "hemligt1" })).toEqual({ ok: false, orsak: "for-manga" });
    expect((await kalla.read("delningar", h.id)).felAntal).toBe(FELKOD_MAX);
  });

  it("⛔ när fönstret gått ut är räknaren noll igen, och rätt kod öppnar", async () => {
    const { tjanst, tid } = bygg();
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    for (let i = 0; i < FELKOD_MAX; i++) await tjanst.hamta(h.adress, { kod: `fel-kod-${i}` });
    tid(NU + FELKOD_FONSTER_MS - 1);
    expect(await tjanst.hamta(h.adress, { kod: "hemligt1" })).toEqual({ ok: false, orsak: "for-manga" });
    tid(NU + FELKOD_FONSTER_MS);
    expect((await tjanst.hamta(h.adress, { kod: "hemligt1" })).ok).toBe(true);
  });

  it("⛔ rätt kod ger tillbaka sitt försök: en besökare som öppnar sidan igen och igen låser inte länken", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    for (let i = 0; i < FELKOD_MAX * 3; i++) expect((await tjanst.hamta(h.adress, { kod: "hemligt1" })).ok, String(i)).toBe(true);
    expect((await kalla.read("delningar", h.id)).felAntal).toBe(0);
  });

  it("⛔ parallella gissningar prövas inte alla: högst FELKOD_MAX kommer förbi spärren", async () => {
    const { tjanst } = bygg();
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    const svar = await Promise.all(Array.from({ length: 30 }, (_, i) => tjanst.hamta(h.adress, { kod: i === 17 ? "hemligt1" : `fel-kod-${i}` })));
    const prövade = svar.filter((s) => s.ok || s.orsak === "fel-kod");
    expect(prövade.length).toBeLessThanOrEqual(FELKOD_MAX);
    expect(svar.filter((s) => !s.ok && s.orsak === "for-manga").length).toBeGreaterThanOrEqual(30 - FELKOD_MAX);
  });

  it("räknaren är per länk: en annan länk med samma kod påverkas inte", async () => {
    const { tjanst } = bygg();
    const a = await delaHandelse(tjanst, { kod: "hemligt1" });
    const b = await delaHandelse(tjanst, { handelsedel: "andra", kod: "hemligt1" });
    for (let i = 0; i < FELKOD_MAX + 2; i++) await tjanst.hamta(a.adress, { kod: `fel-kod-${i}` });
    expect((await tjanst.hamta(b.adress, { kod: "hemligt1" })).ok).toBe(true);
  });

  it("en kod som är för lång för att kunna vara rätt kostar inget försök", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    expect(await tjanst.hamta(h.adress, { kod: "x".repeat(500) })).toEqual({ ok: false, orsak: "fel-kod" });
    expect((await kalla.read("delningar", h.id)).felAntal).toBe(0);
  });

  it("en rad med trasig räknare och en kod öppnas aldrig (fel i datan öppnar ingenting)", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    await kalla.update("delningar", h.id, { felAntal: "inga" });
    expect(await tjanst.hamta(h.adress, { kod: "hemligt1" })).toEqual({ ok: false, orsak: "for-manga" });
  });
});

describe("händelsens sida", () => {
  it("⛔ svaret har BARA de listade fälten och inget av händelsens övriga, inte gruppen, svaren eller kommentarerna", async () => {
    const { tjanst } = bygg();
    const h = await delaHandelse(tjanst);
    const svar = await tjanst.hamta(h.adress);
    expect(svar.ok).toBe(true);
    expect(Object.keys(svar.delning).sort()).toEqual([...HANDELSESVARSFALT].sort());
    expect(svar.delning).toMatchObject({
      slag: "handelse",
      titel: "Resa med kusiner",
      beskrivning: "Vi åker på tisdag.\nTa med pass.",
      plats: "Visby",
      datum: "2026-12-26",
      slutDatum: "2027-01-10",
      tid: "09:00",
      slutTid: "17:00",
      heldag: false,
      filer: [],
      ejVisade: 0,
    });
    const json = JSON.stringify(svar);
    for (const forbjudet of [HEMLIG, "Hemlig skapare", MEDLEM, GRUPP, "kallan", "kravSvar", "kommer", "svar\"", "kommentarer", "intern", "groupId", "skapadAv", "handelser"]) {
      expect(json, forbjudet).not.toContain(forbjudet);
    }
  });

  it("⛔ en fil som appens handelseSida lägger till i svaret följer inte med", async () => {
    const { tjanst } = bygg();
    const svar = await tjanst.hamta((await delaHandelse(tjanst)).adress);
    expect(svar.delning).not.toHaveProperty("intern");
  });

  it("heldag och flera dagar: klockslag följer inte med en heldag, och slutDatum bara när det är efter datum", async () => {
    const heldag = bygg({ handelser: [handelse({ heldag: true, tid: undefined, slutTid: undefined })] });
    const a = await heldag.tjanst.hamta((await delaHandelse(heldag.tjanst)).adress);
    expect(a.delning).toMatchObject({ heldag: true, tid: null, slutTid: null, slutDatum: "2027-01-10" });
    const endag = bygg({ handelser: [handelse({ slutDatum: undefined, tid: "18:00", slutTid: "20:00" })] });
    const b = await endag.tjanst.hamta((await delaHandelse(endag.tjanst)).adress);
    expect(b.delning).toMatchObject({ heldag: false, slutDatum: null, tid: "18:00", slutTid: "20:00" });
  });

  it("⛔ filerna: bara färdiga filer på händelsens plats, med en signerad adress som visar filen", async () => {
    const { tjanst, signeradAdress } = bygg({
      poster: [
        fil("f-b", PLATS, MEDLEM, { skapad: NU - 10, rubrik: "Biljett B" }),
        fil("f-a", PLATS, MEDLEM, { skapad: NU - 20, rubrik: "Biljett A", fil: { sokvag: `grupper/${PLATS}/bibliotek/f-a/a.png`, namn: "a.png", mime: "image/png", byte: 10, klar: true } }),
        { id: "anteckning", groupId: PLATS, typ: "anteckning", rubrik: "Hemlig anteckning", text: "tips", skapadAv: { uid: MEDLEM }, skapad: NU, andrad: NU },
        fil("halv", PLATS, MEDLEM, { fil: { sokvag: `grupper/${PLATS}/bibliotek/halv/h.pdf`, namn: "h.pdf", mime: "application/pdf", byte: 1, klar: false } }),
        fil("annan-handelse", handelseBibliotek(GRUPP, "h2"), MEDLEM, { rubrik: "Annans fil" }),
        fil("gruppens", GRUPP, MEDLEM, { rubrik: "Gruppens fil" }),
      ],
    });
    const svar = await tjanst.hamta((await delaHandelse(tjanst)).adress);
    expect(svar.delning.filer.map((f) => f.rubrik)).toEqual(["Biljett A", "Biljett B"]);
    for (const f of svar.delning.filer) expect(Object.keys(f).sort()).toEqual([...HANDELSEFILFALT].sort());
    expect(svar.delning.filer[0]).toMatchObject({ typ: "bild", mime: "image/png", storlek: 10 });
    expect(svar.delning.filer[1]).toMatchObject({ typ: "pdf", storlek: 2048 });
    const json = JSON.stringify(svar);
    for (const forbjudet of ["Hemlig anteckning", "tips", "Annans fil", "Gruppens fil", "halv"]) expect(json, forbjudet).not.toContain(forbjudet);
    expect(signeradAdress).toHaveBeenCalledWith(expect.objectContaining({ sokvag: `grupper/${PLATS}/bibliotek/f-b/f-b.pdf`, sekunder: 900, disposition: "inline" }));
  });

  it("en fil som tagits bort följer inte med nästa besök", async () => {
    const { tjanst, kalla } = bygg({ poster: [fil("f1", PLATS, MEDLEM), fil("f2", PLATS, MEDLEM, { skapad: NU })] });
    const h = await delaHandelse(tjanst);
    expect((await tjanst.hamta(h.adress)).delning.filer).toHaveLength(2);
    await kalla.remove("bibliotek", "f1");
    expect((await tjanst.hamta(h.adress)).delning.filer.map((f) => f.rubrik)).toEqual(["Rubrik f2"]);
  });

  it("⛔ en post som appens egen läsning nekar (sökvägsprovet) kommer inte med via listan", async () => {
    const { tjanst } = bygg({
      poster: [fil("ok", PLATS, MEDLEM), fil("fel", PLATS, MEDLEM)],
      omslut: (k) => ({ ...k, read: async (samling, id) => (samling === "bibliotek" && id === "fel" ? null : k.read(samling, id)) }),
    });
    const svar = await tjanst.hamta((await delaHandelse(tjanst)).adress);
    expect(svar.delning.filer.map((f) => f.rubrik)).toEqual(["Rubrik ok"]);
  });

  it("taket på antalet filer är MAX_HANDELSEFILER, och det som inte fick plats räknas i ejVisade", async () => {
    const poster = Array.from({ length: MAX_HANDELSEFILER + 3 }, (_, i) => fil(`f${String(i).padStart(3, "0")}`, PLATS, MEDLEM, { skapad: NU - 1000 + i }));
    const { tjanst } = bygg({ poster });
    const svar = await tjanst.hamta((await delaHandelse(tjanst)).adress);
    expect(svar.delning.filer).toHaveLength(MAX_HANDELSEFILER);
    expect(svar.delning.ejVisade).toBe(3);
  });

  it("ett fel från databasen vid filerna kastas vidare i stället för att ge en sida utan filer", async () => {
    const { tjanst } = bygg({
      poster: [fil("f1", PLATS, MEDLEM)],
      omslut: (k) => ({ ...k, list: async (samling, q) => { if (samling === "bibliotek") throw new Error("databasen nere"); return k.list(samling, q); } }),
    });
    const h = await delaHandelse(tjanst);
    await expect(tjanst.hamta(h.adress)).rejects.toThrow(/databasen nere/);
  });

  it("⛔ en arkiverad, borttagen eller flyttad händelse visas inte, och en med trasig tid öppnar ingenting", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst);
    expect((await tjanst.hamta(h.adress)).ok).toBe(true);
    await kalla.update("handelser", "h1", { arkiverad: true });
    expect(await tjanst.hamta(h.adress)).toEqual({ ok: false, orsak: "handelse-saknas" });
    await kalla.update("handelser", "h1", { arkiverad: false });
    expect((await tjanst.hamta(h.adress)).ok).toBe(true);
    await kalla.update("handelser", "h1", { groupId: ANNAN_GRUPP });
    expect(await tjanst.hamta(h.adress)).toEqual({ ok: false, orsak: "handelse-saknas" });
    await kalla.update("handelser", "h1", { groupId: GRUPP, datum: "inte-ett-datum" });
    expect(await tjanst.hamta(h.adress)).toEqual({ ok: false, orsak: "handelse-saknas" });
    await kalla.update("handelser", "h1", { datum: "2026-12-26" });
    await kalla.remove("handelser", "h1");
    expect(await tjanst.hamta(h.adress)).toEqual({ ok: false, orsak: "handelse-saknas" });
  });

  it("en händelse uppdateras vid varje besök: en ändring syns direkt", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst);
    await kalla.update("handelser", "h1", { rubrik: "Nytt namn", plats: "Fårö" });
    expect((await tjanst.hamta(h.adress)).delning).toMatchObject({ titel: "Nytt namn", plats: "Fårö" });
  });

  it("handelseSida utan titel kastas, så att en felkonfigurerad app syns", async () => {
    const kalla = createMemorySource({ memberships: [medlemskap(MEDLEM, GRUPP, "medlem")], bibliotek: [], handelser: [handelse()], delningar: [] });
    for (const sida of [() => ({}), () => ({ titel: "  " }), () => null, () => ({ titel: "a", plats: 4 })]) {
      const tjanst = createDelningService({ kalla, lagring: { signeradAdress: async () => "x" }, samlingar: { delningar: "delningar", bibliotek: "bibliotek", handelser: "handelser" }, handelseSida: sida });
      const h = await delaHandelse(tjanst, { handelsedel: `d${Math.random().toString(36).slice(2, 8)}` });
      await expect(tjanst.hamta(h.adress)).rejects.toThrow(/handelseSida/);
    }
  });
});

describe("giltighet", () => {
  it("⛔ en händelse har ingen gräns som förval och gäller länge, men en fil får det aldrig", async () => {
    const { tjanst, kalla, tid } = bygg();
    const h = await delaHandelse(tjanst);
    expect(h.giltigTill).toBeNull();
    expect((await kalla.read("delningar", h.id)).giltigTill).toBeNull();
    tid(NU + 3650 * DYGN);
    expect((await tjanst.hamta(h.adress)).ok).toBe(true);
    for (const dagar of [undefined, null, 0, 2, 90]) await expect(delaFil(tjanst, { dagar }), String(dagar)).rejects.toThrow(/finns inte/);
    expect(await kalla.list("delningar")).toHaveLength(1);
  });

  it("en händelse kan ändå få 1, 7 eller 30 dagar, och går då ut på sekunden", async () => {
    const { tjanst, tid } = bygg();
    const h = await delaHandelse(tjanst, { dagar: 7 });
    expect(h.giltigTill).toBe(NU + 7 * DYGN);
    tid(h.giltigTill - 1);
    expect((await tjanst.hamta(h.adress)).ok).toBe(true);
    tid(h.giltigTill);
    expect(await tjanst.hamta(h.adress)).toEqual({ ok: false, orsak: "utgangen" });
    for (const dagar of [0, 2, 90, "7", Infinity]) await expect(delaHandelse(tjanst, { dagar, handelsedel: "x" }), String(dagar)).rejects.toThrow(/finns inte/);
  });

  it("⛔ en fillänk med giltigTill null (trasig rad) öppnas aldrig", async () => {
    const { tjanst, kalla } = bygg();
    const f = await delaFil(tjanst);
    await kalla.update("delningar", f.id, { giltigTill: null });
    expect(await tjanst.hamta(f.adress)).toEqual({ ok: false, orsak: "utgangen" });
  });

  it("en återkallad länk är stängd även utan kod, och en länk med ingen gräns kan alltid återkallas", async () => {
    const { tjanst } = bygg();
    const h = await delaHandelse(tjanst);
    await tjanst.aterkalla({ uid: MEDLEM, id: h.id });
    expect(await tjanst.hamta(h.adress)).toEqual({ ok: false, orsak: "stangd" });
  });
});

describe("rättighet och slag", () => {
  it("⛔ en rad med en annan rättighet än las, eller ett okänt slag, öppnas aldrig", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst);
    expect((await kalla.read("delningar", h.id)).rattighet).toBe("las");
    await kalla.update("delningar", h.id, { rattighet: "skriv" });
    expect(await tjanst.hamta(h.adress)).toEqual({ ok: false, orsak: "utgangen" });
    await kalla.update("delningar", h.id, { rattighet: "las", slag: "arende" });
    expect(await tjanst.hamta(h.adress)).toEqual({ ok: false, orsak: "utgangen" });
  });

  it("⛔ adressen och raden måste höra ihop: fel slag eller fel adress i raden öppnas inte", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst, { kod: "hemligt1" });
    await kalla.update("delningar", h.id, { slag: "post" });
    expect(await tjanst.hamta(h.adress, { kod: "hemligt1" })).toEqual({ ok: false, orsak: "utgangen" });
    await kalla.update("delningar", h.id, { slag: "handelse", adress: "travel/event/nagot-annat" });
    expect(await tjanst.hamta(h.adress, { kod: "hemligt1" })).toEqual({ ok: false, orsak: "utgangen" });
  });

  it("ett okänt uppslag svarar byte för byte som ett utgånget, för båda formerna", async () => {
    const { tjanst, tid } = bygg();
    const h = await delaHandelse(tjanst, { dagar: 1 });
    tid(h.giltigTill + 1);
    const utgangen = await tjanst.hamta(h.adress);
    for (const okant of ["travel/event/finns-inte-aaaaaaaa", "travel/lib/finns-inte-aaaaaaaa", nyttDelningstoken(), "skräp", "", null, undefined]) {
      expect(JSON.stringify(await tjanst.hamta(okant)), String(okant)).toBe(JSON.stringify(utgangen));
    }
    expect(utgangen).toEqual({ ok: false, orsak: "utgangen" });
  });

  it("uppslaget tål versaler och ett snedstreck sist", async () => {
    const { tjanst } = bygg();
    const h = await delaHandelse(tjanst);
    expect((await tjanst.hamta(h.adress.toUpperCase())).ok).toBe(true);
    expect((await tjanst.hamta(`${h.adress}/`)).ok).toBe(true);
  });

  it("orsakerna är de sju, och varje en har en text", () => {
    expect([...DELNINGSORSAKER]).toEqual(["utgangen", "stangd", "saknas", "handelse-saknas", "kod-kravs", "fel-kod", "for-manga"]);
  });
});

describe("gamla tokenlänkar lever kvar", () => {
  /** En rad byggd med den gamla funktionen, utan `slag`, `rattighet` och `adress`: så såg en delning ut i 0.119.0. */
  async function gammal({ extra = {}, kalla }) {
    const token = nyttDelningstoken();
    const rad = byggDelning({ token, postId: "p-medlem", groupId: GRUPP, skapadAv: { uid: MEDLEM, namn: "M" }, skapad: NU, dagar: 7, nedladdning: false });
    await kalla.create("delningar", { ...rad, ...extra });
    return { token, rad };
  }

  it("⛔ en rad utan slag, rättighet och adress öppnas som en fil, med oförändrat svar", async () => {
    const { tjanst, kalla } = bygg();
    const { token, rad } = await gammal({ kalla });
    expect(rad).not.toHaveProperty("slag");
    expect(rad).not.toHaveProperty("adress");
    const svar = await tjanst.hamta(token);
    expect(svar.ok).toBe(true);
    expect(svar.delning).toMatchObject({ rubrik: "Rubrik p-medlem", typ: "pdf", nedladdning: false });
    expect(Object.keys(svar.delning).sort()).toEqual(["langd", "mime", "nedladdning", "peaks", "rubrik", "storlek", "typ", "url", "visaUrl"]);
  });

  it("en gammal länk går ut, stängs och ändrar nedladdning som förut, och syns i listan utan adress", async () => {
    const { tjanst, kalla, tid } = bygg();
    const { token, rad } = await gammal({ kalla });
    expect((await tjanst.lista({ uid: MEDLEM, groupId: GRUPP }))[0]).toMatchObject({ id: rad.id, slag: "post", postId: "p-medlem", sokvag: null, harKod: false, rattighet: "las" });
    expect((await tjanst.andraNedladdning({ uid: MEDLEM, id: rad.id, nedladdning: true })).nedladdning).toBe(true);
    expect((await tjanst.hamta(token)).delning.nedladdning).toBe(true);
    await tjanst.aterkalla({ uid: MEDLEM, id: rad.id });
    expect(await tjanst.hamta(token)).toEqual({ ok: false, orsak: "stangd" });
    const andra = await gammal({ kalla });
    tid(andra.rad.giltigTill);
    expect(await tjanst.hamta(andra.token)).toEqual({ ok: false, orsak: "utgangen" });
  });

  it("⛔ ett token öppnar aldrig en händelse: tokenformen hör bara till en fil", async () => {
    const { tjanst, kalla } = bygg();
    const token = nyttDelningstoken();
    const rad = byggAdressdelning({ slag: "handelse", adress: "travel/event/resa-aaaaaaaa", handelseId: "h1", groupId: GRUPP, skapadAv: { uid: MEDLEM }, skapad: NU, dagar: null });
    await kalla.create("delningar", { ...rad, id: createHash("sha256").update(token).digest("hex") });
    expect(await tjanst.hamta(token)).toEqual({ ok: false, orsak: "utgangen" });
  });

  it("skapa ger inget token längre och kräver en adress", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapa({ uid: MEDLEM, postId: "p-medlem", groupId: GRUPP, dagar: 7 })).rejects.toMatchObject({ kod: "ogiltig-adress" });
  });
});

describe("händelse: vem får dela, stänga och lista", () => {
  it("⛔ en aktiv medlem delar, och gruppen läses ur händelsen", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst, { groupId: "påhittad-grupp" });
    expect((await kalla.read("delningar", h.id)).groupId).toBe(GRUPP);
  });

  it("⛔ en utomstående, en annan grupps ägare, en avslutad medlem och en agent delar inte", async () => {
    const { tjanst, kalla } = bygg({ extraMedlemskap: [medlemskap("uid-gammal", GRUPP, "admin", { status: "avslutad" }), medlemskap("uid-agent", GRUPP, "medlem", { typ: "agent" })] });
    for (const uid of [UTOMSTAENDE, "ingen", "uid-gammal", "uid-agent"]) {
      await expect(delaHandelse(tjanst, { uid }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
    }
    expect(await kalla.list("delningar")).toHaveLength(0);
  });

  it("⛔ appens farDelaHandelse prövas EFTER medlemskapet: en icke-medlem når den aldrig, och en medlem som den nekar får nej", async () => {
    const farDelaHandelse = vi.fn(async ({ uid }) => uid === REDAKTOR || uid === AGARE);
    const { tjanst, kalla } = bygg({ farDelaHandelse });
    await expect(delaHandelse(tjanst, { uid: UTOMSTAENDE })).rejects.toMatchObject({ kod: "ej-behorig" });
    expect(farDelaHandelse).not.toHaveBeenCalled();
    await expect(delaHandelse(tjanst, { uid: MEDLEM })).rejects.toMatchObject({ kod: "ej-behorig" });
    expect(farDelaHandelse).toHaveBeenCalledTimes(1);
    expect(farDelaHandelse).toHaveBeenCalledWith(expect.objectContaining({ uid: MEDLEM, groupId: GRUPP, medlemskap: expect.objectContaining({ roll: "medlem" }), handelse: expect.objectContaining({ id: "h1" }) }));
    expect(await kalla.list("delningar")).toHaveLength(0);
    expect((await delaHandelse(tjanst, { uid: REDAKTOR })).adress).toMatch(/^travel\/event\//);
  });

  it("farDelaHandelse måste svara exakt true: ett annat sant värde släpper inte in", async () => {
    const { tjanst } = bygg({ farDelaHandelse: async () => "ja" });
    await expect(delaHandelse(tjanst)).rejects.toMatchObject({ kod: "ej-behorig" });
  });

  it("en arkiverad eller saknad händelse delas inte", async () => {
    const { tjanst, kalla } = bygg();
    await expect(delaHandelse(tjanst, { handelseId: "finns-inte" })).rejects.toMatchObject({ kod: "finns-inte" });
    await kalla.update("handelser", "h1", { arkiverad: true });
    await expect(delaHandelse(tjanst)).rejects.toMatchObject({ kod: "finns-inte" });
    expect(await kalla.list("delningar")).toHaveLength(0);
  });

  it("precis en av postId och handelseId, och händelser kräver samlingen", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.skapa({ uid: MEDLEM, postId: "p-medlem", handelseId: "h1", groupId: GRUPP, dagar: 7, gruppdel: "a", fildel: "b" })).rejects.toThrow(/precis en av/);
    await expect(tjanst.skapa({ uid: MEDLEM, gruppdel: "a" })).rejects.toThrow(/precis en av/);
    const utan = bygg({ utanHandelser: true });
    await expect(delaHandelse(utan.tjanst)).rejects.toThrow(/samlingar\.handelser/);
    expect(await utan.tjanst.hamta("travel/event/resa-aaaaaaaa")).toEqual({ ok: false, orsak: "utgangen" });
  });

  it("⛔ den som delade, admin och ägare stänger; en annan medlem och en utomstående gör det inte", async () => {
    for (const vem of [MEDLEM, ADMIN, AGARE]) {
      const { tjanst } = bygg();
      const h = await delaHandelse(tjanst);
      await tjanst.aterkalla({ uid: vem, id: h.id });
      expect((await tjanst.hamta(h.adress)).ok, vem).toBe(false);
    }
    const { tjanst } = bygg();
    const h = await delaHandelse(tjanst);
    await expect(tjanst.aterkalla({ uid: ANNAN, id: h.id })).rejects.toThrow(/inte den som delade/);
    await expect(tjanst.aterkalla({ uid: UTOMSTAENDE, id: h.id })).rejects.toThrow(/inte den som delade/);
    expect((await tjanst.hamta(h.adress)).ok).toBe(true);
  });

  it("⛔ den som appens regel släpper in på händelsen stänger också, men bara medan hen är aktiv medlem", async () => {
    const farDelaHandelse = async ({ uid }) => uid === REDAKTOR || uid === MEDLEM;
    const { tjanst } = bygg({ farDelaHandelse });
    const h = await delaHandelse(tjanst);
    // ANNAN är medlem men appen släpper inte in hen: nej. REDAKTOR släpps in: ja, fast hen inte delade.
    await expect(tjanst.aterkalla({ uid: ANNAN, id: h.id })).rejects.toThrow(/inte den som delade/);
    await tjanst.aterkalla({ uid: REDAKTOR, id: h.id });
    expect((await tjanst.hamta(h.adress)).ok).toBe(false);

    const ny = bygg({ farDelaHandelse });
    const h2 = await delaHandelse(ny.tjanst);
    await ny.kalla.update("memberships", medlemskapsId(REDAKTOR, GRUPP), { status: "avslutad" });
    await expect(ny.tjanst.aterkalla({ uid: REDAKTOR, id: h2.id })).rejects.toThrow(/inte den som delade/);
    expect((await ny.tjanst.hamta(h2.adress)).ok).toBe(true);
  });

  it("den som delade stänger även efter att ha lämnat gruppen", async () => {
    const { tjanst, kalla } = bygg();
    const h = await delaHandelse(tjanst);
    await kalla.update("memberships", medlemskapsId(MEDLEM, GRUPP), { status: "avslutad" });
    await tjanst.aterkalla({ uid: MEDLEM, id: h.id });
    expect((await tjanst.hamta(h.adress)).ok).toBe(false);
  });

  it("en händelselänk har ingen nedladdning att ändra", async () => {
    const { tjanst } = bygg();
    const h = await delaHandelse(tjanst);
    await expect(tjanst.andraNedladdning({ uid: MEDLEM, id: h.id, nedladdning: true })).rejects.toThrow(/ingen nedladdning/);
  });

  it("⛔ listan för en händelse: egna länkar för en medlem, alla för admin och redaktör, bara den händelsen, och aldrig filänkar", async () => {
    const farDelaHandelse = async ({ uid }) => uid === REDAKTOR || uid === AGARE || uid === ADMIN || uid === MEDLEM || uid === ANNAN;
    const { tjanst, kalla } = bygg({ farDelaHandelse, handelser: [handelse(), handelse({ id: "h2", rubrik: "Annan" })] });
    const min = await delaHandelse(tjanst);
    const annans = await delaHandelse(tjanst, { uid: ANNAN, handelsedel: "annans", kod: "hemligt1", dagar: 30 });
    await tjanst.skapa({ uid: MEDLEM, handelseId: "h2", gruppdel: "travel", handelsedel: "andra-handelsen" });
    await delaFil(tjanst);
    const stangd = await delaHandelse(tjanst, { handelsedel: "stangd" });
    await tjanst.aterkalla({ uid: MEDLEM, id: stangd.id });

    const lista = await tjanst.lista({ uid: MEDLEM, groupId: GRUPP, handelseId: "h1" });
    // MEDLEM släpps in av appens regel och ser alla länkar till händelsen.
    expect(lista.map((r) => r.id).sort()).toEqual([min.id, annans.id].sort());
    for (const rad of lista) {
      expect(rad.slag).toBe("handelse");
      expect(rad.handelseId).toBe("h1");
      expect(rad.rattighet).toBe("las");
      expect(rad.sokvag).toBe(`/g/${rad.id === min.id ? min.adress : annans.adress}`);
    }
    expect(lista.find((r) => r.id === annans.id)).toMatchObject({ harKod: true, giltigTill: NU + 30 * DYGN });
    expect(lista.find((r) => r.id === min.id)).toMatchObject({ harKod: false, giltigTill: null });
    // Filänkarna i platsen visar inga händelselänkar.
    const filer = await tjanst.lista({ uid: ADMIN, groupId: GRUPP });
    expect(filer.every((r) => r.slag === "post")).toBe(true);
    expect(filer).toHaveLength(1);
    expect(JSON.stringify(lista)).not.toContain("hash");
    expect(JSON.stringify(lista)).not.toContain("salt");
    void kalla;
  });

  it("⛔ utan appens regel ser en vanlig medlem bara sina egna, och en utomstående ingenting", async () => {
    const { tjanst } = bygg();
    const min = await delaHandelse(tjanst);
    await delaHandelse(tjanst, { uid: ANNAN, handelsedel: "annans" });
    expect((await tjanst.lista({ uid: MEDLEM, groupId: GRUPP, handelseId: "h1" })).map((r) => r.id)).toEqual([min.id]);
    expect(await tjanst.lista({ uid: ADMIN, groupId: GRUPP, handelseId: "h1" })).toHaveLength(2);
    await expect(tjanst.lista({ uid: UTOMSTAENDE, groupId: GRUPP, handelseId: "h1" })).rejects.toThrow(/inte aktiv medlem/);
    // Uppger anroparen en annan grupp än händelsens finns inga rader att se.
    expect(await tjanst.lista({ uid: UTOMSTAENDE, groupId: ANNAN_GRUPP, handelseId: "h1" })).toEqual([]);
  });
});

describe("tjänsten byggs inte av halva beståndsdelar (händelser)", () => {
  const kalla = createMemorySource();
  const lagring = { signeradAdress: async () => "https://x.test" };
  const samlingar = { delningar: "d", bibliotek: "b", handelser: "h" };
  it("handelser kräver handelseSida, och handelseSida och farDelaHandelse kräver handelser", () => {
    expect(() => createDelningService({ kalla, lagring, samlingar })).toThrow(/handelseSida krävs/);
    expect(() => createDelningService({ kalla, lagring, samlingar: { delningar: "d", bibliotek: "b" }, handelseSida: () => ({ titel: "x" }) })).toThrow(/kräver samlingar\.handelser/);
    expect(() => createDelningService({ kalla, lagring, samlingar: { delningar: "d", bibliotek: "b" }, farDelaHandelse: async () => true })).toThrow(/kräver samlingar\.handelser/);
    expect(() => createDelningService({ kalla, lagring, samlingar: { ...samlingar, handelser: "a/b" }, handelseSida: () => ({ titel: "x" }) })).toThrow(/samlingar\.handelser/);
    expect(() => createDelningService({ kalla, lagring, samlingar, handelseSida: () => ({ titel: "x" }), farDelaHandelse: "ja" })).toThrow(/farDelaHandelse måste vara en funktion/);
  });
});
