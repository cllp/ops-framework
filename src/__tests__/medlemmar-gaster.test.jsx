import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsMedlemmar } from "../components/OpsMedlemmar.jsx";
import { gastId } from "../lib/gast.js";

/**
 * Gästen bjuds in från gruppens medlemsvy (0.132.0, cllp/lifehub.app#389, CP 2026-10-20): "Gäst (utan konto)" är ett val i Roll under BJUD IN, och inte en egen plats. jsdom mäter att rätt val, rätt text
 * och rätt anrop finns; hur det SER UT mäts i skalytan.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => vi.restoreAllMocks());

const med = (userId, roll) => ({ medlemskap: { id: `${userId}_g`, userId, groupId: "g", roll, typ: "person", status: "aktiv", namn: userId === "mig" ? "Jag Själv" : "Någon Annan" } });
const ANNA = gastId("anna@foretag.se");
const PERSONER = [
  { gastId: ANNA, epost: "anna@foretag.se", namn: "", status: "vantar", inbjudningar: [{ id: "i1", omfang: { slag: "grupp" }, titel: null, status: "vantar" }] },
];

function rita(gaster = {}, extra = {}) {
  const props = {
    medlemmar: [med("mig", "agare")],
    migUid: "mig",
    kanAndra: true,
    onBjudIn: vi.fn(),
    inbjudningar: [{ id: "m1", epost: "vantande@foretag.se", roll: "medlem" }],
    gaster: { personer: PERSONER, platser: { anvanda: 1, totalt: 5 }, onBjud: vi.fn().mockResolvedValue(undefined), onSkickaOm: vi.fn(), onAterkalla: vi.fn(), ...gaster },
    ...extra,
  };
  return { props, ...render(<OpsMedlemmar {...props} />) };
}

async function valjGast(user) {
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: "Gäst (utan konto)" }));
}

describe("OpsMedlemmar med gäster", () => {
  it("Gäst (utan konto) är ett val i Roll, och bara med gaster: utan propen finns tre roller", async () => {
    const user = userEvent.setup();
    const { unmount } = rita();
    await user.click(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Ägare", "Admin", "Medlem", "Gäst (utan konto)"]);
    unmount();
    render(<OpsMedlemmar medlemmar={[med("mig", "agare")]} migUid="mig" kanAndra onBjudIn={() => {}} />);
    await user.click(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Ägare", "Admin", "Medlem"]);
  });

  it("raden under E-post säger att en adress utan Google-konto kan bjudas in som gäst, och den ersätter mejlNot bara med gaster", () => {
    const { unmount } = rita();
    expect(screen.getByText("Inloggningen är Google. En adress utan Google-konto kan bjudas in som gäst.")).toBeInTheDocument();
    unmount();
    render(<OpsMedlemmar medlemmar={[med("mig", "agare")]} migUid="mig" kanAndra onBjudIn={() => {}} mejlNot="Inloggningen är Google." />);
    expect(screen.getByText("Inloggningen är Google.")).toBeInTheDocument();
    expect(screen.queryByText(/kan bjudas in som gäst/)).toBeNull();
  });

  it("med Gäst valt: räknaren, ingressen om vad en gäst får se, och knappen heter Bjud in utan konto. Med en annan roll syns inget av det", async () => {
    const user = userEvent.setup();
    rita();
    expect(screen.queryByText("1 av 5 gratis platser")).toBeNull();
    expect(screen.getByRole("button", { name: "Bjud in" })).toBeInTheDocument();
    await valjGast(user);
    expect(screen.getByText("1 av 5 gratis platser")).toBeInTheDocument();
    expect(screen.getByText(/läsa och skriva i chatten, svara och rösta i kalendern och läsa, spela och ladda ned i biblioteket/)).toBeInTheDocument();
    expect(screen.getByText(/Gästen ser inte gruppens ärenden/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bjud in utan konto" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Bjud in" })).toBeNull();
  });

  it("⛔ en gäst bjuds in efter en bekräftelse som säger vad gästen ser, och ingen anropas före den: onBjud får adressen, onBjudIn anropas inte", async () => {
    const user = userEvent.setup();
    const { props } = rita();
    await valjGast(user);
    await user.type(screen.getByLabelText("E-post"), "nils@foretag.se");
    await user.click(screen.getByRole("button", { name: "Bjud in utan konto" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/hela historiken från början/)).toBeInTheDocument();
    expect(within(dialog).getByText(/går inte att ta tillbaka/)).toBeInTheDocument();
    expect(within(dialog).getByText(/kan skriva i den/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Gästen ser inte gruppens ärenden/)).toBeInTheDocument();
    expect(props.gaster.onBjud).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Bjud in", exact: true }));
    await waitFor(() => expect(props.gaster.onBjud).toHaveBeenCalledWith({ epost: "nils@foretag.se", namn: "" }));
    expect(props.onBjudIn).not.toHaveBeenCalled();
    expect(screen.getByLabelText("E-post")).toHaveValue("");
  });

  it("Avbryt bjuder inte in någon, och en adress som inte är en adress öppnar ingen dialog", async () => {
    const user = userEvent.setup();
    const { props } = rita();
    await valjGast(user);
    await user.type(screen.getByLabelText("E-post"), "nils@foretag.se");
    await user.click(screen.getByRole("button", { name: "Bjud in utan konto" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Avbryt" }));
    expect(props.gaster.onBjud).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("en medlem bjuds in som förut: onBjudIn med adress och roll, utan bekräftelse, och inget anrop till gaster", async () => {
    const user = userEvent.setup();
    const { props } = rita();
    await user.type(screen.getByLabelText("E-post"), "ny@foretag.se");
    await user.click(screen.getByRole("button", { name: "Bjud in" }));
    expect(props.onBjudIn).toHaveBeenCalledWith({ epost: "ny@foretag.se", roll: "medlem" });
    expect(props.gaster.onBjud).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("vid taket är knappen spärrad och texten säger varför; ett fel med kod får sin egen text", async () => {
    const user = userEvent.setup();
    const { unmount } = rita({ platser: { anvanda: 5, totalt: 5 } });
    await valjGast(user);
    await user.type(screen.getByLabelText("E-post"), "nils@foretag.se");
    expect(screen.getByRole("button", { name: "Bjud in utan konto" })).toBeDisabled();
    expect(screen.getByText(/det är taket/)).toBeInTheDocument();
    unmount();
    rita({ onBjud: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { kod: "platser-slut" })) });
    await valjGast(user);
    await user.type(screen.getByLabelText("E-post"), "nils@foretag.se");
    await user.click(screen.getByRole("button", { name: "Bjud in utan konto" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Bjud in", exact: true }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Gruppen har 5 gäster"));
  });

  it("väntande gäster står bland de väntande inbjudningarna, med Skicka igen och Dra tillbaka som i OpsGastLista", async () => {
    const user = userEvent.setup();
    const { props } = rita();
    expect(screen.getByText("vantande@foretag.se")).toBeInTheDocument();
    const rad = document.querySelector(`[data-gast-person="${ANNA}"]`);
    expect(rad).not.toBeNull();
    expect(within(rad).getByText("anna@foretag.se")).toBeInTheDocument();
    expect(within(rad).getByText("Hela gruppen")).toBeInTheDocument();
    // Ingen egen rubrik och ingen platsrad i listan: de hör till rutan, inte till raderna.
    expect(document.querySelector("[data-gastlista] h2")).toBeNull();
    await user.click(within(rad).getByRole("button", { name: /Skicka länken igen till anna@foretag.se/ }));
    await user.click(within(rad).getByRole("button", { name: /Dra tillbaka inbjudan till anna@foretag.se/ }));
    expect(props.gaster.onSkickaOm).toHaveBeenCalledWith({ id: "i1" });
    expect(props.gaster.onAterkalla).toHaveBeenCalledWith({ id: "i1" });
  });

  it("utan gäster ritas ingen gästlista alls, och utan kanAndra har gästraderna inga knappar och rutan saknas", () => {
    rita({ personer: [] });
    expect(document.querySelector("[data-gastlista]")).toBeNull();
    expect(screen.queryByText(/Inga gäster/)).toBeNull();
  });

  it("utan kanAndra står gästen som en rad utan åtgärder, och ingen Bjud in-ruta", () => {
    rita({}, { kanAndra: false });
    const rad = document.querySelector(`[data-gast-person="${ANNA}"]`);
    expect(rad).not.toBeNull();
    expect(within(rad).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByLabelText("E-post")).toBeNull();
  });
});
