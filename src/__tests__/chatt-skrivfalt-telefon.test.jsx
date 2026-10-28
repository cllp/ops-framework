import { afterEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { OpsMeddelanden } from "../components/OpsMeddelanden.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { MAX_MEDDELANDE } from "../lib/samtal.js";

/**
 * Skrivfältet på telefon (0.106.0, #386 skiva 5): 16 px, växer med texten till ett tak, följer tangentbordet, och en räknare i stället
 * för tyst kapning. Gapanalysen märkte zoomen och tangentbordet som hypoteser; här mäts vad ramverket gör, och i en riktig webbläsare
 * i check-skalyta 47 (5). En riktig iPhone är inte mätt.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];

async function rita() {
  const s = createSamtalskalla({ kalla: createMemorySource({}) });
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  await s.skicka(p.id, { text: "Hej", av: "bo" });
  render(<OpsMeddelanden kalla={s} uid="anna" groupId="g" gruppNamn="G" medlemmar={MEDLEMMAR} valt={p.id} />);
  await within(await screen.findByRole("log")).findByText("Hej");
  return /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox", { name: "Skriv ett meddelande" }));
}

const ursprung = Object.getOwnPropertyDescriptor(window, "visualViewport");
afterEach(() => {
  if (ursprung) Object.defineProperty(window, "visualViewport", ursprung);
  else delete (/** @type {any} */ (window)).visualViewport;
});

describe("skrivfältet på telefon", () => {
  it("⛔ 16 px på telefon och 14 på dator, och Enter heter Skicka på tangentbordet", async () => {
    const ruta = await rita();
    expect(ruta.className).toContain("text-brod");
    expect(ruta.className).toContain("md:text-etikett");
    expect(ruta.className.split(/\s+/)).not.toContain("text-etikett");
    expect(ruta.getAttribute("enterkeyhint")).toBe("send");
  });

  it("⛔ fältet växer med texten upp till taket, och rullar först över det", async () => {
    const ruta = await rita();
    let hojd = 44;
    Object.defineProperty(ruta, "scrollHeight", { configurable: true, get: () => hojd });
    hojd = 92;
    fireEvent.change(ruta, { target: { value: "en\ntvå\ntre" } });
    expect(ruta.style.height).toBe("92px");
    expect(ruta.style.overflowY).toBe("hidden");
    hojd = 400;
    fireEvent.change(ruta, { target: { value: "lång\n".repeat(20) } });
    expect(ruta.style.height).toBe("160px");
    expect(ruta.style.overflowY).toBe("auto");
  });

  it("⛔ ingen tyst kapning: texten står kvar över taket, raden säger hur mycket för lång, och Skicka är avstängd", async () => {
    const ruta = await rita();
    expect(ruta.hasAttribute("maxlength")).toBe(false);
    fireEvent.change(ruta, { target: { value: "a".repeat(MAX_MEDDELANDE - 600) } });
    expect(document.querySelector("[data-langdraknare]")).toBeNull();
    fireEvent.change(ruta, { target: { value: "a".repeat(MAX_MEDDELANDE - 300) } });
    expect(screen.getByRole("status", { name: "" }).textContent).toBe(`${MAX_MEDDELANDE - 300} av ${MAX_MEDDELANDE} tecken`);
    fireEvent.change(ruta, { target: { value: "a".repeat(MAX_MEDDELANDE + 100) } });
    expect(ruta.value.length).toBe(MAX_MEDDELANDE + 100);
    expect(screen.getByRole("alert").textContent).toBe("Texten är 100 tecken för lång. Korta den för att skicka.");
    expect(ruta.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("button", { name: "Skicka" })).toBeDisabled();
    fireEvent.keyDown(ruta, { key: "Enter" });
    expect(ruta.value.length).toBe(MAX_MEDDELANDE + 100);
  });

  it("⛔ tangentbordet: det visualViewport täcker dras av från chattens höjd", async () => {
    const vv = Object.assign(new EventTarget(), { height: window.innerHeight, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    await rita();
    const yta = /** @type {HTMLElement} */ (document.querySelector("[data-ops-meddelanden]"));
    expect(yta.getAttribute("data-tangentbord")).toBeNull();
    await act(async () => {
      vv.height = window.innerHeight - 300;
      vv.dispatchEvent(new Event("resize"));
    });
    expect(yta.getAttribute("data-tangentbord")).toBe("300");
    expect(yta.style.getPropertyValue("--tangentbord")).toBe("300px");
    expect(yta.className).toContain("var(--tangentbord,0px)");
  });

  it("⛔ samma mätning som bottenraden: layoutfönstret, offsetTop medräknat, också när innerHeight krymper (Android)", async () => {
    // Layoutfönstret står kvar på 800 medan innerHeight krymper med tangentbordet, som i Android Chrome. Mot innerHeight hade chatten fått 0.
    const innerOrig = Object.getOwnPropertyDescriptor(window, "innerHeight");
    let inner = 800;
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, get: () => 800 });
    Object.defineProperty(window, "innerHeight", { configurable: true, get: () => inner });
    const vv = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    try {
      await rita();
      const yta = /** @type {HTMLElement} */ (document.querySelector("[data-ops-meddelanden]"));
      await act(async () => {
        inner = 500;
        vv.height = 500;
        vv.dispatchEvent(new Event("resize"));
      });
      expect(yta.getAttribute("data-tangentbord")).toBe("300");
      await act(async () => {
        vv.offsetTop = 100;
        vv.dispatchEvent(new Event("scroll"));
      });
      expect(yta.getAttribute("data-tangentbord")).toBe("200");
    } finally {
      delete (/** @type {any} */ (document.documentElement)).clientHeight;
      if (innerOrig) Object.defineProperty(window, "innerHeight", innerOrig);
    }
  });

  it("⛔ ett scroll-event som kommer efter att tangentbordet krympt loggen läses inte som att personen rullat bort från slutet", async () => {
    // Mätt i check-skalyta 47 (5): eventet köades när skrivfältet krympte och kördes först när tangentbordet redan tagit 232 px.
    await rita();
    const logg = screen.getByRole("log");
    let ch = 500;
    let topp = 0;
    Object.defineProperty(logg, "scrollHeight", { configurable: true, get: () => 2000 });
    Object.defineProperty(logg, "clientHeight", { configurable: true, get: () => ch });
    Object.defineProperty(logg, "scrollTop", { configurable: true, get: () => topp, set: (v) => (topp = Math.max(0, Math.min(Number(v), 2000 - ch))) });
    topp = 1500;
    fireEvent.scroll(logg);
    expect(document.querySelector("[data-till-senaste]")).toBeNull();
    // Tangentbordet: loggen krymper 200 px utan att personen rör skärmen, och det köade eventet kommer efteråt.
    ch = 300;
    fireEvent.scroll(logg);
    expect(topp).toBe(1700);
    expect(document.querySelector("[data-till-senaste]")).toBeNull();
    // En rullning personen gör ändrar inte måtten, och den läses fortfarande som att man lämnat slutet.
    topp = 1000;
    fireEvent.scroll(logg);
    expect(document.querySelector("[data-till-senaste]")).toBeTruthy();
  });
});
