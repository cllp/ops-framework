import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastLista } from "../components/OpsGastLista.jsx";
import { OpsGastSida } from "../components/OpsGastSida.jsx";
import { GASTFEL } from "../lib/gast.js";

/**
 * Vyn för gäst med telefonnummer (0.197.0, cllp/lifehub.app#661): valet E-post eller Telefon i gruppens inbjudan, länken med Dela och Kopiera direkt efter inbjudan, Ny länk på en telefongästs rad,
 * och gästsidan med en länk som bär tecknet (sedan 0.200.0 frågar den inte efter numret, men en utgången telefonlänk ger ingen knapp för en ny länk).
 * jsdom mäter att rätt text och rätt anrop finns; hur det SER UT mäts i skalytan.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): utfallen med koden muterad står i leveransens rapport.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // @ts-ignore
  delete window.navigator.share;
});

const klicka = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

const ID = "a".repeat(64);
const NYCKEL = "N".repeat(43);
const SESSION = "S".repeat(43);
const URL_TEL = `https://app.example/guest#i=${ID}&k=${NYCKEL}&s=tel`;
/** `gastId({ slag: "telefon", varde: "+46701234567" })`, som en konstant: vyn får id:t ur tjänstens lista och räknar det aldrig själv. */
const TOVE = "g_a599ff5c4d1670ce35ad7b81d6ef2adc3b5284d9";

const telefonperson = (extra = {}) => ({
  gastId: TOVE,
  epost: null,
  telefon: "+46701234567",
  namn: "Tove",
  status: "vantar",
  inbjudningar: [{ id: ID, omfang: { slag: "grupp" }, titel: null, status: "vantar" }],
  ...extra,
});

