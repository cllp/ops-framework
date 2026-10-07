import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden, OpsSamtal, OpsTrad } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harReaktioner } from "../data/samtalskalla.js";
import { REAKTIONSFALT, REAKTIONSKODER, REAKTIONSTAK, byggReaktion, reaktionsnyckel, summeraReaktioner } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";
import { levandeKalla } from "./levandeKalla.js";
import { REAKTIONSVY, reaktionsnamnPa } from "../components/reaktionsvy.js";

/**
 * Etapp 3 av chattens nattskiva: reaktioner (chattanalysen 3.1).
 *
 * ⛔ HÄR MÄTS BETEENDE: nyckeln bär unikheten, antalet räknas fram, en tryckning växlar bara den egna, en lyssnare per samtal
 * (också i en tråd), väljaren nås med tangentbordet och stängs med Escape, och utan nyckeln finns ingenting av det.
 * Reglerna mäts i `rules/__tests__/chattnatt.test.mjs`, utseendet i check-skalyta 29g (3).
 */

describe("modellen", () => {
  it("⛔ nyckeln är mid|uid|kod, och okända koder och trasiga id:n kastar", () => {
    expect(reaktionsnyckel({ mid: "m1", av: "anna", kod: "tumme" })).toBe("m1|anna|tumme");
    expect(byggReaktion({ mid: "m1", av: "anna", kod: "eld", tid: 5 })).toEqual({ id: "m1|anna|eld", mid: "m1", av: "anna", kod: "eld", tid: 5 });
    expect(Object.keys(byggReaktion({ mid: "m1", av: "anna", kod: "eld", tid: 5 })).filter((k) => k !== "id").sort()).toEqual([...REAKTIONSFALT].sort());
    expect(() => byggReaktion({ mid: "m1", av: "anna", kod: "👍" })).toThrow(/finns inte/);
    expect(() => byggReaktion({ mid: "a/b", av: "anna", kod: "eld" })).toThrow(/inget meddelandes id/);
    expect(() => byggReaktion({ mid: "a|b", av: "anna", kod: "eld" })).toThrow(/inget meddelandes id/);
    expect(REAKTIONSKODER).toHaveLength(6);
  });
  it("⛔ antalet räknas fram per meddelande och kod, i listans ordning, och okända koder hoppas över", () => {
    const s = summeraReaktioner(
      [
        { mid: "m1", av: "bo", kod: "eld" },
        { mid: "m1", av: "anna", kod: "tumme" },
        { mid: "m1", av: "bo", kod: "tumme" },
        { mid: "m2", av: "bo", kod: "hjarta" },
        { mid: "m2", av: "bo", kod: "okänd" },
      ],
      "anna",
    );
    expect(s.get("m1")).toEqual([{ kod: "tumme", antal: 2, egen: true }, { kod: "eld", antal: 1, egen: false }]);
    expect(s.get("m2")).toEqual([{ kod: "hjarta", antal: 1, egen: false }]);
  });
});

