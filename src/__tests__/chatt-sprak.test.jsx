import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsMeddelanden, texterPa } from "../components/OpsMeddelanden.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/**
 * Chatten på båda språken (0.106.0, #385). Granskningen av PR 384, MÅSTE 1: i en engelsk chatt stod "Skicka", "Skriv till gruppen",
 * "Fäst", "Svara med citat" och "Sök i samtalet" kvar på svenska.
 *
 * ⛔ KLART NÄR (ärendet): varje nyckel i `Meddelandetexter` har en engelsk form, och chatten ritad med `sprak="en"` bär inget av de
 * svenska förvalen i DOM:en. Provet ritar inkorgen, gruppchatten med trådar, reaktioner, fästa och sök, ett privat samtal med citat,
 * agentens samtal och ett ämne, läget "nytt" och Chattinfo, och samlar varje text och varje `aria-label`, `placeholder` och `title`.
 *
 * ⛔ GOLV (regel 4): minst 100 svenska förval prövas, och minst 25 engelska ord måste hittas i DOM:en. Utan golvet hade ett prov som
 * ritade en tom sida varit grönt.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Hugo", typ: "agent", status: "aktiv" },
];

async function underlag() {
  const kalla = createMemorySource({});
  const s = /** @type {any} */ (createSamtalskalla({ kalla, tradar: "tradar", reaktioner: "reaktioner", omnamnanden: true, citat: true, fasta: "fasta", tyst: "tyst", amnen: true, status: "status" }));
  const g = await s.oppnaGrupp({ groupId: "g", uid: "anna" });
  const m = await s.skicka(g.id, { text: "Hello team", av: "bo" });
  await s.reagera(g.id, { mid: m.id, kod: "tumme", av: "anna" });
  await s.fast(g.id, { mid: m.id, av: "anna" });
  await s.skickaITrad(g.id, m.id, { text: "Thread reply", av: "anna" });
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  await s.skicka(p.id, { text: "Lunch tomorrow?", av: "bo" });
  const a = await s.oppnaAmne({ groupId: "g", uid: "anna", agent: "ops", text: "Book the train" });
  return { s, g, p, a: a.samtal };
}

/** Allt synligt och uppläst i dokumentet: texter och de attribut en skärmläsare eller en person läser. */
function synligt() {
  const ut = /** @type {string[]} */ ([]);
  const gang = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (gang.nextNode()) {
    const t = (gang.currentNode.textContent || "").trim();
    if (t) ut.push(t);
  }
  for (const el of document.body.querySelectorAll("[aria-label], [placeholder], [title]")) {
    for (const a of ["aria-label", "placeholder", "title"]) {
      const v = el.getAttribute(a);
      if (v) ut.push(v);
    }
  }
  return ut;
}

const helaOrd = (/** @type {string} */ ord) => new RegExp(`(?<![\\p{L}])${ord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u");

describe("chatten på engelska", () => {
  it("⛔ varje nyckel har en engelsk form som skiljer sig från den svenska där orden skiljer sig", () => {
    const sv = texterPa("sv", {});
    const en = texterPa("en", {});
    const nycklar = Object.keys(sv).filter((k) => typeof sv[/** @type {keyof typeof sv} */ (k)] === "string");
    expect(nycklar.length).toBeGreaterThanOrEqual(130);
    const lika = nycklar.filter((k) => sv[/** @type {keyof typeof sv} */ (k)] === en[/** @type {keyof typeof en} */ (k)]);
    // Bara ord som är samma på båda språken får vara lika: "Agent".
    expect(lika.sort()).toEqual(["agent"]);
  });

  it("⛔ med sprak=en står inget av de svenska förvalen i DOM:en, i någon av chattens vyer", async () => {
    const { s, g, p, a } = await underlag();
    const sv = texterPa("sv", {});
    const en = texterPa("en", {});
    /** @type {string[]} */
    const allt = [];
    const samla = () => allt.push(...synligt());

    // Inkorgen och gruppchatten, med sökningen och chattinfo öppna, och reaktionsväljaren.
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Group" medlemmar={MEDLEMMAR} valt={g.id} sprak="en" />);
    await within(await screen.findByRole("log")).findByText("Hello team");
    await waitFor(() => expect(document.querySelector("[data-tradmarke='finns']")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Search the conversation" }));
    fireEvent.click(screen.getByRole("button", { name: "React" }));
    samla();
    fireEvent.click(screen.getByRole("button", { name: "Chat info" }));
    samla();
    cleanup();

    // En tråd.
    const m = (await s.meddelanden(g.id))[0];
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Group" medlemmar={MEDLEMMAR} valt={g.id} valtTrad={m.id} sprak="en" />);
    await within(await screen.findByRole("log")).findByText("Thread reply");
    samla();
    cleanup();

    // Ett privat samtal med citat.
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Group" medlemmar={MEDLEMMAR} valt={p.id} sprak="en" />);
    await within(await screen.findByRole("log")).findByText("Lunch tomorrow?");
    fireEvent.click(screen.getByRole("button", { name: "Reply with quote" }));
    samla();
    cleanup();

    // Agentens samtal, ett ämne och ett nytt ämne, och läget "nytt", genom en engelsk OpsSprakProvider i stället för propen.
    render(
      <OpsSprakProvider sprak="en">
        <OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Group" medlemmar={MEDLEMMAR} valtAgent="ops" />
      </OpsSprakProvider>,
    );
    await waitFor(() => expect(document.querySelector("[data-agentens-samtal='ops']")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Show archived" }));
    await waitFor(() => expect(document.querySelector("[data-arkiv-tomt]")).toBeTruthy());
    samla();
    cleanup();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Group" medlemmar={MEDLEMMAR} valt={a.id} sprak="en" />);
    await within(await screen.findByRole("log")).findByText("Book the train");
    samla();
    cleanup();
    render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="Group" medlemmar={MEDLEMMAR} nytt sprak="en" />);
    await screen.findByText("To");
    samla();
    cleanup();

    const prova = Object.entries(sv).filter(([k, v]) => typeof v === "string" && !v.includes("{") && v !== en[/** @type {keyof typeof en} */ (k)]);
    expect(prova.length).toBeGreaterThanOrEqual(100);
    const svenska = prova.filter(([, v]) => allt.some((t) => helaOrd(v).test(t))).map(([k, v]) => `${k}: ${v}`);
    expect(svenska).toEqual([]);
    const engelska = Object.entries(en).filter(([, v]) => typeof v === "string" && !v.includes("{") && allt.some((t) => helaOrd(v).test(t)));
    expect(engelska.length).toBeGreaterThanOrEqual(25);
  });
});
