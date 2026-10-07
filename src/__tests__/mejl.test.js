import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createMemorySource } from "../data/adapters.js";
import { mejlregelfragment } from "../lib/mejl.js";
import {
  SPARRADA_MEJLDOMANER,
  byggMejlhandelse,
  createMailQueue,
  createMailSender,
  createMockMailTransport,
  createNodemailerTransport,
  losMejlsprak,
  mejlregelfragment as mejlregelfragmentNod,
  normaliseraMejlsprak,
} from "../node/mejl.js";

/**
 * Lane 18A, mejlmodulen (ops-framework#101).
 *
 * Utan nätverk. Kön skrivs i minneskällan och utskicket går genom mocken.
 * Ingen riktig SMTP, varken här eller i CI.
 */

const SAMLING = "utkorgen";

/** @param {Record<string, unknown>} [over] */
const brev = (over = {}) => ({
  till: "vanja@staiger.se",
  amne: "Välkommen",
  text: "Hej",
  html: "<p>Hej</p>",
  sprak: "sv",
  kategori: "inbjudan",
  ...over,
});

/**
 * @param {{ send: (brev: object) => Promise<any>, skickade?: () => object[] }} transport
 * @param {object} [extra]
 */
const koOchUtskicket = (transport, extra = {}) => {
  const kalla = createMemorySource({ [SAMLING]: [] });
  const ko = createMailQueue({ kalla, samling: SAMLING });
  const utskick = createMailSender({ kalla, samling: SAMLING, transport, ...extra });
  return { kalla, ko, utskick };
};

/** @param {string} namn */
function konblock(namn) {
  const text = mejlregelfragment(namn);
  const marke = `match /${namn}/{id} {`;
  const start = text.indexOf(marke);
  expect(start).toBeGreaterThan(-1);
  const slut = text.indexOf("\n    }", start);
  expect(slut).toBeGreaterThan(start);
  return text.slice(start, slut);
}

