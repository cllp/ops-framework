import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OpsSamtal } from "../components/OpsMeddelanden.jsx";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { AGENTSTATUS_MAX_ALDER, vackerAgenten } from "../lib/samtal.js";
import { levandeKalla } from "./levandeKalla.js";

/**
 * ⛔ HÄNDELSEN (0.234.0, cllp/ops-framework#609). CP 2026-11-16: "När man börjar prata med agenten tar det några sekunder att väcka den.
 * Det vore bra om man kunde ha en progress även där att agenten vaknar..." Mellan att man skickar och att serverns status "tänker"
 * kommer syntes ingenting. Nu står "Agenten vaknar" på samma rad, direkt.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];
const namnFor = (/** @type {string} */ uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;

/** @param {{ annan?: string, slag?: string }} [val] */
async function rita(val = {}) {
  const kalla = levandeKalla();
  const s = createSamtalskalla({ kalla, status: "status" });
  const samtal = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: val.annan ?? "ops", ...(val.slag ? { slag: val.slag } : { slag: "agent" }) });
  render(<OpsSamtal kalla={s} uid="anna" samtal={samtal} rubrik="Ops" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
  return { kalla, s, samtal };
}

async function skicka(text = "Vilka fakturor är obetalda?") {
  fireEvent.change(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
  });
}

const rad = () => document.querySelector("[data-agentstatus]");

afterEach(() => vi.useRealTimers());

describe("⛔ Agenten vaknar (#609)", () => {
  it("raden syns direkt efter att meddelandet skickats, på samma rad som 'tänker'", async () => {
    await rita();
    expect(rad()).toBeNull();
    await skicka();
    await waitFor(() => expect(rad()?.getAttribute("data-agentstatus")).toBe("vaknar"));
    expect(rad()?.textContent).toContain("Agenten vaknar");
    expect(rad()?.getAttribute("role")).toBe("status");
  });

  it("raden ersätts av 'tänker' när serverns status kommer", async () => {
    const { kalla, samtal } = await rita();
    await skicka();
    await waitFor(() => expect(rad()?.getAttribute("data-agentstatus")).toBe("vaknar"));
    await act(async () => {
      await kalla.create(`samtal/${samtal.id}/status`, { id: "agent", lage: "tanker", sedan: Date.now() });
    });
    await waitFor(() => expect(rad()?.getAttribute("data-agentstatus")).toBe("tanker"));
    // Och när statusen tas bort kommer väckningen inte tillbaka.
    await act(async () => {
      await kalla.remove(`samtal/${samtal.id}/status`, "agent");
    });
    expect(rad()).toBeNull();
  });

  it("raden försvinner när agentens svar kommer", async () => {
    const { s, samtal } = await rita();
    await skicka();
    await waitFor(() => expect(rad()?.getAttribute("data-agentstatus")).toBe("vaknar"));
    await act(async () => {
      await s.skicka(samtal.id, { text: "Två fakturor.", av: "ops" });
    });
    await waitFor(() => expect(rad()).toBeNull());
  });

  it("⛔ raden blir en synlig felrad efter samma tak som 'tänker' (regel 5)", async () => {
    await rita();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await skicka();
    await waitFor(() => expect(rad()?.getAttribute("data-agentstatus")).toBe("vaknar"));
    await act(async () => {
      vi.advanceTimersByTime(AGENTSTATUS_MAX_ALDER + 10);
    });
    await waitFor(() => expect(rad()?.getAttribute("data-agentstatus")).toBe("vaknar-fel"));
    expect(rad()?.getAttribute("role")).toBe("alert");
    expect(rad()?.textContent).toContain("Agenten vaknade inte på två minuter");
  });

  it("raden syns inte i ett samtal utan agent, men i agentsamtalet med samma meddelande", async () => {
    // Samma meddelande i agentsamtalet ger raden, så att provet mäter villkoret och inte bara frånvaron.
    await rita();
    await skicka("Hej Bo");
    await waitFor(() => expect(rad()?.getAttribute("data-agentstatus")).toBe("vaknar"));
    cleanup();
    const { s, samtal } = await rita({ annan: "bo", slag: "personer" });
    await skicka("Hej Bo");
    await waitFor(async () => expect((await s.meddelanden(samtal.id)).length).toBe(1));
    expect(rad()).toBeNull();
  });
});

describe("vackerAgenten: samma villkor som servern", () => {
  const grupp = { slag: "grupp" };
  it("agentsamtalet väcker, ett privat samtal och ett projekts chatt gör det inte", () => {
    expect(vackerAgenten({ samtal: { slag: "agent" }, meddelande: { av: "anna" }, medlemmar: MEDLEMMAR })).toBe(true);
    expect(vackerAgenten({ samtal: { slag: "personer" }, meddelande: { av: "anna", namner: ["ops"] }, medlemmar: MEDLEMMAR })).toBe(false);
    expect(vackerAgenten({ samtal: { slag: "projekt" }, meddelande: { av: "anna", namner: ["ops"] }, medlemmar: MEDLEMMAR })).toBe(false);
  });
  it("gruppchatten och dess trådar väcker bara när en aktiv agent är nämnd", () => {
    expect(vackerAgenten({ samtal: grupp, meddelande: { av: "anna", namner: ["ops"] }, medlemmar: MEDLEMMAR })).toBe(true);
    expect(vackerAgenten({ samtal: grupp, meddelande: { av: "anna" }, medlemmar: MEDLEMMAR })).toBe(false);
    expect(vackerAgenten({ samtal: grupp, meddelande: { av: "anna", namner: ["alla"] }, medlemmar: MEDLEMMAR })).toBe(false);
    const avstangd = MEDLEMMAR.map((m) => (m.typ === "agent" ? { ...m, status: "avstangd" } : m));
    expect(vackerAgenten({ samtal: grupp, meddelande: { av: "anna", namner: ["ops"] }, medlemmar: avstangd })).toBe(false);
  });
  it("ett meddelande från agenten väcker aldrig agenten", () => {
    expect(vackerAgenten({ samtal: { slag: "agent" }, meddelande: { av: "ops" }, medlemmar: MEDLEMMAR })).toBe(false);
  });
});
