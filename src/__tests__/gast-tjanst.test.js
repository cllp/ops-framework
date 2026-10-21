import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import {
  GASTFEL_MAX,
  GASTIP_MAX,
  GASTLANKDAGAR,
  GASTLISTFALT,
  GASTNYLANK_BREV_PER_DYGN,
  GASTNYLANK_MAX_LANKAR,
  GASTNYLANK_SVAR,
  GASTSESSIONSDAGAR,
  GASTSVARSFALT,
  GAST_PLATSER_GRATIS,
  gastId,
  gastplatsId,
} from "../lib/gast.js";
import { medlemskapsId } from "../lib/grupp.js";
import { PLATSFRIST_MS, byggGastinbjudan, createGastService, gastInbjudningsId, gastnyckelHash, nyGastnyckel } from "../node/gast.js";

/**
 * Gästernas tjänst (0.131.0, cllp/lifehub.app#389): inbjudan, taket, inlösen, session, återkallelse och nya länkar.
 *
 * ⛔ UTAN NÄTVERK OCH UTAN FIREBASE: datakällan skickas in, så minneskällan räcker. Kontraktets `createNew` och `updateIf` är atomära i den (kroppen väntar inte på något),
 * och tjänstens egna `await` mellan stegen är det som låter samtidiga anrop korsa varandra. Reglerna provas i emulatorn (`rules/__tests__/gaster.test.mjs`).
 *
 * ⛔ VARJE PROV HAR BEVISATS I BÅDA RIKTNINGARNA (arbetsreglerna, punkt 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const NU = 1_800_000_000_000;
const DYGN = 24 * 60 * 60 * 1000;
const GRUPP = "kallan";
const ANDRA_GRUPP = "grannen";
const AGARE = "uid-agare";
const ADMIN = "uid-admin";
const SKAPARE = "uid-skapare";
const MEDLEM = "uid-medlem";
const UTANFOR = "uid-utanfor";
const AGENT = "uid-agent";
const FRAMLING = "uid-framling";

const medlemskap = (uid, groupId, roll, extra = {}) => ({ id: medlemskapsId(uid, groupId), userId: uid, groupId, roll, typ: "person", status: "aktiv", namn: `Namn ${uid}`, ...extra });

/** Appens regel i provet: skaparen, en admin eller en ägare, och bara medan datumet inte är valt. */
const farBjuda = ({ uid, medlemskap: m, handelse }) => !handelse.datum && (handelse.skapadAv === uid || m.roll === "agare" || m.roll === "admin");

function bygg({ omslut = (/** @type {any} */ k) => k, sak, extraMedlemskap = [], skickaFel = null } = {}) {
  const grundkalla = createMemorySource({
    memberships: [
      medlemskap(AGARE, GRUPP, "agare"),
      medlemskap(ADMIN, GRUPP, "admin"),
      medlemskap(SKAPARE, GRUPP, "medlem"),
      medlemskap(MEDLEM, GRUPP, "medlem"),
      medlemskap(UTANFOR, ANDRA_GRUPP, "agare"),
      medlemskap(AGENT, GRUPP, "admin", { typ: "agent" }),
      medlemskap(FRAMLING, GRUPP, "agare", { status: "avslutad" }),
      ...extraMedlemskap,
    ],
    handelser: [
      { id: "h1", groupId: GRUPP, skapadAv: SKAPARE, titel: "Rep" },
      { id: "h2", groupId: GRUPP, skapadAv: SKAPARE, titel: "Spelning" },
      { id: "h-valt", groupId: GRUPP, skapadAv: SKAPARE, titel: "Klar", datum: "2026-12-26" },
      { id: "h-arkiv", groupId: GRUPP, skapadAv: SKAPARE, arkiverad: true },
      { id: "h-grannen", groupId: ANDRA_GRUPP, skapadAv: UTANFOR, titel: "Grannens" },
      ...Array.from({ length: 7 }, (_, n) => ({ id: `hx${n}`, groupId: GRUPP, skapadAv: SKAPARE, titel: `Extra ${n}` })),
    ],
    gastinbjudningar: [],
    gastsessioner: [],
    gastplatser: [],
    gastraknare: [],
  });
  const kalla = omslut(grundkalla);
  /** @type {any[]} */
  const brev = [];
  const skicka = vi.fn(async (b) => {
    if (skickaFel) throw skickaFel;
    brev.push(b);
  });
  const rapportera = vi.fn();
  let nu = NU;
  const tjanst = createGastService({
    kalla,
    samlingar: { inbjudningar: "gastinbjudningar", sessioner: "gastsessioner", platser: "gastplatser", raknare: "gastraknare", handelser: "handelser" },
    farBjuda,
    skicka,
    rapportera,
    ...(sak ? { sak } : {}),
    klocka: () => nu,
  });
  return { kalla: grundkalla, tjanst, brev, skicka, rapportera, tid: (/** @type {number} */ ny) => { nu = ny; }, nu: () => nu };
}

const epostN = (n) => `gast${n}@foretag.se`;
const bjud = (tjanst, extra = {}) => tjanst.bjud({ uid: SKAPARE, handelseId: "h1", epost: "anna@foretag.se", ...extra });
/** Senaste brevets första länk. */
const senasteLank = (brev) => brev[brev.length - 1].lankar[0];
const IP = "203.0.113.7";
const lasUpp = (tjanst, brev, extra = {}) => {
  const l = senasteLank(brev);
  return tjanst.los({ id: l.id, nyckel: l.nyckel, epost: "anna@foretag.se", ip: IP, ...extra });
};
const platserRader = async (kalla) => (await kalla.list("gastplatser")).sort((a, b) => a.id.localeCompare(b.id));