describe("OpsGastLista: Bjud in med Telefon", () => {
  const rita = (props = {}) => {
    const onBjudGrupp = props.onBjudGrupp ?? vi.fn(async () => ({ id: ID, slag: "telefon" }));
    const onKopieraLank = props.onKopieraLank ?? vi.fn(async () => ({ url: URL_TEL, lankGiltigTill: Date.UTC(2026, 11, 6) }));
    const utf = render(<OpsGastLista personer={[]} platser={{ anvanda: 0, totalt: 5 }} medTelefon onBjudGrupp={onBjudGrupp} onKopieraLank={onKopieraLank} gruppnamn="Källan" {...props} />);
    return { ...utf, onBjudGrupp, onKopieraLank };
  };

  it("utan medTelefon finns inget val, och e-postformuläret är som förut", () => {
    render(<OpsGastLista personer={[]} platser={{ anvanda: 0, totalt: 5 }} onBjudGrupp={() => {}} onKopieraLank={async () => ({ url: "x", lankGiltigTill: 0 })} />);
    expect(screen.queryByRole("tab", { name: "Telefon" })).toBeNull();
    expect(screen.getByLabelText("E-postadress")).toBeInTheDocument();
    expect(screen.queryByLabelText("Telefonnummer")).toBeNull();
  });

  it("med Telefon vald bjuds numret in i normaliserad form efter bekräftelsen, och länken visas direkt med Dela (sms-texten) och Kopiera", async () => {
    const share = vi.fn(async () => {});
    // @ts-ignore
    window.navigator.share = share;
    const { onBjudGrupp, onKopieraLank } = rita();
    expect(screen.getByText(/^En gäst får ett mejl med en länk/)).toBeInTheDocument();
    await klicka(screen.getByRole("tab", { name: "Telefon" }));
    expect(screen.queryByLabelText("E-postadress")).toBeNull();
    // Ingressen lovar inget mejl när inbjudan gäller ett nummer.
    expect(screen.getByText(/^En gäst får en länk som du delar/)).toBeInTheDocument();
    expect(screen.queryByText(/^En gäst får ett mejl med en länk/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Telefonnummer"), { target: { value: "070-123 45 67" } });
    fireEvent.change(screen.getByLabelText("Namn (valfritt)"), { target: { value: "Tove" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    // Bekräftelsen säger vem, och det är namnet.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Bjud in Tove till hela gruppen?")).toBeInTheDocument();
    await klicka(within(dialog).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(onBjudGrupp).toHaveBeenCalledWith({ telefon: "+46701234567", namn: "Tove", laddaNed: false }));
    await waitFor(() => expect(onKopieraLank).toHaveBeenCalledWith({ id: ID }));
    const ruta = await screen.findByText("Inbjudan är klar. Dela länken med Tove.");
    expect(ruta).toBeInTheDocument();
    const lank = document.querySelector('[data-gastlista-telefonlank] [data-gast-lank="telefon"]');
    expect(lank).not.toBeNull();
    expect(within(/** @type {HTMLElement} */ (lank)).getByDisplayValue(URL_TEL)).toBeInTheDocument();
    expect(within(/** @type {HTMLElement} */ (lank)).getByText(/Inget sms skickades/)).toBeInTheDocument();
    await klicka(within(/** @type {HTMLElement} */ (lank)).getByRole("button", { name: "Dela" }));
    expect(share).toHaveBeenCalledWith({ title: "Inbjudan till Källan", text: "Öppna länken. Du behöver inget konto.", url: URL_TEL });
    expect(within(/** @type {HTMLElement} */ (lank)).getByRole("button", { name: "Kopiera" })).toBeInTheDocument();
  });

  it("ett nummer som inte är ett nummer öppnar ingen bekräftelse och anropar inte servern", async () => {
    const { onBjudGrupp } = rita();
    await klicka(screen.getByRole("tab", { name: "Telefon" }));
    fireEvent.change(screen.getByLabelText("Telefonnummer"), { target: { value: "070-12" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/inte ut som ett telefonnummer/);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onBjudGrupp).not.toHaveBeenCalled();
  });

  it("ger appen inget id tillbaka står det att inbjudan finns och var länken hämtas (aldrig tyst)", async () => {
    const { onKopieraLank } = rita({ onBjudGrupp: vi.fn(async () => undefined) });
    await klicka(screen.getByRole("tab", { name: "Telefon" }));
    fireEvent.change(screen.getByLabelText("Telefonnummer"), { target: { value: "0701234567" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    await klicka(within(await screen.findByRole("dialog")).getByRole("button", { name: "Bjud in" }));
    expect(await screen.findByText("Inbjudan finns. Tryck Kopiera länk på gästens rad för att dela den.")).toBeInTheDocument();
    expect(onKopieraLank).not.toHaveBeenCalled();
  });

  it("medTelefon utan onKopieraLank, eller i listan över en omröstning, kastar med skälet", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsGastLista personer={[]} platser={{ anvanda: 0, totalt: 5 }} medTelefon onBjudGrupp={() => {}} />)).toThrow(/medTelefon kräver/);
    expect(() => render(<OpsGastLista gaster={[]} platser={{ anvanda: 0, totalt: 5 }} medTelefon />)).toThrow(/medTelefon hör till/);
    tyst.mockRestore();
  });
});

describe("OpsGastLista: en telefongäst i listan", () => {
  it("raden visar numret, Ny länk byter nyckel utan brev och visar den nya länken med Dela, och Radera skickar numret i bekräftelsen", async () => {
    const onSkickaOm = vi.fn(async () => ({ id: ID, slag: "telefon" }));
    const onKopieraLank = vi.fn(async () => ({ url: URL_TEL, lankGiltigTill: Date.UTC(2026, 11, 6) }));
    const onRadera = vi.fn(async () => {});
    render(<OpsGastLista personer={[telefonperson()]} platser={{ anvanda: 1, totalt: 5 }} onSkickaOm={onSkickaOm} onKopieraLank={onKopieraLank} onRadera={onRadera} />);
    const rad = /** @type {HTMLElement} */ (document.querySelector(`[data-gast-person="${TOVE}"]`));
    expect(within(rad).getByText("+46701234567")).toHaveAttribute("data-gast-telefon");
    expect(within(rad).queryByRole("button", { name: /Skicka länken igen/ })).toBeNull();
    await klicka(within(rad).getByRole("button", { name: /Ge Tove en ny länk/ }));
    expect(onSkickaOm).toHaveBeenCalledWith({ id: ID });
    await waitFor(() => expect(onKopieraLank).toHaveBeenCalledWith({ id: ID }));
    expect(await within(rad).findByText(/En ny länk är skapad/)).toBeInTheDocument();
    expect(within(rad).getByDisplayValue(URL_TEL)).toBeInTheDocument();
    expect(rad.querySelector('[data-gast-lank="telefon"]')).not.toBeNull();
    await klicka(within(rad).getByRole("button", { name: "Radera uppgifterna om Tove" }));
    await klicka(within(await screen.findByRole("dialog")).getByRole("button", { name: "Radera" }));
    await waitFor(() => expect(onRadera).toHaveBeenCalledWith({ gastId: TOVE, telefon: "+46701234567" }));
  });
});

describe("OpsGastSida: en telefonlänk", () => {
  const lagringMed = () => {
    const d = {};
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; }, d };
  };
  const rita = (props = {}) => {
    const onLos = props.onLos ?? vi.fn(async () => ({ ok: true, sessionsnyckel: SESSION }));
    const onHamta = vi.fn(async () => ({ ok: true, namn: "", funktion: "rosta", sak: { titel: "Rep" } }));
    const onNyLank = vi.fn(async () => ({ ok: true }));
    render(<OpsGastSida lank={{ id: ID, nyckel: NYCKEL, slag: "telefon" }} onLos={onLos} onHamta={onHamta} onNyLank={onNyLank} renderSak={({ sak }) => <div>{sak.titel}</div>} intervallMs={0} lagring={lagringMed()} {...props} />);
    return { onLos, onNyLank };
  };

  it("(0.200.0) frågar inte efter numret: välkomsten har inget fält, och Öppna postar exakt { id, nyckel } och loggar in som vanligt", async () => {
    const { onLos } = rita();
    expect(await screen.findByRole("heading", { name: "Välkommen" })).toBeInTheDocument();
    expect(document.querySelectorAll("input")).toHaveLength(0);
    await klicka(screen.getByRole("button", { name: "Öppna" }));
    await waitFor(() => expect(onLos).toHaveBeenCalledTimes(1));
    expect(onLos.mock.calls[0][0]).toStrictEqual({ id: ID, nyckel: NYCKEL });
    expect(await screen.findByText("Rep")).toBeInTheDocument();
  });

  it("en utgången länk erbjuder ingen ny länk med mejl, utan säger att den som bjöd ger en ny", async () => {
    const { onNyLank } = rita({ onLos: vi.fn(async () => ({ ok: false, orsak: "utgangen" })) });
    await klicka(await screen.findByRole("button", { name: "Öppna" }));
    expect(await screen.findByText("Be den som bjöd in dig om en ny länk.")).toBeInTheDocument();
    expect(screen.getByText(GASTFEL.utgangen)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skicka en ny länk" })).toBeNull();
    expect(onNyLank).not.toHaveBeenCalled();
  });
});
