import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { AUTONAMN_LANGD, MAX_TRADNAMN, NAMNLOS_TRAD, TRADFALT, autonamn, byggTrad, kravTradnamn, rensaForNamn, tradensNamn } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";
import * as nod from "../node/index.js";

/**
 * Trådar i gruppchatten (0.66.0, cllp/lifehub.app#60): namnregeln, källan och vyn, mot minnesadaptern.
 *
 * ⛔ HÄR MÄTS BETEENDE: vilket namn en tråd får, att tråden skapas med det första svaret och inte när den öppnas, att märket
 * visar antal och namn, att omdöpning och återgång fungerar, och att trådar bara finns i gruppchatten. Hur det SER UT mäts i
 * Chromium av `check-skalyta` avsnitt 29 (e). Reglerna mäts i `rules/__tests__/tradar.test.mjs`.
 */

describe("namnregeln: ett begripligt namn ur frågan, ingen modell", () => {
  it("⛔ rotmeddelandet utan @-nämnanden, länkar och markdowntecken", () => {
    expect(autonamn([{ text: "@Agent kan du **sammanfatta** budgeten för Q3? https://example.com/x" }])).toBe("Kan du sammanfatta budgeten för Q3?");
    expect(rensaForNamn("\n\n  # Rubrik\nandra raden")).toBe("Rubrik");
    expect(rensaForNamn("kalle@agent.se skrev")).toBe("Kalle@agent.se skrev");
  });
  it("⛔ ett för kort rotmeddelande får nästa till hjälp, ett långt nog gör det inte", () => {
    expect(autonamn([{ text: "Kolla här" }, { text: "Avtalet med hyresvärden löper ut" }, { text: "tredje" }])).toBe("Kolla här / Avtalet med hyresvärden löper ut");
    expect(autonamn([{ text: "Budgeten för Q3, hur ser den ut?" }, { text: "Tight" }])).toBe("Budgeten för Q3, hur ser den ut?");
  });
  it("⛔ kortas vid ett ordslut, aldrig längre än gränsen", () => {
    const lang = "Vi behöver bestämma hur vi gör med resan till Göteborg nästa månad och vem som bokar hotellet";
    const n = autonamn([{ text: lang }]);
    expect(n.length).toBeLessThanOrEqual(AUTONAMN_LANGD);
    expect(n.endsWith("…")).toBe(true);
    expect(lang.startsWith(n.slice(0, -1))).toBe(true);
    expect(autonamn([{ text: "x".repeat(200) }])).toHaveLength(AUTONAMN_LANGD);
  });
  it("⛔ tomhet är ett svar: inget namn blir ett utskrivet namn (regel 5)", () => {
    expect(autonamn([])).toBe(NAMNLOS_TRAD);
    expect(autonamn([{ text: "@Agent" }, { text: "https://x.se" }, { text: undefined }])).toBe(NAMNLOS_TRAD);
  });
  it("⛔ ett satt namn vinner, ett tomt ger det härledda igen", () => {
    const ms = [{ text: "Budgeten för Q3, hur ser den ut?" }];
    expect(tradensNamn({ namn: "Q3-budget" }, ms)).toBe("Q3-budget");
    expect(tradensNamn({ namn: "   " }, ms)).toBe("Budgeten för Q3, hur ser den ut?");
    expect(tradensNamn(null, ms)).toBe("Budgeten för Q3, hur ser den ut?");
  });
  it("byggTrad och kravTradnamn: nyckeln är roten, inga fält utöver modellens, taket gäller", () => {
    const t = byggTrad({ rot: "m1", skapadAv: "anna", skapad: 5 });
    expect(t).toEqual({ id: "m1", skapad: 5, skapadAv: "anna" });
    expect(Object.keys(byggTrad({ rot: "m1", skapadAv: "anna", skapad: 5, namn: "x" })).filter((k) => k !== "id").every((k) => TRADFALT.includes(/** @type {any} */ (k)))).toBe(true);
    expect(() => byggTrad({ rot: "", skapadAv: "anna" })).toThrow(/rot krävs/);
    expect(() => kravTradnamn("y".repeat(MAX_TRADNAMN + 1))).toThrow(/taket/);
    expect(kravTradnamn("  ")).toBeNull();
  });
  it("⛔ node-delen exporterar samma regel, så att appens agent kallar tråden samma sak", () => {
    expect(nod.autonamn).toBe(autonamn);
    expect(nod.tradensNamn).toBe(tradensNamn);
  });
  it("regelfragmentets fält och tak kommer ur modellen, och samlingsnamnet skickas in", () => {
    const r = samtalsregelfragment({ tradar: "tradar" });
    expect(r).toContain(`hasOnly([${TRADFALT.map((f) => `"${f}"`).join(", ")}])`);
    expect(r).toContain(`d.namn.size() <= ${MAX_TRADNAMN}`);
    expect(samtalsregelfragment({ tradar: "tradarna" })).toContain("match /tradarna/{tid}");
    expect(() => samtalsregelfragment({ tradar: "a/b" })).toThrow();
  });
});