describe("mejlkö och utskick", () => {
  it("ett köat mejl blir skickat med kvitto", async () => {
    const transport = createMockMailTransport();
    const { kalla, ko, utskick } = koOchUtskicket(transport);
    const koad = await ko.koa(brev({ groupId: "dev" }));

    expect(koad.status).toBe("koad");
    expect(koad.till).toBe("vanja@staiger.se");
    expect(koad.sprak).toBe("sv");
    expect(koad.kategori).toBe("inbjudan");
    expect(koad.groupId).toBe("dev");
    expect(koad.id).toBeTruthy();

    const sparad = await utskick.skicka(koad);
    const igen = await kalla.read(SAMLING, koad.id);

    expect(sparad.status).toBe("skickad");
    expect(sparad.accepterade).toEqual(["vanja@staiger.se"]);
    expect(sparad.avvisade).toEqual([]);
    expect(sparad.svar).toBe("250 2.0.0 OK mock");
    expect(sparad.messageId).toMatch(/^<mock-/);
    expect(Number.isNaN(Date.parse(sparad.tid))).toBe(false);
    expect(sparad.skal).toBeNull();
    expect(sparad.fel).toBeNull();
    expect(igen).toEqual(sparad);
    expect(transport.skickade()).toHaveLength(1);
    expect(transport.skickade()[0].till).toBe("vanja@staiger.se");
    expect(transport.skickade()[0].amne).toBe("Välkommen");
  });

  it("en avvisad mottagare ger status fel, inte skickad", async () => {
    const transport = createMockMailTransport({
      utfall: () => ({
        accepted: [],
        rejected: ["bort@unik-doman.test"],
        response: "550 5.1.1 User unknown",
        messageId: "<avvisad@test>",
      }),
    });
    const { utskick, ko } = koOchUtskicket(transport);
    const sparad = await utskick.skicka(await ko.koa(brev({ till: "bort@unik-doman.test" })));

    expect(sparad.status).toBe("fel");
    expect(sparad.status).not.toBe("skickad");
    expect(sparad.accepterade).toEqual([]);
    expect(sparad.avvisade).toEqual(["bort@unik-doman.test"]);
    expect(sparad.svar).toBe("550 5.1.1 User unknown");
    expect(sparad.messageId).toBe("<avvisad@test>");
    expect(sparad.skal).toBeTruthy();
    expect(transport.skickade()).toHaveLength(1);
  });

  it("en mottagare som avvisas tillsammans med en accepterad är fortfarande fel", async () => {
    const transport = createMockMailTransport({
      utfall: () => ({
        accepted: ["en@unik-doman.test"],
        rejected: ["tva@unik-doman.test"],
        response: "250 delvis",
        messageId: "<delvis@test>",
      }),
    });
    const { utskick, ko } = koOchUtskicket(transport);
    const sparad = await utskick.skicka(await ko.koa(brev({ till: "en@unik-doman.test" })));
    expect(sparad.status).toBe("fel");
    expect(sparad.accepterade).toEqual(["en@unik-doman.test"]);
    expect(sparad.avvisade).toEqual(["tva@unik-doman.test"]);
  });

  it("en spärrad domän skickas inte och får ett skäl", async () => {
    const transport = createMockMailTransport();
    const { utskick, ko } = koOchUtskicket(transport);
    const koad = await ko.koa(brev({ till: "nagon@example.com" }));
    const sparad = await utskick.skicka(koad);

    expect(koad.status).toBe("koad");
    expect(sparad.status).toBe("hoppad");
    expect(sparad.status).not.toBe("skickad");
    expect(sparad.skal).toContain("example.com");
    expect(sparad.fel).toBeNull();
    expect(sparad.accepterade).toEqual([]);
    expect(sparad.avvisade).toEqual([]);
    expect(sparad.svar).toBeNull();
    expect(sparad.messageId).toBeNull();
    expect(Number.isNaN(Date.parse(sparad.tid))).toBe(false);
    expect(transport.skickade()).toEqual([]);
  });

  it("de fyra spärrade domänerna ur SessionStudio, och inga andra", async () => {
    expect([...SPARRADA_MEJLDOMANER].sort()).toEqual(["example.com", "example.se", "test.com", "test.se"]);
    const transport = createMockMailTransport();
    const { utskick, ko } = koOchUtskicket(transport);
    for (const doman of ["example.com", "example.se", "test.com", "test.se"]) {
      const sparad = await utskick.skicka(await ko.koa(brev({ till: `a@${doman}` })));
      expect(sparad.status).toBe("hoppad");
      expect(sparad.skal).toContain(doman);
    }
    const stor = await utskick.skicka(await ko.koa(brev({ till: "A@Example.COM" })));
    expect(stor.status).toBe("hoppad");
    const under = await utskick.skicka(await ko.koa(brev({ till: "a@foo.example.com" })));
    expect(under.status).toBe("skickad");
    expect(transport.skickade()).toHaveLength(1);
  });

  it("en extra spärrad domän läggs till, de inbyggda tas inte bort", async () => {
    const transport = createMockMailTransport();
    const { utskick, ko } = koOchUtskicket(transport, { sparradeDomaner: [] });
    const kvar = await utskick.skicka(await ko.koa(brev({ till: "a@test.se" })));
    expect(kvar.status).toBe("hoppad");

    const { utskick: medExtra, ko: koExtra } = koOchUtskicket(createMockMailTransport(), { sparradeDomaner: ["ond.se"] });
    const extra = await medExtra.skicka(await koExtra.koa(brev({ till: "a@ond.se" })));
    expect(extra.status).toBe("hoppad");
    expect(extra.skal).toContain("ond.se");
  });

  it("ett transportfel skrivs på dokumentet och kastas inte bort", async () => {
    const transport = createMockMailTransport({
      utfall() {
        throw new Error("421 tillfälligt nere");
      },
    });
    const { utskick, ko, kalla } = koOchUtskicket(transport);
    const koad = await ko.koa(brev());
    const sparad = await utskick.skicka(koad);
    expect(sparad.status).toBe("fel");
    expect(sparad.fel).toContain("421 tillfälligt nere");
    expect(sparad.skal).toBeNull();
    expect(transport.skickade()).toEqual([]);
    expect((await kalla.read(SAMLING, koad.id))?.fel).toContain("421 tillfälligt nere");
  });

  it("ett kvitto som inte går att skriva kastar, med båda felen, och raden står kvar på skickas", async () => {
    const transport = createMockMailTransport({
      utfall() {
        throw new Error("421 tillfälligt nere");
      },
    });
    const { utskick, ko, kalla } = koOchUtskicket(transport);
    const koad = await ko.koa(brev());
    const update = kalla.update;
    kalla.update = async () => {
      throw new Error("disk full");
    };
    /** @type {unknown} */
    let fangat = null;
    await utskick.skicka(koad.id).catch((e) => {
      fangat = e;
    });
    expect(fangat).toBeInstanceOf(Error);
    const text = /** @type {Error} */ (fangat).message;
    expect(text).toMatch(/421 tillfälligt nere/);
    expect(text).toMatch(/disk full/);
    expect(text).toMatch(/skicka/);
    kalla.update = update;
    const kvar = await kalla.read(SAMLING, koad.id);
    expect(kvar?.status).toBe("skickas");
    expect(Number.isNaN(Date.parse(kvar?.paborjad))).toBe(false);
  });

  it("serverns svar kortas och loggen bär hash, inte adressen", async () => {
    const lang = `250 ${"x".repeat(400)}`;
    const transport = createMockMailTransport({
      utfall: () => ({ response: lang, messageId: "<lang@test>" }),
    });
    /** @type {object[]} */
    const handelser = [];
    const { utskick, ko } = koOchUtskicket(transport, { logg: (h) => handelser.push(h) });
    const sparad = await utskick.skicka(await ko.koa(brev({ till: "hemlig-mottagare@unik-doman.test" })));
    expect(sparad.svar).toHaveLength(200);
    expect(sparad.svar?.startsWith("250 ")).toBe(true);
    expect(handelser).toHaveLength(1);
    const text = JSON.stringify(handelser[0]);
    expect(text).not.toContain("hemlig-mottagare");
    expect(handelser[0].mottagarhash).toMatch(/^[0-9a-f]{12}$/);
    expect(handelser[0].antalAccepterade).toBe(1);
    expect(handelser[0].antalAvvisade).toBe(0);
    expect(handelser[0].handling).toBe("skickad");
    expect(handelser[0].svar).toHaveLength(200);
  });

  it("en logg som kastar lämnar kvittot kvar och felet syns", async () => {
    const transport = createMockMailTransport();
    const { utskick, ko, kalla } = koOchUtskicket(transport, {
      logg() {
        throw new Error("logg nere");
      },
    });
    const koad = await ko.koa(brev());
    await expect(utskick.skicka(koad)).rejects.toThrow(/logg nere/);
    expect((await kalla.read(SAMLING, koad.id))?.status).toBe("skickad");
  });
});

