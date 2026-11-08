import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import {
  GASTFEL_MAX,
  GASTIP_MAX,
  GASTLISTFALT,
  GASTPERSONFALT,
  GAST_PLATSER_GRATIS,
  gastId,
  gastLank,
  gastkontaktnyckel,
  normaliseraGastkontakt,
  normaliseraGasttelefon,
  tolkaGastLank,
} from "../lib/gast.js";
import { medlemskapsId } from "../lib/grupp.js";
import { byggGastinbjudan, createGastService, gastInbjudningsId, nyGastnyckel } from "../node/gast.js";

/**
 * Gäst med telefonnummer (0.197.0, cllp/lifehub.app#661): bjud in med ett nummer, inget brev, länken delas från den egna telefonen, och gästen skriver sitt nummer.
 *
 * ⛔ DET VIKTIGASTE PROVET ÄR LÅSET ÖVERST. Det använder bara det som fanns före 0.197.0 och är därför grönt mot den tidigare koden OCH mot den nya; det blir rött när en e-postgästs id räknas på något
 * annat sätt (provat med muterad kod, se rapporten). En gäst som redan bjudits in med e-post ska fungera exakt som före ändringen: id, gastId, inbjudans id och raden räknas ur samma indata till SHA-256.
 * Värdena nedan räknades med koden FÖRE 0.197.0 (`node` mot `src/lib/gast.js` och `src/node/gast.js` på commit b2cc622) och står här som konstanter, inte som ett anrop till samma kod.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (arbetsreglerna, punkt 4): utfallen med koden muterad står i leveransens rapport.
 */

const NU = 1_800_000_000_000;
const GRUPP = "kallan";
const AGARE = "uid-agare-x91";
const MEDLEM = "uid-medlem-x92";
const IP = "203.0.113.7";
const sha = (/** @type {string} */ t) => createHash("sha256").update(t).digest("hex");

// ── Låset: räknat med koden före 0.197.0 ──
const LAST = {
  gastAnna: "g_381166a00a1d5c8c6e701a5b2d66f7c6ed826902",
  gastBo: "g_ad802ed1b451340b191fd97ae74cf3f44d9563ef",
  idGrupp: "09dfc2a94a6b557c2a7b53b25fdb29dd9432d525b8ae9c8c841170070d6a5e22",
  idRosta: "7a634d83b3cac8eaf7e97a574769f642258cc45fc7006a92661e16104176510e",
  idDelta: "c4521952c2060ad9b67d28afe3d82dbdf99feffd57c31a7cbb5c1679b99e90a4",
  lank: `https://my.life-hub.app/guest#i=${"a".repeat(64)}&k=${"B".repeat(43)}`,
};
/** En rad som `bjud` skrev före 0.197.0, byte för byte, och nyckeln i dess brev. */
const GAMMAL_NYCKEL = "Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3";
const GAMMAL_RAD = {
  id: "09dfc2a94a6b557c2a7b53b25fdb29dd9432d525b8ae9c8c841170070d6a5e22",
  groupId: "kallan",
  epost: "anna@foretag.se",
  namn: "Anna",
  omfang: { slag: "grupp" },
  skapadAv: { uid: "uid-agare-x91", namn: "Agda" },
  skapad: 1800000000000,
  skickad: 1800000000000,
  antalSkickade: 1,
  lankGiltigTill: 1802592000000,
  nyckelHash: "0b69c8e779ddc2e46662d7c41b6ac4b9fdaa9b66d7c6ac9e129fc3515ec729ab",
  forstInloggad: null,
  aterkallad: null,
  felAntal: 0,
  felFonster: 0,
};

const medlemskap = (uid, roll) => ({ id: medlemskapsId(uid, GRUPP), userId: uid, groupId: GRUPP, roll, typ: "person", status: "aktiv", namn: `Namn ${uid}` });

/**
 * Tjänsten med hela gruppen, radering och ett länkvalv (en karta id till nyckel), som appen har den.
 * @param {{ valv?: boolean, extra?: Record<string, any[]> }} [val]
 */
