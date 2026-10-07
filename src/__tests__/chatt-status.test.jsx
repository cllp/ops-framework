import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { OpsMarkdown } from "../components/OpsMarkdown.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harStatus } from "../data/samtalskalla.js";
import { AGENTSTATUS_ID, AGENTSTATUS_MAX_ALDER, agentstatus, byggAgentstatus, undersamlingskrock } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";
import { splitInline, splitMarkdown } from "../lib/markdown.js";
import * as nod from "../node/index.js";
import { levandeKalla } from "./levandeKalla.js";

/**
 * Etapp 1 av chattens nattskiva (#273): markdown i bubblan och agentens status.
 *
 * ⛔ HÄR MÄTS BETEENDE: att en fet text blir fet och en `javascript:`-länk förblir text i bubblan, att statusen visas, byts och
 * blir en felrad efter två minuter, och att en app som inte skickat `status` får varken läsning, rad eller nya regler.
 * Reglerna mäts i `rules/__tests__/chattnatt.test.mjs`, utseendet i check-skalyta avsnitt 29g.
 */

const fixtur = (/** @type {string} */ namn) => fs.readFileSync(path.resolve(__dirname, "..", "..", "rules", "__fixturer__", namn), "utf8");

describe("markdown: chattens delmängd", () => {
  it("⛔ kursiv med stjärna och understreck, men aldrig mitt i ett ord", () => {
    expect(splitInline("en *viktig* sak")).toEqual([{ kind: "text", value: "en " }, { kind: "italic", value: "viktig" }, { kind: "text", value: " sak" }]);
    expect(splitInline("en _viktig_ sak").map((b) => b.kind)).toEqual(["text", "italic", "text"]);
    expect(splitInline("snake_case_namn")).toEqual([{ kind: "text", value: "snake_case_namn" }]);
    expect(splitInline("en fil_namn_ i texten")).toEqual([{ kind: "text", value: "en fil_namn_ i texten" }]);
    expect(splitInline("se _x_namn")).toEqual([{ kind: "text", value: "se _x_namn" }]);
    expect(splitInline("**fet**")).toEqual([{ kind: "bold", value: "fet" }]);
    expect(splitInline("2 * 3 * 4")).toEqual([{ kind: "text", value: "2 * 3 * 4" }]);
  });
  it("⛔ med chatt är varje radbrytning en radbrytning, och rubrik, tabell, citat och kodblock är text", () => {
    const b = splitMarkdown("rad ett\nrad två", { chatt: true });
    expect(b).toHaveLength(1);
    expect(b[0].kind === "paragraph" && b[0].inline.map((x) => x.kind)).toEqual(["text", "break", "text"]);
    expect(splitMarkdown("# Inte en rubrik", { chatt: true })[0].kind).toBe("paragraph");
    expect(splitMarkdown("> inget citat\n```\nkod\n```", { chatt: true }).every((x) => x.kind === "paragraph")).toBe(true);
    expect(splitMarkdown("- ett\n- två\n1. först", { chatt: true }).map((x) => x.kind)).toEqual(["list", "list"]);
    // Utan chatt är det som förut: mjuk radbrytning, och rubriken är en rubrik.
    expect(splitMarkdown("rad ett\nrad två")[0]).toEqual({ kind: "paragraph", inline: [{ kind: "text", value: "rad ett rad två" }] });
    expect(splitMarkdown("# Rubrik")[0].kind).toBe("heading");
  });
  it("⛔ injektion: ingen HTML, inget skript, inga bilder, bara http och https blir länkar", () => {
    const { container } = render(
      <OpsMarkdown
        chatt
        text={'<img src=x onerror="alert(1)"> <script>alert(2)</script>\n[klick](javascript:alert(3)) [data](data:text/html,x) ![bild](https://e.se/a.png)\nhttps://exempel.se/sida.'}
      />,
    );
    expect(container.querySelector("img, script, iframe")).toBeNull();
    const lankar = [...container.querySelectorAll("a")];
    expect(lankar.map((a) => a.getAttribute("href"))).toEqual(["https://e.se/a.png", "https://exempel.se/sida"]);
    for (const a of lankar) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
    expect(container.textContent).toContain("[klick](javascript:alert(3))");
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});

describe("agentens status: modellen", () => {
  it("byggAgentstatus prövar läget och tiden, och node-delen exporterar samma funktion", () => {
    expect(byggAgentstatus({ lage: "tanker", sedan: 5 })).toEqual({ lage: "tanker", sedan: 5 });
    expect(() => byggAgentstatus({ lage: "sover", sedan: 5 })).toThrow(/finns inte/);
    expect(() => byggAgentstatus({ lage: "skriver", sedan: 1.5 })).toThrow(/heltal/);
    expect(nod.byggAgentstatus).toBe(byggAgentstatus);
    expect(nod.AGENTSTATUS_ID).toBe(AGENTSTATUS_ID);
  });
  it("⛔ äldre än två minuter är ett fel, och ett dokument utan statusens form också (regel 5)", () => {
    const nu = 1_000_000;
    expect(agentstatus(null, nu)).toBeNull();
    expect(agentstatus({ lage: "skriver", sedan: nu - 1000 }, nu)).toEqual({ lage: "skriver", sedan: nu - 1000 });
    expect(agentstatus({ lage: "skriver", sedan: nu - AGENTSTATUS_MAX_ALDER }, nu)).toEqual({ lage: "skriver", sedan: nu - AGENTSTATUS_MAX_ALDER });
    expect(agentstatus({ lage: "skriver", sedan: nu - AGENTSTATUS_MAX_ALDER - 1 }, nu)).toMatchObject({ fel: "gammal" });
    expect(agentstatus({ lage: "jobbar", sedan: nu }, nu)).toEqual({ fel: "ogiltig" });
    expect(agentstatus({ lage: "tanker" }, nu)).toEqual({ fel: "ogiltig" });
  });
});

describe("agentens status: källan och reglerna", () => {
  it("⛔ utan status: inga statusfunktioner, och regeltexten är byte för byte den tidigare (med och utan trådar)", () => {
    const k = createSamtalskalla({ kalla: createMemorySource({}) });
    expect(harStatus(k)).toBe(false);
    expect("prenumereraStatus" in k).toBe(false);
    const forr = fixtur("samtalsregelfragment-0.67.0.rules");
    const forrTradar = fixtur("samtalsregelfragment-0.68.0-tradar.rules");
    expect(forr.length).toBeGreaterThan(3000); // golv: fixturerna är inte tomma
    expect(forrTradar.length).toBeGreaterThan(5000);
    expect(samtalsregelfragment()).toBe(forr);
    expect(samtalsregelfragment({ tradar: "tradar" })).toBe(forrTradar);
    expect(samtalsregelfragment({ status: "status" })).not.toBe(forr);
  });
  it("⛔ statusblocket: läsa som samtalet, skriva aldrig, och samma under en tråd", () => {
    const r = samtalsregelfragment({ status: "agentstatus", tradar: "tradar" });
    expect(r).toContain("match /agentstatus/{dok} {\n        allow read: if opsISamtal(sid);\n        allow write: if false;");
    expect(r).toContain("match /agentstatus/{dok} {\n          allow read: if opsIGruppchatten(sid);\n          allow write: if false;");
    expect(samtalsregelfragment({ status: "agentstatus" })).not.toContain("opsIGruppchatten");
  });
  it("⛔ ett namn som krockar med en annan undersamling kastar, i reglerna och i källan, med ett hem för prövningen", () => {
    expect(() => samtalsregelfragment({ status: "meddelanden" })).toThrow(/krockar med meddelanden/);
    expect(() => samtalsregelfragment({ status: "tradar", tradar: "tradar" })).toThrow(/krockar med tradar/);
    expect(() => createSamtalskalla({ kalla: createMemorySource({}), status: "last" })).toThrow(/krockar med last/);
    expect(() => undersamlingskrock({ a: "x", b: undefined, c: "x" }, "prov")).toThrow(/prov: c "x" krockar med a/);
  });
  it("källan läser samtalets och trådens status, och en tråds status utan trådar kastar", async () => {
    const kalla = createMemorySource({});
    const s = /** @type {any} */ (createSamtalskalla({ kalla, status: "status", tradar: "tradar" }));
    await kalla.create("samtal/g|grupp/status", { id: "agent", lage: "tanker", sedan: 1 });
    await kalla.create("samtal/g|grupp/tradar/m1/status", { id: "agent", lage: "skriver", sedan: 2 });
    expect(await s.lasStatus("g|grupp")).toMatchObject({ lage: "tanker" });
    expect(await s.lasStatus("g|grupp", { tid: "m1" })).toMatchObject({ lage: "skriver" });
    const utanTradar = /** @type {any} */ (createSamtalskalla({ kalla, status: "status" }));
    await expect(utanTradar.lasStatus("g|grupp", { tid: "m1" })).rejects.toThrow(/kräver tradar/);
  });
});

/** @param {{ status?: string, utanLyssnare?: boolean }} [val] */
async function underlag(val = {}) {
  const kalla = val.utanLyssnare ? createMemorySource({}) : levandeKalla();
  const s = createSamtalskalla({ kalla, ...(val.status ? { status: val.status } : {}) });
  const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
  await s.skicka(a.id, { text: "Vilka fakturor är **obetalda**?\nOch *när* förföll de? https://exempel.se/f", av: "anna" });
  return { kalla, s, a };
}
const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

describe("vyn: markdown i bubblan och agentens rad", () => {
  it("⛔ bubblan ritar markdown: fet, kursiv, radbrytning och en klickbar länk", async () => {
    const { s, a } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    const fet = await screen.findByText("obetalda");
    expect(fet.tagName).toBe("STRONG");
    expect(screen.getByText("när").tagName).toBe("EM");
    const bubbla = /** @type {HTMLElement} */ (fet.closest("[data-bubbla]"));
    expect(bubbla.querySelector("br")).not.toBeNull();
    expect(bubbla.querySelector("a")?.getAttribute("href")).toBe("https://exempel.se/f");
    expect(bubbla.textContent).not.toContain("**");
  });
  it("⛔ utan status i källan: ingen rad, också när ett statusdokument finns", async () => {
    const { kalla, s, a } = await underlag();
    await kalla.create(`samtal/${a.id}/status`, { id: "agent", lage: "tanker", sedan: Date.now() });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await screen.findByText("obetalda");
    expect(document.querySelector("[data-agentstatus]")).toBeNull();
  });
  it("⛔ tänker, skriver, borta, och efter två minuter en felrad i stället för en evig status", async () => {
    const { kalla, s, a } = await underlag({ status: "status" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await screen.findByText("obetalda");
    expect(document.querySelector("[data-agentstatus]")).toBeNull();
    await act(async () => {
      await kalla.create(`samtal/${a.id}/status`, { id: "agent", lage: "tanker", sedan: Date.now() });
    });
    await waitFor(() => expect(document.querySelector('[data-agentstatus="tanker"]')).not.toBeNull());
    expect(document.querySelector('[data-agentstatus="tanker"]')?.textContent).toContain("Agenten tänker");
    await act(async () => {
      await kalla.update(`samtal/${a.id}/status`, "agent", { lage: "skriver" });
    });
    expect(document.querySelector('[data-agentstatus="skriver"]')?.textContent).toContain("Agenten skriver");
    await act(async () => {
      await kalla.remove(`samtal/${a.id}/status`, "agent");
    });
    expect(document.querySelector("[data-agentstatus]")).toBeNull();
    await act(async () => {
      await kalla.create(`samtal/${a.id}/status`, { id: "agent", lage: "skriver", sedan: Date.now() - AGENTSTATUS_MAX_ALDER - 1000 });
    });
    const fel = document.querySelector('[data-agentstatus="fel"]');
    expect(fel?.getAttribute("role")).toBe("alert");
    expect(fel?.textContent).toContain("inte svarat på två minuter");
  });
  it("⛔ en status som blir gammal medan samtalet är öppet byts mot felraden utan att något annat händer", async () => {
    // ⛔ En källa UTAN lyssnare: statusen läses en gång, och ingen annan skrivning kan rita om raden. Bara timern kan byta den.
    const { kalla, s, a } = await underlag({ status: "status", utanLyssnare: true });
    // Färsk i 300 ms till: timern ska byta raden när gränsen passeras, utan en ny skrivning.
    await kalla.create(`samtal/${a.id}/status`, { id: "agent", lage: "tanker", sedan: Date.now() - AGENTSTATUS_MAX_ALDER + 300 });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await waitFor(() => expect(document.querySelector('[data-agentstatus="tanker"]')).not.toBeNull());
    await waitFor(() => expect(document.querySelector('[data-agentstatus="fel"]')).not.toBeNull(), { timeout: 3000 });
    expect(document.querySelector('[data-agentstatus="tanker"]')).toBeNull();
  });
  it("⛔ en timer som vaknar före väggklockan sätts om, så att statusen inte står kvar för alltid (0.73.1)", async () => {
    /*
     * ⛔ Provet ovan var instabilt: 6 av 30 körningar på main 2026-10-07 föll på rad 185, eftersom timern ibland vaknade en
     * millisekund innan `Date.now()` hunnit passera gränsen, och ingen ny timer sattes. Här görs det deterministiskt: när raden
     * "tänker" syns och timern är satt släpar väggklockan 200 ms efter timerns klocka.
     */
    const { kalla, s, a } = await underlag({ status: "status", utanLyssnare: true });
    await kalla.create(`samtal/${a.id}/status`, { id: "agent", lage: "tanker", sedan: Date.now() - AGENTSTATUS_MAX_ALDER + 300 });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await waitFor(() => expect(document.querySelector('[data-agentstatus="tanker"]')).not.toBeNull());
    const riktig = Date.now.bind(Date);
    const slapar = vi.spyOn(Date, "now").mockImplementation(() => riktig() - 200);
    try {
      await waitFor(() => expect(document.querySelector('[data-agentstatus="fel"]')).not.toBeNull(), { timeout: 3000 });
    } finally {
      slapar.mockRestore();
    }
  });
  it("⛔ en väggklocka som står still på gränsen i 400 ms låser inte raden (granskningen av PR 288)", async () => {
    /*
     * ⛔ Granskaren mätte det: med `nu` i beroendelistan och `setNu(Date.now())` gav en klocka som stod på `sedan + MAX` samma tal
     * två gånger. React ritade inte om, effekten kördes inte, ingen ny timer sattes, och raden stod kvar som "tänker" också efter att
     * klockan släppts. Här står klockan exakt på gränsen (gränsen är strikt, så statusen räknas som färsk) i 400 ms och släpps sedan.
     */
    const { kalla, s, a } = await underlag({ status: "status", utanLyssnare: true });
    const sedan = Date.now() - AGENTSTATUS_MAX_ALDER + 300;
    await kalla.create(`samtal/${a.id}/status`, { id: "agent", lage: "tanker", sedan });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await waitFor(() => expect(document.querySelector('[data-agentstatus="tanker"]')).not.toBeNull());
    const still = vi.spyOn(Date, "now").mockImplementation(() => sedan + AGENTSTATUS_MAX_ALDER);
    try {
      await new Promise((klar) => setTimeout(klar, 400));
    } finally {
      still.mockRestore();
    }
    await waitFor(() => expect(document.querySelector('[data-agentstatus="fel"]')).not.toBeNull(), { timeout: 3000 });
  });
  it("⛔ en status som inte går att läsa är en felrad, aldrig tystnad", async () => {
    const { s, a } = await underlag({ status: "status" });
    const trasig = /** @type {any} */ ({ ...s, prenumereraStatus: (_sid, /** @type {any} */ l) => (l.onError(new Error("permission-denied")), () => {}) });
    render(<OpsMeddelanden kalla={trasig} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    await screen.findByText("obetalda");
    expect(document.querySelector('[data-agentstatus="fel"]')?.textContent).toContain("kunde inte läsas");
  });
});
