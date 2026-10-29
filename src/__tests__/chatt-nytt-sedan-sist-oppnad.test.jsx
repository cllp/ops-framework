import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { levandeKalla } from "./levandeKalla.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/*
 * "Nytt sedan sist" jämförs mot när samtalet ÖPPNADES (0.153.0, cllp/ops-framework#460 punkt 6, lifehub.app QA-fynd 13c).
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: avdelaren jämförde bara mot läsmärket. I en nystartad tråd (märket står på ens egen första rad) och i ett samtal man läser stod den före ett svar som kom
 * medan samtalet var öppet. Det är nytt nu, inte nytt sedan sist.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Hugo", typ: "agent", status: "aktiv" },
];

async function underlag() {
  const kalla = levandeKalla();
  let t = new Date(2026, 9, 14, 9, 0).getTime();
  const s = /** @type {any} */ (createSamtalskalla({ kalla, status: "status", klocka: () => (t += 60000) }));
  const nasta = () => (t += 60000);
  return { kalla, s, nasta };
}

const avdelare = () => document.querySelector("[data-nytt-sedan-sist]");

describe("Nytt sedan sist och det som kommer medan samtalet är öppet", () => {
  it("⛔ en nystartad tråd: märket står på ens egen första rad, och agentens svar medan tråden är öppen får ingen avdelare", async () => {
    const { kalla, s, nasta } = await underlag();
    const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
    const egen = await s.skicka(a.id, { text: "Vad händer på fredag?", av: "anna" });
    await s.markeraLast(a.id, "anna", egen.tid);
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    fireEvent.click(await screen.findByRole("button", { name: /Hugo/ }));
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Vad händer på fredag?");
    expect(avdelare()).toBeNull();
    await act(async () => {
      await kalla.create(`samtal/${a.id}/meddelanden`, { text: "Det är styrelsemöte.", av: "ops", tid: nasta() });
    });
    await within(logg).findByText("Det är styrelsemöte.");
    expect(avdelare()).toBeNull();
  });

  it("⛔ ett svar som kommer medan man läser får ingen avdelare, men det som låg oläst när samtalet öppnades får en", async () => {
    const { kalla, s, nasta } = await underlag();
    const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    const lasta = await s.skicka(p.id, { text: "Läst", av: "bo" });
    await s.markeraLast(p.id, "anna", lasta.tid);
    await kalla.create(`samtal/${p.id}/meddelanden`, { text: "Oläst när jag öppnade", av: "bo", tid: nasta() });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    fireEvent.click(await screen.findByRole("button", { name: /Bo Lind/ }));
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Oläst när jag öppnade");
    const forst = /** @type {HTMLElement} */ (avdelare());
    expect(forst).toBeTruthy();
    expect(/** @type {HTMLElement} */ (forst.parentElement).textContent).toContain("Oläst när jag öppnade");
    await act(async () => {
      await kalla.create(`samtal/${p.id}/meddelanden`, { text: "Kom medan jag läste", av: "bo", tid: nasta() });
    });
    await within(logg).findByText("Kom medan jag läste");
    // Avdelaren står kvar där den stod och flyttas inte till det nya.
    expect(document.querySelectorAll("[data-nytt-sedan-sist]").length).toBe(1);
    expect(/** @type {HTMLElement} */ (avdelare()?.parentElement).textContent).toContain("Oläst när jag öppnade");
    expect(/** @type {HTMLElement} */ (avdelare()?.parentElement).textContent).not.toContain("Kom medan jag läste");
  });

  it("allt som kom medan samtalet var stängt står under avdelaren, i ordning", async () => {
    const { kalla, s, nasta } = await underlag();
    const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
    const lasta = await s.skicka(p.id, { text: "Läst", av: "bo" });
    await s.markeraLast(p.id, "anna", lasta.tid);
    await kalla.create(`samtal/${p.id}/meddelanden`, { text: "Ett", av: "bo", tid: nasta() });
    await kalla.create(`samtal/${p.id}/meddelanden`, { text: "Två", av: "bo", tid: nasta() });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    fireEvent.click(await screen.findByRole("button", { name: /Bo Lind/ }));
    await within(await screen.findByRole("log")).findByText("Två");
    expect(document.querySelectorAll("[data-nytt-sedan-sist]").length).toBe(1);
    expect(/** @type {HTMLElement} */ (avdelare()?.parentElement).textContent).toContain("Ett");
  });
});