async function underlag() {
  let t = Date.now() - 600000;
  const kalla = createMemorySource({});
  const samtal = createSamtalskalla({ kalla, klocka: () => (t += 1000) });
  const g = await samtal.oppnaGrupp({ groupId: "g", uid: "anna" });
  const rot = await samtal.skicka(g.id, { text: "Budgeten för Q3, hur ser den ut?", av: "cecilia" });
  const utan = await samtal.skicka(g.id, { text: "Fika på fredag?", av: "bo" });
  await samtal.skickaITrad(g.id, rot.id, { text: "Den ser tight ut", av: "bo" });
  await samtal.skickaITrad(g.id, rot.id, { text: "@Agent kan du sammanfatta?", av: "anna" });
  const p = await samtal.oppnaPrivat({ groupId: "g", uid: "bo", annan: "anna" });
  await samtal.skicka(p.id, { text: "Privat fråga", av: "bo" });
  return { kalla, samtal, grupp: g, rot, utan, privat: p };
}

describe("createSamtalskalla: trådarna", () => {
  it("⛔ en tråd skapas med det första svaret, under gruppchatten, med roten som nyckel", async () => {
    const { kalla, samtal, grupp, rot, utan } = await underlag();
    expect(await samtal.trad(grupp.id, utan.id)).toBeNull();
    const tr = await samtal.trad(grupp.id, rot.id);
    expect(tr).toMatchObject({ id: rot.id, skapadAv: "bo" });
    expect(await kalla.list(`samtal/${grupp.id}/tradar`)).toHaveLength(1);
    expect((await samtal.tradmeddelanden(grupp.id, rot.id)).map((m) => m.text)).toEqual(["Den ser tight ut", "@Agent kan du sammanfatta?"]);
  });
  it("⛔ oppnaTrad två gånger ger samma tråd, och skaparen byts inte", async () => {
    const { samtal, grupp, rot } = await underlag();
    const igen = await samtal.oppnaTrad({ sid: grupp.id, rot: rot.id, uid: "anna" });
    expect(igen.skapadAv).toBe("bo");
  });
  it("⛔ ett tomt svar lämnar ingen tom tråd efter sig", async () => {
    const { samtal, grupp, utan } = await underlag();
    await expect(samtal.skickaITrad(grupp.id, utan.id, { text: "  ", av: "anna" })).rejects.toThrow(/tom/);
    expect(await samtal.trad(grupp.id, utan.id)).toBeNull();
  });
  it("tradar räknar svaren och ger de första för namnet, bara för de rötter som syns", async () => {
    const { samtal, grupp, rot, utan } = await underlag();
    const [r] = await samtal.tradar(grupp.id, { rotter: [rot.id, utan.id] });
    expect(r).toMatchObject({ id: rot.id, antal: 2, fler: false });
    expect(r.forsta).toHaveLength(2);
    expect(await samtal.tradar(grupp.id, { rotter: [utan.id] })).toEqual([]);
  });
  it("⛔ dopOm sätter namnet, och null tar bort det så att det härledda gäller", async () => {
    const { samtal, grupp, rot } = await underlag();
    await samtal.dopOm(grupp.id, rot.id, "Q3-budget");
    expect((await samtal.trad(grupp.id, rot.id))?.namn).toBe("Q3-budget");
    await samtal.dopOm(grupp.id, rot.id, null);
    expect(await samtal.trad(grupp.id, rot.id)).not.toHaveProperty("namn");
  });
});

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "cecilia", namn: "Cecilia Berg", typ: "person", status: "aktiv" },
];

