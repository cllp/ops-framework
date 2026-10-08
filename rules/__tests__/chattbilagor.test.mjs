/**
 * Regelprov för bilaga på ett meddelande (0.77.0, #292, filen i eget dokument 0.80.0, #300) och tysta notiser (#301),
 * mot Firestore-emulatorn.
 *
 * Reglerna skrivs av `scripts/skriv-provregler.mjs` med `bilagor: true`, `bilagaSamling: "bilagor"` och `tyst: "tyst"`. Utan
 * nycklarna är fälten inte tillåtna alls, och det mäts byte för byte i `src/__tests__/chatt-bilagor.test.jsx` mot fixturen.
 *
 * ⛔ VARJE NEKANDE PROV HAR ETT GILTIGT MEDDELANDE I SAMMA BATCH (granskningen av PR 307). Filen är bunden till sitt meddelande.
 * Ett prov som skrev en för stor fil utan meddelande hade nekats av bindningen, och då hade det varit grönt även om taket
 * försvann. Mutationstabellen står i PR 307: ett villkor i taget togs bort ur regeln, och varje gång blev något prov rött.
 *
 * Kör: npm run test:rules
 */

import { medlemskapsId } from "../../src/lib/grupp.js";
import { MAX_KOMMENTARBILAGA } from "../../src/lib/handelsemodell.js";
import { samtalsnyckel } from "../../src/lib/samtal.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, deleteDoc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const G = "bilaga-ab";
const ANNAN = "bilaga-annan";
const ANNA = "uid-bilaga-anna";
const BO = "uid-bilaga-bo";
const FRAMLING = "uid-bilaga-framling";
// I gruppen men inte i det privata samtalet mellan Anna och Bo.
const CARL = "uid-bilaga-carl";
// En agent i gruppen: får läsa gruppchatten, men en fil skickas bara av en person.
const AGENT = "uid-bilaga-agent";
// En person vars medlemskap inte är aktivt.
const INAKTIV = "uid-bilaga-inaktiv";
const nu = () => Date.now();
const SADD_TID = Date.now();
const sid = samtalsnyckel({ groupId: G, slag: "personer", deltagare: [ANNA, BO] });
const grupp = samtalsnyckel({ groupId: G, slag: "grupp" });

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let miljo;

