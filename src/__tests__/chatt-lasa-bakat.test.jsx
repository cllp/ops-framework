import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { levandeKalla } from "./levandeKalla.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * Läsa bakåt (0.106.0, #386 skiva 4), och buggen CP såg på telefonen samma dag: raden "Agenten tänker" kom in under sista meddelandet
 * men vyn följde inte med, så den hamnade under skrivfältet.
 *
 * ⛔ jsdom har ingen layout. Loggens mått sätts här för hand (2000 px innehåll i 500 px fönster), och `scrollTop` är ett vanligt värde,
 * så att provet kan se om vyn rullade. Att raden verkligen syns ovanför skrivfältet mäts i en riktig webbläsare, check-skalyta 47 (4).
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Hugo", typ: "agent", status: "aktiv" },
];

/** Ger loggen mått och en `scrollTop` som går att läsa tillbaka. */
function matt(/** @type {HTMLElement} */ logg) {
  let topp = 0;
  Object.defineProperty(logg, "scrollHeight", { configurable: true, get: () => 2000 });
  Object.defineProperty(logg, "clientHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(logg, "scrollTop", { configurable: true, get: () => topp, set: (v) => (topp = Math.max(0, Math.min(Number(v), 2000))) });
  return {
    get topp() {
      return topp;
    },
    rullaTill(/** @type {number} */ y) {
      topp = y;
      fireEvent.scroll(logg);
    },
  };
}

async function underlag() {
  const kalla = levandeKalla();
  let t = new Date(2026, 9, 14, 9, 0).getTime();
  const s = /** @type {any} */ (createSamtalskalla({ kalla, status: "status", klocka: () => (t += 60000) }));
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  for (let i = 1; i <= 6; i += 1) await s.skicka(p.id, { text: `Meddelande ${i}`, av: i % 2 ? "bo" : "anna" });
  const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
  await s.skicka(a.id, { text: "Vad händer på fredag?", av: "anna" });
  return { kalla, s, p, a, nasta: () => (t += 60000) };
}

describe("läsa bakåt", () => {
  it("⛔ den som läst bakåt rycks inte ned, och Till senaste säger hur många nya som kommit", async () => {
    const { s, p } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    const logg = await screen.findByRole("log");
    const m = matt(logg);
    await within(logg).findByText("Meddelande 6");
    m.rullaTill(300);
    expect(document.querySelector("[data-till-senaste]")).toBeTruthy();
    await act(async () => {
      await s.skicka(p.id, { text: "Är du där?", av: "bo" });
      await s.skicka(p.id, { text: "Hallå?", av: "bo" });
    });
    await within(logg).findByText("Hallå?");
    expect(m.topp).toBe(300);
    const knapp = /** @type {HTMLElement} */ (await waitFor(() => {
      const k = document.querySelector("[data-till-senaste='2']");
      if (!k) throw new Error("Till senaste med 2 nya saknas");
      return k;
    }));
    expect(knapp.getAttribute("aria-label")).toBe("Till senaste, 2 nya");
    fireEvent.click(knapp);
    expect(m.topp).toBe(2000);
    expect(document.querySelector("[data-till-senaste]")).toBeNull();
  });

  it("⛔ ett eget meddelande rullar alltid till slutet, också när man läst bakåt", async () => {
    const { s, p } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
    const logg = await screen.findByRole("log");
    const m = matt(logg);
    await within(logg).findByText("Meddelande 6");
    m.rullaTill(100);
    fireEvent.change(screen.getByRole("textbox", { name: "Skriv ett meddelande" }), { target: { value: "Jag är här" } });
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await within(logg).findByText("Jag är här");
    await waitFor(() => expect(m.topp).toBe(2000));
  });

  it("⛔ agentens status följer med för den som står vid slutet, och syns i Till senaste för den som läst bakåt", async () => {
    const { kalla, s, a } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} />);
    const logg = await screen.findByRole("log");
    const m = matt(logg);
    await within(logg).findByText("Vad händer på fredag?");
    m.rullaTill(1500);
    await act(async () => {
      await kalla.create(`samtal/${a.id}/status`, { id: "agent", lage: "tanker", sedan: Date.now() });
    });
    await screen.findByText("Agenten tänker");
    await waitFor(() => expect(m.topp).toBe(2000));
    m.rullaTill(200);
    await act(async () => {
      await kalla.update(`samtal/${a.id}/status`, "agent", { lage: "skriver", sedan: Date.now() });
    });
    await screen.findByText("Agenten skriver");
    expect(m.topp).toBe(200);
    const knapp = /** @type {HTMLElement} */ (document.querySelector("[data-till-senaste]"));
    expect(knapp.getAttribute("data-agent-arbetar")).toBe("skriver");
    expect(knapp.getAttribute("aria-label")).toBe("Till senaste, Agenten skriver");
  });

  it("⛔ Nytt sedan sist står före det första olästa från någon annan, härlett ur läsmärket", async () => {
    const { kalla, s, p, nasta } = await underlag();
    // Anna har läst till och med Meddelande 4. Sedan skriver Bo två till.
    const lasta = (await s.meddelanden(p.id)).find((x) => x.text === "Meddelande 4");
    await s.markeraLast(p.id, "anna", lasta.tid);
    await kalla.create(`samtal/${p.id}/meddelanden`, { text: "Nytt från Bo", av: "bo", tid: nasta() });
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    fireEvent.click(await screen.findByRole("button", { name: /Bo Lind/ }));
    const logg = await screen.findByRole("log");
    await within(logg).findByText("Nytt från Bo");
    const avdelare = /** @type {HTMLElement} */ (document.querySelector("[data-nytt-sedan-sist]"));
    expect(avdelare).toBeTruthy();
    expect(avdelare.textContent).toBe("Nytt sedan sist");
    // Avdelaren står direkt före Meddelande 5 (Bos), inte före Annas egna meddelanden.
    const rad = /** @type {HTMLElement} */ (avdelare.parentElement);
    expect(rad.textContent).toContain("Meddelande 5");
    expect(document.querySelectorAll("[data-nytt-sedan-sist]").length).toBe(1);
  });

  it("⛔ ingen avdelare när allt är nytt: en avdelare överst avdelar ingenting", async () => {
    const { s } = await underlag();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} />);
    fireEvent.click(await screen.findByRole("button", { name: /Bo Lind/ }));
    await within(await screen.findByRole("log")).findByText("Meddelande 6");
    expect(document.querySelector("[data-nytt-sedan-sist]")).toBeNull();
  });
});