describe("ett utskick per mejl (granskningen av PR 294, B1)", () => {
  it("samma id två gånger i följd ger ett utskick", async () => {
    const transport = createMockMailTransport();
    const { ko, utskick, kalla } = koOchUtskicket(transport);
    const koad = await ko.koa(brev());
    const forsta = await utskick.skicka(koad.id);
    const andra = await utskick.skicka(koad.id);
    const tredje = await utskick.skicka(koad);
    expect(transport.skickade()).toHaveLength(1);
    expect(forsta.status).toBe("skickad");
    expect(andra).toEqual(forsta);
    expect(tredje).toEqual(forsta);
    expect(await kalla.read(SAMLING, koad.id)).toEqual(forsta);
  });

  it("två samtidiga anrop ger ett utskick", async () => {
    const transport = createMockMailTransport({
      // Transporten väntar, som en riktig SMTP. Utan anspråket hinner båda anropen fram hit.
      utfall: () => new Promise((r) => setTimeout(() => r({}), 5)),
    });
    const { ko, utskick } = koOchUtskicket(transport);
    const koad = await ko.koa(brev());
    const svar = await Promise.all([utskick.skicka(koad.id), utskick.skicka(koad.id), utskick.skicka(koad)]);
    expect(transport.skickade()).toHaveLength(1);
    expect(svar.filter((s) => s.status === "skickad")).toHaveLength(1);
    expect(svar.filter((s) => s.status === "skickas")).toHaveLength(2);
  });

  it("ett dokument som står på skickad, fel, hoppad eller skickas skickas inte", async () => {
    const transport = createMockMailTransport();
    const rader = ["skickad", "fel", "hoppad", "skickas"].map((status, i) => ({ id: `r${i}`, ...brev(), groupId: null, status }));
    expect(rader).toHaveLength(4);
    const kalla = createMemorySource({ [SAMLING]: rader });
    const utskick = createMailSender({ kalla, samling: SAMLING, transport });
    for (const rad of rader) {
      const svar = await utskick.skicka(rad.id);
      expect(svar).toEqual(rad);
      expect(await kalla.read(SAMLING, rad.id)).toEqual(rad);
    }
    expect(transport.skickade()).toEqual([]);
  });

  it("innehållet läses ur källan, inte ur argumentet", async () => {
    const transport = createMockMailTransport();
    const { ko, utskick } = koOchUtskicket(transport);
    const koad = await ko.koa(brev({ till: "ratt@unik-doman.test" }));
    await utskick.skicka({ ...koad, till: "fel@unik-doman.test", amne: "Gammal bild" });
    expect(transport.skickade()).toHaveLength(1);
    expect(transport.skickade()[0].till).toBe("ratt@unik-doman.test");
    expect(transport.skickade()[0].amne).toBe("Välkommen");
  });

  it("anspråket sätter skickas och paborjad innan transporten anropas", async () => {
    /** @type {any} */
    let underTiden = null;
    /** @type {import("../data/contract.js").DataSource<any>} */
    let kallan;
    const transport = createMockMailTransport({
      async utfall() {
        underTiden = await kallan.read(SAMLING, id);
        return {};
      },
    });
    const { ko, utskick, kalla } = koOchUtskicket(transport);
    kallan = kalla;
    const id = (await ko.koa(brev())).id;
    const sparad = await utskick.skicka(id);
    expect(underTiden?.status).toBe("skickas");
    expect(Number.isNaN(Date.parse(underTiden?.paborjad))).toBe(false);
    expect(sparad.status).toBe("skickad");
    expect(sparad.paborjad).toBe(underTiden.paborjad);
  });

  it("minneskällans updateIf skriver bara när villkoret stämmer", async () => {
    const kalla = createMemorySource({ k: [{ id: "a", status: "koad", n: 1 }] });
    const updateIf = /** @type {NonNullable<typeof kalla.updateIf>} */ (kalla.updateIf);
    expect(await updateIf("k", "saknas", { status: "koad" }, { status: "x" })).toEqual({ updated: false, row: null });
    expect(await updateIf("k", "a", { status: "annan" }, { status: "x" })).toEqual({ updated: false, row: { id: "a", status: "koad", n: 1 } });
    expect(await updateIf("k", "a", { status: "koad" }, { status: "x" })).toEqual({ updated: true, row: { id: "a", status: "x", n: 1 } });
    expect(await updateIf("k", "a", { status: "koad" }, { status: "y" })).toEqual({ updated: false, row: { id: "a", status: "x", n: 1 } });
    await expect(updateIf("k", "a", {}, { status: "y" })).rejects.toThrow(/villkor/);
  });

  it("ett id som inte finns kastar, och en källa utan updateIf nekas vid uppstart", async () => {
    const transport = createMockMailTransport();
    const { utskick, kalla } = koOchUtskicket(transport);
    await expect(utskick.skicka("finns-inte")).rejects.toThrow(/finns inte/);
    await expect(utskick.skicka("")).rejects.toThrow(/id saknas/);
    const utan = { ...kalla, updateIf: undefined };
    expect(() => createMailSender({ kalla: utan, samling: SAMLING, transport })).toThrow(/updateIf/);
    expect(transport.skickade()).toEqual([]);
  });
});