before(async () => {
  const regler = path.join(rot, "rules", "provregler.rules");
  if (!fs.existsSync(regler)) throw new Error("rules/provregler.rules saknas. Kör npm run test:rules.");
  miljo = await initializeTestEnvironment({
    projectId: "regelprov-chattbilaga",
    firestore: { rules: fs.readFileSync(regler, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  // Tom databas före sådden, så att en andra körning i samma emulator (mutationskörningen i PR 307) inte möter förra körningens filer.
  await miljo.clearFirestore();
  await miljo.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const medlem = (/** @type {string} */ uid, /** @type {string} */ gid) =>
      setDoc(doc(db, `memberships/${medlemskapsId(uid, gid)}`), { userId: uid, groupId: gid, roll: "medlem", typ: "person", status: "aktiv" });
    await medlem(ANNA, G);
    await medlem(BO, G);
    await medlem(CARL, G);
    await medlem(FRAMLING, ANNAN);
    await setDoc(doc(db, `memberships/${medlemskapsId(AGENT, G)}`), { userId: AGENT, groupId: G, roll: "medlem", typ: "agent", status: "aktiv" });
    await setDoc(doc(db, `memberships/${medlemskapsId(INAKTIV, G)}`), { userId: INAKTIV, groupId: G, roll: "medlem", typ: "person", status: "inaktiv" });
    await setDoc(doc(db, `samtal/${sid}`), { groupId: G, slag: "personer", deltagare: [ANNA, BO].sort(), skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${grupp}`), { groupId: G, slag: "grupp", skapad: nu(), skapadAv: ANNA });
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/rot`), { text: "Roten", av: ANNA, tid: nu() });
    await setDoc(doc(db, `samtal/${grupp}/tradar/rot`), { skapad: nu(), skapadAv: ANNA });
    // Meddelanden som bara kan finnas om någon skrev förbi reglerna, eller skrev dem medan medlemskapet ännu gällde. De
    // låter proven mäta ETT villkor i taget: att meddelandet finns och är ens eget räcker inte för att lägga en fil på det.
    await setDoc(doc(db, `samtal/${sid}/meddelanden/carls`), { text: "", av: CARL, tid: SADD_TID, bilaga: { namn: "c.png", typ: "image/png" } });
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/agentens`), { text: "", av: AGENT, tid: SADD_TID, bilaga: { namn: "a.png", typ: "image/png" } });
    await setDoc(doc(db, `samtal/${grupp}/meddelanden/inaktivs`), { text: "", av: INAKTIV, tid: SADD_TID, bilaga: { namn: "i.png", typ: "image/png" } });
    await setDoc(doc(db, `samtal/${sid}/meddelanden/annas`), { text: "", av: ANNA, tid: SADD_TID, bilaga: { namn: "kvitto.png", typ: "image/png" } });
    await setDoc(doc(db, `samtal/${sid}/tyst/${CARL}`), { tyst: true });
  });
});

after(async () => {
  if (miljo) await miljo.cleanup();
});

/** @param {string} uid */
const som = (uid) => miljo.authenticatedContext(uid).firestore();
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const bild = (extra = {}) => ({ dataUrl: PNG, namn: "kvitto.png", typ: "image/png", tecken: PNG.length, ...extra });
/** @param {string} typ @param {number} n */
const pa = (typ, n) => {
  const huvud = `data:${typ};base64,`;
  return huvud + "A".repeat(n - huvud.length);
};
const meddelande = (/** @type {string} */ av, extra = {}) => ({ text: "Hej", av, tid: nu(), ...extra });
const marke = (/** @type {string} */ namn, /** @type {string} */ typ) => ({ namn, typ });

/**
 * Meddelandet och filen i samma batch, som källan skriver dem. `filnyckel` är meddelandets id, eller `<tråd>~<id>`.
 * @param {string} uid @param {string} vag meddelandets samling @param {string} mid @param {string} filvag @param {string} filnyckel
 * @param {{ text?: string, bilaga: Record<string, any>, marke?: Record<string, any>, filTid?: number }} d
 */
function batchMedFil(uid, vag, mid, filvag, filnyckel, d) {
  const db = som(uid);
  const tid = nu();
  const b = writeBatch(db);
  b.set(doc(db, `${vag}/${mid}`), { text: d.text ?? "", av: uid, tid, bilaga: d.marke ?? marke(d.bilaga.namn, d.bilaga.typ) });
  b.set(doc(db, `${filvag}/${filnyckel}`), { ...d.bilaga, tid: d.filTid ?? tid });
  return b.commit();
}

describe("bilaga på ett meddelande", () => {
  it("meddelandet bär märket och filen ligger i sitt dokument, också utan text och i en tråd", async () => {
    await assertSucceeds(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "bild", `samtal/${sid}/bilagor`, "bild", { bilaga: bild() }));
    const las = await assertSucceeds(getDoc(doc(som(BO), `samtal/${sid}/meddelanden/bild`)));
    assert.equal(las.data()?.bilaga?.namn, "kvitto.png");
    assert.equal(las.data()?.bilaga?.dataUrl, undefined);
    const fil = await assertSucceeds(getDoc(doc(som(BO), `samtal/${sid}/bilagor/bild`)));
    assert.equal(fil.data()?.dataUrl, PNG);
    assert.equal(fil.data()?.tid, las.data()?.tid);
    await assertSucceeds(batchMedFil(BO, `samtal/${grupp}/tradar/rot/meddelanden`, "svar", `samtal/${grupp}/bilagor`, "rot~svar", { text: "Se filen", bilaga: bild({ namn: "svar.png" }) }));
  });

  it("⛔ en främling läser varken meddelandet eller filen", async () => {
    await assertFails(getDoc(doc(som(FRAMLING), `samtal/${sid}/meddelanden/bild`)));
    await assertFails(getDoc(doc(som(FRAMLING), `samtal/${sid}/bilagor/bild`)));
  });

  it("⛔ en medlem av gruppen som inte är med i det privata samtalet läser inte filen", async () => {
    await assertFails(getDoc(doc(som(CARL), `samtal/${sid}/bilagor/bild`)));
    await assertFails(getDoc(doc(som(CARL), `samtal/${sid}/meddelanden/bild`)));
  });

  it("⛔ filen kan inte ändras eller raderas", async () => {
    await assertFails(updateDoc(doc(som(ANNA), `samtal/${sid}/bilagor/bild`), { namn: "annat.png" }));
    await assertFails(deleteDoc(doc(som(ANNA), `samtal/${sid}/bilagor/bild`)));
    await assertFails(deleteDoc(doc(som(BO), `samtal/${sid}/bilagor/bild`)));
  });

  it("⛔ dataUrl på meddelandet nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/hel`), meddelande(ANNA, { bilaga: bild() })));
  });

  it("⛔ för stor fil nekas, exakt taket släpps in", async () => {
    const exakt = pa("application/pdf", MAX_KOMMENTARBILAGA);
    assert.equal(exakt.length, MAX_KOMMENTARBILAGA);
    await assertSucceeds(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "tak", `samtal/${sid}/bilagor`, "tak", { bilaga: { dataUrl: exakt, namn: "a.pdf", typ: "application/pdf", tecken: exakt.length } }));
    const over = pa("application/pdf", MAX_KOMMENTARBILAGA + 1);
    await assertFails(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "over", `samtal/${sid}/bilagor`, "over", { bilaga: { dataUrl: over, namn: "a.pdf", typ: "application/pdf", tecken: over.length } }));
  });

  it("⛔ innehåll som inte är typen nekas, och fel typ nekas redan på märket", async () => {
    // Märket säger pdf och filen säger pdf, men innehållet är en png.
    await assertFails(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "lur", `samtal/${sid}/bilagor`, "lur", { bilaga: bild({ typ: "application/pdf" }) }));
    const svg = pa("image/svg+xml", 40);
    await assertFails(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "svg", `samtal/${sid}/bilagor`, "svg", { bilaga: { dataUrl: svg, namn: "a.svg", typ: "image/svg+xml", tecken: svg.length } }));
    const exe = pa("application/x-msdownload", 40);
    await assertFails(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "exe", `samtal/${sid}/bilagor`, "exe", { bilaga: { dataUrl: exe, namn: "a.exe", typ: "application/x-msdownload", tecken: exe.length } }));
  });

  it("⛔ ett märke med en typ som inte får bifogas nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/svgmarke`), meddelande(ANNA, { text: "", bilaga: marke("a.svg", "image/svg+xml") })));
  });

  it("⛔ tom text utan bilaga nekas som förut", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/tom`), meddelande(ANNA, { text: "" })));
  });
});

describe("filen är bunden till sitt meddelande (granskningen av PR 307)", () => {
  it("⛔ en fil utan meddelande nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/bilagor/ensam`), { ...bild(), tid: nu() }));
  });

  it("⛔ en fil på någon annans meddelande nekas", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${sid}/bilagor/annas`), { ...bild(), tid: SADD_TID }));
  });

  it("⛔ märkets typ, namn och tid ska vara filens", async () => {
    const pdf = pa("application/pdf", 40);
    await assertFails(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "typ", `samtal/${sid}/bilagor`, "typ", { bilaga: { dataUrl: pdf, namn: "a.pdf", typ: "application/pdf", tecken: pdf.length }, marke: marke("a.pdf", "image/png") }));
    await assertFails(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "namn", `samtal/${sid}/bilagor`, "namn", { bilaga: bild(), marke: marke("annat.png", "image/png") }));
    await assertFails(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "tid", `samtal/${sid}/bilagor`, "tid", { bilaga: bild(), filTid: 1 }));
  });

  it("⛔ ett svar i en tråd har trådens id i nyckeln, och bara en gång", async () => {
    await assertFails(batchMedFil(BO, `samtal/${grupp}/tradar/rot/meddelanden`, "svar2", `samtal/${grupp}/bilagor`, "svar2", { bilaga: bild() }));
    const svar = await getDoc(doc(som(BO), `samtal/${grupp}/tradar/rot/meddelanden/svar`));
    await assertFails(setDoc(doc(som(BO), `samtal/${grupp}/bilagor/rot~svar~igen`), { ...bild({ namn: "svar.png" }), tid: svar.data()?.tid }));
  });

  it("⛔ en medlem av gruppen utanför det privata samtalet lägger ingen fil där, inte ens på ett eget meddelande", async () => {
    await assertFails(setDoc(doc(som(CARL), `samtal/${sid}/bilagor/carls`), { ...bild({ namn: "c.png" }), tid: SADD_TID }));
  });

  it("⛔ en agent och en inaktiv medlem lägger ingen fil, inte ens på ett eget meddelande", async () => {
    await assertFails(setDoc(doc(som(AGENT), `samtal/${grupp}/bilagor/agentens`), { ...bild({ namn: "a.png" }), tid: SADD_TID }));
    await assertFails(setDoc(doc(som(INAKTIV), `samtal/${grupp}/bilagor/inaktivs`), { ...bild({ namn: "i.png" }), tid: SADD_TID }));
  });
});

describe("märket har sin fil, och id:t kan bära en (granskningen av PR 307)", () => {
  // ⛔ Förut släpptes ett märke utan fil in, och bubblan sade "Bilagan går inte att visa" för alltid. Ett prov i blocket
  // ovan ("pngmarke") stod då grönt på just det, alltså var hålet mätt som avsett. Det provet är borttaget.
  // ⛔ Proven för `~` skriver UTAN bilaga. Med en fil hade bindningen nekat redan, och provet hade inte mätt villkoret.
  it("⛔ ett märke utan fil nekas, i samtalet och i en tråd", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/utanfil`), meddelande(ANNA, { text: "", bilaga: marke("a.png", "image/png") })));
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/utanfil2`), meddelande(ANNA, { text: "Se bilden", bilaga: marke("a.png", "image/png") })));
    await assertFails(setDoc(doc(som(BO), `samtal/${grupp}/tradar/rot/meddelanden/utanfil`), meddelande(BO, { text: "", bilaga: marke("a.png", "image/png") })));
  });

  it("märket med filen i samma batch släpps in, i samtalet och i en tråd", async () => {
    await assertSucceeds(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "medfil", `samtal/${sid}/bilagor`, "medfil", { bilaga: bild() }));
    await assertSucceeds(batchMedFil(BO, `samtal/${grupp}/tradar/rot/meddelanden`, "medfil", `samtal/${grupp}/bilagor`, "rot~medfil", { bilaga: bild() }));
  });

  it("ett meddelande utan bilaga släpps in som förut, i samtalet och i en tråd", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/bara-text`), meddelande(ANNA)));
    await assertSucceeds(setDoc(doc(som(BO), `samtal/${grupp}/tradar/rot/meddelanden/bara-text`), meddelande(BO)));
  });

  it("en fil som läggs till senare på ett eget meddelande som redan bär märket släpps in", async () => {
    // `annas` sås förbi reglerna: ett meddelande med märke men utan fil, som 0.80.0 före härdningen kunde lämna efter sig.
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/bilagor/annas`), { ...bild(), tid: SADD_TID }));
  });

  it("⛔ ett id med ~ nekas, i samtalet och i en tråd, också utan bilaga", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/rot~m1`), meddelande(ANNA)));
    await assertFails(setDoc(doc(som(BO), `samtal/${grupp}/tradar/rot/meddelanden/a~b`), meddelande(BO)));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${grupp}/meddelanden/m1`), meddelande(ANNA)));
  });
});

describe("en fil utan meddelande tas inte över under ett annat namn eller en annan typ (granskningen av PR 307)", () => {
  // ⛔ Filen sås förbi reglerna, som en server eller en äldre regelversion hade kunnat lämna den. Utan jämförelsen i
  // meddelandets regel räckte det att filen FANNS: ett nytt meddelande med samma id kunde då visa den under vilket namn
  // och vilken tillåten typ som helst.
  before(async () => {
    await miljo.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `samtal/${sid}/bilagor/foraldralos`), { ...bild(), tid: SADD_TID });
    });
  });

  it("⛔ ett nytt meddelande med samma id men ett annat namn i märket nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/foraldralos`), meddelande(ANNA, { text: "", bilaga: marke("annat.png", "image/png") })));
  });

  it("⛔ ett nytt meddelande med samma id men en annan typ i märket nekas", async () => {
    await assertFails(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/foraldralos`), meddelande(ANNA, { text: "", bilaga: marke("kvitto.png", "application/pdf") })));
  });

  it("med samma namn och typ släpps det in (README säger varför det är godtagbart)", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/meddelanden/foraldralos`), meddelande(ANNA, { text: "", bilaga: marke("kvitto.png", "image/png") })));
  });

  it("fil och märke i samma batch släpps in som förut, i samtalet och i en tråd", async () => {
    await assertSucceeds(batchMedFil(ANNA, `samtal/${sid}/meddelanden`, "jamfor", `samtal/${sid}/bilagor`, "jamfor", { bilaga: bild() }));
    await assertSucceeds(batchMedFil(BO, `samtal/${grupp}/tradar/rot/meddelanden`, "jamfor", `samtal/${grupp}/bilagor`, "rot~jamfor", { bilaga: bild({ namn: "svar.png" }) }));
  });
});

