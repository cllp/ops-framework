import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla, harAmnen } from "../data/samtalskalla.js";
import { amnesId, amnesrubrik, delaSamtalsnyckel, kravAmne, nyttAmnesId, parnyckel, samtalsnyckel } from "../lib/samtal.js";
import { samtalsregelfragment } from "../lib/regler.js";

/**
 * Samtal per ämne med agenten (0.106.0, #386 skiva 2). CP 2026-10-14: "Så en konversation med agenten inte kluddar ner en annan."
 *
 * ⛔ HÄR MÄTS BETEENDE: nyckeln, källan (ett ämne skrivs först med sitt första meddelande, ett arkiverat ämne läses inte), och vyn
 * (agentens rad i inkorgen, ämneslistan, Nytt samtal, rubriken och Arkivera). Reglerna mäts mot emulatorn i
 * `rules/__tests__/amnen.test.mjs`, och utseendet i check-skalyta 47 (2).
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Hugo", typ: "agent", status: "aktiv" },
];

/** En källa med räknade läsningar av meddelanden, så att "ett arkiverat ämne kostar noll läsningar" går att mäta. */
function raknandeKalla() {
  const kalla = createMemorySource({});
  const lasta = /** @type {string[]} */ ([]);
  const list = kalla.list.bind(kalla);
  kalla.list = async (vag, fraga) => {
    if (vag.endsWith("/meddelanden")) lasta.push(vag);
    return list(vag, fraga);
  };
  return { kalla, lasta };
}

