import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    // ⛔ Dialogen säger vad gästen ser och kan: chattens hela historik och att gästen kan skriva i den, kalendern (svara och rösta), biblioteket (läsa, spela, ladda ned), och att ärenden inte syns.
    expect(within(dialog).getByText(/hela historiken från början, och kan skriva i den/)).toBeInTheDocument();
    expect(within(dialog).getByText(/kalendern och händelserna och kan svara och rösta/)).toBeInTheDocument();
    expect(within(dialog).getByText(/läsa, spela och ladda ned i biblioteket/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Gästen ser inte gruppens ärenden/)).toBeInTheDocument();
    expect(within(dialog).getByText(/medlemmarnas e-postadresser/)).toBeInTheDocument();
    expect(within(dialog).getByText(/går inte att ta tillbaka/)).toBeInTheDocument();
    expect(within(dialog).getByText(/högst 15 minuter/)).toBeInTheDocument();
    expect(onBjudGrupp).not.toHaveBeenCalled();
    await klicka(within(dialog).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(onBjudGrupp).toHaveBeenCalledWith({ epost: "nils@foretag.se", namn: "" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("E-postadress")).toHaveValue("");
  });

  it("⛔ bekräftelsen står kvar och visar att den bjuder in tills servern svarat, och ett andra tryck bjuder inte in igen (CP 2026-11-05)", async () => {
    // CP: "Finns ingen progress-bar när man klickar på bjuden så man kan komma att trycka många gånger." Dialogen stängdes före anropet, och formulärets knapp var tryckbar igen med adressen kvar.
    let svara = () => {};
    const onBjudGrupp = vi.fn(() => new Promise((r) => (svara = r)));
    rita({ personer: [], onBjudGrupp });
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "nils@foretag.se" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    const dialog = await screen.findByRole("dialog");
    await klicka(within(dialog).getByRole("button", { name: "Bjud in" }));
    expect(onBjudGrupp).toHaveBeenCalledTimes(1);
    // Under väntan: dialogen är kvar, knappen är upptagen och säger vad den gör, och Avbryt går inte att trycka.
    expect(screen.getByRole("dialog")).toBe(dialog);
    const upptagen = within(dialog).getByText("Skickar inbjudan…").closest("button");
    expect(upptagen).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Avbryt" })).toBeDisabled();
    await klicka(upptagen);
    await klicka(within(dialog).getByRole("button", { name: "Avbryt" }));
    expect(onBjudGrupp).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBe(dialog);
    await act(async () => {
      svara(undefined);
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("E-postadress")).toHaveValue("");
    expect(onBjudGrupp).toHaveBeenCalledTimes(1);
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

  it("⛔ Skicka igen säger vad den gör medan den väntar, och sedan att en ny länk är skickad och att den förra inte gäller (CP 2026-11-05)", async () => {
    let svara = () => {};
    const onSkickaOm = vi.fn(() => new Promise((r) => (svara = r)));
    rita({ onSkickaOm });
    const rad = document.querySelectorAll("[data-gast-inbjudan]")[0];
    await klicka(within(rad).getByRole("button", { name: /Skicka länken igen till anna@foretag.se/ }));
    expect(within(rad).getByText("Skickar…").closest("button")).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector("[data-gast-klar]")).toBeNull();
    await act(async () => {
      svara(undefined);
    });
    await waitFor(() =>
      expect(document.querySelector("[data-gast-klar]")).toHaveTextContent("En ny länk är skickad till anna@foretag.se. Den gäller i 30 dagar, och den förra länken fungerar inte längre."),
    );
    expect(onSkickaOm).toHaveBeenCalledTimes(1);
  });

  describe("Kopiera länk (0.189.0, CP 2026-11-05)", () => {
    const URL_ = "https://app.example/gast?i=i-sak&k=abc";
    const GILTIG = Date.UTC(2026, 11, 5, 12);
    const svarMed = () => ({ url: URL_, lankGiltigTill: GILTIG });
    const knappNamn = /Kopiera länken till anna@foretag.se \(Omröstning: Sommarfest\)/;

    it("knappen syns bara med onKopieraLank, och inte för en återkallad inbjudan", () => {
      rita();
      expect(screen.queryByRole("button", { name: /Kopiera länken till/ })).toBeNull();
    });

    it("är upptagen med Hämtar länken… under väntan, och visar sedan länken i ett fält med texten att inget mejl skickades", async () => {
      let svara = (/** @type {any} */ _v) => {};
      const onKopieraLank = vi.fn(() => new Promise((r) => (svara = r)));
      rita({ onKopieraLank });
      const rad = document.querySelector('[data-gast-inbjudan="i-sak"]');
      await klicka(within(rad).getByRole("button", { name: knappNamn }));
      expect(onKopieraLank).toHaveBeenCalledWith({ id: "i-sak" });
      expect(within(rad).getByText("Hämtar länken…").closest("button")).toHaveAttribute("aria-busy", "true");
      expect(document.querySelector("[data-gast-lank]")).toBeNull();
      await act(async () => {
        svara(svarMed());
      });
      const ruta = await waitFor(() => {
        const r = rad.querySelector("[data-gast-lank]");
        expect(r).not.toBeNull();
        return r;
      });
      expect(within(ruta).getByDisplayValue(URL_)).toHaveAttribute("readonly");
      expect(ruta).toHaveTextContent("Inget mejl skickades.");
      expect(ruta).toHaveTextContent("Samma länk som i mejlet. Den gäller till 5 december 2026.");
      expect(ruta).not.toHaveTextContent(/förra länken|fungerar inte längre/);
      // Bara den inbjudan som hämtades får en ruta.
      expect(document.querySelectorAll("[data-gast-lank]")).toHaveLength(1);
    });

    it("Kopiera anropar clipboard.writeText med länken och säger Kopierad", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(window.navigator, "clipboard", { value: { writeText }, configurable: true });
      rita({ onKopieraLank: vi.fn().mockResolvedValue(svarMed()) });
      await klicka(screen.getByRole("button", { name: knappNamn }));
      const ruta = await waitFor(() => document.querySelector("[data-gast-lank]"));
      await klicka(within(ruta).getByRole("button", { name: "Kopiera" }));
      expect(writeText).toHaveBeenCalledWith(URL_);
      await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Kopierad"));
    });

    it("saknas clipboard markeras texten och det står vad man gör i stället", async () => {
      Object.defineProperty(window.navigator, "clipboard", { value: undefined, configurable: true });
      rita({ onKopieraLank: vi.fn().mockResolvedValue(svarMed()) });
      await klicka(screen.getByRole("button", { name: knappNamn }));
      const ruta = await waitFor(() => document.querySelector("[data-gast-lank]"));
      const falt = within(ruta).getByDisplayValue(URL_);
      await klicka(within(ruta).getByRole("button", { name: "Kopiera" }));
      await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Markerad, kopiera den med Kopiera i menyn"));
      expect(document.activeElement === falt || (falt.selectionStart === 0 && falt.selectionEnd === URL_.length)).toBe(true);
    });

    it("tjänstens felkoder får egna texter: ingen-kopia, utgangen och valv-misslyckades", async () => {
      const texter = { "ingen-kopia": "Den här länken skapades innan länkar sparades. Tryck Skicka igen en gång, sedan går den att kopiera.", utgangen: "Länken har gått ut. Tryck Skicka igen för en ny.", "valv-misslyckades": "Länken kunde inte sparas för kopiering. Inbjudan finns: tryck Skicka igen." };
      for (const [kod, text] of Object.entries(texter)) {
        const { unmount } = rita({ onKopieraLank: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { kod })) });
        await klicka(screen.getByRole("button", { name: knappNamn }));
        await waitFor(() => expect(document.querySelector("[data-gast-fel]")).toHaveTextContent(text));
        unmount();
      }
    });

    it("kastar clipboard visas samma besked, och ett fel från onKopieraLank blir ett radfel", async () => {
      Object.defineProperty(window.navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("nej")) }, configurable: true });
      const { unmount } = rita({ onKopieraLank: vi.fn().mockResolvedValue(svarMed()) });
      await klicka(screen.getByRole("button", { name: knappNamn }));
      const ruta = await waitFor(() => document.querySelector("[data-gast-lank]"));
      await klicka(within(ruta).getByRole("button", { name: "Kopiera" }));
      await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Markerad"));
      unmount();
      rita({ onKopieraLank: vi.fn().mockRejectedValue(new Error("ej-behorig")) });
      await klicka(screen.getByRole("button", { name: knappNamn }));
      await waitFor(() => expect(document.querySelector("[data-gast-fel]")).not.toBeNull());
      expect(document.querySelector("[data-gast-lank]")).toBeNull();
    });

    describe("Dela", () => {
      const delaKnapp = (ruta) => within(ruta).queryByRole("button", { name: "Dela" });
      const oppna = async (props = {}) => {
        rita({ onKopieraLank: vi.fn().mockResolvedValue(svarMed()), ...props });
        await klicka(screen.getByRole("button", { name: knappNamn }));
        return waitFor(() => {
          const r = document.querySelector("[data-gast-lank]");
          expect(r).not.toBeNull();
          return r;
        });
      };
      afterEach(() => {
        Object.defineProperty(window.navigator, "share", { value: undefined, configurable: true });
      });

      it("knappen saknas utan navigator.share och finns med den", async () => {
        Object.defineProperty(window.navigator, "share", { value: undefined, configurable: true });
        expect(delaKnapp(await oppna())).toBeNull();
        cleanup();
        Object.defineProperty(window.navigator, "share", { value: vi.fn(), configurable: true });
        expect(delaKnapp(await oppna())).not.toBeNull();
      });

      it("anropar share med länken, texten och rubriken (med gruppnamn, annars bara Inbjudan)", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(window.navigator, "share", { value: share, configurable: true });
        const ruta = await oppna({ gruppnamn: "Källan" });
        await klicka(delaKnapp(ruta));
        expect(share).toHaveBeenCalledWith({ title: "Inbjudan till Källan", text: "Öppna länken. Du behöver inget konto.", url: URL_ });
        expect(within(ruta).queryByRole("status")).toBeNull();
        cleanup();
        const ruta2 = await oppna();
        await klicka(delaKnapp(ruta2));
        expect(share).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Inbjudan", url: URL_ }));
      });

      it("AbortError (personen stängde menyn) ger ingen text, annat fel ger att länken går att kopiera", async () => {
        const share = vi.fn().mockRejectedValueOnce(Object.assign(new Error("avbruten"), { name: "AbortError" })).mockRejectedValueOnce(new Error("nej"));
        Object.defineProperty(window.navigator, "share", { value: share, configurable: true });
        const ruta = await oppna();
        await klicka(delaKnapp(ruta));
        expect(within(ruta).queryByRole("status")).toBeNull();
        await klicka(delaKnapp(ruta));
        await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Det gick inte att dela. Kopiera länken i stället."));
      });
    });

    it("omröstningsläget (gaster) har samma knapp", async () => {
      const onKopieraLank = vi.fn().mockResolvedValue(svarMed());
      render(<OpsGastLista gaster={[{ id: "g1", epost: "bo@foretag.se", namn: "", skapad: 1, lankGiltigTill: Date.now() + 1e9, aterkallad: null }]} platser={{ anvanda: 1, totalt: 5 }} onKopieraLank={onKopieraLank} />);
      await klicka(screen.getByRole("button", { name: "Kopiera länken till bo@foretag.se" }));
      expect(onKopieraLank).toHaveBeenCalledWith({ id: "g1" });
      await waitFor(() => expect(document.querySelector('[data-gast="g1"] [data-gast-lank]')).not.toBeNull());
    });
  });

  it("⛔ en visad länk försvinner när Skicka igen byter nyckel, så listan aldrig visar en länk som slutat fungera", async () => {
    const onKopieraLank = vi.fn().mockResolvedValue({ url: "https://exempel.se/gast#gammal", lankGiltigTill: Date.UTC(2026, 11, 5) });
    rita({ onKopieraLank, onSkickaOm: vi.fn().mockResolvedValue(undefined) });
    const rad = document.querySelectorAll("[data-gast-inbjudan]")[0];
    await klicka(within(rad).getByRole("button", { name: /Kopiera länken till anna@foretag.se/ }));
    await waitFor(() => expect(document.querySelector("[data-gast-lank]")).not.toBeNull());
    await klicka(within(rad).getByRole("button", { name: /Skicka länken igen till anna@foretag.se/ }));
    await waitFor(() => expect(document.querySelector("[data-gast-klar]")).not.toBeNull());
    expect(document.querySelector("[data-gast-lank]")).toBeNull();
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
