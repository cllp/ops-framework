import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsAppShell } from "../components/OpsAppShell.jsx";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { TALK_UPPTAGEN } from "../components/OpsTalk.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";

/*
 * 0.72.0 mot 0.71.0. TALK-knappen i huvudet (#276) och ljudvågen i chattens skrivfält bygger båda på `useTalk`, och båda kan stå
 * på samma sida. ⛔ HÄR MÄTS ATT BARA EN AV DEM SPELAR IN ÅT GÅNGEN: den andra får ett fel som säger varför, den första spelar
 * vidare och lämnar sitt ljud dit det skulle, och när den första är klar går den andra att starta.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "ops", namn: "Ops-agenten", typ: "agent", status: "aktiv" },
];

/** En inspelare utan mikrofon, med ett eget ljud så att det går att se vart det tog vägen. */
function inspelare(/** @type {string} */ namn) {
  const blob = new Blob([namn], { type: "audio/webm" });
  return {
    blob,
    starta: vi.fn(async () => {}),
    stoppa: vi.fn(async () => ({ blob, mimeType: "audio/webm", sekunder: 1 })),
    kasta: vi.fn(),
    niva: () => 0.5,
  };
}

async function sida() {
  const kalla = createMemorySource({});
  const s = /** @type {any} */ (createSamtalskalla({ kalla }));
  const a = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "ops", slag: "agent" });
  await s.skicka(a.id, { text: "Hej", av: "anna" });
  const huvud = inspelare("huvudet");
  const chatt = inspelare("chatten");
  const onTalk = vi.fn(async () => {});
  const onTranscribe = vi.fn(async () => "från chatten");
  render(
    <OpsAppShell brand="Ops" fasta={{ idag: { href: "/" }, kalender: { href: "/k" }, hub: { href: "/h" } }} moduler={[]} activeHref="/" skapa={{ arende: true }} talk={{ onTalk, inspelare: huvud }}>
      <OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={a.id} onTranscribe={onTranscribe} inspelare={chatt} />
    </OpsAppShell>,
  );
  await within(await screen.findByRole("log")).findByText("Hej");
  return { huvud, chatt, onTalk, onTranscribe };
}

const huvudknapp = () => /** @type {HTMLElement} */ (document.querySelector("header [data-talk-huvud]"));
const ruta = () => /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Skriv ett meddelande" }));
const vanta = () => act(async () => {
  await new Promise((r) => setTimeout(r, 5));
});

describe("TALK i huvudet och rösten i skrivfältet på samma sida", () => {
  it("⛔ huvudet först: skrivfältets ljudvåg spelar inte in, säger varför, och huvudets ljud når appen", async () => {
    const { huvud, chatt, onTalk, onTranscribe } = await sida();
    fireEvent.click(huvudknapp());
    await vanta();
    expect(huvud.starta).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await vanta();
    expect(chatt.starta).not.toHaveBeenCalled();
    const fel = document.querySelector("[data-rostlage=fel]");
    expect(fel?.textContent).toContain(TALK_UPPTAGEN);
    // ⛔ Det är inte ett utskriftsfel: inget spelades in.
    expect(fel?.textContent).not.toContain("kunde inte skrivas ut");
    expect(document.querySelector("[data-ops-talk]")?.getAttribute("data-lage")).toBe("lyssnar");

    fireEvent.click(within(screen.getByRole("dialog", { name: "TALK" })).getByRole("button", { name: "Skicka" }));
    await vanta();
    expect(onTalk).toHaveBeenCalledWith(huvud.blob, expect.anything());
    expect(onTranscribe).not.toHaveBeenCalled();

    // När huvudet är klart går skrivfältet att starta, och dess ljud hamnar i fältet.
    fireEvent.click(within(/** @type {HTMLElement} */ (fel)).getByRole("button", { name: "Stäng" }));
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await vanta();
    expect(chatt.starta).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Skriv ut det inspelade" }));
    await waitFor(() => expect(ruta().value).toBe("från chatten"));
    expect(onTranscribe).toHaveBeenCalledWith(chatt.blob);
  });

  it("⛔ skrivfältet först: huvudets TALK spelar inte in, säger varför, och skrivfältets ljud hamnar i fältet", async () => {
    const { huvud, chatt, onTalk, onTranscribe } = await sida();
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await vanta();
    expect(chatt.starta).toHaveBeenCalledTimes(1);

    fireEvent.click(huvudknapp());
    await vanta();
    expect(huvud.starta).not.toHaveBeenCalled();
    expect(document.querySelector("[data-ops-talk]")?.textContent).toContain(TALK_UPPTAGEN);
    expect(document.querySelector("[data-rostlage=spelar]")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Skriv ut det inspelade" }));
    await waitFor(() => expect(ruta().value).toBe("från chatten"));
    expect(onTranscribe).toHaveBeenCalledWith(chatt.blob);
    expect(onTalk).not.toHaveBeenCalled();
  });

  it("⛔ en avbruten inspelning släpper mikrofonen", async () => {
    const { huvud, chatt } = await sida();
    fireEvent.click(screen.getByRole("button", { name: "Prata in" }));
    await vanta();
    fireEvent.click(screen.getByRole("button", { name: "Avbryt inspelningen" }));
    await vanta();
    expect(chatt.kasta).toHaveBeenCalled();
    fireEvent.click(huvudknapp());
    await vanta();
    expect(huvud.starta).toHaveBeenCalledTimes(1);
  });
});
