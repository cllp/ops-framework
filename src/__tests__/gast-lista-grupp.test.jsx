import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastLista } from "../components/OpsGastLista.jsx";
import { gastId } from "../lib/gast.js";

/**
 * Gästlistan i gruppläget (0.132.0, cllp/lifehub.app#389, skiva 2): en rad per person med inbjudningarna under, bekräftelsen innan en gäst bjuds in till hela gruppen, och raderingen av en gästs uppgifter.
 * jsdom mäter att rätt text och rätt knappar finns och att anropen går rätt; hur det SER UT mäts i skalytan (390 och 1280 px).
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
});

const klicka = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

const ANNA = gastId("anna@foretag.se");
const person = (extra = {}) => ({
  gastId: ANNA,
  epost: "anna@foretag.se",
  namn: "",
  status: "vantar",
  inbjudningar: [
    { id: "i-grupp", omfang: { slag: "grupp" }, titel: null, status: "vantar" },
    { id: "i-sak", omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" }, titel: "Sommarfest", status: "inloggad" },
  ],
  ...extra,
});

const rita = (props = {}) =>
  render(<OpsGastLista personer={[person()]} platser={{ anvanda: 1, totalt: 5 }} onBjudGrupp={() => {}} onSkickaOm={() => {}} onAterkalla={() => {}} onAterkallaAlla={() => {}} onRadera={() => {}} {...props} />);

describe("OpsGastLista, gruppläget", () => {
  it("ritar en rad per person med varje inbjudan under och sitt omfång i ord", () => {
    rita();
    expect(screen.getByText("1 av 5 gratis platser")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-gast-person]")).toHaveLength(1);
    const inb = document.querySelectorAll("[data-gast-inbjudan]");
    expect(inb).toHaveLength(2);
    expect(within(inb[0]).getByText("Hela gruppen")).toBeInTheDocument();
    expect(within(inb[1]).getByText("Omröstning: Sommarfest")).toBeInTheDocument();
    expect(within(inb[1]).getByText("Har loggat in")).toBeInTheDocument();
  });

  it("tomt är ett svar: utan personer står det att ingen bjudits in till gruppen", () => {
    rita({ personer: [] });
    expect(screen.getByText("Inga gäster har bjudits in till gruppen.")).toBeInTheDocument();
    expect(document.querySelector("[data-gastlista-lista]")).toBeNull();
  });

  it("⛔ att bjuda in till hela gruppen går via en bekräftelse som säger vad gästen ser, och inget anropas före bekräftelsen", async () => {
    const onBjudGrupp = vi.fn().mockResolvedValue(undefined);
    rita({ personer: [], onBjudGrupp });
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "nils@foretag.se" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/hela historiken från början/)).toBeInTheDocument();
    expect(within(dialog).getByText(/allt i kalendern, ärendena och biblioteket/)).toBeInTheDocument();
    expect(within(dialog).getByText(/medlemmarnas e-postadresser/)).toBeInTheDocument();
    expect(within(dialog).getByText(/går inte att ta tillbaka/)).toBeInTheDocument();
    expect(within(dialog).getByText(/högst 15 minuter/)).toBeInTheDocument();
    expect(onBjudGrupp).not.toHaveBeenCalled();
    await klicka(within(dialog).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(onBjudGrupp).toHaveBeenCalledWith({ epost: "nils@foretag.se", namn: "" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("E-postadress")).toHaveValue("");
  });

  it("Avbryt i bekräftelsen bjuder inte in någon och lämnar formuläret ifyllt", async () => {
    const onBjudGrupp = vi.fn();
    rita({ personer: [], onBjudGrupp });
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "nils@foretag.se" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    const dialog = await screen.findByRole("dialog");
    await klicka(within(dialog).getByRole("button", { name: "Avbryt" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onBjudGrupp).not.toHaveBeenCalled();
    expect(screen.getByLabelText("E-postadress")).toHaveValue("nils@foretag.se");
  });

  it("en adress som inte är en adress öppnar ingen dialog utan visar felet", async () => {
    rita({ personer: [] });
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "inte-en-adress" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Det där ser inte ut som en e-postadress.");
  });

  it("ett fel från bjudningen efter bekräftelsen står kvar i formuläret med sin kod-text", async () => {
    const fel = Object.assign(new Error("x"), { kod: "platser-slut" });
    rita({ personer: [], onBjudGrupp: vi.fn().mockRejectedValue(fel) });
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "nils@foretag.se" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    await klicka(within(await screen.findByRole("dialog")).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(document.querySelector("[data-gastlista-bjudfel]")).toHaveTextContent("Gruppen har 5 gäster"));
  });

  it("Skicka igen och Dra tillbaka gäller en inbjudan och skickar inbjudans id, inte personens", async () => {
    const onSkickaOm = vi.fn();
    const onAterkalla = vi.fn();
    rita({ onSkickaOm, onAterkalla });
    const sak = document.querySelector('[data-gast-inbjudan="i-sak"]');
    await klicka(within(sak).getByRole("button", { name: /Skicka länken igen till anna@foretag.se/ }));
    await klicka(within(sak).getByRole("button", { name: /Dra tillbaka inbjudan till anna@foretag.se/ }));
    expect(onSkickaOm).toHaveBeenCalledWith({ id: "i-sak" });
    expect(onAterkalla).toHaveBeenCalledWith({ id: "i-sak" });
  });

  it("Dra tillbaka alla skickar personens gastId, och knappen saknas när allt redan är återkallat", async () => {
    const onAterkallaAlla = vi.fn();
    rita({ onAterkallaAlla });
    await klicka(screen.getByRole("button", { name: "Dra tillbaka alla inbjudningar till anna@foretag.se" }));
    expect(onAterkallaAlla).toHaveBeenCalledWith({ gastId: ANNA });
  });

  it("ingen Dra tillbaka alla när alla inbjudningar redan är återkallade, och en återkallad gruppinbjudan kan bjudas in igen via bekräftelsen", async () => {
    const onBjudGrupp = vi.fn().mockResolvedValue(undefined);
    rita({
      onBjudGrupp,
      personer: [person({ status: "aterkallad", namn: "Anna A", inbjudningar: [{ id: "i-grupp", omfang: { slag: "grupp" }, titel: null, status: "aterkallad" }] })],
    });
    expect(screen.queryByRole("button", { name: /Dra tillbaka alla/ })).toBeNull();
    await klicka(screen.getByRole("button", { name: "Bjud in Anna A igen" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/hela historiken/)).toBeInTheDocument();
    expect(onBjudGrupp).not.toHaveBeenCalled();
    await klicka(within(dialog).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(onBjudGrupp).toHaveBeenCalledWith({ epost: "anna@foretag.se", namn: "Anna A" }));
  });

  it("⛔ Radera uppgifter ber om bekräftelse som säger att det inte går att ångra, och raderar först efter den", async () => {
    const onRadera = vi.fn().mockResolvedValue(undefined);
    rita({ onRadera });
    await klicka(screen.getByRole("button", { name: "Radera uppgifterna om anna@foretag.se" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Det går inte att ångra/)).toBeInTheDocument();
    expect(onRadera).not.toHaveBeenCalled();
    await klicka(within(dialog).getByRole("button", { name: "Radera" }));
    await waitFor(() => expect(onRadera).toHaveBeenCalledWith({ gastId: ANNA, epost: "anna@foretag.se" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Avbryt i raderingen raderar ingenting, och ett radfel från raderingen står kvar på personen", async () => {
    const onRadera = vi.fn().mockRejectedValue(new Error("Servern sa nej."));
    rita({ onRadera });
    await klicka(screen.getByRole("button", { name: "Radera uppgifterna om anna@foretag.se" }));
    await klicka(within(await screen.findByRole("dialog")).getByRole("button", { name: "Avbryt" }));
    expect(onRadera).not.toHaveBeenCalled();
    await klicka(screen.getByRole("button", { name: "Radera uppgifterna om anna@foretag.se" }));
    await klicka(within(await screen.findByRole("dialog")).getByRole("button", { name: "Radera" }));
    await waitFor(() => expect(document.querySelector("[data-gast-person] [data-gast-fel]")).toHaveTextContent("Servern sa nej."));
  });

  it("raderingen finns också i listan över en omröstning, och bara när appen ger onRadera", async () => {
    const onRadera = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<OpsGastLista gaster={[{ id: "g1", epost: "anna@foretag.se" }]} platser={{ anvanda: 1, totalt: 5 }} onRadera={onRadera} />);
    await klicka(screen.getByRole("button", { name: "Radera uppgifterna om anna@foretag.se" }));
    await klicka(within(await screen.findByRole("dialog")).getByRole("button", { name: "Radera" }));
    await waitFor(() => expect(onRadera).toHaveBeenCalledWith({ gastId: ANNA, epost: "anna@foretag.se" }));
    unmount();
    render(<OpsGastLista gaster={[{ id: "g1", epost: "anna@foretag.se" }]} platser={{ anvanda: 1, totalt: 5 }} />);
    expect(screen.queryByRole("button", { name: /Radera/ })).toBeNull();
  });

  it("vid fulla platser spärras formuläret och texten säger varför", () => {
    rita({ personer: [], platser: { anvanda: 5, totalt: 5 } });
    expect(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" })).toBeDisabled();
    expect(screen.getByText(/det är taket/)).toBeInTheDocument();
  });

  it("vägrar tvetydig eller felaktig användning med ett tydligt fel", () => {
    expect(() => render(<OpsGastLista gaster={[]} personer={[]} platser={{ anvanda: 0, totalt: 5 }} />)).toThrow(/antingen gaster/);
    expect(() => render(<OpsGastLista personer={[]} platser={{ anvanda: 0, totalt: 5 }} onBjud={() => {}} />)).toThrow(/onBjudGrupp/);
    expect(() => render(<OpsGastLista gaster={[]} platser={{ anvanda: 0, totalt: 5 }} onBjudGrupp={() => {}} />)).toThrow(/hela gruppen/);
    expect(() => render(<OpsGastLista personer={[{ gastId: 1 }]} platser={{ anvanda: 0, totalt: 5 }} />)).toThrow(/gastId, epost, inbjudningar/);
    expect(() => render(<OpsGastLista personer={[]} platser={{ anvanda: 0, totalt: 5 }} onRadera="x" />)).toThrow(/onRadera/);
  });
});