describe("källan och regeltexten", () => {
  it("⛔ utan reaktioner: inga funktioner och ingen regeltext om dem", () => {
    const k = createSamtalskalla({ kalla: createMemorySource({}) });
    expect(harReaktioner(k)).toBe(false);
    expect(samtalsregelfragment({ tradar: "tradar", status: "status" })).not.toContain("opsGiltigReaktion");
    expect(samtalsregelfragment({ reaktioner: "reaktioner" })).toContain("match /reaktioner/{rid}");
    expect(() => samtalsregelfragment({ reaktioner: "status", status: "status" })).toThrow(/krockar med status/);
  });
  it("⛔ regeln bär fälten, koderna och nyckeln ur modellen, och raderingen bara för den egna", () => {
    const r = samtalsregelfragment({ reaktioner: "reaktioner", tradar: "tradar" });
    expect(r).toContain(`d.keys().hasOnly([${REAKTIONSFALT.map((f) => `"${f}"`).join(", ")}])`);
    expect(r).toContain(`d.kod in [${REAKTIONSKODER.map((f) => `"${f}"`).join(", ")}]`);
    expect(r).toContain("rid == d.mid + '|' + d.av + '|' + d.kod");
    expect(r.match(/allow delete: if opsISamtal\(sid\) && resource\.data\.av == request\.auth\.uid;/g)).toHaveLength(1);
    expect(r.match(/allow delete: if opsIGruppchatten\(sid\) && resource\.data\.av == request\.auth\.uid;/g)).toHaveLength(1);
  });
  it("reagera och taBortReaktion skriver och tar bort raden med den härledda nyckeln, i samtalet och i tråden", async () => {
    const kalla = createMemorySource({});
    const s = /** @type {any} */ (createSamtalskalla({ kalla, reaktioner: "reaktioner", tradar: "tradar" }));
    const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
    const m = await s.skicka(g.id, { text: "Hej", av: "bo" });
    await s.reagera(g.id, { mid: m.id, kod: "tumme", av: "anna" });
    await s.reagera(g.id, { mid: m.id, kod: "tumme", av: "anna" });
    expect((await s.lasReaktioner(g.id)).rader.map((/** @type {any} */ r) => r.id)).toEqual([`${m.id}|anna|tumme`]);
    await s.taBortReaktion(g.id, { mid: m.id, kod: "tumme", av: "anna" });
    expect((await s.lasReaktioner(g.id)).rader).toHaveLength(0);
    await s.reagera(g.id, { mid: "t1", kod: "eld", av: "anna" }, { trad: m.id });
    expect(await kalla.list(`samtal/${g.id}/tradar/${m.id}/reaktioner`)).toHaveLength(1);
    const utan = /** @type {any} */ (createSamtalskalla({ kalla, reaktioner: "reaktioner" }));
    await expect(utan.reagera(g.id, { mid: "t1", kod: "eld", av: "anna" }, { trad: m.id })).rejects.toThrow(/kräver tradar/);
  });
  it("⛔ en lyssnare per samtal, med taket, och fler när taket nås", async () => {
    const bas = levandeKalla();
    /** @type {any[]} */
    const fragor = [];
    const kalla = { ...bas, subscribe: (/** @type {string} */ c, /** @type {any} */ q, /** @type {any} */ l) => (fragor.push([c, q]), bas.subscribe(c, q, l)) };
    const s = /** @type {any} */ (createSamtalskalla({ kalla, reaktioner: "reaktioner" }));
    /** @type {any[]} */
    const svar = [];
    s.prenumereraReaktioner("g|grupp", { onData: (/** @type {any} */ x) => svar.push(x), onError: () => {} });
    await waitFor(() => expect(svar).toHaveLength(1));
    expect(fragor).toEqual([["samtal/g|grupp/reaktioner", { sortBy: "tid", direction: "desc", limit: REAKTIONSTAK }]]);
    expect(svar[0].fler).toBe(false);
  });
});

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];
/** @param {string} uid */
const NAMN_FOR = (uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;

/** @param {{ reaktioner?: boolean }} [val] */
async function underlag(val = { reaktioner: true }) {
  const kalla = levandeKalla();
  let t = Date.now() - 100000;
  const s = /** @type {any} */ (createSamtalskalla({ kalla, klocka: () => (t += 1000), tradar: "tradar", ...(val.reaktioner ? { reaktioner: "reaktioner" } : {}) }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  const m1 = await s.skicka(g.id, { text: "Styrelsemötet flyttas", av: "bo" });
  const m2 = await s.skicka(g.id, { text: "Jag tar kaffe", av: "anna" });
  if (val.reaktioner) await s.reagera(g.id, { mid: m1.id, kod: "tumme", av: "bo" });
  return { kalla, s, g, m1, m2 };
}

describe("vyn", () => {
  it("⛔ utan reaktioner i källan: varken knappar eller chips", async () => {
    const { s, g } = await underlag({ reaktioner: false });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    // ⛔ I loggen, inte i listans utdrag: annars mäts tomheten innan loggen ritats.
    await within(await screen.findByRole("log")).findByText("Jag tar kaffe");
    expect(document.querySelectorAll("[data-bubbla]").length).toBe(2); // golv: båda bubblorna står där
    expect(screen.queryByRole("button", { name: "Reagera" })).toBeNull();
    expect(document.querySelector("[data-reaktioner]")).toBeNull();
  });
  it("⛔ chippet visar antal, säger om reaktionen är min, och en tryckning växlar bara min egen", async () => {
    const { s, g, m1 } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const chip = await screen.findByRole("button", { name: "Tummen upp, 1" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    const min = await screen.findByRole("button", { name: "Tummen upp, 2, du har reagerat" });
    expect(min.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(min);
    await screen.findByRole("button", { name: "Tummen upp, 1" });
    // Bos reaktion står kvar: växlingen rörde bara min.
    expect((await s.lasReaktioner(g.id)).rader.map((/** @type {any} */ r) => r.id)).toEqual([`${m1.id}|bo|tumme`]);
  });
  it("⛔ väljaren: öppnas med Reagera, fokus på första, pilar flyttar, Escape stänger och lämnar fokus på knappen", async () => {
    const { s, g, m2 } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    await within(await screen.findByRole("log")).findByText("Jag tar kaffe");
    const knapp = /** @type {HTMLElement} */ (document.querySelector(`[data-reagera="${m2.id}"]`));
    fireEvent.click(knapp);
    const valjare = await screen.findByRole("group", { name: "Välj en reaktion" });
    const knappar = within(valjare).getAllByRole("button");
    expect(knappar).toHaveLength(6);
    expect(document.activeElement).toBe(knappar[0]);
    fireEvent.keyDown(valjare, { key: "ArrowRight" });
    expect(document.activeElement).toBe(knappar[1]);
    fireEvent.keyDown(valjare, { key: "ArrowLeft" });
    fireEvent.keyDown(valjare, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(knappar[5]);
    fireEvent.keyDown(valjare, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Välj en reaktion" })).toBeNull();
    expect(document.activeElement).toBe(knapp);
    expect(knapp.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(knapp);
    fireEvent.click(within(await screen.findByRole("group", { name: "Välj en reaktion" })).getByRole("button", { name: "Eld" }));
    await screen.findByRole("button", { name: "Eld, 1, du har reagerat" });
    expect(document.activeElement).toBe(knapp);
  });
  it("⛔ en nekad reaktion säger det", async () => {
    const { s, g } = await underlag();
    const trasig = { ...s, reagera: async () => Promise.reject(new Error("permission-denied")) };
    render(<OpsMeddelanden kalla={trasig} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tummen upp, 1" }));
    expect((await screen.findByText("Reaktionen kunde inte sparas.")).getAttribute("role")).toBe("alert");
  });
  it("⛔ en läsning som föll säger det, i stället för att se ut som noll reaktioner", async () => {
    const { s, g } = await underlag();
    const trasig = { ...s, prenumereraReaktioner: (/** @type {any} */ _sid, /** @type {any} */ l) => (l.onError(new Error("permission-denied")), () => {}) };
    render(<OpsMeddelanden kalla={trasig} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    expect((await screen.findByText("Reaktionerna kunde inte hämtas.")).getAttribute("role")).toBe("alert");
  });
  it("⛔ i tråden: trådens egna reaktioner, under tråden", async () => {
    const { kalla, s, g, m1 } = await underlag();
    const svar = await s.skickaITrad(g.id, m1.id, { text: "Svar i tråden", av: "bo" });
    await s.reagera(g.id, { mid: svar.id, kod: "klapp", av: "bo" }, { trad: m1.id });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} valtTrad={m1.id} />);
    const chip = await screen.findByRole("button", { name: "Applåd, 1" });
    fireEvent.click(chip);
    await screen.findByRole("button", { name: "Applåd, 2, du har reagerat" });
    expect(await kalla.list(`samtal/${g.id}/tradar/${m1.id}/reaktioner`)).toHaveLength(2);
    expect((await s.lasReaktioner(g.id)).rader).toHaveLength(1);
  });
  it("⛔ när läsningen når taket sägs det", async () => {
    const { s, g } = await underlag();
    const fullt = { ...s, prenumereraReaktioner: (/** @type {any} */ _sid, /** @type {any} */ l) => (l.onData({ rader: [], fler: true }), () => {}) };
    render(<OpsMeddelanden kalla={fullt} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    expect(await screen.findByText("Äldre reaktioner visas inte.")).toBeTruthy();
  });
});

/*
 * ⛔ LUCIDE OCH INTE EMOJI (0.75.0, CP 2026-10-07: "Kör Lucide Ikoner som reaktioner"). Datan bär fortfarande bara koden. Här mäts
 * vad som RITAS: Lucides egen klass på svg:n (`lucide-<namn>`) säger vilken ikon det är, och ingen text i knappen får vara ett tecken
 * ur emojiblocket.
 */
const VANTAD_IKON = /** @type {const} */ ({ tumme: "lucide-thumbs-up", hjarta: "lucide-heart", skratt: "lucide-laugh", eld: "lucide-flame", klapp: "lucide-party-popper", bock: "lucide-check" });
const EMOJI = /\p{Extended_Pictographic}/u;

describe("ikonerna", () => {
  it("⛔ varje kod har en Lucide-ikon och ett namn på svenska och engelska (golv: sex)", () => {
    expect(REAKTIONSKODER.length).toBeGreaterThanOrEqual(6);
    for (const kod of REAKTIONSKODER) {
      const vy = REAKTIONSVY[kod];
      expect(typeof vy?.Ikon, kod).toBe("function");
      const { container } = render(<vy.Ikon size={20} />);
      const svg = container.querySelector("svg");
      expect(svg?.classList.contains(VANTAD_IKON[kod]), `${kod}: ${svg?.getAttribute("class")}`).toBe(true);
      expect(svg?.getAttribute("stroke-width")).toBe("1.5");
      expect(EMOJI.test(container.textContent ?? ""), kod).toBe(false);
      expect(vy.namn.sv.length > 0 && vy.namn.en.length > 0, kod).toBe(true);
      expect(EMOJI.test(vy.namn.sv + vy.namn.en), kod).toBe(false);
    }
    expect(reaktionsnamnPa("en").tumme).toBe("Thumbs up");
    expect(reaktionsnamnPa("sv").tumme).toBe("Tummen upp");
  });
  it("⛔ en sparad reaktion ritas som sin ikon under bubblan, med antalet och inget tecken", async () => {
    const { s, g, m1 } = await underlag();
    await s.reagera(g.id, { mid: m1.id, kod: "klapp", av: "anna" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    const tumme = await screen.findByRole("button", { name: "Tummen upp, 1" });
    const klapp = await screen.findByRole("button", { name: "Applåd, 1, du har reagerat" });
    expect(tumme.querySelector(`svg.${VANTAD_IKON.tumme}`)).not.toBeNull();
    expect(klapp.querySelector(`svg.${VANTAD_IKON.klapp}`)).not.toBeNull();
    expect(tumme.textContent).toBe("1");
    expect(klapp.textContent).toBe("1");
    // Ovald i textfärgen, vald i accenten.
    expect(tumme.querySelector("[data-reaktionsikon]")?.classList.contains("text-ink")).toBe(true);
    expect(klapp.querySelector("[data-reaktionsikon]")?.classList.contains("text-accent")).toBe(true);
    expect(klapp.getAttribute("aria-pressed")).toBe("true");
    const rad = /** @type {HTMLElement} */ (document.querySelector(`[data-reaktioner="${m1.id}"]`));
    expect(rad.querySelectorAll("button")).toHaveLength(2); // golv
    expect(EMOJI.test(rad.textContent ?? "")).toBe(false);
  });
  it("⛔ väljaren ritar sex ikoner, och den egna reaktionen är tryckt", async () => {
    const { s, g, m1 } = await underlag();
    await s.reagera(g.id, { mid: m1.id, kod: "eld", av: "anna" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} />);
    await screen.findByRole("button", { name: "Eld, 1, du har reagerat" });
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector(`[data-reagera="${m1.id}"]`)));
    const valjare = await screen.findByRole("group", { name: "Välj en reaktion" });
    const knappar = within(valjare).getAllByRole("button");
    expect(knappar).toHaveLength(6);
    for (const [i, kod] of REAKTIONSKODER.entries()) {
      expect(knappar[i].querySelector(`svg.${VANTAD_IKON[kod]}`), kod).not.toBeNull();
      expect(knappar[i].getAttribute("aria-pressed"), kod).toBe(kod === "eld" ? "true" : "false");
    }
    expect(EMOJI.test(valjare.textContent ?? "")).toBe(false);
  });
  it("⛔ på engelska heter reaktionerna på engelska", async () => {
    const { s, g } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={g.id} sprak="en" />);
    expect(await screen.findByRole("button", { name: "Thumbs up, 1" })).toBeTruthy();
  });
  /*
   * ⛔ OpsSamtal och OpsTrad är egna exporter (src/index.js) och kan användas utan OpsMeddelanden runt sig. Byggde de sina texter
   * själva utan `reaktionsnamnPa(sprak)` blev namnen svenska med sprak="en" (granskningen av PR 290). En källa: samma funktion
   * bygger texterna i alla tre.
   */
  it("⛔ OpsSamtal ensam, på engelska: reaktionernas namn på engelska", async () => {
    const { s, g } = await underlag();
    render(<OpsSamtal kalla={s} uid="anna" samtal={g} namnFor={NAMN_FOR} medlemmar={MEDLEMMAR} sprak="en" />);
    const chip = await screen.findByRole("button", { name: "Thumbs up, 1" });
    expect(chip.querySelector(`svg.${VANTAD_IKON.tumme}`)).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Tummen upp/ })).toBeNull();
  });
  it("⛔ OpsTrad ensam, på engelska: reaktionernas namn på engelska", async () => {
    const { s, g, m1 } = await underlag();
    const svar = await s.skickaITrad(g.id, m1.id, { text: "Svar i tråden", av: "bo" });
    await s.reagera(g.id, { mid: svar.id, kod: "klapp", av: "bo" }, { trad: m1.id });
    render(<OpsTrad kalla={s} uid="anna" samtal={g} tid={m1.id} namnFor={NAMN_FOR} medlemmar={MEDLEMMAR} sprak="en" />);
    const chip = await screen.findByRole("button", { name: "Applause, 1" });
    expect(chip.querySelector(`svg.${VANTAD_IKON.klapp}`)).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Applåd/ })).toBeNull();
  });
});
