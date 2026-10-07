import { describe, it, expect, vi } from "vitest";
import { createMemorySource } from "../data/adapters.js";
import {
  MEJLSTATUS,
  SPARRADE_MEJLDOMÄNER,
  losInbjudningssprak,
  losMejlsprak,
  mejlregelfragment,
  normaliseraMejlsprak,
} from "../lib/mejl.js";
import { createMailService, createMockTransport, createNodemailerTransport } from "../node/mejl.js";

/**
 * Mejlkö (0.74.0, #101). Utan nätverk: minneskällan och mock-transporten.
 * Ingenting här anropar en riktig SMTP-server.
 */

const TID = "2026-10-07T14:31:00.000Z";
const FROM = "Prov <prov@prov.invalid>";

const brev = (extra = {}) => ({
  till: "mottagare@bolaget.se",
  amne: "Välkommen",
  text: "Hej",
  html: "<p>Hej</p>",
  sprak: "sv",
  kategori: "inbjudan",
  ...extra,
});

const bygg = () => {
  const kalla = createMemorySource();
  const tjanst = createMailService({ kalla, samling: "utko", nu: () => TID });
  return { kalla, tjanst };
};

describe("köat mejl blir skickat med kvitto", () => {
  it("mock-transporten ger status skickad och kvittot på samma dokument", async () => {
    const { kalla, tjanst } = bygg();
    const transport = createMockTransport({ from: FROM });
    const rad = await tjanst.koa(brev({ groupId: "bolaget" }));

    expect(rad.status).toBe("koad");
    expect(rad.groupId).toBe("bolaget");
    expect(rad.tid).toBeNull();
    expect(rad.orsak).toBeNull();

    const efter = await tjanst.skicka(rad.id, { transport });

    expect(efter.status).toBe("skickad");
    expect(efter.accepterade).toEqual(["mottagare@bolaget.se"]);
    expect(efter.avvisade).toEqual([]);
    expect(efter.svar).toBe("250 2.0.0 OK mock");
    expect(efter.messageId).toBe("<mock-1@prov>");
    expect(efter.tid).toBe(TID);
    expect(efter.orsak).toBeNull();
    expect(transport.skickade).toEqual([
      {
        from: FROM,
        to: "mottagare@bolaget.se",
        subject: "Välkommen",
        text: "Hej",
        html: "<p>Hej</p>",
      },
    ]);

    const lagrad = await kalla.read("utko", rad.id);
    expect(lagrad).toMatchObject({
      status: "skickad",
      accepterade: ["mottagare@bolaget.se"],
      messageId: "<mock-1@prov>",
      tid: TID,
      orsak: null,
    });
  });

  it("ett redan skickat dokument skickas inte en gång till", async () => {
    const { tjanst } = bygg();
    const transport = createMockTransport({ from: FROM });
    const rad = await tjanst.koa(brev());
    await tjanst.skicka(rad.id, { transport });
    const andra = await tjanst.skicka(rad.id, { transport });
    expect(andra.status).toBe("skickad");
    expect(transport.skickade).toHaveLength(1);
  });

  it("en transport som kastar skrivs som fel och försvinner inte", async () => {
    const { kalla, tjanst } = bygg();
    const transport = createMockTransport({
      from: FROM,
      sendMail: async () => {
        throw new Error("SMTP nere");
      },
    });
    const rad = await tjanst.koa(brev());
    const efter = await tjanst.skicka(rad.id, { transport });
    expect(efter.status).toBe("fel");
    expect(efter.orsak).toBe("SMTP nere");
    expect(efter.tid).toBe(TID);
    expect((await kalla.read("utko", rad.id)).status).toBe("fel");
  });

  it("en transportfabrik som kastar blir fel på dokumentet", async () => {
    const { tjanst } = bygg();
    const rad = await tjanst.koa(brev());
    const efter = await tjanst.skicka(rad.id, {
      transport: () => {
        throw new Error("auth.pass krävs");
      },
    });
    expect(efter.status).toBe("fel");
    expect(efter.orsak).toBe("auth.pass krävs");
  });
});

