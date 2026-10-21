import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { medlemskapsId } from "../lib/grupp.js";
import { mittBibliotek } from "../lib/bibliotek.js";
import { DELNINGSDAGAR, DELNINGSFEL, DELNINGSSVARSFALT, SIGNERAD_SEKUNDER, TOKENFORM, delningsTyp, delningsfel } from "../lib/delning.js";
import { delningsregelfragment } from "../lib/regler.js";
import { byggDelning, createDelningService, delningsDisposition, delningsId, nyttDelningstoken } from "../node/delning.js";

/**
 * Publik delning av en biblioteksfil (0.119.0, lifehub.app#356).
 *
 * ⛔ UTAN NÄTVERK OCH UTAN FIREBASE: datakällan och lagringen skickas in, så minneskällan och en låtsaslagring räcker. Samma mönster som
 * `inbjudan.test.js`. Reglerna provas i emulatorn (`rules/__tests__/delningar.test.mjs`).
 *
 * ⛔ VARJE PROV HAR BEVISATS I BÅDA RIKTNINGARNA (arbetsreglerna, punkt 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const NU = 1_800_000_000_000;
const DYGN = 24 * 60 * 60 * 1000;
const GRUPP = "kallan";
const ANNAN_GRUPP = "grannen";
const AGARE = "uid-agare";
const ADMIN = "uid-admin";
const MEDLEM = "uid-medlem";
const ANNAN = "uid-annan";
const UTOMSTAENDE = "uid-utanfor";

const medlemskap = (uid, groupId, roll, extra = {}) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn: `Namn ${uid}`, ...extra });
const fil = (id, groupId, av, extra = {}) => ({
  id,
  groupId,
  typ: "fil",
  rubrik: `Rubrik ${id}`,
  skapadAv: { uid: av, namn: "Skaparen", typ: "manniska", kalla: "bibliotek" },
  skapad: NU - 1000,
  andrad: NU - 1000,
  fil: { sokvag: `grupper/${groupId}/bibliotek/${id}/${id}.mp3`, namn: `${id}.mp3`, mime: "audio/mpeg", byte: 4_000_000, klar: true },
  taggar: ["privat-tagg"],
  utskrift: "Detta är en hemlig utskrift",
  ...extra,
});

function bygg({ poster = [], extraMedlemskap = [], omslut = (/** @type {any} */ k) => k } = {}) {
  const grundkalla = createMemorySource({
    memberships: [
      medlemskap(AGARE, GRUPP, "agare"),
      medlemskap(ADMIN, GRUPP, "admin"),
      medlemskap(MEDLEM, GRUPP, "medlem"),
      medlemskap(ANNAN, GRUPP, "medlem"),
      medlemskap(UTOMSTAENDE, ANNAN_GRUPP, "agare"),
      ...extraMedlemskap,
    ],
    bibliotek: [
      fil("p-medlem", GRUPP, MEDLEM),
      fil("p-annan", GRUPP, ANNAN),
      fil("p-grannen", ANNAN_GRUPP, UTOMSTAENDE),
      fil("p-mitt", mittBibliotek(MEDLEM), MEDLEM),
      ...poster,
    ],
    delningar: [],
  });
  const kalla = omslut(grundkalla);
  const signeradAdress = vi.fn(async ({ sokvag, sekunder, disposition }) => `https://lagring.test/${sokvag}?s=${sekunder}&d=${encodeURIComponent(disposition)}`);
  let nu = NU;
  const tjanst = createDelningService({
    kalla,
    lagring: { signeradAdress },
    samlingar: { delningar: "delningar", bibliotek: "bibliotek" },
    klocka: () => nu,
  });
  return { kalla: grundkalla, tjanst, signeradAdress, tid: (/** @type {number} */ ny) => { nu = ny; } };
}