async function underlag() {
  const { kalla, lasta } = raknandeKalla();
  let t = new Date(2026, 9, 14, 9, 0).getTime();
  const s = /** @type {any} */ (createSamtalskalla({ kalla, amnen: true, klocka: () => (t += 60000) }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  await s.skicka(g.id, { text: "Hej gruppen", av: "bo" });
  // Det befintliga agentsamtalet, som står kvar som det första ämnet.
  const forsta = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
  await s.skicka(forsta.id, { text: "Vilka fakturor är obetalda?", av: "anna" });
  // Ett ämne med rubrik som agenten satt, och agentens svar skrivet förbi källan som appens server gör.
  const moms = await s.oppnaAmne({ groupId: "g", uid: "anna", agent: "ops", text: "Hur ligger momsen till?" });
  await kalla.update("samtal", moms.samtal.id, { rubrik: "Momsen för augusti" });
  await kalla.create(`samtal/${moms.samtal.id}/meddelanden`, { text: "Den är deklarerad.", av: "ops", tid: (t += 60000) });
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  await s.skicka(p.id, { text: "Lunch?", av: "bo" });
  return { kalla, lasta, s, g, forsta, moms: moms.samtal, p };
}

describe("nyckeln för ett ämne", () => {
  it("⛔ fyra delar för ett ämne med agenten, och läst baklänges med ämnet", () => {
    const sid = samtalsnyckel({ groupId: "g", slag: "agent", deltagare: ["ops", "anna"], amne: "a_x1" });
    expect(sid).toBe("g|anna|ops|a_x1");
    expect(delaSamtalsnyckel(sid, "g")).toEqual({ groupId: "g", deltagare: ["anna", "ops"], amne: "a_x1" });
    expect(amnesId(sid)).toBe("a_x1");
    expect(amnesId("g|anna|ops")).toBeNull();
    expect(parnyckel(sid)).toBe("g|anna|ops");
  });
  it("⛔ bara agenten har ämnen, och ett ämnesid har sin form", () => {
    expect(() => samtalsnyckel({ groupId: "g", slag: "personer", deltagare: ["anna", "bo"], amne: "a_x" })).toThrow(/bara ett samtal med agenten/);
    expect(() => samtalsnyckel({ groupId: "g", slag: "grupp", amne: "a_x" })).toThrow(/gruppchatten har inga ämnen/);
    for (const fel of ["", "A_x", "a-x", "a|x", "x", `a_${"x".repeat(39)}`]) expect(() => kravAmne(fel)).toThrow(/ämnesid/);
    expect(nyttAmnesId(1)).toMatch(/^a_1_[a-z0-9]+$/);
  });
  it("⛔ rubriken: den satta, annars den härledda ur de första meddelandena, annars den tomma", () => {
    expect(amnesrubrik({ rubrik: "Momsen" }, [{ text: "Hej" }])).toBe("Momsen");
    expect(amnesrubrik({}, [{ text: "Hur ligger **momsen** till i augusti?" }])).toBe("Hur ligger momsen till i augusti?");
    expect(amnesrubrik({}, [], "Nytt samtal")).toBe("Nytt samtal");
  });
  it("⛔ regelfragmentet utan nyckeln är detsamma, med nyckeln släpps ämnet och ändringen in", () => {
    const utan = samtalsregelfragment();
    expect(utan).not.toContain("opsAmnesandring");
    expect(utan).toContain("allow update, delete: if false;");
    const med = samtalsregelfragment({ amnen: true });
    expect(med).toContain("allow update: if opsAmnesandring(resource.data, request.resource.data);");
    expect(med).toContain("matches('a_[a-z0-9_]{1,38}')");
    expect(() => samtalsregelfragment({ amnen: /** @type {any} */ ("ja") })).toThrow(/amnen är true/);
  });
});

describe("källan", () => {
  it("⛔ utan amnen finns inga ämnesfunktioner, som förut", () => {
    expect(harAmnen(createSamtalskalla({ kalla: createMemorySource({}) }))).toBe(false);
    expect(() => createSamtalskalla({ kalla: createMemorySource({}), amnen: /** @type {any} */ ("ja") })).toThrow(/amnen är true/);
  });
  it("⛔ ett nytt ämne skrivs inte förrän det första meddelandet skickas, och då samtalet före meddelandet", async () => {
    const { kalla, s } = await underlag();
    const nytt = s.nyttAmne({ groupId: "g", uid: "anna", agent: "ops" });
    expect(amnesId(nytt.id)).toMatch(/^a_/);
    expect(await kalla.read("samtal", nytt.id)).toBeNull();
    await expect(s.skickaIAmne(nytt, { text: "  ", av: "anna" })).rejects.toThrow(/tom/);
    expect(await kalla.read("samtal", nytt.id)).toBeNull();
    await s.skickaIAmne(nytt, { text: "Boka resan", av: "anna" });
    expect(await kalla.read("samtal", nytt.id)).toMatchObject({ slag: "agent", deltagare: ["anna", "ops"], skapadAv: "anna" });
    expect((await s.meddelanden(nytt.id)).map((m) => m.text)).toEqual(["Boka resan"]);
  });
  it("⛔ samtalsdokumentet läses en gång per ämne, inte före varje meddelande (granskningen av PR 390)", async () => {
    const { kalla, s } = await underlag();
    const lasningar = /** @type {string[]} */ ([]);
    const read = kalla.read.bind(kalla);
    kalla.read = async (c, id) => {
      if (c === "samtal") lasningar.push(id);
      return read(c, id);
    };
    const nytt = s.nyttAmne({ groupId: "g", uid: "anna", agent: "ops" });
    await s.skickaIAmne(nytt, { text: "Ett", av: "anna" });
    await s.skickaIAmne(nytt, { text: "Två", av: "anna" });
    await s.skickaIAmne(nytt, { text: "Tre", av: "anna" });
    // Golv: tre meddelanden skrevs. Tak: en läsning av samtalet (förut tre).
    expect((await s.meddelanden(nytt.id)).map((m) => m.text)).toEqual(["Ett", "Två", "Tre"]);
    expect(lasningar).toEqual([nytt.id]);
    // Ett annat ämne läses för sig.
    const annat = s.nyttAmne({ groupId: "g", uid: "anna", agent: "ops" });
    await s.skickaIAmne(annat, { text: "Annat", av: "anna" });
    expect(lasningar).toEqual([nytt.id, annat.id]);
  });
  it("⛔ översikten hoppar över ett arkiverat ämne utan att läsa dess meddelanden, och läser bara de arkiverade på begäran", async () => {
    const { lasta, s, moms } = await underlag();
    await s.arkivera(moms.id, true);
    lasta.length = 0;
    const rader = await s.oversikt({ groupId: "g", uid: "anna" });
    expect(rader.map((r) => r.samtal.id)).not.toContain(moms.id);
    expect(lasta.some((v) => v.includes(moms.id))).toBe(false);
    // Golv: översikten läste något, annars mäter provet ingenting.
    expect(lasta.length).toBeGreaterThanOrEqual(3);
    const arkiv = await s.oversikt({ groupId: "g", uid: "anna", arkiverade: true });
    expect(arkiv.map((r) => r.samtal.id)).toEqual([moms.id]);
    await s.arkivera(moms.id, false);
    expect((await s.oversikt({ groupId: "g", uid: "anna" })).map((r) => r.samtal.id)).toContain(moms.id);
  });
  it("⛔ ett ämne utan meddelanden visas inte, rubriken sätts och tas bort", async () => {
    const { kalla, s, moms } = await underlag();
    const tomt = s.nyttAmne({ groupId: "g", uid: "anna", agent: "ops" });
    const { id, ...falt } = tomt;
    await kalla.create("samtal", { id, ...falt, deltagare: [...falt.deltagare] });
    expect((await s.oversikt({ groupId: "g", uid: "anna" })).map((r) => r.samtal.id)).not.toContain(tomt.id);
    await s.sattRubrik(moms.id, null);
    expect((await kalla.read("samtal", moms.id))?.rubrik).toBeUndefined();
    await expect(s.sattRubrik(moms.id, "x".repeat(81))).rejects.toThrow(/taket är 80/);
  });
});

describe("vyn", () => {
  const rita = async (/** @type {Record<string, any>} */ p = {}) => {
    const u = await underlag();
    const onValj = vi.fn();
    const r = render(<OpsMeddelanden kalla={u.s} uid="anna" groupId="g" gruppNamn="Gruppen" medlemmar={MEDLEMMAR} onValj={onValj} {...p} />);
    await screen.findByText("Gruppen");
    return { ...u, onValj, ...r };
  };

  it("⛔ inkorgen: gruppen överst, sedan agenten som EN rad med antal samtal, sedan personerna", async () => {
    await rita();
    const lista = /** @type {HTMLElement} */ (document.querySelector("[data-samtalslista]"));
    await waitFor(() => expect(lista.querySelector("[data-agentrad='ops']")).toBeTruthy());
    const ordning = [...lista.querySelectorAll("[data-samtalsrad], [data-agentrad]")].map((el) => el.getAttribute("data-samtalsrad") ?? `agent:${el.getAttribute("data-agentrad")}`);
    expect(ordning).toEqual(["grupp", "agent:ops", "personer"]);
    const agentrad = /** @type {HTMLElement} */ (lista.querySelector("[data-agentrad='ops']"));
    expect(agentrad.textContent).toContain("Hugo, gruppens agent");
    expect(agentrad.querySelector("[data-agentrad-antal]")?.textContent).toMatch(/^2 samtal, senast /);
    // Ämnena står inte som egna rader i inkorgen.
    expect(lista.querySelectorAll("[data-samtalsrad='agent']").length).toBe(0);
  });

  it("⛔ agentens rad leder till ämnena med rubrik, och ett ämne öppnas med rubriken i huvudet och en rad tillbaka", async () => {
    const { moms, forsta, onValj } = await rita();
    fireEvent.click(/** @type {HTMLElement} */ (await waitFor(() => { const el = document.querySelector("[data-agentrad='ops']"); if (!el) throw new Error("agentraden saknas"); return el; })));
    expect(onValj).toHaveBeenLastCalledWith(null, { agent: "ops" });
    const panel = /** @type {HTMLElement} */ (await waitFor(() => document.querySelector("[data-agentens-samtal='ops']")));
    expect(within(panel).getByRole("button", { name: "Nytt samtal" })).toBeTruthy();
    const rader = [...panel.querySelectorAll("[data-amnesrad]")].map((el) => el.getAttribute("data-amnesrad"));
    expect(rader).toEqual([moms.id, forsta.id]);
    expect(panel.querySelector(`[data-amnesrad='${moms.id}']`)?.textContent).toContain("Momsen för augusti");
    expect(panel.querySelector(`[data-amnesrad='${forsta.id}']`)?.textContent).toContain("Vilka fakturor är obetalda?");
    fireEvent.click(/** @type {HTMLElement} */ (panel.querySelector(`[data-amnesrad='${moms.id}']`)));
    await within(await screen.findByRole("log")).findByText("Den är deklarerad.");
    expect(document.querySelector("[data-amnesrubrik]")?.textContent).toBe("Momsen för augusti");
    expect(screen.getByRole("textbox", { name: "Skriv ett meddelande" }).getAttribute("placeholder")).toBe("Fråga agenten");
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector("[data-tillbaka-agent]")));
    await waitFor(() => expect(document.querySelector("[data-agentens-samtal='ops']")).toBeTruthy());
  });

  it("⛔ Nytt samtal skriver ingenting förrän personen skickar, och sedan står ämnet i listan med sin härledda rubrik", async () => {
    const { kalla, onValj } = await rita();
    fireEvent.click(/** @type {HTMLElement} */ (await waitFor(() => { const el = document.querySelector("[data-agentrad='ops']"); if (!el) throw new Error("agentraden saknas"); return el; })));
    fireEvent.click(await screen.findByRole("button", { name: "Nytt samtal" }));
    expect(onValj).toHaveBeenLastCalledWith(null, { nytt: "agent", agent: "ops" });
    await waitFor(() => expect(document.querySelector("[data-amne='ny']")).toBeTruthy());
    expect(document.querySelector("[data-amnesrubrik]")?.textContent).toBe("Nytt samtal");
    const fore = (await kalla.list("samtal", {})).length;
    fireEvent.change(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), { target: { value: "Boka tåget till Stockholm på fredag" } });
    expect((await kalla.list("samtal", {})).length).toBe(fore);
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(() => expect((/** @type {any} */ (onValj.mock.lastCall))?.[0]).toMatch(/^g\|anna\|ops\|a_/));
    const sid = /** @type {string} */ (/** @type {any} */ (onValj.mock.lastCall)[0]);
    expect((await kalla.list("samtal", {})).length).toBe(fore + 1);
    await waitFor(() => expect(document.querySelector("[data-amnesrubrik]")?.textContent).toBe("Boka tåget till Stockholm på fredag"));
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector("[data-tillbaka-agent]")));
    await waitFor(() => expect(document.querySelector(`[data-amnesrad='${sid}']`)).toBeTruthy());
  });

  it("⛔ Arkivera tar ämnet ur listan, Visa arkiverade läser det, och Ta fram ger tillbaka det", async () => {
    const { moms } = await rita();
    fireEvent.click(/** @type {HTMLElement} */ (await waitFor(() => { const el = document.querySelector("[data-agentrad='ops']"); if (!el) throw new Error("agentraden saknas"); return el; })));
    fireEvent.click(/** @type {HTMLElement} */ (await waitFor(() => document.querySelector(`[data-amnesrad='${moms.id}']`))));
    fireEvent.click(await screen.findByRole("button", { name: "Arkivera" }));
    await waitFor(() => expect(document.querySelector("[data-agentens-samtal='ops']")).toBeTruthy());
    await waitFor(() => expect(document.querySelector(`[data-amnesrad='${moms.id}']`)).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Visa arkiverade" }));
    await waitFor(() => expect(document.querySelector(`[data-ta-fram='${moms.id}']`)).toBeTruthy());
    fireEvent.click(/** @type {HTMLElement} */ (document.querySelector(`[data-ta-fram='${moms.id}']`)));
    await waitFor(() => expect(document.querySelectorAll(`[data-amnesrad='${moms.id}']`).length).toBe(1));
    expect(document.querySelector("[data-arkiv-tomt]")).toBeTruthy();
  });

  it("⛔ appen öppnar ett nytt ämne med en text (TALK:s Agent), och utan amnen är agentsamtalet en rad som förut", async () => {
    await rita({ nytt: "agent", nyttUtkast: "Påminn mig om momsen" });
    await waitFor(() => expect(document.querySelector("[data-amne='ny']")).toBeTruthy());
    expect(/** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Skriv ett meddelande" })).value).toBe("Påminn mig om momsen");
  });
  it("⛔ utan amnen på källan: inga agentrader, agentsamtalet står i listan som förut", async () => {
    const s = createSamtalskalla({ kalla: createMemorySource({}) });
    const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
    await s.skicka(a.id, { text: "Hej", av: "anna" });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Gruppen" medlemmar={MEDLEMMAR} />);
    await waitFor(() => expect(document.querySelector("[data-samtalsrad='agent']")).toBeTruthy());
    expect(document.querySelector("[data-agentrad]")).toBeNull();
  });
});
