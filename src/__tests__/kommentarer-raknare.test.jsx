import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OpsKommentarer } from "../components/OpsKommentarer.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { MAX_HANDELSEKOMMENTAR } from "../lib/handelsemodell.js";
import { RAKNARE_FRAN } from "../lib/samtal.js";

/*
 * Teckenräknaren i kommentarsfältet (0.153.0, cllp/ops-framework#460 punkt 7).
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: fältet hade `maxLength={MAX_HANDELSEKOMMENTAR}`, så webbläsaren kapade en inklistrad text vid taket utan ett ord, och ingen räknare fanns.
 * jsdom kapar inte på `maxLength` (det gör bara användarens inmatning), så provet mäter ATT ATTRIBUTET ÄR BORTA och att fältet bär hela texten.
 */

const falt = () => /** @type {HTMLTextAreaElement} */ (screen.getByLabelText("Skriv en kommentar"));
const skriv = (/** @type {string} */ text) => fireEvent.change(falt(), { target: { value: text } });
const visa = (/** @type {Record<string, any>} */ extra = {}) => {
  const onSkriv = vi.fn();
  render(<OpsKommentarer kommentarer={[]} uid="anna" onSkriv={onSkriv} {...extra} />);
  return onSkriv;
};

describe("räknaren i OpsKommentarer", () => {
  it("⛔ ingen räknare långt från taket", () => {
    visa();
    skriv("a".repeat(MAX_HANDELSEKOMMENTAR - RAKNARE_FRAN - 1));
    expect(document.querySelector("[data-langdraknare]")).toBeNull();
  });

  it("⛔ räknaren syns de sista RAKNARE_FRAN tecknen och säger hur många det är och vad taket är", () => {
    visa();
    skriv("a".repeat(MAX_HANDELSEKOMMENTAR - RAKNARE_FRAN));
    const r = document.querySelector("[data-langdraknare]");
    expect(r?.getAttribute("data-langdraknare")).toBe("nara");
    expect(r?.textContent).toBe(`Kommentaren är ${MAX_HANDELSEKOMMENTAR - RAKNARE_FRAN} tecken, taket är ${MAX_HANDELSEKOMMENTAR}.`);
  });

  it("⛔ INGEN TYST KAPNING: fältet har inget maxLength, och en inklistrad text över taket står kvar hel", () => {
    visa();
    expect(falt().hasAttribute("maxlength")).toBe(false);
    const lang = "a".repeat(MAX_HANDELSEKOMMENTAR + 37);
    skriv(lang);
    expect(falt().value).toHaveLength(MAX_HANDELSEKOMMENTAR + 37);
  });

  it("⛔ över taket: raden säger hur många tecken för lång texten är, fältet är markerat och Skicka är avstängd", () => {
    const onSkriv = visa();
    skriv("a".repeat(MAX_HANDELSEKOMMENTAR + 37));
    expect(screen.getByText("Kommentaren är 37 tecken för lång. Korta den för att skicka.")).toBeTruthy();
    expect(document.querySelector("[data-langdraknare]")?.getAttribute("data-langdraknare")).toBe("over");
    expect(falt().getAttribute("aria-invalid")).toBe("true");
    const skicka = /** @type {HTMLButtonElement} */ (screen.getByRole("button", { name: "Skicka" }));
    expect(skicka.disabled).toBe(true);
    fireEvent.click(skicka);
    expect(onSkriv).not.toHaveBeenCalled();
  });

  it("⛔ exakt vid taket går den att skicka, och bortkortad under taket också", () => {
    const onSkriv = visa();
    skriv("a".repeat(MAX_HANDELSEKOMMENTAR));
    const skicka = /** @type {HTMLButtonElement} */ (screen.getByRole("button", { name: "Skicka" }));
    expect(skicka.disabled).toBe(false);
    skriv("a".repeat(MAX_HANDELSEKOMMENTAR + 1));
    expect(skicka.disabled).toBe(true);
    skriv("a".repeat(MAX_HANDELSEKOMMENTAR - 1));
    expect(skicka.disabled).toBe(false);
    fireEvent.click(skicka);
    expect(onSkriv).toHaveBeenCalledTimes(1);
  });

  it("längden räknas som modellen räknar den: blanksteg i kanterna ger inte en text över taket", () => {
    const onSkriv = visa();
    skriv(`  ${"a".repeat(MAX_HANDELSEKOMMENTAR)}  `);
    expect(/** @type {HTMLButtonElement} */ (screen.getByRole("button", { name: "Skicka" })).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    expect(onSkriv).toHaveBeenCalledWith("a".repeat(MAX_HANDELSEKOMMENTAR), expect.anything());
  });

  /*
   * ⛔ GRANSKNINGEN AV PR 464: räknaren räknade `utkast.length` medan taket prövar den trimmade texten, den var inte kopplad till fältet, och över taket stod felet BÅDE som
   * fältets `role="alert"` och som räknarens `role="status"`, så en skärmläsare läste upp det två gånger vid varje tangent.
   */
  it("⛔ räknaren visar den trimmade längden, samma som taket prövar", () => {
    visa();
    skriv(`   ${"a".repeat(MAX_HANDELSEKOMMENTAR - 10)}   `);
    expect(document.querySelector("[data-langdraknare]")?.textContent).toBe(`Kommentaren är ${MAX_HANDELSEKOMMENTAR - 10} tecken, taket är ${MAX_HANDELSEKOMMENTAR}.`);
  });
  it("⛔ räknaren är kopplad till fältet med aria-describedby, nära taket och över det", () => {
    visa();
    for (const n of [MAX_HANDELSEKOMMENTAR - 1, MAX_HANDELSEKOMMENTAR + 3]) {
      skriv("a".repeat(n));
      const r = /** @type {HTMLElement} */ (document.querySelector("[data-langdraknare]"));
      expect(r.id).not.toBe("");
      expect((falt().getAttribute("aria-describedby") ?? "").split(" ")).toContain(r.id);
    }
  });
  it("⛔ över taket finns EN levande yta: räknarens status, ingen alert", () => {
    visa();
    skriv("a".repeat(MAX_HANDELSEKOMMENTAR + 3));
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);
    const levande = [...document.querySelectorAll('[role="status"], [aria-live]')].filter((e) => (e.textContent ?? "").includes("för lång"));
    expect(levande).toHaveLength(1);
    expect(falt().getAttribute("aria-invalid")).toBe("true");
  });

  it("engelska orden följer språket", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsKommentarer kommentarer={[]} uid="anna" onSkriv={() => {}} />
      </OpsSprakProvider>,
    );
    fireEvent.change(screen.getByLabelText("Write a comment"), { target: { value: "a".repeat(MAX_HANDELSEKOMMENTAR + 5) } });
    expect(screen.getByText("The comment is 5 characters too long. Shorten it to send.")).toBeTruthy();
  });
});