function bygg({ valv = true, extra = {} } = {}) {
  const grund = createMemorySource({
    memberships: [medlemskap(AGARE, "agare"), medlemskap(MEDLEM, "medlem")],
    groups: [{ id: GRUPP, namn: "Källan" }],
    handelser: [{ id: "h-mote", groupId: GRUPP, rubrik: "Möte", datum: "2026-11-02", skapadAv: { uid: AGARE } }],
    gastinbjudningar: [],
    gastsessioner: [],
    gastplatser: [],
    gastraknare: [],
    ...extra,
  });
  /** @type {any[]} */
  const brev = [];
  /** @type {Map<string, string>} */
  const kopior = new Map();
  const lankvalv = {
    spara: vi.fn(async ({ id, nyckel }) => {
      kopior.set(id, nyckel);
    }),
    hamta: vi.fn(async ({ id }) => kopior.get(id) ?? null),
    radera: vi.fn(async ({ id }) => {
      kopior.delete(id);
    }),
  };
  const spar = vi.fn(async () => {});
  let nu = NU;
  const tjanst = createGastService({
    kalla: grund,
    samlingar: { inbjudningar: "gastinbjudningar", sessioner: "gastsessioner", platser: "gastplatser", raknare: "gastraknare", handelser: "handelser" },
    farBjuda: ({ uid, handelse }) => handelse.skapadAv?.uid === uid,
    skicka: vi.fn(async (b) => {
      brev.push(b);
    }),
    rapportera: vi.fn(),
    klocka: () => nu,
    grupp: {
      samlingar: { grupper: "groups", samtal: "samtal", meddelanden: "meddelanden", bibliotek: "bibliotek", svar: "svar" },
      lagring: { signeradAdress: async () => "https://lagring.example/x" },
      handelseSida: (h) => ({ titel: h.rubrik }),
    },
    radering: { spar },
    ...(valv ? { lankvalv } : {}),
  });
  return { grund, tjanst, brev, kopior, lankvalv, spar, tid: (/** @type {number} */ t) => { nu = t; } };
}

/** Bjuder in ett nummer till hela gruppen och hämtar länken ur valvet, som vyn gör. */
async function telefonGast(h, telefon = "070-123 45 67", namn = "") {
  const svar = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon, namn });
  const lank = await h.tjanst.kopieraLank({ uid: AGARE, id: svar.id });
  return { svar, lank };
}