describe("en avvisad mottagare ger status fel och inte skickad", () => {
  it("tom accepterad lista och en avvisad rad är fel, med båda listorna och serverns svar", async () => {
    const { tjanst } = bygg();
    const transport = createMockTransport({
      from: FROM,
      sendMail: async () => ({
        accepted: [],
        rejected: ["nekad@bolaget.se"],
        response: "550 5.1.1 User unknown",
        messageId: "<nekad@smtp>",
      }),
    });
    const rad = await tjanst.koa(brev({ till: "nekad@bolaget.se" }));
    const efter = await tjanst.skicka(rad.id, { transport });

    expect(efter.status).toBe("fel");
    expect(efter.status).not.toBe("skickad");
    expect(efter.accepterade).toEqual([]);
    expect(efter.avvisade).toEqual(["nekad@bolaget.se"]);
    expect(efter.svar).toBe("550 5.1.1 User unknown");
    expect(efter.messageId).toBe("<nekad@smtp>");
    expect(efter.orsak).toContain("nekad@bolaget.se");
    expect(transport.skickade).toHaveLength(1);
  });

  it("en delvis avvisad rad är också fel", async () => {
    const { tjanst } = bygg();
    const transport = createMockTransport({
      from: FROM,
      sendMail: async () => ({
        accepted: ["en@bolaget.se"],
        rejected: ["tva@bolaget.se"],
        response: "250 2.0.0 OK, en avvisad",
        messageId: "<delvis@smtp>",
      }),
    });
    const rad = await tjanst.koa(brev({ till: "en@bolaget.se" }));
    const efter = await tjanst.skicka(rad.id, { transport });
    expect(efter.status).toBe("fel");
    expect(efter.accepterade).toEqual(["en@bolaget.se"]);
    expect(efter.avvisade).toEqual(["tva@bolaget.se"]);
  });
});

describe("en spärrad domän skickas inte och får ett skäl", () => {
  it("de fyra domänerna ur SessionStudio, med och utan visningsnamn", async () => {
    expect(SPARRADE_MEJLDOMÄNER).toEqual(["test.se", "example.com", "test.com", "example.se"]);
    const { tjanst } = bygg();
    const transport = createMockTransport({ from: FROM });
    const fall = [
      [" x@EXAMPLE.COM ", "example.com"],
      ["a@test.se", "test.se"],
      ["a@test.com", "test.com"],
      ["Namn <a@example.se>", "example.se"],
    ];
    expect(fall).toHaveLength(4);
    for (const [till, doman] of fall) {
      const rad = await tjanst.koa(brev({ till, amne: `Hej ${doman}` }));
      const efter = await tjanst.skicka(rad.id, { transport });
      expect(efter.status).toBe("fel");
      expect(efter.orsak).toBe(`Spärrad domän: ${doman}`);
      expect(efter.accepterade).toEqual([]);
      expect(efter.svar).toBeNull();
      expect(efter.messageId).toBeNull();
    }
    expect(transport.skickade).toHaveLength(0);
  });

  it("en vanlig domän är inte spärrad", async () => {
    const { tjanst } = bygg();
    const transport = createMockTransport({ from: FROM });
    const rad = await tjanst.koa(brev({ till: "a@bolaget.se" }));
    expect((await tjanst.skicka(rad.id, { transport })).status).toBe("skickad");
    expect(transport.skickade).toHaveLength(1);
  });
});

describe("regelfragmentet nekar en klient att skriva i kön", () => {
  it("varje allow är if false, och samlingsnamnet är appens", () => {
    expect(() => mejlregelfragment("")).toThrow(/mejlregelfragment/);
    expect(() => mejlregelfragment("a/b")).toThrow(/samlingsnamn/);
    const text = mejlregelfragment("utko");
    expect(text).toContain("match /utko/{id}");
    const allows = [...text.matchAll(/allow\s+[^;]+;/g)].map((m) => m[0]);
    expect(allows.length).toBeGreaterThan(0);
    for (const rad of allows) expect(rad).toMatch(/if\s+false\s*;/);
    expect(text).not.toMatch(/if\s+true/);
    expect(text).not.toMatch(/request\.auth/);
  });
});