describe("kövalidering och språk", () => {
  it("språk är sv eller en, och kön gissar inte", async () => {
    const { ko } = koOchUtskicket(createMockMailTransport());
    await expect(ko.koa(brev({ sprak: "en" }))).resolves.toMatchObject({ sprak: "en" });
    await expect(ko.koa(brev({ sprak: "de" }))).rejects.toThrow(/koa/);
    await expect(ko.koa(brev({ sprak: "SV" }))).rejects.toThrow(/sv eller en/);
    await expect(ko.koa(brev({ till: "inte-en-adress" }))).rejects.toThrow(/koa/);
    await expect(ko.koa(brev({ amne: "  " }))).rejects.toThrow(/amne/);
    await expect(ko.koa(brev({ text: "", html: "" }))).rejects.toThrow(/text eller html/);
    await expect(ko.koa(brev({ kategori: "" }))).rejects.toThrow(/kategori/);
    await expect(ko.koa(brev({ groupId: "" }))).rejects.toThrow(/groupId/);
    const utanGrupp = await ko.koa(brev());
    expect(utanGrupp.groupId).toBeNull();
  });

  it("språket väljs i ordningen händelse, grupp, avsändare, sedan sv", () => {
    expect(normaliseraMejlsprak("sv")).toBe("sv");
    expect(normaliseraMejlsprak("en")).toBe("en");
    expect(normaliseraMejlsprak("EN")).toBeNull();
    expect(normaliseraMejlsprak(null)).toBeNull();
    expect(losMejlsprak({ handelse: "en", grupp: "sv", avsandare: "sv" })).toBe("en");
    expect(losMejlsprak({ handelse: "de", grupp: "en", avsandare: "sv" })).toBe("en");
    expect(losMejlsprak({ avsandare: "en" })).toBe("en");
    expect(losMejlsprak({})).toBe("sv");
    expect(losMejlsprak()).toBe("sv");
  });

  it("fabrikerna säger sitt namn när konfigurationen saknas", () => {
    expect(() => createMailQueue()).toThrow(/createMailQueue/);
    expect(() => createMailSender()).toThrow(/createMailSender/);
    expect(() => createNodemailerTransport()).toThrow(/createNodemailerTransport/);
    expect(() => createMailQueue({ kalla: createMemorySource() })).toThrow(/samling/);
    expect(() => createMailSender({ kalla: createMemorySource(), samling: SAMLING })).toThrow(/transport/);
  });
});

