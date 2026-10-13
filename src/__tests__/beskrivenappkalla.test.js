import { describe, expect, it } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import { createBeskrivenAppKalla, createBeskrivningskalla } from "../data/beskrivenappkalla.js";
import { beskrivningsId } from "../lib/beskrivenapp.js";

const utlaning = () => ({
  format: 1,
  id: "utlaning",
  namn: "Utlåning",
  ikon: "book",
  beskrivning: "",
  listor: [
    {
      id: "saker",
      namn: "Saker",
      falt: [
        { id: "namn", namn: "Sak", typ: "text", krav: true },
        { id: "lanad-av", namn: "Lånad av", typ: "person" },
        { id: "tillbaka", namn: "Tillbaka", typ: "datum" },
        { id: "skick", namn: "Skick", typ: "val", val: ["Bra", "Sliten", "Trasig"] },
      ],
      rubrikfalt: "namn",
    },
    { id: "personer", namn: "Personer", falt: [{ id: "namn", namn: "Namn", typ: "text", krav: true }], rubrikfalt: "namn", visning: "tabell" },
  ],
});

const skapare = () => ({ uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "appar" });
const hel = (extra = {}) => ({ groupId: "cps-ab", appId: "utlaning", lista: "saker", varden: { namn: "Borr" }, skapadAv: skapare(), skapad: 10, andrad: 10, ...extra });
const kalla = (source, extra = {}) => createBeskrivenAppKalla({ source, collection: "appdata", groupId: "cps-ab", beskrivning: utlaning(), skapare, ...extra });

describe("createBeskrivenAppKalla: krav", () => {
  it("kräver samling, grupp, skapare, en giltig beskrivning och en källa med remove", () => {
    const source = createMemorySource();
    const bas = { source, collection: "appdata", groupId: "cps-ab", beskrivning: utlaning(), skapare };
    expect(() => createBeskrivenAppKalla({ ...bas, collection: "" })).toThrow(/collection krävs/);
    expect(() => createBeskrivenAppKalla({ ...bas, groupId: " " })).toThrow(/groupId krävs/);
    expect(() => createBeskrivenAppKalla({ ...bas, skapare: undefined })).toThrow(/skapare krävs/);
    expect(() => createBeskrivenAppKalla({ ...bas, source: { list() {}, read() {}, create() {}, update() {} } })).toThrow(/remove/);
    expect(() => createBeskrivenAppKalla({ ...bas, beskrivning: { ...utlaning(), format: 2 } })).toThrow(/beskrivningen håller inte[\s\S]*format: måste vara talet 1/);
    expect(() => createBeskrivenAppKalla(undefined)).toThrow(/source krävs/);
  });

  it("appId härleds ur beskrivningen, och en annan appId är ett fel", () => {
    const source = createMemorySource();
    expect(kalla(source).appId).toBe("utlaning");
    expect(kalla(source, { appId: "utlaning" }).appId).toBe("utlaning");
    expect(() => kalla(source, { appId: "bibliotek" })).toThrow(/appId "bibliotek" är inte beskrivningens id "utlaning"/);
  });
});