describe("låset: en gäst med e-post räknas exakt som före 0.197.0", () => {
  it("gastId, inbjudans id (grupp, omröstning, delta) och e-postlänken är byte för byte de förra värdena", () => {
    expect(gastId("anna@foretag.se")).toBe(LAST.gastAnna);
    expect(gastId(" Anna@Foretag.SE ")).toBe(LAST.gastAnna);
    expect(gastId("bo.ek@exempel.org")).toBe(LAST.gastBo);
    expect(gastInbjudningsId({ groupId: GRUPP, epost: "anna@foretag.se", omfang: { slag: "grupp" } })).toBe(LAST.idGrupp);
    expect(gastInbjudningsId({ groupId: GRUPP, epost: "anna@foretag.se", omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" } })).toBe(LAST.idRosta);
    expect(gastInbjudningsId({ groupId: GRUPP, epost: "Bo.Ek@exempel.org", omfang: { slag: "sak", funktion: "delta", handelseId: "h-mote" } })).toBe(LAST.idDelta);
    expect(gastLank("https://my.life-hub.app", { id: "a".repeat(64), nyckel: "B".repeat(43) })).toBe(LAST.lank);
    expect(tolkaGastLank(`#i=${"a".repeat(64)}&k=${"B".repeat(43)}`)).toEqual({ id: "a".repeat(64), nyckel: "B".repeat(43) });
  });

  it("en ny e-postrad har exakt den förra radens fält och värden (ingen telefon på raden)", () => {
    const rad = byggGastinbjudan({ groupId: GRUPP, epost: "Anna@Foretag.se", namn: "Anna", omfang: { slag: "grupp" }, skapadAv: { uid: AGARE, namn: "Agda" }, skapad: NU, nyckel: GAMMAL_NYCKEL });
    // (0.203.0, lifehub.app#691) En gruppinbjudan bär sedan dess `laddaNed`, förvalt `false`, och inget annat har ändrats. En rad från före 0.203.0 saknar fältet och följer gruppen.
    expect(rad).toEqual({ ...GAMMAL_RAD, laddaNed: false });
    expect(Object.keys(rad)).toEqual([...Object.keys(GAMMAL_RAD), "laddaNed"]);
  });

  it("en rad som skrevs före 0.197.0 löses in med sin nyckel (sedan 0.200.0 utan adress), ger samma gäst och samma session, och återkallas och raderas som förut", async () => {
    const h = bygg({ extra: { gastinbjudningar: [{ ...GAMMAL_RAD }], gastplatser: [{ id: `${GRUPP}|1`, gastId: LAST.gastAnna, skapad: NU }] } });
    const inl = await h.tjanst.los({ id: GAMMAL_RAD.id, nyckel: GAMMAL_NYCKEL, ip: IP });
    expect(inl.ok).toBe(true);
    const s = await h.tjanst.session({ sessionsnyckel: inl.sessionsnyckel });
    expect(s).toMatchObject({ ok: true, gastId: LAST.gastAnna, inbjudan: { id: LAST.idGrupp, slag: "grupp" } });
    // Fel nyckel är ett nej.
    expect(await h.tjanst.los({ id: GAMMAL_RAD.id, nyckel: nyGastnyckel(), ip: IP })).toEqual({ ok: false, orsak: "nej" });
    // Listan visar samma gäst med adressen.
    const { personer } = await h.tjanst.lista({ uid: AGARE, groupId: GRUPP });
    expect(personer).toEqual([expect.objectContaining({ gastId: LAST.gastAnna, epost: "anna@foretag.se" })]);
    // Återkallelsen släpper platsen som förut.
    await expect(h.tjanst.aterkalla({ uid: AGARE, id: GAMMAL_RAD.id })).resolves.toEqual({ id: GAMMAL_RAD.id, platsSlappt: true });
    // Raderingen får exakt det appens `spar` fick förut.
    await h.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: LAST.gastAnna });
    expect(h.spar).toHaveBeenCalledWith({ epost: "anna@foretag.se", gastId: LAST.gastAnna, grupper: [GRUPP], alla: true });
    expect(await h.grund.list("gastinbjudningar")).toEqual([]);
  });
});

describe("normaliseraGasttelefon", () => {
  it("svenska nummer blir E.164: 07x, +46, 0046, mellanslag, bindestreck, parenteser och +46 (0)", () => {
    for (const [in_, ut] of [
      ["0701234567", "+46701234567"],
      ["070-123 45 67", "+46701234567"],
      [" 070 123 45 67 ", "+46701234567"],
      ["+46 70 123 45 67", "+46701234567"],
      ["+46701234567", "+46701234567"],
      ["0046 70 123 45 67", "+46701234567"],
      ["+46 (0)70 123 45 67", "+46701234567"],
      ["+46 070-123 45 67", "+46701234567"],
      ["08-123 456 78", "+46812345678"],
      ["(08) 12 34 56", "+468123456"],
      ["0498 123 45", "+4649812345"],
      ["070\u2013123 45 67", "+46701234567"],
    ]) {
      expect(normaliseraGasttelefon(in_), in_).toBe(ut);
    }
  });

  it("utländska nummer med + eller 00 behålls i E.164", () => {
    expect(normaliseraGasttelefon("+47 912 34 567")).toBe("+4791234567");
    expect(normaliseraGasttelefon("+1 (415) 555-0132")).toBe("+14155550132");
    expect(normaliseraGasttelefon("0044 20 7946 0958")).toBe("+442079460958");
    expect(normaliseraGasttelefon("+358 40 1234567")).toBe("+358401234567");
  });

  it("felaktiga nummer nekas: för korta, för långa, bokstäver, utan land, och allt som inte är en text", () => {
    for (const fel of ["", "   ", "070", "070 12", "+46 70 12", "+46 70 123 45 67 89", "+1 234", "+12345678901234567", "070-ABC 45 67", "0701234567x", "701234567", "46701234567", "+0 70 123", "++46701234567", "070.123.45.67", "+46 0", "a".repeat(10), "0".repeat(41)]) {
      expect(normaliseraGasttelefon(fel), JSON.stringify(fel)).toBeNull();
    }
    for (const fel of [null, undefined, 701234567, {}, ["0701234567"]]) expect(normaliseraGasttelefon(fel)).toBeNull();
  });

  it("kontakten: ett nummer hashas som tel:<nummer> och kan aldrig bli samma nyckel eller gäst som en adress", () => {
    const k = normaliseraGastkontakt({ slag: "telefon", varde: "070-123 45 67" });
    expect(k).toEqual({ slag: "telefon", varde: "+46701234567" });
    expect(gastkontaktnyckel(/** @type {any} */ (k))).toBe("tel:+46701234567");
    expect(gastId(/** @type {any} */ (k))).toBe(`g_${sha("tel:+46701234567").slice(0, 40)}`);
    expect(gastId({ slag: "telefon", varde: "+46 70 123 45 67" })).toBe(gastId(/** @type {any} */ (k)));
    // En e-postkontakt som objekt är samma gäst som adressen ensam, och ett nummer släpper inte in en inbjudan till en adress (provet nedan).
    expect(gastId({ slag: "epost", varde: "Anna@Foretag.se" })).toBe(LAST.gastAnna);
    expect(gastkontaktnyckel({ slag: "epost", varde: "anna@foretag.se" })).toBe("anna@foretag.se");
    expect(normaliseraGastkontakt({ slag: "fax", varde: "0701234567" })).toBeNull();
    expect(normaliseraGastkontakt({ slag: "telefon", varde: "anna@foretag.se" })).toBeNull();
    expect(() => gastId({ slag: "telefon", varde: "nej" })).toThrow();
  });
});

describe("länken: tecknet för telefon", () => {
  it("gastLank med slag telefon bär &s=tel, och tolkaGastLank läser tillbaka det; ett okänt tecken är ingen länk", () => {
    const id = "c".repeat(64);
    const nyckel = "D".repeat(43);
    const url = gastLank("https://my.life-hub.app", { id, nyckel, slag: "telefon" });
    expect(url).toBe(`https://my.life-hub.app/guest#i=${id}&k=${nyckel}&s=tel`);
    expect(tolkaGastLank(new URL(url).hash)).toEqual({ id, nyckel, slag: "telefon" });
    expect(gastLank("https://my.life-hub.app", { id, nyckel, slag: "epost" })).toBe(`https://my.life-hub.app/guest#i=${id}&k=${nyckel}`);
    expect(tolkaGastLank(`#i=${id}&k=${nyckel}&s=sms`)).toBeNull();
    expect(() => gastLank("https://my.life-hub.app", { id, nyckel, slag: /** @type {any} */ ("sms") })).toThrow(/slag/);
  });
});

describe("bjud med telefon", () => {
  it("skickar inget brev, sparar nyckeln i valvet, raden bär telefon och inte epost, och id:t är hashen av (grupp, tel:<nummer>, grupp)", async () => {
    const h = bygg();
    const svar = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: "070-123 45 67", namn: "Tove" });
    expect(h.brev).toHaveLength(0);
    expect(svar).toEqual({ id: sha(JSON.stringify([GRUPP, "tel:+46701234567", "grupp"])), gastId: gastId({ slag: "telefon", varde: "+46701234567" }), ny: true, vackt: false, slag: "telefon" });
    const [rad] = await h.grund.list("gastinbjudningar");
    expect(rad.telefon).toBe("+46701234567");
    expect("epost" in rad).toBe(false);
    expect(h.kopior.has(svar.id)).toBe(true);
    // Länken ur valvet bär slaget, och den nyckeln löser in med numret i vilken skrivning som helst.
    const lank = await h.tjanst.kopieraLank({ uid: AGARE, id: svar.id });
    expect(lank.slag).toBe("telefon");
    const inl = await h.tjanst.los({ id: svar.id, nyckel: lank.nyckel, telefon: "+46 70 123 45 67", ip: IP });
    expect(inl.ok).toBe(true);
    const s = await h.tjanst.session({ sessionsnyckel: inl.sessionsnyckel });
    expect(s).toMatchObject({ ok: true, gastId: svar.gastId, inbjudan: { id: svar.id, slag: "grupp", namn: "Tove" } });
  });

  it("utan valv svarar den ej-konfigurerad innan något skrivs: ingen inbjudan och ingen plats", async () => {
    const h = bygg({ valv: false });
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: "0701234567" })).rejects.toMatchObject({ kod: "ej-konfigurerad" });
    expect(await h.grund.list("gastinbjudningar")).toEqual([]);
    expect(await h.grund.list("gastplatser")).toEqual([]);
    expect(h.brev).toHaveLength(0);
  });

  it("ett felaktigt nummer, både adress och nummer, och ett nummer till en sak nekas innan något skrivs", async () => {
    const h = bygg();
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: "070-12" })).rejects.toMatchObject({ kod: "ogiltig-telefon" });
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: "0701234567", epost: "anna@foretag.se" })).rejects.toMatchObject({ kod: "ogiltig-telefon" });
    await expect(h.tjanst.bjud({ uid: AGARE, handelseId: "h-mote", telefon: "0701234567" })).rejects.toMatchObject({ kod: "ogiltigt-omfang" });
    await expect(h.tjanst.bjud({ uid: MEDLEM, slag: "grupp", groupId: GRUPP, telefon: "0701234567" })).rejects.toMatchObject({ kod: "ej-behorig" });
    expect(await h.grund.list("gastinbjudningar")).toEqual([]);
    expect(await h.grund.list("gastplatser")).toEqual([]);
  });

  it("samma nummer i en annan skrivning är samma inbjudan (ett nytt utskick, ingen ny plats)", async () => {
    const h = bygg();
    const a = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: "0701234567" });
    const b = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: "+46 70 123 45 67" });
    expect(b).toMatchObject({ id: a.id, ny: false });
    expect(await h.grund.list("gastinbjudningar")).toHaveLength(1);
    expect(await h.grund.list("gastplatser")).toHaveLength(1);
  });
});