describe("nodemailer-adaptern", () => {
  it("tar konfigurationen appen skickar in och läser inte hemligheterna", async () => {
    const tidigareUser = process.env.MAIL_USER;
    const tidigarePass = process.env.MAIL_PASS;
    process.env.MAIL_USER = "fel-anvandare";
    process.env.MAIL_PASS = "fel-losen";
    try {
      expect(() => createNodemailerTransport()).toThrow(/createNodemailerTransport/);
      expect(() =>
        createNodemailerTransport({
          host: "smtp.gmail.com",
          port: 465,
          auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
          from: "LifeHub <hello@life-hub.app>",
        }),
      ).toThrow(/secure/);

      /** @type {object[]} */
      const sedda = [];
      const transport = createNodemailerTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: "ratt-anvandare", pass: "ratt-losen" },
        from: "LifeHub <hello@life-hub.app>",
        skapa(opts) {
          sedda.push(opts);
          return {
            async sendMail(mail) {
              sedda.push(mail);
              return { accepted: [mail.to], rejected: [], response: "250 2.0.0 OK", messageId: "<id@test>" };
            },
          };
        },
      });
      const info = await transport.send({ till: "a@unik-doman.test", amne: "Hej", text: "t", html: "<p>t</p>" });
      expect(sedda[0]).toEqual({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: "ratt-anvandare", pass: "ratt-losen" },
      });
      expect(sedda[0].auth.user).not.toBe("fel-anvandare");
      expect(sedda[1]).toMatchObject({
        from: "LifeHub <hello@life-hub.app>",
        to: "a@unik-doman.test",
        subject: "Hej",
        text: "t",
        html: "<p>t</p>",
      });
      expect(info.accepted).toEqual(["a@unik-doman.test"]);
      expect(info.messageId).toBe("<id@test>");
    } finally {
      if (tidigareUser === undefined) delete process.env.MAIL_USER;
      else process.env.MAIL_USER = tidigareUser;
      if (tidigarePass === undefined) delete process.env.MAIL_PASS;
      else process.env.MAIL_PASS = tidigarePass;
    }
  });

  it("ops-framework/node laddar inte nodemailer förrän ett utskick (granskningen av PR 294, B2)", () => {
    // Ett barn med en resolve-krok som skriver ner varje modul som laddas. Golvet: kroken
    // måste se nodemailer när send körs, annars mäter den ingenting.
    const skript = `
      import { registerHooks } from "node:module";
      const sedda = [];
      registerHooks({ resolve(spec, ctx, next) { const r = next(spec, ctx); sedda.push(r.url); return r; } });
      const nod = await import(${JSON.stringify(path.join(process.cwd(), "src/node/index.js"))});
      const fore = sedda.filter((u) => u.includes("/nodemailer/")).length;
      const antal = sedda.length;
      const t = nod.createNodemailerTransport({ host: "127.0.0.1", port: 9, secure: false, auth: { user: "u", pass: "p" }, from: "a@unik-doman.test" });
      const efterSkapa = sedda.filter((u) => u.includes("/nodemailer/")).length;
      await t.send({ till: "b@unik-doman.test", amne: "x", text: "x", html: "" }).catch(() => {});
      const efter = sedda.filter((u) => u.includes("/nodemailer/")).length;
      console.log(JSON.stringify({ fore, antal, efterSkapa, efter }));
    `;
    const ut = execFileSync(process.execPath, ["--input-type=module", "-e", skript], { encoding: "utf8", timeout: 30000 });
    const m = JSON.parse(ut.trim().split("\n").pop() ?? "{}");
    expect(m.antal).toBeGreaterThanOrEqual(20);
    expect(m.fore).toBe(0);
    expect(m.efterSkapa).toBe(0);
    expect(m.efter).toBeGreaterThanOrEqual(1);
  });

  it("utan nodemailer i appen säger första utskicket det, och kön får fel på dokumentet", () => {
    const skript = `
      import { registerHooks } from "node:module";
      registerHooks({ resolve(spec, ctx, next) {
        if (spec === "nodemailer") { const e = new Error("Cannot find package 'nodemailer'"); e.code = "ERR_MODULE_NOT_FOUND"; throw e; }
        return next(spec, ctx);
      } });
      const nod = await import(${JSON.stringify(path.join(process.cwd(), "src/node/index.js"))});
      const { createMemorySource } = await import(${JSON.stringify(path.join(process.cwd(), "src/data/adapters.js"))});
      const kalla = createMemorySource({ ko: [] });
      const ko = nod.createMailQueue({ kalla, samling: "ko" });
      const transport = nod.createNodemailerTransport({ host: "127.0.0.1", port: 9, secure: false, auth: { user: "u", pass: "p" }, from: "a@unik-doman.test" });
      const utskick = nod.createMailSender({ kalla, samling: "ko", transport });
      const koad = await ko.koa({ till: "b@unik-doman.test", amne: "x", text: "x", sprak: "sv", kategori: "prov" });
      const sparad = await utskick.skicka(koad.id);
      console.log(JSON.stringify({ status: sparad.status, fel: sparad.fel }));
    `;
    const ut = execFileSync(process.execPath, ["--input-type=module", "-e", skript], { encoding: "utf8", timeout: 30000 });
    const m = JSON.parse(ut.trim().split("\n").pop() ?? "{}");
    expect(m.status).toBe("fel");
    expect(m.fel).toMatch(/Installera nodemailer i appen för att skicka mejl/);
  });

  it("källan nämner inte MAIL_USER eller MAIL_PASS", () => {
    const filer = ["src/lib/mejl.js", "src/node/mejl.js", "src/node/index.js"];
    expect(filer.length).toBeGreaterThanOrEqual(2);
    for (const fil of filer) {
      const text = readFileSync(path.join(process.cwd(), fil), "utf8");
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain("MAIL_USER");
      expect(text).not.toContain("MAIL_PASS");
      expect(text).not.toContain("process.env");
    }
  });
});