describe("createBeskrivenAppKalla: läsa", () => {
  it("läser bara den här gruppens och appens rader, nyast ändrad först", async () => {
    const source = createMemorySource({
      appdata: [
        { id: "a", ...hel({ andrad: 10 }) },
        { id: "b", ...hel({ andrad: 30 }) },
        { id: "c", ...hel({ andrad: 20 }) },
        { id: "annan-grupp", ...hel({ groupId: "miranda-ab", andrad: 99 }) },
        { id: "annan-app", ...hel({ appId: "bibliotek", andrad: 98 }) },
      ],
    });
    const svar = await kalla(source).las();
    expect(svar.kalla).toBe("databas");
    expect(svar.fel).toBeNull();
    expect(svar.rader.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(svar.trasiga).toEqual([]);
  });

  it("en tom app är ett svar: databas, inga rader, inget fel", async () => {
    const svar = await kalla(createMemorySource()).las();
    expect(svar).toEqual({ rader: [], kalla: "databas", fel: null, trasiga: [] });
  });

  it("en källa som kastar ger kalla fel och inte en tom lista", async () => {
    const trasig = { list: async () => { throw new Error("nätet"); }, read: async () => null, create: async () => ({ id: "x" }), update: async () => {}, remove: async () => {} };
    const svar = await kalla(trasig).las();
    expect(svar.kalla).toBe("fel");
    expect(svar.fel?.message).toBe("nätet");
    expect(svar.rader).toEqual([]);
  });

  it("en trasig rad märks och släcker inte de andra", async () => {
    const source = createMemorySource({
      appdata: [
        { id: "ok", ...hel() },
        { id: "okand-lista", ...hel({ lista: "borta" }) },
        { id: "utan-varden", ...hel({ varden: undefined }) },
        { id: "extra-falt", ...hel({ hemlig: 1 }) },
        { id: "utan-tider", ...hel({ skapad: "igår" }) },
      ],
    });
    const svar = await kalla(source).las();
    expect(svar.rader.map((r) => r.id)).toEqual(["ok"]);
    expect(svar.trasiga.map((t) => t.id).sort()).toEqual(["extra-falt", "okand-lista", "utan-tider", "utan-varden"]);
    expect(svar.trasiga.find((t) => t.id === "okand-lista")?.fel).toMatch(/listan "borta", som inte finns i appen\. Listor: saker, personer\./);
  });

  it("en rad från en annan grupp som källan släpper igenom märks", async () => {
    const rad = { id: "fel-grupp", ...hel({ groupId: "miranda-ab" }) };
    const source = { list: async () => [rad], read: async () => null, create: async () => ({ id: "n" }), update: async () => {}, remove: async () => {} };
    const svar = await kalla(source).las();
    expect(svar.rader).toEqual([]);
    expect(svar.trasiga[0]).toMatchObject({ id: "fel-grupp", groupId: "miranda-ab" });
    expect(svar.trasiga[0].fel).toMatch(/miranda-ab/);
  });

  it("värden som inte längre passar beskrivningen läses ändå: en rad är inte trasig för att en app utvecklats", async () => {
    const source = createMemorySource({ appdata: [{ id: "gammal", ...hel({ varden: { namn: "Sak", borttaget: "ett fält som inte finns mer", skick: "Ny" } }) }] });
    const svar = await kalla(source).las();
    expect(svar.rader.map((r) => r.id)).toEqual(["gammal"]);
    expect(svar.rader[0].varden.borttaget).toBe("ett fält som inte finns mer");
  });

  it("en skapare med okänd typ i en rad släcker inte listan", async () => {
    const source = createMemorySource({ appdata: [{ id: "a", ...hel({ skapadAv: { uid: "u", namn: "X", typ: "robot", kalla: "k" } }) }, { id: "b", ...hel() }] });
    const svar = await kalla(source).las();
    expect(svar.kalla).toBe("databas");
    expect(svar.rader.length).toBe(2);
  });
});

describe("createBeskrivenAppKalla: skriva", () => {
  it("skapa sätter grupp, app, skapare och klockslag själv, och ger raden med sitt id", async () => {
    const source = createMemorySource();
    const k = kalla(source);
    const fore = Date.now();
    const rad = await k.skapa({ lista: "saker", varden: { namn: " Borrmaskin ", skick: "Bra" } });
    expect(rad).toMatchObject({ groupId: "cps-ab", appId: "utlaning", lista: "saker", varden: { namn: "Borrmaskin", skick: "Bra" } });
    expect(rad.skapadAv).toEqual({ uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "appar" });
    expect(rad.skapad).toBeGreaterThanOrEqual(fore);
    expect(rad.andrad).toBe(rad.skapad);
    const lagrad = await source.read("appdata", rad.id);
    expect(Object.keys(lagrad).sort()).toEqual(["andrad", "appId", "groupId", "id", "lista", "skapad", "skapadAv", "varden"]);
    expect((await k.las()).rader.map((r) => r.id)).toEqual([rad.id]);
  });

  it("skapa skriver ingenting när raden inte håller, och felet säger varför", async () => {
    const source = createMemorySource();
    const k = kalla(source);
    await expect(k.skapa({ lista: "saker", varden: { skick: "Ny" } })).rejects.toThrow(/varden\.namn: krävs\.\nvarden\.skick: "Ny" är inget av alternativen/);
    await expect(k.skapa({ lista: "finns-inte", varden: { namn: "x" } })).rejects.toThrow(/lista: "finns-inte" finns inte i appen/);
    await expect(k.skapa({ lista: "saker", varden: { namn: "x", fusk: 1 } })).rejects.toThrow(/varden\.fusk: okänt fält/);
    expect((await source.list("appdata", {})).length).toBe(0);
  });

  it("skapa kräver en inloggad person som skapare", async () => {
    const source = createMemorySource();
    await expect(kalla(source, { skapare: () => ({ uid: "u", typ: "robot" }) }).skapa({ lista: "saker", varden: { namn: "x" } })).rejects.toThrow(/okänd typ/);
  });

  it("spara ersätter värdena, tar bort ett tömt fält och lämnar lista, skapare och skapad stilla", async () => {
    const source = createMemorySource({ appdata: [{ id: "r1", ...hel({ varden: { namn: "Borr", skick: "Bra" }, skapad: 5, andrad: 5 }) }] });
    const k = kalla(source, { skapare: () => ({ uid: "uid-2", namn: "Alex", typ: "manniska", kalla: "appar" }) });
    const ny = await k.spara("r1", { namn: "Borrmaskin" });
    expect(ny.varden).toEqual({ namn: "Borrmaskin" });
    expect(ny.skapad).toBe(5);
    expect(ny.andrad).toBeGreaterThan(5);
    const lagrad = await source.read("appdata", "r1");
    expect(lagrad.varden).toEqual({ namn: "Borrmaskin" });
    expect(lagrad.lista).toBe("saker");
    expect(lagrad.skapadAv.uid).toBe("uid-1");
    expect(lagrad.skapad).toBe(5);
  });

  it("spara avvisar ogiltiga värden och rör inte raden", async () => {
    const source = createMemorySource({ appdata: [{ id: "r1", ...hel() }] });
    await expect(kalla(source).spara("r1", { namn: "" })).rejects.toThrow(/varden\.namn: krävs\./);
    expect((await source.read("appdata", "r1")).varden).toEqual({ namn: "Borr" });
  });

  it("spara och taBort vägrar en rad i en annan grupp eller app, och en rad som inte finns", async () => {
    const source = createMemorySource({
      appdata: [
        { id: "deras", ...hel({ groupId: "miranda-ab" }) },
        { id: "annan-app", ...hel({ appId: "bibliotek" }) },
      ],
    });
    const k = kalla(source);
    await expect(k.spara("deras", { namn: "x" })).rejects.toThrow(/hör till "miranda-ab\/utlaning" och rörs inte i "cps-ab\/utlaning"/);
    await expect(k.taBort("deras")).rejects.toThrow(/rörs inte/);
    await expect(k.spara("annan-app", { namn: "x" })).rejects.toThrow(/rörs inte/);
    await expect(k.taBort("saknas")).rejects.toThrow(/raden finns inte/);
    await expect(k.taBort(" ")).rejects.toThrow(/id krävs/);
    expect((await source.list("appdata", {})).length).toBe(2);
  });

  it("taBort tar bort raden", async () => {
    const source = createMemorySource({ appdata: [{ id: "r1", ...hel() }, { id: "r2", ...hel() }] });
    await kalla(source).taBort("r1");
    expect((await source.list("appdata", {})).map((r) => r.id)).toEqual(["r2"]);
  });
});

describe("createBeskrivningskalla", () => {
  const bk = (source, extra = {}) => createBeskrivningskalla({ source, collection: "appbeskrivningar", groupId: "cps-ab", skapare, ...extra });
  const dokument = (b, extra = {}) => ({ id: beskrivningsId("cps-ab", b.id), groupId: "cps-ab", beskrivning: b, skapadAv: skapare(), skapad: 10, andrad: 10, ...extra });

  it("kräver samling, grupp och skapare", () => {
    const source = createMemorySource();
    expect(() => createBeskrivningskalla({ source, collection: "", groupId: "cps-ab", skapare })).toThrow(/collection krävs/);
    expect(() => createBeskrivningskalla({ source, collection: "x", groupId: "", skapare })).toThrow(/groupId krävs/);
    expect(() => createBeskrivningskalla({ source, collection: "x", groupId: "cps-ab" })).toThrow(/skapare krävs/);
  });

  it("spara skapar appen på sitt id, och lista och las läser den", async () => {
    const source = createMemorySource();
    const k = bk(source);
    const sparad = await k.spara(utlaning());
    expect(sparad.id).toBe("utlaning");
    const lagrad = await source.read("appbeskrivningar", "6~cps-ab~utlaning");
    expect(Object.keys(lagrad).sort()).toEqual(["andrad", "beskrivning", "groupId", "id", "skapad", "skapadAv"]);
    const lista = await k.lista();
    expect(lista.kalla).toBe("databas");
    expect(lista.beskrivningar.map((p) => p.id)).toEqual(["utlaning"]);
    expect(lista.beskrivningar[0].beskrivning.listor[0].falt[0].krav).toBe(true);
    const en = await k.las("utlaning");
    expect(en.post?.beskrivning.namn).toBe("Utlåning");
    expect(await k.las("finns-inte")).toEqual({ post: null, kalla: "databas", fel: null });
  });

  it("spara kastar med alla fel och skriver ingenting när beskrivningen inte håller", async () => {
    const source = createMemorySource();
    const dalig = { ...utlaning(), id: "Utlaning", ikon: "bokhylla" };
    await expect(bk(source).spara(dalig)).rejects.toThrow(/id: "Utlaning" är inget giltigt id[\s\S]*ikon: okänd ikon "bokhylla"/);
    expect((await source.list("appbeskrivningar", {})).length).toBe(0);
  });

  it("spara av en befintlig app ändrar beskrivningen och lämnar skapare och skapad stilla", async () => {
    const source = createMemorySource({ appbeskrivningar: [dokument(utlaning(), { skapad: 5, andrad: 5, skapadAv: { uid: "uid-9", namn: "Pat", typ: "manniska", kalla: "appar" } })] });
    const ny = { ...utlaning(), namn: "Utlåning 2" };
    const post = await bk(source).spara(ny);
    expect(post.skapad).toBe(5);
    expect(post.skapadAv.uid).toBe("uid-9");
    const lagrad = await source.read("appbeskrivningar", "6~cps-ab~utlaning");
    expect(lagrad.beskrivning.namn).toBe("Utlåning 2");
    expect(lagrad.skapadAv.uid).toBe("uid-9");
    expect(lagrad.andrad).toBeGreaterThan(5);
  });

  it("spara skriver inte över en annan grupps dokument, och agenten sparar inte härifrån", async () => {
    const source = createMemorySource({ appbeskrivningar: [dokument(utlaning(), { groupId: "miranda-ab" })] });
    await expect(bk(source).spara(utlaning())).rejects.toThrow(/hör till "miranda-ab"/);
    await expect(bk(createMemorySource(), { skapare: () => ({ uid: "ag", namn: "Agent", typ: "agent", kalla: "x" }) }).spara(utlaning())).rejects.toThrow(/bara en inloggad person/);
  });

  it("en beskrivning som inte håller, eller ligger på fel id, står i trasiga och ritas inte", async () => {
    const source = createMemorySource({
      appbeskrivningar: [
        dokument(utlaning()),
        dokument({ ...utlaning(), id: "skev", format: 5 }),
        { ...dokument({ ...utlaning(), id: "flyttad" }), id: "6~cps-ab~nagot-annat" },
        dokument({ ...utlaning(), id: "grannen" }, { groupId: "miranda-ab" }),
      ],
    });
    const lista = await bk(source).lista();
    expect(lista.beskrivningar.map((p) => p.id)).toEqual(["utlaning"]);
    expect(lista.trasiga.map((t) => t.id).sort()).toEqual(["6~cps-ab~nagot-annat", "6~cps-ab~skev"]);
    expect(lista.trasiga.find((t) => t.id === "6~cps-ab~skev")?.fel).toMatch(/format: måste vara talet 1/);
    expect(lista.trasiga.find((t) => t.id === "6~cps-ab~nagot-annat")?.fel).toMatch(/stämmer inte med appens id "flyttad"/);
  });

  it("las av en trasig beskrivning är ett fel och inte en tom app", async () => {
    const source = createMemorySource({ appbeskrivningar: [dokument({ ...utlaning(), format: 5 })] });
    const svar = await bk(source).las("utlaning");
    expect(svar.kalla).toBe("fel");
    expect(svar.post).toBeNull();
    expect(svar.fel?.message).toMatch(/format/);
  });

  it("taBort tar bort beskrivningen men inte raderna, och vägrar det som inte finns", async () => {
    const source = createMemorySource({
      appbeskrivningar: [dokument(utlaning())],
      appdata: [{ id: "r1", ...hel() }],
    });
    const k = bk(source);
    await k.taBort("utlaning");
    expect((await source.list("appbeskrivningar", {})).length).toBe(0);
    expect((await source.list("appdata", {})).length).toBe(1);
    await expect(k.taBort("utlaning")).rejects.toThrow(/finns inte i gruppen/);
  });
});