describe("los för en telefoninbjudan: nyckeln räcker och kontakten läses inte (0.200.0, cllp/ops-framework#540)", () => {
  it("bara id och nyckel loggar in; ett skickat nummer, fel nummer eller en adress ändrar ingenting, och fel nyckel är nej", async () => {
    const h = bygg();
    const { svar, lank } = await telefonGast(h);
    const epostSvar = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se" });
    const epostLank = h.brev[h.brev.length - 1].lankar[0];
    for (const extra of [{}, { telefon: "0701234567" }, { telefon: "0701234568" }, { epost: "anna@foretag.se" }]) {
      expect((await h.tjanst.los({ id: svar.id, nyckel: lank.nyckel, ip: IP, ...extra })).ok, JSON.stringify(extra)).toBe(true);
    }
    // En e-postinbjudan med ett nummer: nyckeln är beviset, inte kontakten.
    expect((await h.tjanst.los({ id: epostSvar.id, nyckel: epostLank.nyckel, telefon: "0701234567", ip: IP })).ok).toBe(true);
    // Fel nyckel (en annan inbjudans) är nej, med rätt nummer också.
    expect(await h.tjanst.los({ id: svar.id, nyckel: epostLank.nyckel, telefon: "0701234567", ip: IP })).toEqual({ ok: false, orsak: "nej" });
  });

  it("fel nyckel räknas per inbjudan: efter GASTFEL_MAX fel är också rätt nyckel for-manga", async () => {
    const h = bygg();
    const { svar, lank } = await telefonGast(h);
    for (let i = 0; i < GASTFEL_MAX; i++) {
      expect(await h.tjanst.los({ id: svar.id, nyckel: nyGastnyckel(), ip: `198.51.100.${i}` })).toEqual({ ok: false, orsak: "nej" });
    }
    expect(await h.tjanst.los({ id: svar.id, nyckel: lank.nyckel, ip: "198.51.100.99" })).toEqual({ ok: false, orsak: "for-manga" });
  });

  it("nyLank med en telefonlänk skickar inget brev och byter inte nyckeln, och svaret är detsamma som för en e-postlänk som får brev", async () => {
    const h = bygg();
    const { svar, lank } = await telefonGast(h);
    const epostSvar = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "anna@foretag.se" });
    const epostLank = h.brev[h.brev.length - 1].lankar[0];
    h.brev.length = 0;
    const telefonsvar = await h.tjanst.nyLank({ id: svar.id, nyckel: lank.nyckel, ip: "198.51.100.1" });
    expect(h.brev).toHaveLength(0);
    expect((await h.tjanst.kopieraLank({ uid: AGARE, id: svar.id })).nyckel).toBe(lank.nyckel);
    const epostsvar = await h.tjanst.nyLank({ id: epostSvar.id, nyckel: epostLank.nyckel, ip: "198.51.100.2" });
    expect(h.brev).toHaveLength(1);
    expect(h.brev[0].till).toBe("anna@foretag.se");
    expect(JSON.stringify(telefonsvar)).toBe(JSON.stringify(epostsvar));
  });

  it("räknaren per IP gäller ett nummer som en adress: efter GASTIP_MAX försök från samma IP är svaret for-manga", async () => {
    const h = bygg();
    const { svar, lank } = await telefonGast(h);
    for (let i = 0; i < GASTIP_MAX; i++) await h.tjanst.los({ id: "0".repeat(64), nyckel: lank.nyckel, telefon: "0701234567", ip: IP });
    expect(await h.tjanst.los({ id: svar.id, nyckel: lank.nyckel, telefon: "0701234567", ip: IP })).toEqual({ ok: false, orsak: "for-manga" });
  });
});