describe("regelfragmentet för kön", () => {
  it("nekar en klient att läsa och skriva, med appens samlingsnamn", () => {
    const block = konblock("utkorgen");
    expect(block).toContain("allow read, write: if false;");
    expect(block).not.toContain("request.auth");
    expect(block).not.toContain("allow read: if");
    expect(block).not.toContain("allow write: if");
    const annan = mejlregelfragment("annanKo");
    expect(annan).toContain("match /annanKo/{id}");
    expect(annan).not.toContain("utkorgen");
    expect(mejlregelfragmentNod("annanKo")).toBe(annan);
  });

  it("utan samlingsnamn säger fragmentet sitt namn", () => {
    expect(() => mejlregelfragment()).toThrow(/mejlregelfragment/);
    expect(() => mejlregelfragment("a/b")).toThrow(/mejlregelfragment/);
    expect(() => mejlregelfragment("")).toThrow(/mejlregelfragment/);
  });
});

describe("byggMejlhandelse", () => {
  it("hashar mottagaren och lämnar adressen utanför", () => {
    const handelse = byggMejlhandelse({
      handling: "fel",
      kategori: "inbjudan",
      till: "hemlig-mottagare@unik-doman.test",
      groupId: "dev",
      mejlId: "m1",
      millisekunder: 12,
      fel: "421",
      accepterade: [],
      avvisade: ["hemlig-mottagare@unik-doman.test"],
      svar: null,
      messageId: null,
    });
    expect(JSON.stringify(handelse)).not.toContain("hemlig-mottagare");
    expect(handelse.mottagarhash).toMatch(/^[0-9a-f]{12}$/);
    expect(handelse.antalAvvisade).toBe(1);
    expect(handelse.handling).toBe("fel");
    expect(handelse.groupId).toBe("dev");
  });
});