describe("byggGastinbjudan", () => {
  const d = { groupId: GRUPP, epost: "Anna@Foretag.se", namn: " Anna ", omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" }, skapadAv: { uid: SKAPARE, namn: "S" }, skapad: NU, nyckel: nyGastnyckel() };

  it("id är hashen av (grupp, adress, omfång), nyckeln finns inte i raden, och raden bär exakt modellens fält", () => {
    const rad = byggGastinbjudan(d);
    expect(rad.id).toBe(gastInbjudningsId({ groupId: GRUPP, epost: "anna@foretag.se", omfang: d.omfang }));
    expect(rad.epost).toBe("anna@foretag.se");
    expect(rad.namn).toBe("Anna");
    expect(rad.nyckelHash).toBe(gastnyckelHash(d.nyckel));
    expect(JSON.stringify(rad)).not.toContain(d.nyckel);
    expect(Object.keys(rad).sort()).toEqual(["id", "groupId", "epost", "namn", "omfang", "skapadAv", "skapad", "skickad", "antalSkickade", "lankGiltigTill", "nyckelHash", "forstInloggad", "aterkallad", "felAntal", "felFonster"].sort());
    expect(rad).toMatchObject({ aterkallad: null, forstInloggad: null, felAntal: 0, felFonster: 0, antalSkickade: 1, lankGiltigTill: NU + GASTLANKDAGAR * DYGN });
  });

  it("samma adress till samma sak är samma id, och en annan adress, sak eller grupp är en annan", () => {
    const a = gastInbjudningsId({ groupId: GRUPP, epost: "anna@foretag.se", omfang: d.omfang });
    expect(gastInbjudningsId({ groupId: GRUPP, epost: " ANNA@foretag.se", omfang: d.omfang })).toBe(a);
    expect(gastInbjudningsId({ groupId: GRUPP, epost: "bo@foretag.se", omfang: d.omfang })).not.toBe(a);
    expect(gastInbjudningsId({ groupId: GRUPP, epost: "anna@foretag.se", omfang: { ...d.omfang, handelseId: "h2" } })).not.toBe(a);
    expect(gastInbjudningsId({ groupId: ANDRA_GRUPP, epost: "anna@foretag.se", omfang: d.omfang })).not.toBe(a);
  });

  it("kastar för en adress som inte går att skicka till och för ett för långt namn", () => {
    expect(() => byggGastinbjudan({ ...d, epost: "inte-en-adress" })).toThrow(/adress/);
    expect(() => byggGastinbjudan({ ...d, namn: "x".repeat(81) })).toThrow(/högst/);
    expect(() => byggGastinbjudan({ ...d, nyckel: "kort" })).toThrow(/nyckel/);
  });
});

describe("createGastService: bygget kräver det som skyddar", () => {
  const ok = () => ({ kalla: createMemorySource({}), samlingar: { inbjudningar: "a", sessioner: "b", platser: "c", raknare: "d", handelser: "e" }, farBjuda: () => true, skicka: async () => {} });

  it("bygger med allt, och vägrar utan farBjuda, utan skicka, med dubbla samlingsnamn och med en källa utan createNew eller updateIf", () => {
    expect(() => createGastService(ok())).not.toThrow();
    expect(() => createGastService({ ...ok(), farBjuda: undefined })).toThrow(/farBjuda krävs/);
    expect(() => createGastService({ ...ok(), skicka: undefined })).toThrow(/skicka krävs/);
    expect(() => createGastService({ ...ok(), samlingar: { ...ok().samlingar, sessioner: "a" } })).toThrow(/eget namn/);
    expect(() => createGastService({ ...ok(), samlingar: { ...ok().samlingar, raknare: undefined } })).toThrow(/samlingar.raknare/);
    const { createNew: _c, ...utanCreateNew } = ok().kalla;
    expect(() => createGastService({ ...ok(), kalla: utanCreateNew })).toThrow(/createNew/);
    const { updateIf: _u, ...utanUpdateIf } = ok().kalla;
    expect(() => createGastService({ ...ok(), kalla: utanUpdateIf })).toThrow(/updateIf/);
    expect(() => createGastService(undefined)).toThrow(/datakälla/);
    expect(() => createGastService({ ...ok(), sak: { falt: [], bygg: () => ({}) } })).toThrow(/sak.falt/);
  });
});

describe("bjud: vem får, och vad som skrivs", () => {
  it("en skapare bjuder in: raden skrivs, brevet bär nyckeln, och inget returvärde gör det", async () => {
    const { tjanst, brev, kalla } = bygg();
    const svar = await bjud(tjanst);
    expect(svar).toEqual({ id: expect.stringMatching(/^[0-9a-f]{64}$/), gastId: gastId("anna@foretag.se"), ny: true, vackt: false });
    expect(brev).toHaveLength(1);
    expect(brev[0]).toMatchObject({ typ: "inbjudan", till: "anna@foretag.se", skickadAv: { uid: SKAPARE } });
    const lank = brev[0].lankar[0];
    expect(lank).toMatchObject({ id: svar.id, groupId: GRUPP, omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" } });
    const rader = await kalla.list("gastinbjudningar");
    expect(rader).toHaveLength(1);
    expect(rader[0].nyckelHash).toBe(gastnyckelHash(lank.nyckel));
    // Nyckeln finns i brevet och ingen annanstans: inte i raden, inte i något annat dokument och inte i svaret.
    for (const samling of ["gastinbjudningar", "gastsessioner", "gastplatser", "gastraknare"]) expect(JSON.stringify(await kalla.list(samling))).not.toContain(lank.nyckel);
    expect(JSON.stringify(svar)).not.toContain(lank.nyckel);
  });

  it("ägare, admin och skaparen får bjuda; en annan medlem, en agent, en före detta medlem, en utomstående och ingen alls får det inte", async () => {
    const { tjanst } = bygg();
    for (const uid of [AGARE, ADMIN, SKAPARE]) await expect(tjanst.bjud({ uid, handelseId: "h1", epost: epostN(uid.length) }), uid).resolves.toBeTruthy();
    for (const uid of [MEDLEM, AGENT, FRAMLING, UTANFOR, "uid-okand"]) {
      await expect(tjanst.bjud({ uid, handelseId: "h2", epost: "bo@foretag.se" }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
    }
  });

  it("appens regel prövas efter medlemskapet: en vald dag stänger inbjudan, även för en ägare", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.bjud({ uid: AGARE, handelseId: "h-valt", epost: "bo@foretag.se" })).rejects.toMatchObject({ kod: "ej-behorig" });
  });

  it("en händelse som saknas eller är arkiverad ger samma svar, och en från en annan grupp når ingen utomstående", async () => {
    const { tjanst } = bygg();
    await expect(tjanst.bjud({ uid: AGARE, handelseId: "h-arkiv", epost: "bo@foretag.se" })).rejects.toMatchObject({ kod: "finns-inte" });
    await expect(tjanst.bjud({ uid: AGARE, handelseId: "finns-ej", epost: "bo@foretag.se" })).rejects.toMatchObject({ kod: "finns-inte" });
    // Gruppen läses ur händelsen och aldrig ur anropet: en ägare i gruppen "grannen" kan inte bjuda till kallans händelse.
    await expect(tjanst.bjud({ uid: UTANFOR, handelseId: "h1", epost: "bo@foretag.se" })).rejects.toMatchObject({ kod: "ej-behorig" });
  });

  it("en ogiltig adress, en spärrad domän och ett för långt namn avvisas innan något skrivs", async () => {
    const { tjanst, kalla, brev } = bygg();
    for (const epost of ["inte-en-adress", "bo@example.com", "", undefined]) await expect(bjud(tjanst, { epost }), String(epost)).rejects.toMatchObject({ kod: "ogiltig-epost" });
    await expect(bjud(tjanst, { namn: "x".repeat(81) })).rejects.toMatchObject({ kod: "ogiltigt-namn" });
    expect(await kalla.list("gastinbjudningar")).toHaveLength(0);
    expect(await kalla.list("gastplatser")).toHaveLength(0);
    expect(brev).toHaveLength(0);
  });

  it("brevet som inte går ger brev-misslyckades, inbjudan ligger kvar aktiv, och Skicka igen löser det", async () => {
    const { tjanst, kalla, brev } = bygg({ skickaFel: new Error("smtp nere") });
    await expect(bjud(tjanst)).rejects.toMatchObject({ kod: "brev-misslyckades" });
    const [rad] = await kalla.list("gastinbjudningar");
    expect(rad).toMatchObject({ aterkallad: null });
    expect(brev).toHaveLength(0);
    // Skicka igen med en fungerande mejlväg: samma rad, nu skickad.
    const bra = bygg();
    await bjud(bra.tjanst);
    await bra.tjanst.skickaOm({ uid: SKAPARE, id: (await bra.kalla.list("gastinbjudningar"))[0].id });
    expect(bra.brev).toHaveLength(2);
  });
});

describe("unikhet: dokument-id och aldrig en läsning följd av en skrivning", () => {
  it("två samtidiga inbjudningar till samma adress och sak ger EN rad och EN plats", async () => {
    const { tjanst, kalla } = bygg();
    const [a, b] = await Promise.all([bjud(tjanst), bjud(tjanst, { epost: "ANNA@foretag.se" })]);
    expect(a.id).toBe(b.id);
    expect(await kalla.list("gastinbjudningar")).toHaveLength(1);
    expect((await platserRader(kalla)).filter((r) => r.gastId === gastId("anna@foretag.se"))).toHaveLength(1);
    // Exakt en av dem skapade raden; den andra skickade om.
    expect([a.ny, b.ny].filter(Boolean)).toHaveLength(1);
  });

  it("samma adress till två saker är två rader och tar EN plats", async () => {
    const { tjanst, kalla } = bygg();
    await Promise.all([bjud(tjanst), bjud(tjanst, { handelseId: "h2" })]);
    expect(await kalla.list("gastinbjudningar")).toHaveLength(2);
    expect(await platserRader(kalla)).toHaveLength(1);
  });

  it("en andra inbjudan skickar om: nyckeln roteras, den gamla slutar fungera, och räknaren går upp", async () => {
    const { tjanst, brev, kalla } = bygg();
    await bjud(tjanst);
    const gammal = senasteLank(brev);
    const svar = await bjud(tjanst, { namn: "Anna A" });
    expect(svar.ny).toBe(false);
    const ny = senasteLank(brev);
    expect(ny.nyckel).not.toBe(gammal.nyckel);
    const [rad] = await kalla.list("gastinbjudningar");
    expect(rad).toMatchObject({ antalSkickade: 2, namn: "Anna A" });
    expect(await tjanst.los({ ...gammal, epost: "anna@foretag.se", ip: IP })).toEqual({ ok: false, orsak: "nej" });
    expect(await tjanst.los({ ...ny, epost: "anna@foretag.se", ip: IP })).toMatchObject({ ok: true });
  });
});

describe("taket: fem platser, och det är dokument", () => {
  /**
   * Samma anrop mot en NAIV tjänst som räknar med en fråga och skriver sedan, med ett steg emellan där en annan hinner före. Det är inte tjänsten: det är beviset på att provet nedan kan
   * se felet. Ett prov som inte kan se ett överskridet tak är ingen vakt (arbetsreglerna, punkt 4).
   */
  async function naivBjud(kalla, n) {
    const rader = await kalla.list("gastplatser");
    if (rader.length >= GAST_PLATSER_GRATIS) return false;
    await Promise.resolve();
    await kalla.create("gastplatser", { id: `naiv|${n}`, gastId: `g_${n}` });
    return true;
  }

  it("provets samtidighet kan se felet: en naiv räkning med fråga släpper in alla sju", async () => {
    const { kalla } = bygg();
    const utfall = await Promise.all(Array.from({ length: 7 }, (_, n) => naivBjud(kalla, n)));
    expect(utfall.filter(Boolean).length).toBeGreaterThan(GAST_PLATSER_GRATIS);
  });

  it("sju samtidiga inbjudningar till sju adresser ger exakt fem platser, fem rader och två avslag med koden", async () => {
    const { tjanst, kalla, brev } = bygg();
    const utfall = await Promise.allSettled(Array.from({ length: 7 }, (_, n) => bjud(tjanst, { epost: epostN(n) })));
    expect(utfall.filter((u) => u.status === "fulfilled")).toHaveLength(GAST_PLATSER_GRATIS);
    const avslag = utfall.filter((u) => u.status === "rejected");
    expect(avslag).toHaveLength(2);
    for (const a of avslag) expect(/** @type {any} */ (a).reason).toMatchObject({ kod: "platser-slut" });
    const platser = await platserRader(kalla);
    expect(platser.map((p) => p.id)).toEqual([1, 2, 3, 4, 5].map((n) => gastplatsId(GRUPP, n)));
    expect(new Set(platser.map((p) => p.gastId)).size).toBe(GAST_PLATSER_GRATIS);
    // Ingen avvisad gäst har en inbjudan kvar, och inget brev gick till dem.
    expect(await kalla.list("gastinbjudningar")).toHaveLength(GAST_PLATSER_GRATIS);
    expect(brev).toHaveLength(GAST_PLATSER_GRATIS);
  });

  it("den sjätte efter varandra nekas, en redan inbjuden gäst får en andra sak vid taket, och en ledig plats efter en återkallelse tas", async () => {
    const { tjanst, kalla } = bygg();
    for (let n = 0; n < GAST_PLATSER_GRATIS; n++) await bjud(tjanst, { epost: epostN(n) });
    await expect(bjud(tjanst, { epost: epostN(9) })).rejects.toMatchObject({ kod: "platser-slut" });
    // En gäst som redan har en plats tar ingen ny för en andra sak.
    await expect(bjud(tjanst, { epost: epostN(0), handelseId: "h2" })).resolves.toMatchObject({ ny: true });
    expect(await platserRader(kalla)).toHaveLength(GAST_PLATSER_GRATIS);
    // Två inbjudningar för gäst 1 (h1 och h2) behöver båda återkallas innan platsen släpps; gäst 2 har en.
    const gast2 = (await kalla.list("gastinbjudningar")).find((r) => r.epost === epostN(1));
    await tjanst.aterkalla({ uid: SKAPARE, id: gast2.id });
    await expect(bjud(tjanst, { epost: epostN(9) })).resolves.toMatchObject({ ny: true });
    expect(await platserRader(kalla)).toHaveLength(GAST_PLATSER_GRATIS);
  });

  it("taket är per grupp: en annan grupp har egna fem", async () => {
    const { tjanst, kalla } = bygg();
    for (let n = 0; n < GAST_PLATSER_GRATIS; n++) await bjud(tjanst, { epost: epostN(n) });
    await expect(tjanst.bjud({ uid: UTANFOR, handelseId: "h-grannen", epost: epostN(20) })).resolves.toMatchObject({ ny: true });
    expect((await platserRader(kalla)).map((p) => p.id)).toContain(gastplatsId(ANDRA_GRUPP, 1));
  });

  it("en plats som ingen längre använder tas tillbaka vid taket, men bara om den är äldre än fristen", async () => {
    const { tjanst, kalla, tid } = bygg();
    for (let n = 0; n < GAST_PLATSER_GRATIS; n++) await bjud(tjanst, { epost: epostN(n) });
    // Plats 3:s inbjudan försvinner (processen dog mellan platsen och inbjudan, eller raden togs bort för hand).
    const forlorad = (await platserRader(kalla)).find((p) => p.id === gastplatsId(GRUPP, 3));
    const rad = (await kalla.list("gastinbjudningar")).find((r) => gastId(r.epost) === forlorad.gastId);
    await kalla.remove("gastinbjudningar", rad.id);
    // Samma minut: platsen är ny och kan höra till en inbjudan som håller på att skrivas. Den tas inte.
    await expect(bjud(tjanst, { epost: epostN(30) })).rejects.toMatchObject({ kod: "platser-slut" });
    tid(NU + PLATSFRIST_MS + 1000);
    await expect(bjud(tjanst, { epost: epostN(30) })).resolves.toMatchObject({ ny: true });
    expect((await platserRader(kalla)).find((p) => p.id === gastplatsId(GRUPP, 3)).gastId).toBe(gastId(epostN(30)));
  });
});

describe("platsen bekräftas efter inbjudan: en återkallelse som korsar ett utskick lämnar ingen aktiv inbjudan utan plats", () => {
  /**
   * En källa som, direkt efter att inbjudan skrivits om, gör vad en samtidig återkallelse gör: tömmer gästens plats (och, om `fyll`, ger platserna till fem andra).
   * @param {boolean} fyll
   */
  const korsad = (fyll) => (/** @type {any} */ k) => {
    let skjuten = false;
    return new Proxy(k, {
      get(mal, prop) {
        if (prop !== "updateIf") return typeof mal[prop] === "function" ? mal[prop].bind(mal) : mal[prop];
        return async (samling, id, villkor, data) => {
          const svar = await mal.updateIf(samling, id, villkor, data);
          if (samling === "gastinbjudningar" && svar.updated && !skjuten) {
            skjuten = true;
            for (const p of await mal.list("gastplatser")) await mal.remove("gastplatser", p.id);
            if (fyll) for (let n = 1; n <= GAST_PLATSER_GRATIS; n++) await mal.create("gastplatser", { id: gastplatsId(GRUPP, n), gastId: `g_${n}`, skapad: NU });
          }
          return svar;
        };
      },
    });
  };

  it("platsen tas på nytt när den tömdes mitt i utskicket", async () => {
    const { tjanst, kalla } = bygg({ omslut: korsad(false) });
    await bjud(tjanst);
    const { id } = await bjud(tjanst);
    expect((await platserRader(kalla)).filter((p) => p.gastId === gastId("anna@foretag.se"))).toHaveLength(1);
    expect((await kalla.list("gastinbjudningar")).find((r) => r.id === id).aterkallad).toBeNull();
  });

  it("⛔ finns ingen plats att ta på nytt kastas platser-slut och inbjudan dras tillbaka: aldrig aktiv utan plats", async () => {
    const { tjanst, kalla, brev } = bygg({ omslut: korsad(true) });
    await bjud(tjanst);
    brev.length = 0;
    await expect(bjud(tjanst)).rejects.toMatchObject({ kod: "platser-slut" });
    expect((await kalla.list("gastinbjudningar"))[0].aterkallad).not.toBeNull();
    expect(brev).toHaveLength(0);
  });
});

describe("los: adressen skrivs, nyckeln i länken räcker inte", () => {
  it("rätt nyckel och rätt adress ger en session, markerar första inloggningen och förbrukar inte länken", async () => {
    const { tjanst, brev, kalla } = bygg();
    await bjud(tjanst);
    const r1 = await lasUpp(tjanst, brev);
    expect(r1).toEqual({ ok: true, sessionsnyckel: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    const [rad] = await kalla.list("gastinbjudningar");
    expect(rad.forstInloggad).toBe(NU);
    // Sessionen lagras som hash.
    const sessioner = await kalla.list("gastsessioner");
    expect(sessioner).toHaveLength(1);
    expect(sessioner[0].id).toBe(gastnyckelHash(r1.sessionsnyckel));
    expect(JSON.stringify(sessioner)).not.toContain(r1.sessionsnyckel);
    // Länken är inte en engångskod: ett mejlprograms förhandshämtning eller en andra enhet förbrukar ingenting.
    const r2 = await lasUpp(tjanst, brev);
    expect(r2.ok).toBe(true);
    expect(r2.sessionsnyckel).not.toBe(r1.sessionsnyckel);
    expect((await kalla.list("gastinbjudningar"))[0].forstInloggad).toBe(NU);
  });

  it("adressen jämförs normaliserad: versaler och blanksteg spelar ingen roll", async () => {
    const { tjanst, brev } = bygg();
    await bjud(tjanst);
    expect(await lasUpp(tjanst, brev, { epost: "  ANNA@Foretag.SE " })).toMatchObject({ ok: true });
  });

  it("okänt id, fel nyckel, fel adress, trasig form och ingen adress ger ETT svar, byte för byte", async () => {
    const { tjanst, brev } = bygg();
    await bjud(tjanst);
    const l = senasteLank(brev);
    const nej = { ok: false, orsak: "nej" };
    const svar = [
      await tjanst.los({ id: "0".repeat(64), nyckel: l.nyckel, epost: "anna@foretag.se", ip: IP }),
      await tjanst.los({ id: l.id, nyckel: nyGastnyckel(), epost: "anna@foretag.se", ip: IP }),
      await tjanst.los({ id: l.id, nyckel: l.nyckel, epost: "bo@foretag.se", ip: IP }),
      await tjanst.los({ id: l.id, nyckel: l.nyckel, epost: "inte-en-adress", ip: IP }),
      await tjanst.los({ id: l.id, nyckel: l.nyckel, epost: undefined, ip: IP }),
      await tjanst.los({ id: "kort", nyckel: l.nyckel, epost: "anna@foretag.se", ip: IP }),
      await tjanst.los({ id: l.id, nyckel: "kort", epost: "anna@foretag.se", ip: IP }),
      await tjanst.los({ id: undefined, nyckel: undefined, epost: undefined, ip: IP }),
    ];
    expect(svar).toHaveLength(8);
    for (const s of svar) expect(JSON.stringify(s)).toBe(JSON.stringify(nej));
  });

  it("fel adress räknas per inbjudan: sjätte försöket i fönstret ger for-manga även med rätt adress, och fönstret går ut", async () => {
    const { tjanst, brev, kalla, tid } = bygg();
    await bjud(tjanst);
    const l = senasteLank(brev);
    for (let i = 0; i < GASTFEL_MAX; i++) expect(await tjanst.los({ ...l, epost: "fel@foretag.se", ip: `198.51.100.${i}` })).toEqual({ ok: false, orsak: "nej" });
    expect((await kalla.list("gastinbjudningar"))[0].felAntal).toBe(GASTFEL_MAX);
    expect(await tjanst.los({ ...l, epost: "anna@foretag.se", ip: "198.51.100.200" })).toEqual({ ok: false, orsak: "for-manga" });
    tid(NU + 16 * 60 * 1000);
    expect(await tjanst.los({ ...l, epost: "anna@foretag.se", ip: "198.51.100.200" })).toMatchObject({ ok: true });
  });

  it("tjugo parallella gissningar prövas högst fem gånger, och rätt adress sist av dem kommer inte igenom", async () => {
    const { tjanst, brev, kalla } = bygg();
    await bjud(tjanst);
    const l = senasteLank(brev);
    const anrop = Array.from({ length: 20 }, (_, i) => tjanst.los({ ...l, epost: `fel${i}@foretag.se`, ip: `198.51.100.${i}` }));
    anrop.push(tjanst.los({ ...l, epost: "anna@foretag.se", ip: "198.51.100.99" }));
    const svar = await Promise.all(anrop);
    expect(svar.filter((s) => s.orsak === "nej")).toHaveLength(GASTFEL_MAX);
    expect(svar.filter((s) => s.orsak === "for-manga")).toHaveLength(16);
    expect(svar[20]).toEqual({ ok: false, orsak: "for-manga" });
    expect((await kalla.list("gastinbjudningar"))[0].felAntal).toBe(GASTFEL_MAX);
    expect(await kalla.list("gastsessioner")).toHaveLength(0);
  });

  it("lyckade inloggningar låser inte inbjudan: ett försök som lyckas ges tillbaka", async () => {
    const { tjanst, brev, kalla } = bygg();
    await bjud(tjanst);
    for (let i = 0; i < GASTFEL_MAX * 3; i++) expect(await lasUpp(tjanst, brev, { ip: `198.51.100.${i}` })).toMatchObject({ ok: true });
    expect((await kalla.list("gastinbjudningar"))[0].felAntal).toBe(0);
  });

  it("fel adress räknas också per IP, över alla inbjudningar, och en annan IP påverkas inte", async () => {
    const { tjanst, brev } = bygg();
    await bjud(tjanst);
    const l = senasteLank(brev);
    for (let i = 0; i < GASTIP_MAX; i++) expect((await tjanst.los({ id: "0".repeat(64), nyckel: l.nyckel, epost: "x@foretag.se", ip: IP })).orsak).toBe("nej");
    // IP:n är slut, också för en riktig länk med rätt adress.
    expect(await lasUpp(tjanst, brev)).toEqual({ ok: false, orsak: "for-manga" });
    expect(await lasUpp(tjanst, brev, { ip: "192.0.2.1" })).toMatchObject({ ok: true });
  });

  it("ip krävs: en tjänst som tyst slutade räkna per IP hade sett ut som en som gör det", async () => {
    const { tjanst, brev } = bygg();
    await bjud(tjanst);
    const l = senasteLank(brev);
    await expect(tjanst.los({ ...l, epost: "anna@foretag.se" })).rejects.toThrow(/ip krävs/);
    await expect(tjanst.los({ ...l, epost: "anna@foretag.se", ip: "  " })).rejects.toThrow(/ip krävs/);
    await expect(tjanst.nyLank({ epost: "anna@foretag.se" })).rejects.toThrow(/ip krävs/);
  });

  it("återkallad och utgången säger det bara när nyckeln OCH adressen stämde, annars är det ett vanligt nej", async () => {
    const { tjanst, brev, tid } = bygg();
    await bjud(tjanst);
    const l = senasteLank(brev);
    tid(NU + (GASTLANKDAGAR + 1) * DYGN);
    expect(await tjanst.los({ ...l, epost: "anna@foretag.se", ip: IP })).toEqual({ ok: false, orsak: "utgangen" });
    expect(await tjanst.los({ ...l, epost: "bo@foretag.se", ip: IP })).toEqual({ ok: false, orsak: "nej" });
    expect(await tjanst.los({ id: l.id, nyckel: nyGastnyckel(), epost: "anna@foretag.se", ip: IP })).toEqual({ ok: false, orsak: "nej" });
    tid(NU);
    await tjanst.aterkalla({ uid: SKAPARE, id: l.id });
    expect(await tjanst.los({ ...l, epost: "anna@foretag.se", ip: IP })).toEqual({ ok: false, orsak: "aterkallad" });
    expect(await tjanst.los({ ...l, epost: "bo@foretag.se", ip: IP })).toEqual({ ok: false, orsak: "nej" });
  });

  it("en roterad nyckel och en förhandshämtning: den nya fungerar, den gamla inte, och en trasig begäran ändrar ingenting", async () => {
    const { tjanst, brev, kalla } = bygg();
    await bjud(tjanst);
    const gammal = senasteLank(brev);
    const fore = JSON.stringify(await kalla.list("gastinbjudningar"));
    // Ett mejlprograms förhandshämtning hämtar sidan utan fragment: ingen inlösen, ingen räknare, ingen ändring.
    await tjanst.session({ sessionsnyckel: undefined });
    await tjanst.hamta({ sessionsnyckel: "" });
    expect(JSON.stringify(await kalla.list("gastinbjudningar"))).toBe(fore);
    await tjanst.skickaOm({ uid: SKAPARE, id: gammal.id });
    expect(await tjanst.los({ ...gammal, epost: "anna@foretag.se", ip: IP })).toEqual({ ok: false, orsak: "nej" });
    expect(await lasUpp(tjanst, brev)).toMatchObject({ ok: true });
  });
});

describe("session och hamta", () => {
  const sak = {
    falt: ["titel", "forslag"],
    bygg: async ({ handelse }) => ({ titel: handelse.titel, forslag: [{ id: "f1", datum: "2026-12-26", ja: 2 }], epostPaMedlem: "agare@hemlig.se", skapadAv: handelse.skapadAv, groupId: handelse.groupId }),
  };

  async function inloggad(val = {}) {
    const b = bygg(val);
    await bjud(b.tjanst);
    const { sessionsnyckel } = await lasUpp(b.tjanst, b.brev);
    return { ...b, sessionsnyckel };
  }

  it("en giltig session ger gästens identitet och inbjudan, och läses om vid varje anrop", async () => {
    const { tjanst, sessionsnyckel } = await inloggad();
    expect(await tjanst.session({ sessionsnyckel })).toEqual({
      ok: true,
      gastId: gastId("anna@foretag.se"),
      inbjudan: { id: expect.any(String), groupId: GRUPP, slag: "sak", handelseId: "h1", funktion: "rosta", namn: "" },
    });
    expect(await tjanst.session({ sessionsnyckel, krav: { funktion: "rosta" } })).toMatchObject({ ok: true });
    expect(await tjanst.session({ sessionsnyckel, krav: { funktion: "chatta" } })).toEqual({ ok: false, orsak: "nej" });
  });

  it("en okänd, trasig eller saknad sessionsnyckel ger ett nej, byte för byte", async () => {
    const { tjanst } = await inloggad();
    for (const s of [nyGastnyckel(), "kort", "", undefined, null, 5]) expect(JSON.stringify(await tjanst.session({ sessionsnyckel: s })), String(s)).toBe(JSON.stringify({ ok: false, orsak: "nej" }));
  });

  it("en session som stått oanvänd i 90 dagar är borta, och en som används lever vidare", async () => {
    const { tjanst, sessionsnyckel, kalla, tid } = await inloggad();
    tid(NU + (GASTSESSIONSDAGAR - 1) * DYGN);
    expect((await tjanst.session({ sessionsnyckel })).ok).toBe(true);
    // Anropet förnyade `senast`: ytterligare 89 dagar går bra.
    tid(NU + (GASTSESSIONSDAGAR - 1) * DYGN + (GASTSESSIONSDAGAR - 1) * DYGN);
    expect((await tjanst.session({ sessionsnyckel })).ok).toBe(true);
    tid(NU + 3 * GASTSESSIONSDAGAR * DYGN);
    expect(await tjanst.session({ sessionsnyckel })).toEqual({ ok: false, orsak: "nej" });
    expect(await kalla.list("gastsessioner")).toHaveLength(0);
  });

  it("hamta ger bara fälten i GASTSVARSFALT och av saken bara de som appen listat, och inget ur en seedad medlem", async () => {
    const { tjanst, sessionsnyckel } = await inloggad({ sak, extraMedlemskap: [medlemskap("uid-hemlig", GRUPP, "medlem", { namn: "Hemlige Hans", epost: "hans@hemlig.se" })] });
    const svar = await tjanst.hamta({ sessionsnyckel });
    expect(svar).toEqual({ ok: true, namn: "", funktion: "rosta", sak: { titel: "Rep", forslag: [{ id: "f1", datum: "2026-12-26", ja: 2 }] } });
    // Golv: svaret bär något, så att "inga läckta fält" inte är grönt av ett tomt svar.
    expect(Object.keys(svar).length).toBeGreaterThan(2);
    for (const k of Object.keys(svar)) expect(/** @type {readonly string[]} */ (GASTSVARSFALT)).toContain(k);
    const json = JSON.stringify(svar);
    for (const forbjuden of ["Hemlige Hans", "hans@hemlig.se", "uid-hemlig", "agare@hemlig.se", "uid-skapare", "uid-agare", GRUPP, "anna@foretag.se", "Namn uid-"]) expect(json, forbjuden).not.toContain(forbjuden);
  });

  it("hamta utan sak i tjänsten ger inget sak-fält, och en händelse som försvunnit ger saknas", async () => {
    const { tjanst, sessionsnyckel, kalla } = await inloggad();
    expect(await tjanst.hamta({ sessionsnyckel })).toEqual({ ok: true, namn: "", funktion: "rosta" });
    await kalla.update("handelser", "h1", { arkiverad: true });
    expect(await tjanst.hamta({ sessionsnyckel })).toEqual({ ok: false, orsak: "saknas" });
  });

  it("gästens eget namn sparas på inbjudan, rensas med en tom text, och nekas efter en återkallelse", async () => {
    const { tjanst, sessionsnyckel, kalla } = await inloggad();
    expect(await tjanst.sattNamn({ sessionsnyckel, namn: "  Anna A  " })).toEqual({ ok: true, namn: "Anna A" });
    expect((await kalla.list("gastinbjudningar"))[0].namn).toBe("Anna A");
    expect((await tjanst.session({ sessionsnyckel })).inbjudan.namn).toBe("Anna A");
    await expect(tjanst.sattNamn({ sessionsnyckel, namn: "x".repeat(81) })).rejects.toMatchObject({ kod: "ogiltigt-namn" });
    await expect(tjanst.sattNamn({ sessionsnyckel, namn: "a\u0000b" })).rejects.toMatchObject({ kod: "ogiltigt-namn" });
    await tjanst.aterkalla({ uid: SKAPARE, id: (await kalla.list("gastinbjudningar"))[0].id });
    expect(await tjanst.sattNamn({ sessionsnyckel, namn: "Ny" })).toEqual({ ok: false, orsak: "aterkallad" });
    expect((await kalla.list("gastinbjudningar"))[0].namn).toBe("Anna A");
  });
});

describe("aterkalla", () => {
  it("nästa session och hamta nekas med aterkallad, sessionen får ligga men förnyas inte, och platsen släpps", async () => {
    const { tjanst, brev, kalla } = bygg();
    await bjud(tjanst);
    const { sessionsnyckel } = await lasUpp(tjanst, brev);
    const id = senasteLank(brev).id;
    expect(await platserRader(kalla)).toHaveLength(1);
    expect(await tjanst.aterkalla({ uid: SKAPARE, id })).toEqual({ id, platsSlappt: true });
    expect(await tjanst.session({ sessionsnyckel })).toEqual({ ok: false, orsak: "aterkallad" });
    expect(await tjanst.hamta({ sessionsnyckel })).toEqual({ ok: false, orsak: "aterkallad" });
    // Sessionen ligger kvar (sidan ska kunna säga "återkallad"), och den tas av stadaSessioner när den blivit 90 dagar gammal.
    expect(await kalla.list("gastsessioner")).toHaveLength(1);
    expect(await platserRader(kalla)).toHaveLength(0);
    const [rad] = await kalla.list("gastinbjudningar");
    expect(rad.aterkallad).toBe(NU);
    // Raden finns kvar: adressen blir kvar på den återkallade raden (se beslut 0011).
    expect(rad.epost).toBe("anna@foretag.se");
  });

  it("platsen släpps först när gästens SISTA aktiva inbjudan i gruppen dras tillbaka", async () => {
    const { tjanst, kalla } = bygg();
    const a = await bjud(tjanst);
    const b = await bjud(tjanst, { handelseId: "h2" });
    expect(await tjanst.aterkalla({ uid: SKAPARE, id: a.id })).toMatchObject({ platsSlappt: false });
    expect(await platserRader(kalla)).toHaveLength(1);
    expect(await tjanst.aterkalla({ uid: SKAPARE, id: b.id })).toMatchObject({ platsSlappt: true });
    expect(await platserRader(kalla)).toHaveLength(0);
  });

  it("den som bjöd, en admin och en ägare får dra tillbaka; en annan medlem, en agent och en utomstående får det inte", async () => {
    for (const uid of [SKAPARE, ADMIN, AGARE]) {
      const { tjanst } = bygg();
      const { id } = await bjud(tjanst);
      await expect(tjanst.aterkalla({ uid, id }), uid).resolves.toMatchObject({ id });
    }
    for (const uid of [MEDLEM, AGENT, UTANFOR, FRAMLING]) {
      const { tjanst, kalla } = bygg();
      const { id } = await bjud(tjanst);
      await expect(tjanst.aterkalla({ uid, id }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
      expect((await kalla.list("gastinbjudningar"))[0].aterkallad).toBeNull();
    }
  });

  it("den som bjöd får dra tillbaka även efter att ha lämnat gruppen", async () => {
    const { tjanst, kalla } = bygg({ extraMedlemskap: [medlemskap("uid-forsvunnen", GRUPP, "admin")] });
    const { id } = await tjanst.bjud({ uid: "uid-forsvunnen", handelseId: "h1", epost: "anna@foretag.se" });
    await kalla.update("memberships", medlemskapsId("uid-forsvunnen", GRUPP), { status: "avslutad" });
    await expect(tjanst.aterkalla({ uid: "uid-forsvunnen", id })).resolves.toMatchObject({ id });
  });

  it("är idempotent, tål en okänd inbjudan med en kod, och två samtidiga återkallelser släpper platsen en gång utan fel", async () => {
    const { tjanst, kalla } = bygg();
    const { id } = await bjud(tjanst);
    await Promise.all([tjanst.aterkalla({ uid: SKAPARE, id }), tjanst.aterkalla({ uid: ADMIN, id })]);
    await expect(tjanst.aterkalla({ uid: SKAPARE, id })).resolves.toMatchObject({ id });
    expect(await platserRader(kalla)).toHaveLength(0);
    await expect(tjanst.aterkalla({ uid: SKAPARE, id: "0".repeat(64) })).rejects.toMatchObject({ kod: "finns-inte" });
    await expect(tjanst.aterkalla({ uid: SKAPARE, id: "kort" })).rejects.toMatchObject({ kod: "finns-inte" });
  });

  it("Bjud in igen väcker en återkallad inbjudan med samma id, tar en plats på nytt, och nekas om taket hunnit fyllas", async () => {
    const { tjanst, kalla } = bygg();
    const forsta = await bjud(tjanst);
    await tjanst.aterkalla({ uid: SKAPARE, id: forsta.id });
    const vackt = await bjud(tjanst);
    expect(vackt).toMatchObject({ id: forsta.id, ny: false, vackt: true });
    const [rad] = await kalla.list("gastinbjudningar");
    expect(rad.aterkallad).toBeNull();
    expect(await platserRader(kalla)).toHaveLength(1);
    // Åter: återkalla, fyll gruppen med andra, och försök väcka.
    await tjanst.aterkalla({ uid: SKAPARE, id: forsta.id });
    for (let n = 0; n < GAST_PLATSER_GRATIS; n++) await bjud(tjanst, { epost: epostN(n) });
    await expect(bjud(tjanst)).rejects.toMatchObject({ kod: "platser-slut" });
    expect((await kalla.list("gastinbjudningar")).find((r) => r.id === forsta.id).aterkallad).not.toBeNull();
  });

  it("skickaOm på en återkallad inbjudan ger aterkallad, och på en aktiv roterar nyckeln och räknar utskicket", async () => {
    const { tjanst, brev, kalla } = bygg();
    const { id } = await bjud(tjanst);
    await tjanst.skickaOm({ uid: ADMIN, id });
    expect(brev).toHaveLength(2);
    expect(brev[1]).toMatchObject({ typ: "igen", skickadAv: { uid: ADMIN } });
    expect((await kalla.list("gastinbjudningar"))[0].antalSkickade).toBe(2);
    await tjanst.aterkalla({ uid: SKAPARE, id });
    await expect(tjanst.skickaOm({ uid: SKAPARE, id })).rejects.toMatchObject({ kod: "aterkallad" });
    await expect(tjanst.skickaOm({ uid: MEDLEM, id })).rejects.toMatchObject({ kod: "ej-behorig" });
  });

  it("ett nytt utskick lagar en plats som en samtidig återkallelse tömde", async () => {
    const { tjanst, kalla } = bygg();
    const { id } = await bjud(tjanst);
    await bjud(tjanst, { handelseId: "h2" });
    // Platsen försvinner under fötterna på en aktiv inbjudan (en återkallelse som korsade ett utskick).
    for (const p of await platserRader(kalla)) await kalla.remove("gastplatser", p.id);
    await tjanst.skickaOm({ uid: SKAPARE, id });
    expect(await platserRader(kalla)).toHaveLength(1);
  });
});

describe("nyLank: samma svar hur det än går", () => {
  it("svaret är byte för byte detsamma för en känd adress, en okänd, en ogiltig och en som är spärrad av tak", async () => {
    const { tjanst, brev } = bygg();
    await bjud(tjanst);
    brev.length = 0;
    const svar = [
      await tjanst.nyLank({ epost: "anna@foretag.se", ip: "198.51.100.1" }),
      await tjanst.nyLank({ epost: "okand@foretag.se", ip: "198.51.100.2" }),
      await tjanst.nyLank({ epost: "inte-en-adress", ip: "198.51.100.3" }),
      await tjanst.nyLank({ epost: undefined, ip: "198.51.100.4" }),
    ];
    for (let i = 0; i < GASTNYLANK_BREV_PER_DYGN + 2; i++) svar.push(await tjanst.nyLank({ epost: "anna@foretag.se", ip: `198.51.100.${10 + i}` }));
    expect(svar.length).toBeGreaterThanOrEqual(9);
    for (const s of svar) expect(JSON.stringify(s)).toBe(JSON.stringify({ ok: true, svar: GASTNYLANK_SVAR }));
  });

  it("bara en adress med en aktiv inbjudan får ett brev, och bara tre brev per dygn", async () => {
    const { tjanst, brev, tid } = bygg();
    await bjud(tjanst);
    brev.length = 0;
    await tjanst.nyLank({ epost: "okand@foretag.se", ip: "198.51.100.1" });
    await tjanst.nyLank({ epost: "inte-en-adress", ip: "198.51.100.2" });
    expect(brev).toHaveLength(0);
    for (let i = 0; i < GASTNYLANK_BREV_PER_DYGN + 3; i++) await tjanst.nyLank({ epost: "anna@foretag.se", ip: `198.51.100.${10 + i}` });
    expect(brev).toHaveLength(GASTNYLANK_BREV_PER_DYGN);
    expect(brev[0]).toMatchObject({ typ: "ny-lank", till: "anna@foretag.se", skickadAv: null });
    tid(NU + DYGN + 1000);
    await tjanst.nyLank({ epost: "anna@foretag.se", ip: "198.51.100.99" });
    expect(brev).toHaveLength(GASTNYLANK_BREV_PER_DYGN + 1);
  });

  it("nyckeln roteras: den gamla länken slutar fungera och den nya fungerar", async () => {
    const { tjanst, brev } = bygg();
    await bjud(tjanst);
    const gammal = senasteLank(brev);
    await tjanst.nyLank({ epost: "anna@foretag.se", ip: IP });
    const ny = brev[brev.length - 1].lankar[0];
    expect(ny.id).toBe(gammal.id);
    expect(ny.nyckel).not.toBe(gammal.nyckel);
    expect((await tjanst.los({ ...gammal, epost: "anna@foretag.se", ip: IP })).orsak).toBe("nej");
    expect((await tjanst.los({ ...ny, epost: "anna@foretag.se", ip: IP })).ok).toBe(true);
  });

  it("högst fem länkar i ett brev, de nyaste, bara de aktiva, och en plats för alla sju inbjudningarna", async () => {
    const { tjanst, brev, kalla, tid } = bygg();
    const ider = [];
    for (let n = 0; n < 7; n++) {
      tid(NU + n * 1000);
      ider.push((await tjanst.bjud({ uid: SKAPARE, handelseId: `hx${n}`, epost: "anna@foretag.se" })).id);
    }
    expect(await platserRader(kalla)).toHaveLength(1);
    await tjanst.aterkalla({ uid: SKAPARE, id: ider[6] });
    brev.length = 0;
    await tjanst.nyLank({ epost: "anna@foretag.se", ip: IP });
    expect(brev).toHaveLength(1);
    expect(brev[0].lankar).toHaveLength(GASTNYLANK_MAX_LANKAR);
    // De fem nyaste aktiva: hx5 ned till hx1. hx6 är återkallad och hx0 är för gammal.
    expect(brev[0].lankar.map((l) => l.omfang.handelseId)).toEqual(["hx5", "hx4", "hx3", "hx2", "hx1"]);
  });

  it("ett brev som inte går rapporteras men syns inte i svaret", async () => {
    const { tjanst, rapportera, skicka } = bygg();
    await bjud(tjanst);
    skicka.mockRejectedValueOnce(new Error("smtp nere"));
    const svar = await tjanst.nyLank({ epost: "anna@foretag.se", ip: IP });
    expect(svar).toEqual({ ok: true, svar: GASTNYLANK_SVAR });
    expect(rapportera).toHaveBeenCalledTimes(1);
  });

  it("räknaren per IP: elva förfrågningar på en timme från samma IP skickar inga fler brev", async () => {
    const { tjanst, brev, tid } = bygg();
    for (let n = 0; n < 5; n++) await bjud(tjanst, { epost: epostN(n) });
    brev.length = 0;
    for (let n = 0; n < 11; n++) await tjanst.nyLank({ epost: epostN(n % 5), ip: IP });
    expect(brev).toHaveLength(10);
    tid(NU + 61 * 60 * 1000);
    await tjanst.nyLank({ epost: epostN(0), ip: IP });
    expect(brev).toHaveLength(11);
  });
});

describe("lista och platser", () => {
  it("en medlem får gästerna på händelsen med bara listfälten, härledd status, och serverns platssiffra", async () => {
    const { tjanst, brev } = bygg();
    await bjud(tjanst);
    await bjud(tjanst, { epost: "bo@foretag.se", namn: "Bo" });
    await bjud(tjanst, { epost: "cia@foretag.se", handelseId: "h2" });
    await tjanst.los({ ...senasteLank(brev), epost: "cia@foretag.se", ip: IP });
    const svar = await tjanst.lista({ uid: MEDLEM, handelseId: "h1", harRostat: [gastId("bo@foretag.se")] });
    expect(svar.platser).toEqual({ anvanda: 3, totalt: GAST_PLATSER_GRATIS, lediga: GAST_PLATSER_GRATIS - 3 });
    expect(svar.gaster.map((g) => g.epost)).toEqual(["anna@foretag.se", "bo@foretag.se"]);
    expect(svar.gaster.map((g) => g.status)).toEqual(["vantar", "har-rostat"]);
    for (const g of svar.gaster) {
      expect(Object.keys(g).sort()).toEqual([...GASTLISTFALT].sort());
      expect(JSON.stringify(g)).not.toMatch(/nyckelHash|felAntal|felFonster/);
    }
  });

  it("en utomstående, en agent och en före detta medlem får ingen lista och inga platssiffror", async () => {
    const { tjanst } = bygg();
    await bjud(tjanst);
    for (const uid of [UTANFOR, AGENT, FRAMLING, "uid-okand"]) {
      await expect(tjanst.lista({ uid, handelseId: "h1" }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
      await expect(tjanst.platser({ uid, groupId: GRUPP }), uid).rejects.toMatchObject({ kod: "ej-behorig" });
    }
    await expect(tjanst.lista({ uid: MEDLEM, handelseId: "h-arkiv" })).rejects.toMatchObject({ kod: "finns-inte" });
  });

  it("en gäst som aldrig loggat in och vars länk gått ut är utgången, och en återkallad syns som återkallad", async () => {
    const { tjanst, tid } = bygg();
    const a = await bjud(tjanst);
    await bjud(tjanst, { epost: "bo@foretag.se" });
    await tjanst.aterkalla({ uid: SKAPARE, id: a.id });
    tid(NU + (GASTLANKDAGAR + 1) * DYGN);
    const svar = await tjanst.lista({ uid: ADMIN, handelseId: "h1" });
    expect(svar.gaster.map((g) => g.status)).toEqual(["aterkallad", "utgangen"]);
  });
});

describe("stadaSessioner", () => {
  it("raderar sessioner som stått oanvända längre än 90 dagar och lämnar de andra", async () => {
    const { tjanst, brev, kalla, tid } = bygg();
    await bjud(tjanst);
    await lasUpp(tjanst, brev);
    tid(NU + 20 * DYGN);
    await lasUpp(tjanst, brev);
    expect(await kalla.list("gastsessioner")).toHaveLength(2);
    tid(NU + 100 * DYGN);
    expect(await tjanst.stadaSessioner()).toEqual({ raderade: 1 });
    expect(await kalla.list("gastsessioner")).toHaveLength(1);
    expect(await tjanst.stadaSessioner()).toEqual({ raderade: 0 });
  });
});