describe("tysta notiser", () => {
  it("personen skriver och läser sin egen rad", async () => {
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/tyst/${ANNA}`), { tyst: true }));
    await assertSucceeds(setDoc(doc(som(ANNA), `samtal/${sid}/tyst/${ANNA}`), { tyst: false }));
    await assertSucceeds(getDoc(doc(som(ANNA), `samtal/${sid}/tyst/${ANNA}`)));
  });

  it("⛔ någon annans rad läses och skrivs inte", async () => {
    await assertFails(getDoc(doc(som(BO), `samtal/${sid}/tyst/${ANNA}`)));
    await assertFails(setDoc(doc(som(BO), `samtal/${sid}/tyst/${ANNA}`), { tyst: false }));
  });

  it("⛔ extra fält och ett värde som inte är sant eller falskt nekas", async () => {
    await assertFails(setDoc(doc(som(BO), `samtal/${sid}/tyst/${BO}`), { tyst: true, till: 99 }));
    await assertFails(setDoc(doc(som(BO), `samtal/${sid}/tyst/${BO}`), { tyst: "ja" }));
  });

  it("⛔ den som inte är med i samtalet har ingen rad där", async () => {
    await assertFails(setDoc(doc(som(CARL), `samtal/${sid}/tyst/${CARL}`), { tyst: false }));
    await assertFails(getDoc(doc(som(CARL), `samtal/${sid}/tyst/${CARL}`)));
  });

  it("⛔ raden raderas aldrig", async () => {
    await assertFails(deleteDoc(doc(som(ANNA), `samtal/${sid}/tyst/${ANNA}`)));
  });
});