const GRUPPDEL = "kallan-grupp";
const dela = (tjanst, extra = {}) => tjanst.skapa({ uid: MEDLEM, postId: "p-medlem", groupId: GRUPP, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett", ...extra });

describe("byggDelning och token", () => {
  it("id är SHA-256 (hex) av tokenet, och tokenet finns inte i raden", () => {
    const token = nyttDelningstoken();
    expect(token).toMatch(TOKENFORM);
    const rad = byggDelning({ token, postId: "p", groupId: GRUPP, skapadAv: { uid: MEDLEM, namn: "M" }, skapad: NU, dagar: 7, nedladdning: false });
    expect(rad.id).toBe(createHash("sha256").update(token).digest("hex"));
    expect(rad.id).toBe(delningsId(token));
    expect(JSON.stringify(rad)).not.toContain(token);
    expect(rad).toMatchObject({ postId: "p", groupId: GRUPP, skapadAv: { uid: MEDLEM, namn: "M" }, skapad: NU, giltigTill: NU + 7 * DYGN, aterkallad: null, nedladdning: false });
  });

  it("tokenet är 32 slumpbyte i base64url och aldrig samma två gånger", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => nyttDelningstoken()));
    expect(tokens.size).toBe(50);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(t, "base64url")).toHaveLength(32);
    }
  });

  it("utgångstiden för en fil är 1, 7 eller 30 dagar, och 'ingen utgång' finns inte", () => {
    expect([...DELNINGSDAGAR]).toEqual([1, 7, 30]);
    const bas = { token: nyttDelningstoken(), postId: "p", groupId: GRUPP, skapadAv: { uid: "u" }, skapad: NU, nedladdning: false };
    for (const dagar of [0, 2, 365, null, undefined, Infinity, "7"]) {
      expect(() => byggDelning({ ...bas, dagar }), String(dagar)).toThrow(/finns inte/);
    }
    expect(byggDelning({ ...bas, dagar: 30 }).giltigTill).toBe(NU + 30 * DYGN);
  });

  it("nedladdning är sant eller falskt, aldrig en sträng", () => {
    const bas = { token: nyttDelningstoken(), postId: "p", groupId: GRUPP, skapadAv: { uid: "u" }, skapad: NU, dagar: 7 };
    expect(() => byggDelning({ ...bas, nedladdning: "false" })).toThrow(/sant eller falskt/);
    expect(() => byggDelning({ ...bas, nedladdning: undefined })).toThrow(/sant eller falskt/);
  });

  it("ett felskrivet token blir inget id", () => {
    expect(() => delningsId("kort")).toThrow();
    expect(() => delningsId(`${"a".repeat(42)}/`)).toThrow();
  });
});