describe("platserna, listan, ny länk och raderingen gäller telefongästen", () => {
  it("platstaket räknar telefongäster, och en adress och ett nummer för samma person tar två platser", async () => {
    const h = bygg();
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "tove@foretag.se", namn: "Tove" });
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: "0701234567", namn: "Tove" });
    expect(await h.grund.list("gastplatser")).toHaveLength(2);
    for (let n = 2; n < GAST_PLATSER_GRATIS; n++) await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: `070123456${n}` });
    await expect(h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: "0709999999" })).rejects.toMatchObject({ kod: "platser-slut" });
    expect(await h.tjanst.platser({ uid: AGARE, groupId: GRUPP })).toMatchObject({ anvanda: GAST_PLATSER_GRATIS, lediga: 0 });
  });

  it("listan har en rad per kontakt: telefongästen med numret och epost null, e-postgästen med telefon null, och bara de vitlistade fälten", async () => {
    const h = bygg();
    const t = await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, telefon: "0701234567", namn: "Tove" });
    await h.tjanst.bjud({ uid: AGARE, slag: "grupp", groupId: GRUPP, epost: "bo@foretag.se" });
    const { personer } = await h.tjanst.lista({ uid: AGARE, groupId: GRUPP });
    expect(personer).toHaveLength(2);
    const tove = personer.find((p) => p.gastId === t.gastId);
    expect(tove).toMatchObject({ telefon: "+46701234567", epost: null, namn: "Tove" });
    expect(personer.find((p) => p.gastId !== t.gastId)).toMatchObject({ epost: "bo@foretag.se", telefon: null });
    for (const p of personer) expect(Object.keys(p).sort()).toEqual([...GASTPERSONFALT].sort());
    expect(GASTLISTFALT).toContain("telefon");
  });

  it("Skicka igen för en telefongäst byter nyckel utan brev: den gamla länken slutar fungera och kopieraLank ger den nya", async () => {
    const h = bygg();
    const { svar, lank } = await telefonGast(h);
    await expect(h.tjanst.skickaOm({ uid: AGARE, id: svar.id })).resolves.toEqual({ id: svar.id, slag: "telefon" });
    expect(h.brev).toHaveLength(0);
    const ny = await h.tjanst.kopieraLank({ uid: AGARE, id: svar.id });
    expect(ny.nyckel).not.toBe(lank.nyckel);
    expect(await h.tjanst.los({ id: svar.id, nyckel: lank.nyckel, telefon: "0701234567", ip: IP })).toEqual({ ok: false, orsak: "nej" });
    expect((await h.tjanst.los({ id: svar.id, nyckel: ny.nyckel, telefon: "0701234567", ip: IP })).ok).toBe(true);
  });

  it("raderingen tar telefongästen: inbjudan, sessionen, valvets kopia och platsen, och appens spar får numret", async () => {
    const h = bygg();
    const { svar, lank } = await telefonGast(h);
    await h.tjanst.los({ id: svar.id, nyckel: lank.nyckel, telefon: "0701234567", ip: IP });
    const ut = await h.tjanst.radera({ uid: AGARE, groupId: GRUPP, gastId: svar.gastId });
    expect(ut).toMatchObject({ inbjudningar: 1, sessioner: 1, platserSlappta: 1 });
    expect(h.spar).toHaveBeenCalledWith({ epost: null, telefon: "+46701234567", gastId: svar.gastId, grupper: [GRUPP], alla: true });
    expect(await h.grund.list("gastinbjudningar")).toEqual([]);
    expect(await h.grund.list("gastsessioner")).toEqual([]);
    expect(await h.grund.list("gastplatser")).toEqual([]);
    expect(h.kopior.size).toBe(0);
  });

  it("gästen raderar sig själv med sin session (raderaMig), och återkallelsen släpper platsen", async () => {
    const h = bygg();
    const { svar, lank } = await telefonGast(h);
    const inl = await h.tjanst.los({ id: svar.id, nyckel: lank.nyckel, telefon: "0701234567", ip: IP });
    await expect(h.tjanst.raderaMig({ sessionsnyckel: inl.sessionsnyckel })).resolves.toEqual({ ok: true });
    expect(await h.grund.list("gastinbjudningar")).toEqual([]);
    expect(await h.grund.list("gastplatser")).toEqual([]);
    const andra = await telefonGast(h, "0707654321");
    await expect(h.tjanst.aterkalla({ uid: AGARE, id: andra.svar.id })).resolves.toEqual({ id: andra.svar.id, platsSlappt: true });
  });
});