describe("språk, samma ordning som SessionStudio", () => {
  it("normalisera släpper bara sv och en", () => {
    expect(normaliseraMejlsprak("sv")).toBe("sv");
    expect(normaliseraMejlsprak("en")).toBe("en");
    expect(normaliseraMejlsprak("EN")).toBeNull();
    expect(normaliseraMejlsprak("")).toBeNull();
  });

  it("händelse, grupp, avsändare, sedan sv", () => {
    expect(losMejlsprak({ handelse: "en", grupp: "sv", avsandare: "sv" })).toBe("en");
    expect(losMejlsprak({ handelse: "no", grupp: "en", avsandare: "sv" })).toBe("en");
    expect(losMejlsprak({ avsandare: "en" })).toBe("en");
    expect(losMejlsprak({})).toBe("sv");
    expect(losMejlsprak()).toBe("sv");
  });

  it("inbjudan, händelse, grupp, sedan sv", () => {
    expect(losInbjudningssprak({ inbjudan: "en", handelse: "sv", grupp: "sv" })).toBe("en");
    expect(losInbjudningssprak({ handelse: "en", grupp: "sv" })).toBe("en");
    expect(losInbjudningssprak({ grupp: "en" })).toBe("en");
    expect(losInbjudningssprak({})).toBe("sv");
  });
});

describe("kön kräver det appen skickar in", () => {
  it("utan datakälla och utan samling namnger sig fabriken", () => {
    expect(() => createMailService()).toThrow(/createMailService/);
    expect(() => createMockTransport()).toThrow(/createMockTransport/);
    expect(() => createNodemailerTransport()).toThrow(/createNodemailerTransport/);
  });

  it("statusvärdena är de tre kvittona", () => {
    expect(MEJLSTATUS).toEqual(["koad", "skickad", "fel"]);
  });

  it("serverns svar kapas vid 200 tecken", async () => {
    const { tjanst } = bygg();
    const lang = "250 ".padEnd(250, "x");
    const transport = createMockTransport({
      from: FROM,
      sendMail: async () => ({
        accepted: ["mottagare@bolaget.se"],
        rejected: [],
        response: lang,
        messageId: "<lang@smtp>",
      }),
    });
    const rad = await tjanst.koa(brev());
    const efter = await tjanst.skicka(rad.id, { transport });
    expect(efter.svar).toHaveLength(200);
    expect(efter.svar).toBe(lang.slice(0, 200));
  });
});

const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn(async (m) => ({
    accepted: [m.to],
    rejected: [],
    response: "250 2.0.0 OK",
    messageId: "<adapter@prov>",
  }));
  const createTransport = vi.fn(() => ({ sendMail }));
  return { createTransport, sendMail };
});

vi.mock("nodemailer", () => ({ createTransport, default: { createTransport } }));

describe("nodemailer-adaptern tar emot appens konfiguration", () => {
  it("skickar host, port, secure, auth och from, och läser inte miljön", async () => {
    process.env.MAIL_USER = "lackt-anvandare";
    process.env.MAIL_PASS = "lackt-losen";
    const transport = createNodemailerTransport({
      host: "smtp.prov.invalid",
      port: 465,
      secure: true,
      auth: { user: "appens-anvandare", pass: "appens-losen" },
      from: "App <app@app.invalid>",
    });
    const info = await transport.sendMail({
      to: "mottagare@bolaget.se",
      subject: "Hej",
      text: "Hej",
      html: "<p>Hej</p>",
    });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport.mock.calls[0][0]).toEqual({
      host: "smtp.prov.invalid",
      port: 465,
      secure: true,
      auth: { user: "appens-anvandare", pass: "appens-losen" },
    });
    expect(JSON.stringify(createTransport.mock.calls[0][0])).not.toContain("lackt-anvandare");
    expect(JSON.stringify(createTransport.mock.calls[0][0])).not.toContain("lackt-losen");
    expect(sendMail).toHaveBeenCalledWith({
      from: "App <app@app.invalid>",
      to: "mottagare@bolaget.se",
      subject: "Hej",
      text: "Hej",
      html: "<p>Hej</p>",
    });
    expect(info.messageId).toBe("<adapter@prov>");
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASS;
  });
});
