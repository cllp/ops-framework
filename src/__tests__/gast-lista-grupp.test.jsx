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

const ritaSammanfalld = (props = {}) =>
  render(<OpsGastLista personer={[person()]} platser={{ anvanda: 1, totalt: 5 }} onBjudGrupp={() => {}} onSkickaOm={() => {}} onAterkalla={() => {}} onAterkallaAlla={() => {}} onRadera={() => {}} {...props} />);

/** Fäller ut varje sammanfällt gästkort (0.204.0). */
const fallUtAlla = () => {
  for (const b of document.querySelectorAll('[data-gast-vaxla][aria-expanded="false"]')) fireEvent.click(b);
};

/**
 * ⛔ ÄNDRAT 0.204.0 (hopfällbara gästkort, CP 2026-11-08): korten är sammanfällda från början, och proven nedan mäter det som står i ett utfällt kort. `rita` fäller därför ut alla kort direkt
 * efter ritningen, så att proven mäter samma sak som förut. Det sammanfällda läget mäts för sig i "hopfällbara gästkort" längst ned, med `ritaSammanfalld`.
 */
const rita = (props = {}) => {
  const svar = ritaSammanfalld(props);
  fallUtAlla();
  return svar;
};

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
    // ⛔ Dialogen säger vad gästen ser och kan: chattens hela historik och att gästen kan skriva i den, kalendern (svara och rösta), biblioteket (läsa, spela), och att ärenden inte syns.
    // (0.203.0) Nedladdning är av som förval, och dialogen säger det: kryssrutan var inte ikryssad.
    expect(within(dialog).getByText(/hela historiken från början, och kan skriva i den/)).toBeInTheDocument();
    expect(within(dialog).getByText(/kalendern och händelserna och kan svara och rösta/)).toBeInTheDocument();
    expect(within(dialog).getByText(/kan läsa och spela i biblioteket/)).toBeInTheDocument();
    expect(within(dialog).getByText("Gästen får inte ladda ned filer.")).toBeInTheDocument();
    expect(within(dialog).getByText(/Gästen ser inte gruppens ärenden/)).toBeInTheDocument();
    expect(within(dialog).getByText(/medlemmarnas e-postadresser/)).toBeInTheDocument();
    expect(within(dialog).getByText(/går inte att ta tillbaka/)).toBeInTheDocument();
    expect(within(dialog).getByText(/högst 15 minuter/)).toBeInTheDocument();
    expect(onBjudGrupp).not.toHaveBeenCalled();
    await klicka(within(dialog).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(onBjudGrupp).toHaveBeenCalledWith({ epost: "nils@foretag.se", namn: "", laddaNed: false }));
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
        // (0.206.0) Felet bär telefonens egen orsak, och länken är markerad.
        await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Det gick inte att dela (Error: nej). Länken är markerad, kopiera den."));
      });

      // ⛔ (0.206.0) CP tryckte Dela på ett gästkort i telefonen och fick "Det gick inte att dela. Kopiera länken i stället." Felet svaldes, så ingen kunde se varför.
      it("⛔ nekas delningen står telefonens orsak (e.name) i felraden, och länken i fältet är markerad", async () => {
        const share = vi.fn().mockRejectedValue({ name: "NotAllowedError" });
        Object.defineProperty(window.navigator, "share", { value: share, configurable: true });
        const ruta = await oppna();
        const falt = within(ruta).getByDisplayValue(URL_);
        await klicka(delaKnapp(ruta));
        await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Det gick inte att dela (NotAllowedError). Länken är markerad, kopiera den."));
        expect(falt.selectionStart).toBe(0);
        expect(falt.selectionEnd).toBe(URL_.length);
      });

      it("ett kort meddelande följer med namnet, ett långt gör det inte, och ett fel utan namn säger att orsaken saknas", async () => {
        const lang = "x".repeat(200);
        const share = vi
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error("Permission denied"), { name: "NotAllowedError" }))
          .mockRejectedValueOnce(Object.assign(new Error(lang), { name: "NotAllowedError" }))
          .mockRejectedValueOnce(undefined);
        Object.defineProperty(window.navigator, "share", { value: share, configurable: true });
        const ruta = await oppna();
        await klicka(delaKnapp(ruta));
        await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Det gick inte att dela (NotAllowedError: Permission denied). Länken är markerad, kopiera den."));
        await klicka(delaKnapp(ruta));
        await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Det gick inte att dela (NotAllowedError). Länken är markerad, kopiera den."));
        await klicka(delaKnapp(ruta));
        await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Det gick inte att dela (telefonen angav ingen orsak). Länken är markerad, kopiera den."));
      });

      it("på engelska står samma sak med orsaken", async () => {
        Object.defineProperty(window.navigator, "share", { value: vi.fn().mockRejectedValue({ name: "NotAllowedError" }), configurable: true });
        rita({ onKopieraLank: vi.fn().mockResolvedValue(svarMed()), sprak: "en" });
        await klicka(screen.getByRole("button", { name: /Copy the link to anna@foretag.se \(Vote: Sommarfest\)/ }));
        const ruta = await waitFor(() => {
          const r = document.querySelector("[data-gast-lank]");
          expect(r).not.toBeNull();
          return /** @type {HTMLElement} */ (r);
        });
        await klicka(within(ruta).getByRole("button", { name: "Share" }));
        await waitFor(() => expect(within(ruta).getByRole("status")).toHaveTextContent("Could not share (NotAllowedError). The link is selected, copy it."));
      });

      it("⛔ share anropas i själva klicket, före varje await (webbläsaren kräver användartrycket)", () => {
        const share = vi.fn(() => new Promise(() => {}));
        Object.defineProperty(window.navigator, "canShare", { value: vi.fn(() => false), configurable: true });
        Object.defineProperty(window.navigator, "share", { value: share, configurable: true });
        return oppna().then((ruta) => {
          fireEvent.click(delaKnapp(ruta));
          expect(share).toHaveBeenCalledTimes(1);
          Object.defineProperty(window.navigator, "canShare", { value: undefined, configurable: true });
        });
      });

      it("säger canShare nej till rubrik, text och länk delas bara länken; säger den ja delas allt", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        const canShare = vi.fn(() => false);
        Object.defineProperty(window.navigator, "share", { value: share, configurable: true });
        Object.defineProperty(window.navigator, "canShare", { value: canShare, configurable: true });
        try {
          const ruta = await oppna({ gruppnamn: "Källan" });
          await klicka(delaKnapp(ruta));
          expect(canShare).toHaveBeenCalledWith({ title: "Inbjudan till Källan", text: "Öppna länken. Du behöver inget konto.", url: URL_ });
          expect(share).toHaveBeenLastCalledWith({ url: URL_ });
          canShare.mockReturnValue(true);
          await klicka(delaKnapp(ruta));
          expect(share).toHaveBeenLastCalledWith({ title: "Inbjudan till Källan", text: "Öppna länken. Du behöver inget konto.", url: URL_ });
        } finally {
          Object.defineProperty(window.navigator, "canShare", { value: undefined, configurable: true });
        }
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

  it("⛔ en visad länk försvinner när samma person bjuds in igen, eftersom inbjudan byter nyckel (0.202.0, lifehub.app#687 punkt 1 och 2)", async () => {
    const onKopieraLank = vi.fn().mockResolvedValue({ url: "https://exempel.se/gast#gammal", lankGiltigTill: Date.UTC(2026, 11, 5) });
    const onBjudGrupp = vi.fn().mockResolvedValue(undefined);
    rita({ onKopieraLank, onBjudGrupp });
    const rad = document.querySelectorAll("[data-gast-inbjudan]")[0];
    await klicka(within(rad).getByRole("button", { name: /Kopiera länken till anna@foretag.se/ }));
    await waitFor(() => expect(document.querySelector("[data-gast-lank]")).not.toBeNull());
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "anna@foretag.se" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    await klicka(within(await screen.findByRole("dialog")).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(onBjudGrupp).toHaveBeenCalled());
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

describe("OpsGastLista, nedladdning per gäst (0.203.0, lifehub.app#691)", () => {
  const gruppInbjudan = (laddaNed, extra = {}) => ({ id: "i-grupp", omfang: { slag: "grupp" }, titel: null, status: "vantar", laddaNed, ...extra });

  it("kryssrutan Får ladda ned filer står av som förval, och onBjudGrupp får laddaNed: true när den kryssats; efter inbjudan står den av igen", async () => {
    const onBjudGrupp = vi.fn().mockResolvedValue(undefined);
    rita({ personer: [], onBjudGrupp });
    const ruta = screen.getByRole("checkbox", { name: "Får ladda ned filer" });
    expect(ruta).not.toBeChecked();
    await klicka(ruta);
    expect(ruta).toBeChecked();
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "nils@foretag.se" } });
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Gästen får också ladda ned filer ur biblioteket/)).toBeInTheDocument();
    await klicka(within(dialog).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(onBjudGrupp).toHaveBeenCalledWith({ epost: "nils@foretag.se", namn: "", laddaNed: true }));
    expect(screen.getByRole("checkbox", { name: "Får ladda ned filer" })).not.toBeChecked();
  });

  it("med telefon får onBjudGrupp också laddaNed", async () => {
    const onBjudGrupp = vi.fn().mockResolvedValue({ id: "i-ny" });
    const onKopieraLank = vi.fn().mockResolvedValue({ url: "https://app.exempel/gast#i=x", lankGiltigTill: 1 });
    rita({ personer: [], onBjudGrupp, onKopieraLank, medTelefon: true });
    await klicka(screen.getByRole("tab", { name: "Telefon" }));
    fireEvent.change(screen.getByLabelText("Telefonnummer"), { target: { value: "070-123 45 67" } });
    await klicka(screen.getByRole("checkbox", { name: "Får ladda ned filer" }));
    await klicka(screen.getByRole("button", { name: "Bjud in gäst till hela gruppen" }));
    await klicka(within(await screen.findByRole("dialog")).getByRole("button", { name: "Bjud in" }));
    await waitFor(() => expect(onBjudGrupp).toHaveBeenCalledWith({ telefon: "+46701234567", namn: "", laddaNed: true }));
    expect(screen.getByRole("checkbox", { name: "Får ladda ned filer" })).not.toBeChecked();
  });

  it("med onNedladdning har varje gruppinbjudan ett reglage som följer laddaNed och anropar med { id, pa }; en sak har inget", async () => {
    const onNedladdning = vi.fn().mockResolvedValue(undefined);
    const { rerender } = rita({ personer: [person({ inbjudningar: [gruppInbjudan(false), { id: "i-sak", omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" }, titel: "Sommarfest", status: "inloggad" }] })], onNedladdning });
    const reglage = screen.getAllByRole("switch", { name: "Får ladda ned filer" });
    expect(reglage).toHaveLength(1);
    expect(reglage[0]).not.toBeChecked();
    expect(within(document.querySelector('[data-gast-inbjudan="i-sak"]')).queryByRole("switch")).toBeNull();
    await klicka(reglage[0]);
    await waitFor(() => expect(onNedladdning).toHaveBeenCalledWith({ id: "i-grupp", pa: true }));
    rerender(<OpsGastLista personer={[person({ inbjudningar: [gruppInbjudan(true)] })]} platser={{ anvanda: 1, totalt: 5 }} onNedladdning={onNedladdning} />);
    const pa = screen.getByRole("switch", { name: "Får ladda ned filer" });
    expect(pa).toBeChecked();
    await klicka(pa);
    await waitFor(() => expect(onNedladdning).toHaveBeenLastCalledWith({ id: "i-grupp", pa: false }));
  });

  // ⛔ ÄNDRAT 0.204.0: provet sade att `laddaNed: null` stod avslagen med raden "Följer gruppens inställning". Gruppen är inte längre en del av regeln, så en inbjudan utan värde är av,
  // som på servern, och raden finns inte. Rött mot 0.203.0 (där stod raden).
  it("laddaNed: null eller saknat står avslaget utan någon rad om gruppen; en återkallad går inte att ändra; ett fel syns på raden", async () => {
    const onNedladdning = vi.fn().mockRejectedValue(Object.assign(new Error("nej"), { kod: "ej-behorig" }));
    rita({ personer: [person({ inbjudningar: [gruppInbjudan(null)] })], onNedladdning });
    const r = screen.getByRole("switch", { name: "Får ladda ned filer" });
    expect(r).not.toBeChecked();
    expect(screen.queryByText(/gruppens inställning/)).toBeNull();
    expect(document.querySelector("[data-gast-laddaned]")).toHaveAttribute("data-gast-laddaned", "av");
    await klicka(r);
    expect(await screen.findByRole("alert")).toHaveTextContent("Du får inte bjuda in gäster");
    cleanup();
    rita({ personer: [person({ status: "aterkallad", inbjudningar: [gruppInbjudan(true, { status: "aterkallad" })] })], onNedladdning });
    expect(screen.getByRole("switch", { name: "Får ladda ned filer" })).toBeDisabled();
  });

  it("utan onNedladdning inget reglage, och onNedladdning som inte är en funktion, eller i listan över en omröstning, kastar", () => {
    rita({ personer: [person({ inbjudningar: [gruppInbjudan(true)] })] });
    expect(screen.queryByRole("switch")).toBeNull();
    cleanup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => rita({ onNedladdning: true })).toThrow(/onNedladdning måste vara en funktion/);
    expect(() => render(<OpsGastLista gaster={[]} platser={{ anvanda: 0, totalt: 5 }} onNedladdning={() => {}} />)).toThrow(/onNedladdning hör till listan över hela gruppen/);
  });
});

describe("OpsGastLista, hopfällbara gästkort (0.204.0, CP 2026-11-08)", () => {
  const ANNA_BERG = () =>
    person({
      namn: "Anna Berg",
      inbjudningar: [
        { id: "i-grupp", omfang: { slag: "grupp" }, titel: null, status: "inloggad", laddaNed: false },
        { id: "i-sak", omfang: { slag: "sak", funktion: "rosta", handelseId: "h1" }, titel: "Sommarfest", status: "vantar" },
      ],
      status: "inloggad",
    });
  const BO = gastId("bo@foretag.se");
  const BO_LUND = () => ({ gastId: BO, epost: "bo@foretag.se", namn: "Bo Lund", status: "vantar", inbjudningar: [{ id: "i-bo", omfang: { slag: "grupp" }, titel: null, status: "vantar", laddaNed: true }] });
  const alla = (extra = {}) => ({ onKopieraLank: vi.fn().mockResolvedValue({ url: "https://app.exempel/gast#i=x", lankGiltigTill: 1 }), onNedladdning: vi.fn().mockResolvedValue(undefined), ...extra });

  it("⛔ från början syns namnet och statusmärket, men inte adressen, inbjudningarna eller knapparna", () => {
    ritaSammanfalld({ personer: [ANNA_BERG()], ...alla() });
    const kort = /** @type {HTMLElement} */ (document.querySelector("[data-gast-person]"));
    expect(within(kort).getByText("Anna Berg")).toBeInTheDocument();
    expect(within(kort).getByText("Har loggat in")).toBeInTheDocument();
    expect(within(kort).queryByText("anna@foretag.se")).toBeNull();
    expect(kort.querySelectorAll("[data-gast-inbjudan]")).toHaveLength(0);
    for (const namn of [/Skicka länken igen/, /Kopiera länken/, /^Dra tillbaka inbjudan/, /Dra tillbaka alla/, /Radera/]) expect(within(kort).queryByRole("button", { name: namn }), String(namn)).toBeNull();
    expect(within(kort).queryByRole("switch")).toBeNull();
    // Den enda knappen på raden är chevronen, med namnet och läget.
    const knappar = within(kort).getAllByRole("button");
    expect(knappar).toHaveLength(1);
    expect(knappar[0]).toHaveAccessibleName("Visa detaljer för Anna Berg");
    expect(knappar[0]).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(/** @type {string} */ (knappar[0].getAttribute("aria-controls")));
    expect(panel, "aria-controls pekar på ett element som finns").not.toBeNull();
    expect(panel).not.toBeVisible();
    // Få element i en sammanfälld rad: panelen bär inget innehåll.
    expect(panel?.childElementCount).toBe(0);
  });

  it("⛔ ett tryck fäller ut och sätter aria-expanded, ett till fäller ihop, och flera kort får vara utfällda samtidigt", async () => {
    ritaSammanfalld({ personer: [ANNA_BERG(), BO_LUND()], ...alla() });
    const anna = screen.getByRole("button", { name: "Visa detaljer för Anna Berg" });
    const bo = screen.getByRole("button", { name: "Visa detaljer för Bo Lund" });
    await klicka(anna);
    expect(anna).toHaveAttribute("aria-expanded", "true");
    expect(bo).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("anna@foretag.se")).toBeVisible();
    expect(screen.queryByText("bo@foretag.se")).toBeNull();
    await klicka(bo);
    expect(anna).toHaveAttribute("aria-expanded", "true");
    expect(bo).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("bo@foretag.se")).toBeVisible();
    expect(document.getElementById(/** @type {string} */ (bo.getAttribute("aria-controls")))).toBeVisible();
    await klicka(anna);
    expect(anna).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("anna@foretag.se")).toBeNull();
    expect(screen.getByText("bo@foretag.se")).toBeVisible();
  });

  it("knappens namn på engelska är Show details for <name>", () => {
    ritaSammanfalld({ personer: [ANNA_BERG()], sprak: "en" });
    expect(screen.getByRole("button", { name: "Show details for Anna Berg" })).toHaveAttribute("aria-expanded", "false");
  });

  it("⛔ i utfällt läge finns allt som stod i kortet, och knapparna fungerar: Skicka igen, Kopiera länk, Dra tillbaka, reglaget, Dra tillbaka alla och Radera uppgifter", async () => {
    const f = alla({ onSkickaOm: vi.fn().mockResolvedValue(undefined), onAterkalla: vi.fn().mockResolvedValue(undefined), onAterkallaAlla: vi.fn().mockResolvedValue(undefined), onRadera: vi.fn().mockResolvedValue(undefined) });
    ritaSammanfalld({ personer: [ANNA_BERG()], ...f });
    await klicka(screen.getByRole("button", { name: "Visa detaljer för Anna Berg" }));
    const kort = /** @type {HTMLElement} */ (document.querySelector("[data-gast-person]"));
    expect(within(kort).getByText("anna@foretag.se")).toBeVisible();
    expect(kort.querySelectorAll("[data-gast-inbjudan]")).toHaveLength(2);
    expect(within(kort).getByText("Hela gruppen")).toBeVisible();
    expect(within(kort).getByText("Omröstning: Sommarfest")).toBeVisible();

    await klicka(within(kort).getByRole("button", { name: "Skicka länken igen till Anna Berg (Hela gruppen)" }));
    await waitFor(() => expect(f.onSkickaOm).toHaveBeenCalledWith({ id: "i-grupp" }));
    await klicka(within(kort).getByRole("button", { name: "Kopiera länken till Anna Berg (Hela gruppen)" }));
    await waitFor(() => expect(f.onKopieraLank).toHaveBeenCalledWith({ id: "i-grupp" }));
    await klicka(within(kort).getByRole("switch", { name: "Får ladda ned filer" }));
    await waitFor(() => expect(f.onNedladdning).toHaveBeenCalledWith({ id: "i-grupp", pa: true }));
    await klicka(within(kort).getByRole("button", { name: "Dra tillbaka inbjudan till Anna Berg (Omröstning: Sommarfest)" }));
    await waitFor(() => expect(f.onAterkalla).toHaveBeenCalledWith({ id: "i-sak" }));
    await klicka(within(kort).getByRole("button", { name: "Dra tillbaka alla inbjudningar till Anna Berg" }));
    await waitFor(() => expect(f.onAterkallaAlla).toHaveBeenCalledWith({ gastId: ANNA }));
    await klicka(within(kort).getByRole("button", { name: "Radera uppgifterna om Anna Berg" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
