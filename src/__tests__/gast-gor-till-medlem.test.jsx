import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastLista } from "../components/OpsGastLista.jsx";
import { gastId } from "../lib/gast.js";

/**
 * Gör till medlem på gästkortet (0.206.0, CP 2026-11-08: "hur gör jag en gäst till en medlem?"). Knappen finns bara med `onGorTillMedlem` och bara för en gäst med e-postadress, trycket öppnar en
 * bekräftelse som står kvar tills anropet är klart, ett fel står i dialogen och ett lyckat anrop ger ett besked på kortet.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött utan ändringen, grönt med den. Utfallen står i commit-meddelandet.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
});

const klicka = async (/** @type {Element} */ el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

const ANNA = gastId("anna@foretag.se");
const TOVE = "gast-tove";
const anna = () => ({ gastId: ANNA, epost: "anna@foretag.se", namn: "Anna Berg", status: "inloggad", inbjudningar: [{ id: "i-grupp", omfang: { slag: "grupp" }, titel: null, status: "inloggad" }] });
const tove = () => ({ gastId: TOVE, epost: null, telefon: "+46701234567", namn: "Tove", status: "vantar", inbjudningar: [{ id: "i-tove", omfang: { slag: "grupp" }, titel: null, status: "vantar" }] });

/** Ritar gruppläget och fäller ut alla kort. */
const rita = (/** @type {Record<string, unknown>} */ props = {}) => {
  const svar = render(<OpsGastLista personer={[anna(), tove()]} platser={{ anvanda: 2, totalt: 5 }} {...props} />);
  for (const b of document.querySelectorAll('[data-gast-vaxla][aria-expanded="false"]')) fireEvent.click(b);
  return svar;
};
const kortFor = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.querySelector(`[data-gast-person="${id}"]`));
const knapp = () => screen.queryByRole("button", { name: "Gör Anna Berg till medlem" });

describe("OpsGastLista, Gör till medlem", () => {
  it("knappen saknas utan onGorTillMedlem", () => {
    rita();
    expect(document.querySelector("[data-gast-person]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /till medlem/ })).toBeNull();
  });

  it("⛔ knappen finns för en gäst med e-postadress men inte för en gäst med bara telefonnummer", () => {
    // Med Radera finns knappraden på båda korten, så att det är villkoret för knappen som mäts och inte om raden ritas.
    rita({ onGorTillMedlem: vi.fn(), onRadera: vi.fn() });
    expect(within(kortFor(TOVE)).getByRole("button", { name: "Radera uppgifterna om Tove" })).toBeInTheDocument();
    expect(within(kortFor(ANNA)).getByRole("button", { name: "Gör Anna Berg till medlem" })).toHaveTextContent("Gör till medlem");
    expect(within(kortFor(TOVE)).queryByRole("button", { name: /till medlem/ })).toBeNull();
  });

  it("trycket öppnar bekräftelsen med texten, och Avbryt stänger utan anrop", async () => {
    const onGorTillMedlem = vi.fn();
    rita({ onGorTillMedlem });
    await klicka(/** @type {HTMLElement} */ (knapp()));
    const dialog = await screen.findByRole("dialog", { name: "Gör Anna Berg till medlem?" });
    expect(dialog).toHaveTextContent("Anna Berg får en inbjudan som medlem till anna@foretag.se. När inbjudan tas emot slutar gästlänkarna gälla, och gästen blir medlem med medlemmens rättigheter.");
    expect(within(dialog).getByRole("button", { name: "Skicka medlemsinbjudan" })).toBeInTheDocument();
    await klicka(within(dialog).getByRole("button", { name: "Avbryt" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onGorTillMedlem).not.toHaveBeenCalled();
  });

  it("⛔ anropet får { gastId, epost }, dialogen står kvar med knappen upptagen tills löftet är klart, och kortet säger sedan vart inbjudan gick", async () => {
    let klar = () => {};
    const onGorTillMedlem = vi.fn(() => new Promise((r) => (klar = () => r(undefined))));
    rita({ onGorTillMedlem });
    await klicka(/** @type {HTMLElement} */ (knapp()));
    const dialog = await screen.findByRole("dialog");
    await klicka(within(dialog).getByRole("button", { name: "Skicka medlemsinbjudan" }));
    expect(onGorTillMedlem).toHaveBeenCalledWith({ gastId: ANNA, epost: "anna@foretag.se" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getByText("Skickar medlemsinbjudan…").closest("button")).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Avbryt" })).toBeDisabled();
    await act(async () => {
      klar();
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(kortFor(ANNA)).getByRole("status")).toHaveTextContent("Medlemsinbjudan skickad till anna@foretag.se.");
    expect(onGorTillMedlem).toHaveBeenCalledTimes(1);
  });

  it("⛔ ett fel visas i dialogen, som står kvar, och kortet säger inte att något skickades; ett nytt försök tar bort felet", async () => {
    const onGorTillMedlem = vi.fn().mockRejectedValueOnce(new Error("Adressen är redan medlem.")).mockResolvedValueOnce(undefined);
    rita({ onGorTillMedlem });
    await klicka(/** @type {HTMLElement} */ (knapp()));
    const dialog = await screen.findByRole("dialog");
    await klicka(within(dialog).getByRole("button", { name: "Skicka medlemsinbjudan" }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Adressen är redan medlem."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(kortFor(ANNA).querySelector("[data-gast-klar]")).toBeNull();
    await klicka(within(dialog).getByRole("button", { name: "Skicka medlemsinbjudan" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(kortFor(ANNA)).getByRole("status")).toHaveTextContent("Medlemsinbjudan skickad till anna@foretag.se.");
  });

  it("ett fel utan meddelande ger reservtexten, inte en tom rad", async () => {
    rita({ onGorTillMedlem: vi.fn().mockRejectedValue({}) });
    await klicka(/** @type {HTMLElement} */ (knapp()));
    const dialog = await screen.findByRole("dialog");
    await klicka(within(dialog).getByRole("button", { name: "Skicka medlemsinbjudan" }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Det gick inte. Försök igen."));
  });

  it("på engelska", async () => {
    rita({ onGorTillMedlem: vi.fn().mockResolvedValue(undefined), sprak: "en" });
    await klicka(screen.getByRole("button", { name: "Make Anna Berg a member" }));
    const dialog = await screen.findByRole("dialog", { name: "Make Anna Berg a member?" });
    expect(dialog).toHaveTextContent("Anna Berg gets an invitation as a member at anna@foretag.se.");
    await klicka(within(dialog).getByRole("button", { name: "Send member invitation" }));
    await waitFor(() => expect(within(kortFor(ANNA)).getByRole("status")).toHaveTextContent("Member invitation sent to anna@foretag.se."));
  });

  it("hör till gruppläget: en omröstningslista med onGorTillMedlem kastar, och en prop som inte är en funktion kastar", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsGastLista gaster={[]} platser={{ anvanda: 0, totalt: 5 }} onGorTillMedlem={vi.fn()} />)).toThrow(/onGorTillMedlem hör till listan över hela gruppen/);
    expect(() => render(<OpsGastLista personer={[]} platser={{ anvanda: 0, totalt: 5 }} onGorTillMedlem={/** @type {any} */ ("ja")} />)).toThrow(/onGorTillMedlem måste vara en funktion/);
    konsol.mockRestore();
  });
});