describe("OpsMeddelanden: trådar i gruppchatten", () => {
  it("⛔ märket visar antal och namn, och öppnar tråden med roten, svaren och vem som ser den", async () => {
    const { samtal, grupp } = await underlag();
    const onValjTrad = vi.fn();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} onValjTrad={onValjTrad} />);
    const user = userEvent.setup();
    const marke = await screen.findByRole("button", { name: /2 svar · Budgeten för Q3, hur ser den ut\?/ });
    expect(screen.getAllByRole("button", { name: "Svara i tråd" })).toHaveLength(1);
    await user.click(marke);
    expect(onValjTrad).toHaveBeenLastCalledWith(expect.any(String));
    const logg = await screen.findByRole("log", { name: "Budgeten för Q3, hur ser den ut?" });
    await waitFor(() => expect(within(logg).getByText("@Agent kan du sammanfatta?")).toBeInTheDocument());
    expect(within(logg).getByText("Budgeten för Q3, hur ser den ut?")).toBeInTheDocument();
    expect(within(logg).queryByText("Fika på fredag?")).toBeNull();
    expect(within(logg).getByText("2 svar")).toBeInTheDocument();
    expect(screen.getByText("Alla i gruppen ser tråden")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Alfa AB" }));
    expect(onValjTrad).toHaveBeenLastCalledWith(null);
    await screen.findByRole("log", { name: "Alfa AB" });
  });

  it("⛔ Svara i tråd skapar ingen tråd förrän något skickas, och efteråt finns märket", async () => {
    const { samtal, grupp, utan } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Svara i tråd" }));
    await screen.findByText("Inga svar än. Skriv det första.");
    expect(await samtal.trad(grupp.id, utan.id)).toBeNull();
    expect(screen.queryByRole("button", { name: "Döp om" })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), "Ja gärna{Enter}");
    await waitFor(async () => expect(await samtal.trad(grupp.id, utan.id)).not.toBeNull());
    await screen.findByText("1 svar");
    await user.click(screen.getByRole("button", { name: "Alfa AB" }));
    await screen.findByRole("button", { name: /1 svar · Fika på fredag\?/ });
  });

  it("⛔ döp om och tillbaka till det automatiska namnet", async () => {
    const { samtal, grupp, rot } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={grupp.id} valtTrad={rot.id} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Döp om" }));
    const falt = screen.getByRole("textbox", { name: "Trådens namn" });
    await user.clear(falt);
    await user.type(falt, "Q3-budget{Enter}");
    await screen.findByRole("heading", { name: "Q3-budget" });
    expect((await samtal.trad(grupp.id, rot.id))?.namn).toBe("Q3-budget");
    await user.click(screen.getByRole("button", { name: "Döp om" }));
    await user.click(screen.getByRole("button", { name: "Använd det automatiska namnet" }));
    await screen.findByRole("heading", { name: "Budgeten för Q3, hur ser den ut?" });
  });

  it("⛔ ett privat samtal har inga trådar, och ett trådval gäller inte där", async () => {
    const { samtal, privat, rot } = await underlag();
    render(<OpsMeddelanden kalla={samtal} uid="anna" groupId="g" gruppNamn="Alfa AB" medlemmar={MEDLEMMAR} valt={privat.id} valtTrad={rot.id} />);
    const logg = await screen.findByRole("log", { name: "Bo Lind" });
    await waitFor(() => expect(within(logg).getByText("Privat fråga")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Svara i tråd" })).toBeNull();
    expect(document.querySelector("[data-ops-trad]")).toBeNull();
  });
});