describe("skapa: vem får dela", () => {
  it("en medlem delar sin egen post, och id:t är hashen av adressen", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await dela(tjanst);
    expect(svar.adress).toMatch(/^kallan-grupp\/lib\/biljett-[a-z0-9]{8}$/);
    expect(svar.sokvag).toBe(`/g/${svar.adress}`);
    expect(svar.id).toBe(createHash("sha256").update(svar.adress).digest("hex"));
    expect(svar.giltigTill).toBe(NU + 7 * DYGN);
    expect(svar).toMatchObject({ harKod: false, rattighet: "las", nedladdning: false });
    expect(svar).not.toHaveProperty("token");
    const rader = await kalla.list("delningar");
    expect(rader).toHaveLength(1);
    expect(rader[0]).toMatchObject({
      id: svar.id,
      slag: "post",
      rattighet: "las",
      adress: svar.adress,
      postId: "p-medlem",
      groupId: GRUPP,
      skapadAv: { uid: MEDLEM, namn: `Namn ${MEDLEM}` },
      aterkallad: null,
      nedladdning: false,
      felAntal: 0,
      felFonster: 0,
    });
    expect(rader[0]).not.toHaveProperty("kod");
  });

  it("⛔ en medlem delar INTE någon annans post", async () => {
    const { tjanst, kalla } = bygg();
    await expect(tjanst.skapa({ uid: MEDLEM, postId: "p-annan", groupId: GRUPP, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" })).rejects.toThrow(/har inte skrivit posten/);
    expect(await kalla.list("delningar")).toHaveLength(0);
  });

  it("⛔ admin och ägare delar andras poster", async () => {
    const { tjanst } = bygg();
    expect((await tjanst.skapa({ uid: ADMIN, postId: "p-medlem", groupId: GRUPP, dagar: 1, gruppdel: GRUPPDEL, fildel: "biljett" })).adress).toMatch(/^kallan-grupp\/lib\/biljett-[a-z0-9]{8}$/);
    expect((await tjanst.skapa({ uid: AGARE, postId: "p-annan", groupId: GRUPP, dagar: 30, gruppdel: GRUPPDEL, fildel: "biljett" })).adress).toMatch(/^kallan-grupp\/lib\/biljett-[a-z0-9]{8}$/);
  });

  it("⛔ annan grupps post nekas: en admin i grupp A delar inte en post ur grupp B", async () => {
    const { tjanst, kalla } = bygg();
    // Anroparen anger sin egen grupp men postens id ur en annan (IDOR). Behörigheten prövas mot grupp A, och posten ligger i B.
    await expect(tjanst.skapa({ uid: AGARE, postId: "p-grannen", groupId: GRUPP, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" })).rejects.toThrow(/finns inte i platsen/);
    // Och anger hen grupp B är hen inte medlem där.
    await expect(tjanst.skapa({ uid: AGARE, postId: "p-grannen", groupId: ANNAN_GRUPP, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" })).rejects.toThrow(/inte aktiv medlem/);
    expect(await kalla.list("delningar")).toHaveLength(0);
  });

  it("en utomstående och en avslutad medlem delar ingenting", async () => {
    const { tjanst } = bygg({ extraMedlemskap: [medlemskap("uid-gammal", GRUPP, "admin", { status: "avslutad" })] });
    await expect(tjanst.skapa({ uid: UTOMSTAENDE, postId: "p-medlem", groupId: GRUPP, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" })).rejects.toThrow(/inte aktiv medlem/);
    await expect(tjanst.skapa({ uid: "uid-gammal", postId: "p-medlem", groupId: GRUPP, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" })).rejects.toThrow(/inte aktiv medlem/);
  });

  it("en post som inte finns och en fil som inte blev klar går inte att dela (en anteckning gör det sedan 0.133.0, se delning-alla-typer.test.js)", async () => {
    const { tjanst } = bygg({
      poster: [
        fil("halv", GRUPP, MEDLEM, { fil: { sokvag: `grupper/${GRUPP}/bibliotek/halv/h.mp3`, namn: "h.mp3", mime: "audio/mpeg", byte: 1, klar: false } }),
      ],
    });
    for (const postId of ["finns-inte", "halv"]) {
      await expect(tjanst.skapa({ uid: MEDLEM, postId, groupId: GRUPP, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" }), postId).rejects.toThrow(/finns inte i platsen/);
    }
  });

  it("Mitt bibliotek: bara ägaren delar, aldrig en admin i någon grupp", async () => {
    const { tjanst } = bygg();
    const mitt = mittBibliotek(MEDLEM);
    expect((await tjanst.skapa({ uid: MEDLEM, postId: "p-mitt", groupId: mitt, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" })).adress).toMatch(/^kallan-grupp\/lib\/biljett-[a-z0-9]{8}$/);
    await expect(tjanst.skapa({ uid: AGARE, postId: "p-mitt", groupId: mitt, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" })).rejects.toThrow(/äger inte biblioteket/);
    await expect(tjanst.skapa({ uid: ADMIN, postId: "p-mitt", groupId: mitt, dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" })).rejects.toThrow(/äger inte biblioteket/);
  });

  it("nedladdning är AV som förval, och en sträng avvisas", async () => {
    const { tjanst, kalla } = bygg();
    const svar = await dela(tjanst);
    expect(svar.nedladdning).toBe(false);
    expect((await kalla.read("delningar", svar.id)).nedladdning).toBe(false);
    await expect(dela(tjanst, { nedladdning: "ja" })).rejects.toThrow(/sant eller falskt/);
  });

  it("en utgångstid utanför 1, 7 och 30 dagar nekas, och inget skrivs", async () => {
    const { tjanst, kalla } = bygg();
    for (const dagar of [0, 2, 90, undefined]) await expect(dela(tjanst, { dagar }), String(dagar)).rejects.toThrow(/finns inte/);
    expect(await kalla.list("delningar")).toHaveLength(0);
  });
});

describe("hamta: svaret", () => {
  it("⛔ svaret har BARA de tillåtna fälten och läcker ingenting om posten", async () => {
    const { tjanst } = bygg({ poster: [fil("p-ljud", GRUPP, MEDLEM, { durationMs: 240000, peaks: "A".repeat(48) })] });
    const { adress: ref } = await dela(tjanst, { postId: "p-ljud" });
    const svar = await tjanst.hamta(ref);
    expect(svar.ok).toBe(true);
    expect(Object.keys(svar.delning).sort()).toEqual([...DELNINGSSVARSFALT].sort());
    expect(svar.delning).toMatchObject({ rubrik: "Rubrik p-ljud", typ: "ljud", mime: "audio/mpeg", storlek: 4_000_000, langd: 240000, peaks: "A".repeat(48), nedladdning: false });
    const text = JSON.stringify(svar);
    for (const forbjudet of [`grupper/${GRUPP}`, "bibliotek/p-ljud", GRUPP, "privat-tagg", "hemlig utskrift", "taggar", "utskrift", "sokvag", "groupId", MEDLEM, "Namn", "@"]) {
      // Sökvägen får förekomma i den SIGNERADE adressen (det är dit lagringen pekar), men bara där.
      const utanAdress = text.replace(svar.delning.url, "");
      expect(utanAdress, forbjudet).not.toContain(forbjudet);
    }
  });

  it("den signerade adressen gäller 15 minuter", async () => {
    const { tjanst, signeradAdress } = bygg();
    const { adress: ref } = await dela(tjanst);
    await tjanst.hamta(ref);
    expect(SIGNERAD_SEKUNDER).toBe(900);
    expect(signeradAdress).toHaveBeenCalledWith(expect.objectContaining({ sokvag: `grupper/${GRUPP}/bibliotek/p-medlem/p-medlem.mp3`, sekunder: 900 }));
  });

  it("⛔ nedladdning AV ger Content-Disposition inline, PÅ ger attachment", async () => {
    const { tjanst, signeradAdress } = bygg();
    const av = await dela(tjanst);
    const svarAv = await tjanst.hamta(av.adress);
    expect(signeradAdress).toHaveBeenLastCalledWith(expect.objectContaining({ disposition: "inline" }));
    expect(decodeURIComponent(svarAv.delning.url.split("&d=")[1])).toBe("inline");
    expect(svarAv.delning.nedladdning).toBe(false);

    const pa = await dela(tjanst, { nedladdning: true });
    const svarPa = await tjanst.hamta(pa.adress);
    const disposition = signeradAdress.mock.lastCall[0].disposition;
    expect(disposition).toMatch(/^attachment; filename="p-medlem\.mp3"; filename\*=UTF-8''p-medlem\.mp3$/);
    expect(svarPa.delning.nedladdning).toBe(true);
  });

  it("ett filnamn kan inte skriva egna headrar", () => {
    const d = delningsDisposition('a"\r\nSet-Cookie: x=1.pdf', true);
    expect(d).not.toMatch(/[\r\n]/);
    expect(d.startsWith('attachment; filename="')).toBe(true);
    expect(d.split("\n")).toHaveLength(1);
    expect(d).toContain("filename*=UTF-8''");
    expect(delningsDisposition("x.pdf", false)).toBe("inline");
  });

  it("en PDF med nedladdning på får också en inbäddningsbar adress, annars null", async () => {
    const pdf = fil("p-pdf", GRUPP, MEDLEM, { fil: { sokvag: `grupper/${GRUPP}/bibliotek/p-pdf/a.pdf`, namn: "a.pdf", mime: "application/pdf", byte: 10, klar: true } });
    const { tjanst } = bygg({ poster: [pdf] });
    const pa = await tjanst.hamta((await dela(tjanst, { postId: "p-pdf", nedladdning: true })).adress);
    expect(pa.delning.typ).toBe("pdf");
    expect(decodeURIComponent(pa.delning.url.split("&d=")[1])).toMatch(/^attachment/);
    expect(decodeURIComponent(pa.delning.visaUrl.split("&d=")[1])).toBe("inline");
    const av = await tjanst.hamta((await dela(tjanst, { postId: "p-pdf" })).adress);
    expect(av.delning.visaUrl).toBeNull();
  });

  it("⛔ en återkallad delning nekas, med orsaken 'stangd'", async () => {
    const { tjanst } = bygg();
    const { adress: ref, id } = await dela(tjanst);
    expect((await tjanst.hamta(ref)).ok).toBe(true);
    await tjanst.aterkalla({ uid: MEDLEM, id });
    expect(await tjanst.hamta(ref)).toEqual({ ok: false, orsak: "stangd" });
  });

  it("⛔ en utgången delning nekas, på sekunden", async () => {
    const { tjanst, tid } = bygg();
    const { adress: ref, giltigTill } = await dela(tjanst, { dagar: 1 });
    tid(giltigTill - 1);
    expect((await tjanst.hamta(ref)).ok).toBe(true);
    tid(giltigTill);
    expect(await tjanst.hamta(ref)).toEqual({ ok: false, orsak: "utgangen" });
    tid(giltigTill + 30 * DYGN);
    expect(await tjanst.hamta(ref)).toEqual({ ok: false, orsak: "utgangen" });
  });

  it("⛔ ett okänt token svarar EXAKT som ett utgånget, och skräp kastar inte", async () => {
    const { tjanst, tid } = bygg();
    const { adress: ref, giltigTill } = await dela(tjanst);
    tid(giltigTill + 1);
    const utgangen = await tjanst.hamta(ref);
    const okant = await tjanst.hamta(nyttDelningstoken());
    expect(okant).toEqual(utgangen);
    expect(JSON.stringify(okant)).toBe(JSON.stringify(utgangen));
    for (const skrap of ["", "x", null, undefined, 42, {}, "../../etc/passwd", `${"a".repeat(42)}!`, "a".repeat(44)]) {
      expect(await tjanst.hamta(/** @type {any} */ (skrap)), String(skrap)).toEqual(utgangen);
    }
  });

  it("⛔ en post som bytt grupp, en raderad post och en fil som inte är klar nekas med 'saknas'", async () => {
    const { tjanst, kalla } = bygg();
    const { adress: ref } = await dela(tjanst);
    // Flyttad till Mitt bibliotek: delningen gällde gruppen, inte dit.
    await kalla.update("bibliotek", "p-medlem", { groupId: mittBibliotek(MEDLEM) });
    expect(await tjanst.hamta(ref)).toEqual({ ok: false, orsak: "saknas" });
    await kalla.update("bibliotek", "p-medlem", { groupId: GRUPP, fil: { sokvag: "x/y/z/w/v", namn: "v.mp3", mime: "audio/mpeg", byte: 1, klar: false } });
    expect(await tjanst.hamta(ref)).toEqual({ ok: false, orsak: "saknas" });
    await kalla.remove("bibliotek", "p-medlem");
    expect(await tjanst.hamta(ref)).toEqual({ ok: false, orsak: "saknas" });
  });

  it("en rad med trasig utgångstid öppnar aldrig länken", async () => {
    const { tjanst, kalla } = bygg();
    const { adress: ref, id } = await dela(tjanst);
    await kalla.update("delningar", id, { giltigTill: "aldrig" });
    expect(await tjanst.hamta(ref)).toEqual({ ok: false, orsak: "utgangen" });
  });
});

describe("stänga och ändra", () => {
  it("den som delade, admin och ägare stänger. En annan medlem och en utomstående gör det inte", async () => {
    for (const vem of [MEDLEM, ADMIN, AGARE]) {
      const { tjanst } = bygg();
      const { adress: ref, id } = await dela(tjanst);
      await tjanst.aterkalla({ uid: vem, id });
      expect((await tjanst.hamta(ref)).ok, vem).toBe(false);
    }
    const { tjanst } = bygg();
    const { adress: ref, id } = await dela(tjanst);
    await expect(tjanst.aterkalla({ uid: ANNAN, id })).rejects.toThrow(/inte den som delade/);
    await expect(tjanst.aterkalla({ uid: UTOMSTAENDE, id })).rejects.toThrow(/inte den som delade/);
    expect((await tjanst.hamta(ref)).ok).toBe(true);
  });

  it("den som delade stänger även efter att ha lämnat gruppen", async () => {
    const { tjanst, kalla } = bygg();
    const { adress: ref, id } = await dela(tjanst);
    await kalla.update("memberships", medlemskapsId(MEDLEM, GRUPP), { status: "avslutad" });
    await tjanst.aterkalla({ uid: MEDLEM, id });
    expect((await tjanst.hamta(ref)).ok).toBe(false);
  });

  it("⛔ den som delade och sedan lämnat gruppen nekas att ändra nedladdning men får stänga länken", async () => {
    const { tjanst, kalla } = bygg();
    const { adress: ref, id } = await dela(tjanst);
    await kalla.update("memberships", medlemskapsId(MEDLEM, GRUPP), { status: "avslutad" });
    await expect(tjanst.andraNedladdning({ uid: MEDLEM, id, nedladdning: true })).rejects.toThrow(/inte aktiv medlem som delade/);
    expect((await kalla.read("delningar", id)).nedladdning).toBe(false);
    expect((await tjanst.hamta(ref)).delning.nedladdning).toBe(false);
    // En admin i gruppen kan fortfarande ändra, och den borttagne kan fortfarande stänga.
    await tjanst.andraNedladdning({ uid: ADMIN, id, nedladdning: true });
    await tjanst.aterkalla({ uid: MEDLEM, id });
    expect((await tjanst.hamta(ref)).ok).toBe(false);
  });

  it("i Mitt bibliotek ändrar ägaren nedladdning, och ingen annan", async () => {
    const { tjanst } = bygg();
    const { id } = await tjanst.skapa({ uid: MEDLEM, postId: "p-mitt", groupId: mittBibliotek(MEDLEM), dagar: 7, gruppdel: GRUPPDEL, fildel: "biljett" });
    expect((await tjanst.andraNedladdning({ uid: MEDLEM, id, nedladdning: true })).nedladdning).toBe(true);
    await expect(tjanst.andraNedladdning({ uid: AGARE, id, nedladdning: false })).rejects.toThrow(/inte aktiv medlem som delade/);
  });

  it("att stänga en stängd länk är inget fel och ändrar inte tiden", async () => {
    const { tjanst, tid } = bygg();
    const { id } = await dela(tjanst);
    const forsta = await tjanst.aterkalla({ uid: MEDLEM, id });
    tid(NU + 5000);
    expect(await tjanst.aterkalla({ uid: MEDLEM, id })).toEqual(forsta);
  });

  it("⛔ ändra nedladdning: den som delade, admin och ägare, inte en annan medlem", async () => {
    const { tjanst, kalla } = bygg();
    const { adress: ref, id } = await dela(tjanst);
    expect((await tjanst.andraNedladdning({ uid: MEDLEM, id, nedladdning: true })).nedladdning).toBe(true);
    expect((await tjanst.hamta(ref)).delning.nedladdning).toBe(true);
    await tjanst.andraNedladdning({ uid: ADMIN, id, nedladdning: false });
    expect((await kalla.read("delningar", id)).nedladdning).toBe(false);
    await tjanst.andraNedladdning({ uid: AGARE, id, nedladdning: true });
    await expect(tjanst.andraNedladdning({ uid: ANNAN, id, nedladdning: false })).rejects.toThrow(/inte aktiv medlem som delade/);
    await expect(tjanst.andraNedladdning({ uid: MEDLEM, id, nedladdning: "nej" })).rejects.toThrow(/sant eller falskt/);
  });

  it("⛔ en stängd länk öppnas inte igen av en ändring", async () => {
    const { tjanst, kalla } = bygg();
    const { id } = await dela(tjanst);
    await tjanst.aterkalla({ uid: MEDLEM, id });
    await expect(tjanst.andraNedladdning({ uid: MEDLEM, id, nedladdning: true })).rejects.toThrow(/stängd/);
    expect((await kalla.read("delningar", id)).nedladdning).toBe(false);
    expect(typeof (await kalla.read("delningar", id)).aterkallad).toBe("number");
  });

  it("⛔ en ändring som korsar en stängning lyckas inte, hur nära i tiden de ligger", async () => {
    let stangt = false;
    const { tjanst, kalla } = bygg({
      // Läsningen i andraNedladdning ser en länk som lever. Innan skrivningen hinner en annan stänga den.
      omslut: (k) => ({
        ...k,
        read: async (/** @type {string} */ samling, /** @type {string} */ id) => {
          const rad = await k.read(samling, id);
          if (samling === "delningar" && rad && !stangt) {
            stangt = true;
            await k.update("delningar", id, { aterkallad: NU + 1 });
          }
          return rad;
        },
      }),
    });
    const { id } = await dela(tjanst);
    stangt = false;
    await expect(tjanst.andraNedladdning({ uid: MEDLEM, id, nedladdning: true })).rejects.toThrow(/stängdes medan ändringen gjordes/);
    expect((await kalla.read("delningar", id)).nedladdning).toBe(false);
  });

  it("⛔ en ny delning efter en återkallning ger ett NYTT token, och det gamla förblir stängt", async () => {
    const { tjanst } = bygg();
    const forsta = await dela(tjanst);
    await tjanst.aterkalla({ uid: MEDLEM, id: forsta.id });
    const andra = await dela(tjanst);
    expect(andra.adress).not.toBe(forsta.adress);
    expect(andra.id).not.toBe(forsta.id);
    expect((await tjanst.hamta(andra.adress)).ok).toBe(true);
    expect(await tjanst.hamta(forsta.adress)).toEqual({ ok: false, orsak: "stangd" });
  });

  it("en delning som inte finns går inte att stänga eller ändra", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.aterkalla({ uid: MEDLEM, id: "finns-inte" })).rejects.toThrow(/finns inte/);
    await expect(tjanst.andraNedladdning({ uid: MEDLEM, id: "finns-inte", nedladdning: true })).rejects.toThrow(/finns inte/);
  });
});

describe("lista", () => {
  it("en medlem ser sina egna, admin ser alla, och stängda och utgångna syns inte", async () => {
    const { tjanst, tid } = bygg();
    const min = await dela(tjanst);
    const annans = await tjanst.skapa({ uid: ANNAN, postId: "p-annan", groupId: GRUPP, dagar: 1, gruppdel: GRUPPDEL, fildel: "biljett" });
    const stangd = await dela(tjanst, { dagar: 30 });
    await tjanst.aterkalla({ uid: MEDLEM, id: stangd.id });
    expect((await tjanst.lista({ uid: MEDLEM, groupId: GRUPP })).map((r) => r.id)).toEqual([min.id]);
    expect((await tjanst.lista({ uid: ADMIN, groupId: GRUPP })).map((r) => r.id).sort()).toEqual([min.id, annans.id].sort());
    tid(annans.giltigTill + 1);
    expect((await tjanst.lista({ uid: ADMIN, groupId: GRUPP })).map((r) => r.id)).toEqual([min.id]);
    await expect(tjanst.lista({ uid: UTOMSTAENDE, groupId: GRUPP })).rejects.toThrow(/inte aktiv medlem/);
    const rad = (await tjanst.lista({ uid: ADMIN, groupId: GRUPP }))[0];
    expect(Object.keys(rad).sort()).toEqual(["giltigTill", "harKod", "id", "nedladdning", "postId", "rattighet", "skapad", "skapadAv", "slag", "sokvag"]);
  });
});

describe("tjänsten byggs inte av halva beståndsdelar", () => {
  const kalla = createMemorySource();
  const lagring = { signeradAdress: async () => "https://x.test" };
  it("kräver datakälla, lagring och appens samlingsnamn", () => {
    expect(() => createDelningService(undefined)).toThrow(/datakälla/);
    expect(() => createDelningService({ kalla, samlingar: { delningar: "d", bibliotek: "b" } })).toThrow(/signeradAdress/);
    expect(() => createDelningService({ kalla, lagring, samlingar: { bibliotek: "b" } })).toThrow(/samlingar\.delningar/);
    expect(() => createDelningService({ kalla, lagring, samlingar: { delningar: "d/x", bibliotek: "b" } })).toThrow(/samlingar\.delningar/);
    expect(() => createDelningService({ kalla, lagring })).toThrow(/samlingar\./);
  });
  it("kräver createNew och updateIf", () => {
    const utanNew = { ...kalla, createNew: undefined };
    const utanIf = { ...kalla, updateIf: undefined };
    expect(() => createDelningService({ kalla: utanNew, lagring, samlingar: { delningar: "d", bibliotek: "b" } })).toThrow(/createNew/);
    expect(() => createDelningService({ kalla: utanIf, lagring, samlingar: { delningar: "d", bibliotek: "b" } })).toThrow(/updateIf/);
  });
});

describe("typ och texter", () => {
  it("typen härleds ur MIME", () => {
    expect(delningsTyp("audio/wav")).toBe("ljud");
    expect(delningsTyp("image/png")).toBe("bild");
    expect(delningsTyp("video/mp4")).toBe("video");
    expect(delningsTyp("application/pdf")).toBe("pdf");
    expect(delningsTyp("text/plain")).toBe("dokument");
    expect(delningsTyp(undefined)).toBe("dokument");
  });
  it("orden för de tre ursprungliga orsakerna står kvar (utom att saknas inte längre påstår att det var en fil, 0.133.0), och en okänd orsak får det utgångnas", () => {
    expect(DELNINGSFEL).toMatchObject({ utgangen: "Länken har gått ut", stangd: "Länken är stängd", saknas: "Finns inte längre" });
    expect(delningsfel("okänd")).toBe("Länken har gått ut");
    expect(delningsfel(undefined)).toBe("Länken har gått ut");
  });
});

describe("regelfragmentet", () => {
  it("nekar läsning och skrivning, med appens samlingsnamn", () => {
    const f = delningsregelfragment("delningar");
    expect(f).toContain("match /delningar/{id}");
    expect(f).toContain("allow read, write: if false;");
    expect(f).not.toMatch(/allow (read|write|get|list|create|update|delete)[^;]*:\s*if\s+(?!false)/);
  });
  it("⛔ utan valet är texten byte för byte den förra, och gruppdelarna är ett eget block efter den", () => {
    const forr = `    // ══ Ramverkets delningslänkar. GENERERAD, ändra inte för hand ══
    //
    // Källa: ops-framework, delningsregelfragment() i src/lib/regler.js.
    // Klienten läser inte raderna och skriver dem inte. Bara servern, med Admin SDK.
    // Id:t är SHA-256 av tokenet, och en lista över dem är en lista över hashar att försöka vända.
    match /delningar/{id} {
      allow read, write: if false;
    }
`;
    expect(delningsregelfragment("delningar")).toBe(forr);
    expect(delningsregelfragment("delningar", {})).toBe(forr);
    const med = delningsregelfragment("delningar", { gruppdelar: true });
    expect(med.startsWith(forr)).toBe(true);
    expect(med).toContain("match /delningsgruppdelar/{gruppdel} {\n      allow read, write: if false;");
    expect(delningsregelfragment("delningar", { gruppdelar: "namn" })).toContain("match /namn/{gruppdel}");
    expect(med).not.toMatch(/allow (read|write|get|list|create|update|delete)[^;]*:\s*if\s+(?!false)/);
    expect(() => delningsregelfragment("delningar", { gruppdelar: "a/b" })).toThrow(/samlingsnamn/);
  });
  it("ett namn med snedstreck är en sökväg och avvisas", () => {
    expect(() => delningsregelfragment("a/b")).toThrow(/samlingsnamn/);
    expect(() => delningsregelfragment("")).toThrow();
  });
});
