import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsDelad } from "../components/OpsDelad.jsx";
import { OpsDeladHandelse } from "../components/OpsDeladHandelse.jsx";
import { DELAD_SPRAKNYCKEL } from "../lib/deladdatum.js";
import { DELNINGSORSAKER } from "../lib/delning.js";

/**
 * Den publika händelsesidan (0.125.0, cllp/lifehub.app#377): vad som står högst upp, språkvalet i huvudet, filerna, kodrutan och lägena. jsdom mäter att rätt text finns och att rätt sak
 * saknas; hur det SER UT mäts inte här (ärendet citerar ingen SessionStudio-skärmbild, regel 12).
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): rött med koden muterad, grönt med den. Utfallen står i PR-texten.
 */

const HANDELSE = {
  slag: "handelse",
  titel: "Resa med kusiner",
  beskrivning: "Vi åker på tisdag.\nTa med pass.\n\n<b>Fet</b> <script>alert(1)</script>",
  plats: "Visby hamn",
  datum: "2026-12-26",
  slutDatum: "2027-01-10",
  tid: "09:00",
  slutTid: "17:00",
  heldag: false,
  filer: [
    { rubrik: "Biljett A", typ: "pdf", mime: "application/pdf", storlek: 2048, url: "https://lagring.test/a.pdf?sig=1" },
    { rubrik: "Karta över Visby", typ: "bild", mime: "image/png", storlek: 3_145_728, url: "https://lagring.test/b.png?sig=2" },
  ],
  ejVisade: 0,
};

const sprakFran = (sprak) => vi.spyOn(window.navigator, "language", "get").mockReturnValue(sprak);

beforeEach(() => {
  window.localStorage.clear();
  sprakFran("sv-SE");
});
afterEach(() => {
  vi.restoreAllMocks();
});

const text = (el) => el?.textContent?.replace(/\s+/g, " ").trim();

describe("OpsDeladHandelse: det som står högst upp", () => {
  it("⛔ titeln, och direkt under den datumet stort: veckodag, datum och år, från och till och antal dagar", () => {
    const { container } = render(<OpsDeladHandelse delning={HANDELSE} />);
    expect(screen.getByRole("heading", { level: 1, name: "Resa med kusiner" })).toBeInTheDocument();
    expect(text(container.querySelector("[data-dh-datum]"))).toBe("lör 26 dec 2026 till sön 10 jan 2027, 16 dagar");
    // Datumet kommer före klockslaget, platsen och beskrivningen, i dokumentordning.
    const ordning = [...container.querySelectorAll("[data-dh-titel], [data-dh-datum], [data-dh-klockslag], [data-dh-plats], [data-dh-beskrivning], [data-dh-filer]")].map((e) => Object.keys(e.dataset)[0]);
    expect(ordning).toEqual(["dhTitel", "dhDatum", "dhKlockslag", "dhPlats", "dhBeskrivning", "dhFiler"]);
  });

  it("klockslaget står med, över flera dagar som början och slut", () => {
    const { container } = render(<OpsDeladHandelse delning={HANDELSE} />);
    expect(text(container.querySelector("[data-dh-klockslag]"))).toBe("börjar kl 09:00, slutar kl 17:00");
  });

  it("en endagshändelse med klockslag: ett datum, inga dagar, och klockslaget", () => {
    const { container } = render(<OpsDeladHandelse delning={{ ...HANDELSE, slutDatum: null }} />);
    expect(text(container.querySelector("[data-dh-datum]"))).toBe("lör 26 dec 2026");
    expect(text(container.querySelector("[data-dh-klockslag]"))).toBe("09:00 - 17:00");
  });

  it("en heldag står som heldag, och utan klockslag finns ingen klockslagsrad", () => {
    const { container, rerender } = render(<OpsDeladHandelse delning={{ ...HANDELSE, slutDatum: null, tid: null, slutTid: null, heldag: true }} />);
    expect(text(container.querySelector("[data-dh-klockslag]"))).toBe("Heldag");
    rerender(<OpsDeladHandelse delning={{ ...HANDELSE, slutDatum: null, tid: null, slutTid: null, heldag: false }} />);
    expect(container.querySelector("[data-dh-klockslag]")).toBeNull();
  });

  it("⛔ platsen står på en egen rad med en ikon, och utan plats finns ingen rad", () => {
    const { container, rerender } = render(<OpsDeladHandelse delning={HANDELSE} />);
    const plats = container.querySelector("[data-dh-plats]");
    expect(plats?.querySelector("svg")).not.toBeNull();
    expect(text(plats)).toBe("Plats: Visby hamn");
    expect(plats?.parentElement).toBe(container.querySelector("[data-dh-tid]"));
    rerender(<OpsDeladHandelse delning={{ ...HANDELSE, plats: null }} />);
    expect(container.querySelector("[data-dh-plats]")).toBeNull();
  });

  it("⛔ beskrivningen bevarar radbrytningar och tolkar ingen HTML", () => {
    const { container } = render(<OpsDeladHandelse delning={HANDELSE} />);
    const b = container.querySelector("[data-dh-beskrivning]");
    expect(b?.textContent).toBe(HANDELSE.beskrivning);
    expect(b?.className).toContain("whitespace-pre-line");
    expect(b?.querySelector("b, script")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[data-dh-handelse] b")).toBeNull();
  });

  it("utan beskrivning finns ingen beskrivningsruta", () => {
    const { container } = render(<OpsDeladHandelse delning={{ ...HANDELSE, beskrivning: null }} />);
    expect(container.querySelector("[data-dh-beskrivning]")).toBeNull();
  });
});

describe("OpsDeladHandelse: filerna", () => {
  it("varje fil har namn, typ, storlek och en knapp som öppnar den i en ny flik", () => {
    render(<OpsDeladHandelse delning={HANDELSE} />);
    const lista = screen.getByRole("list");
    const rader = within(lista).getAllByRole("listitem");
    expect(rader).toHaveLength(2);
    expect(text(rader[0])).toContain("Biljett A");
    expect(text(rader[0])).toContain("PDF · 2 kB");
    expect(text(rader[1])).toContain("Bild · 3,0 MB");
    const oppna = screen.getByRole("link", { name: "Öppna Biljett A" });
    expect(oppna).toHaveAttribute("href", "https://lagring.test/a.pdf?sig=1");
    expect(oppna).toHaveAttribute("target", "_blank");
    expect(oppna.getAttribute("rel")).toContain("noopener");
    expect(oppna.getAttribute("rel")).toContain("noreferrer");
    expect(oppna).not.toHaveAttribute("download");
  });

  it("⛔ utan filer står en rad som säger det, och inte en tom yta", () => {
    const { container } = render(<OpsDeladHandelse delning={{ ...HANDELSE, filer: [] }} />);
    expect(text(container.querySelector("[data-dh-inga-filer]"))).toBe("Inga filer har lagts till.");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("filer som inte fick plats räknas: sidan säger hur många som inte visas", () => {
    const { container } = render(<OpsDeladHandelse delning={{ ...HANDELSE, ejVisade: 3 }} />);
    expect(text(container.querySelector("[data-dh-ejvisade]"))).toBe("3 filer till finns men visas inte här.");
    const ingen = render(<OpsDeladHandelse delning={{ ...HANDELSE, ejVisade: 0 }} />);
    expect(ingen.container.querySelector("[data-dh-ejvisade]")).toBeNull();
  });

  it("en okänd filtyp är ett dokument", () => {
    render(<OpsDeladHandelse delning={{ ...HANDELSE, filer: [{ rubrik: "X", typ: "konstigt", url: "https://l.test/x" }] }} />);
    expect(screen.getByText("Dokument")).toBeInTheDocument();
  });
});

describe("OpsDeladHandelse: språket i huvudet", () => {
  it("⛔ förvalet är webbläsarens språk: svenska om det börjar på sv, annars engelska", () => {
    const sv = render(<OpsDeladHandelse delning={HANDELSE} />);
    expect(sv.container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "sv");
    expect(text(sv.container.querySelector("[data-dh-datum]"))).toContain("lör 26 dec 2026");
    sv.unmount();
    sprakFran("en-GB");
    const en = render(<OpsDeladHandelse delning={HANDELSE} />);
    expect(en.container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "en");
    expect(text(en.container.querySelector("[data-dh-datum]"))).toBe("Sat 26 Dec 2026 to Sun 10 Jan 2027, 16 days");
    expect(screen.getByRole("heading", { level: 2, name: "Files" })).toBeInTheDocument();
    en.unmount();
    sprakFran("de-DE");
    const de = render(<OpsDeladHandelse delning={HANDELSE} />);
    expect(de.container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "en");
  });

  it("⛔ väljaren byter språk på allt ramverket skriver, men inte på händelsens egen text", () => {
    const { container } = render(<OpsDeladHandelse delning={HANDELSE} />);
    const grupp = screen.getByRole("group", { name: "Språk" });
    expect(within(grupp).getByRole("button", { name: "SV" })).toHaveAttribute("aria-pressed", "true");
    expect(within(grupp).getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(within(grupp).getByRole("button", { name: "EN" }));
    expect(container.querySelector("[data-deladhandelse]")).toHaveAttribute("lang", "en");
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(text(container.querySelector("[data-dh-datum]"))).toBe("Sat 26 Dec 2026 to Sun 10 Jan 2027, 16 days");
    expect(text(container.querySelector("[data-dh-klockslag]"))).toBe("starts at 09:00, ends at 17:00");
    expect(screen.getByRole("link", { name: "Open Biljett A" })).toBeInTheDocument();
    expect(screen.getByText("PDF · 2 kB")).toBeInTheDocument();
    // Händelsens titel, beskrivning och plats översätts inte.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Resa med kusiner");
    expect(container.querySelector("[data-dh-beskrivning]")?.textContent).toContain("Vi åker på tisdag.");
    expect(container.querySelector("[data-dh-plats]")?.textContent).toContain("Visby hamn");
    expect(within(screen.getByRole("group", { name: "Language" })).getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
  });

  it("⛔ valet sparas i webbläsarens minne och gäller nästa gång, före webbläsarens språk", () => {
    const forsta = render(<OpsDeladHandelse delning={HANDELSE} />);
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(window.localStorage.getItem(DELAD_SPRAKNYCKEL)).toBe("en");
    forsta.unmount();
    const andra = render(<OpsDeladHandelse delning={HANDELSE} />);
    expect(andra.container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "en");
    andra.unmount();
    window.localStorage.setItem(DELAD_SPRAKNYCKEL, "sv");
    sprakFran("en-US");
    const tredje = render(<OpsDeladHandelse delning={HANDELSE} />);
    expect(tredje.container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "sv");
  });

  it("⛔ ett sparat värde som inte är ett språk vi har ignoreras", () => {
    window.localStorage.setItem(DELAD_SPRAKNYCKEL, "klingon");
    const { container } = render(<OpsDeladHandelse delning={HANDELSE} />);
    expect(container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "sv");
  });

  it("⛔ en lagring som kastar stoppar inte sidan, och valet gäller ändå tills sidan lämnas", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blockerad");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const { container } = render(<OpsDeladHandelse delning={HANDELSE} />);
    expect(container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "sv");
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "en");
  });

  it("styr appen språket är det appens och väljaren anropar onSprak", () => {
    const onSprak = vi.fn();
    const { container, rerender } = render(<OpsDeladHandelse delning={HANDELSE} sprak="en" onSprak={onSprak} />);
    expect(container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "en");
    fireEvent.click(screen.getByRole("button", { name: "SV" }));
    expect(onSprak).toHaveBeenCalledWith("sv");
    // Appen har inte ändrat språket: sidan står kvar på det appen sade.
    expect(container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "en");
    rerender(<OpsDeladHandelse delning={HANDELSE} sprak="sv" onSprak={onSprak} />);
    expect(container.querySelector("[data-deladhandelse]")).toHaveAttribute("data-sprak", "sv");
  });

  it("appens huvud (loggan) ritas till vänster i huvudet", () => {
    const { container } = render(<OpsDeladHandelse delning={HANDELSE} huvud={<span data-test="logga">LifeHub</span>} />);
    expect(container.querySelector("header [data-dh-huvud] [data-test='logga']")).toHaveTextContent("LifeHub");
    expect(container.querySelector("header [data-dh-sprak]")).not.toBeNull();
  });
});

describe("OpsDeladHandelse: lägena", () => {
  it("precis ett av delning, orsak och laddar", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsDeladHandelse />)).toThrow(/precis en av/);
    expect(() => render(<OpsDeladHandelse delning={HANDELSE} orsak="utgangen" />)).toThrow(/precis en av/);
    expect(() => render(<OpsDeladHandelse laddar orsak="utgangen" />)).toThrow(/precis en av/);
    expect(() => render(<OpsDeladHandelse delning={HANDELSE} sprak="de" />)).toThrow(/språket/);
    expect(() => render(<OpsDeladHandelse delning={HANDELSE} onKod="x" />)).toThrow(/onKod/);
  });

  it("⛔ varje orsak har en text på båda språken, och en okänd orsak får det utgångnas", () => {
    for (const [sprak, forvantat] of [
      ["sv", { utgangen: "Länken har gått ut", stangd: "Länken är stängd", saknas: "Filen finns inte längre", "handelse-saknas": "Händelsen finns inte längre", "kod-kravs": "Länken kräver en kod", "fel-kod": "Koden stämde inte", "for-manga": "För många försök. Vänta en stund och försök igen" }],
      ["en", { utgangen: "The link has expired", stangd: "The link is closed", saknas: "The file no longer exists", "handelse-saknas": "The event no longer exists", "kod-kravs": "This link needs a code", "fel-kod": "The code was not right", "for-manga": "Too many attempts. Wait a while and try again" }],
    ]) {
      expect(Object.keys(forvantat).sort()).toEqual([...DELNINGSORSAKER].sort());
      for (const [orsak, rubrik] of Object.entries(forvantat)) {
        const { container, unmount } = render(<OpsDeladHandelse orsak={orsak} sprak={sprak} />);
        expect(container.querySelector("[data-delad='fel']"), `${sprak} ${orsak}`).toHaveAttribute("data-delad-orsak", orsak);
        expect(screen.getByText(rubrik), `${sprak} ${orsak}`).toBeInTheDocument();
        unmount();
      }
    }
    const okand = render(<OpsDeladHandelse orsak="hittepa" sprak="sv" />);
    expect(okand.container.querySelector("[data-delad='fel']")).toHaveAttribute("data-delad-orsak", "utgangen");
    expect(screen.getByText("Länken har gått ut")).toBeInTheDocument();
  });

  it("laddar skriver ut att den hämtar, på valt språk", () => {
    const { rerender } = render(<OpsDeladHandelse laddar sprak="sv" />);
    expect(screen.getByText("Hämtar händelsen")).toBeInTheDocument();
    rerender(<OpsDeladHandelse laddar sprak="en" />);
    expect(screen.getByText("Loading the event")).toBeInTheDocument();
  });

  it("⛔ ett fel är fortfarande en sida med huvud och språkval, så att besökaren kan byta språk också där", () => {
    const { container } = render(<OpsDeladHandelse orsak="stangd" />);
    expect(container.querySelector("header [data-dh-sprak]")).not.toBeNull();
  });

  it("⛔ inga tankstreck någonstans på sidan, på något språk", () => {
    const { container, rerender } = render(<OpsDeladHandelse delning={HANDELSE} sprak="sv" />);
    expect(container.textContent).not.toMatch(/[\u2014\u2013]/);
    rerender(<OpsDeladHandelse delning={HANDELSE} sprak="en" />);
    expect(container.textContent).not.toMatch(/[\u2014\u2013]/);
  });
});

describe("kodrutan", () => {
  it("⛔ kod-kravs med onKod ritar en ruta, och koden skickas till appen", async () => {
    const onKod = vi.fn(async () => {});
    render(<OpsDeladHandelse orsak="kod-kravs" onKod={onKod} />);
    expect(screen.getByRole("heading", { level: 1, name: "Länken kräver en kod" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Kod" }), { target: { value: "hemligt1" } });
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    await waitFor(() => expect(onKod).toHaveBeenCalledWith("hemligt1"));
    expect(onKod).toHaveBeenCalledTimes(1);
  });

  it("en tom kod skickas aldrig, och rutan säger att koden ska skrivas", () => {
    const onKod = vi.fn();
    render(<OpsDeladHandelse orsak="kod-kravs" onKod={onKod} />);
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Skriv koden.");
    fireEvent.change(screen.getByRole("textbox", { name: "Kod" }), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    expect(onKod).not.toHaveBeenCalled();
  });

  it("fel-kod och for-manga skriver ut sin text, och kod-kravs gör det inte", () => {
    const { rerender } = render(<OpsDeladHandelse orsak="kod-kravs" onKod={vi.fn()} sprak="sv" />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<OpsDeladHandelse orsak="fel-kod" onKod={vi.fn()} sprak="sv" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Koden stämde inte");
    rerender(<OpsDeladHandelse orsak="for-manga" onKod={vi.fn()} sprak="en" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts. Wait a while and try again");
  });

  it("kodrutan följer språket: engelska etiketter när EN är valt", () => {
    render(<OpsDeladHandelse orsak="kod-kravs" onKod={vi.fn()} sprak="en" />);
    expect(screen.getByRole("heading", { level: 1, name: "This link needs a code" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("⛔ ett dubbeltryck skickar ett försök (servern räknar felaktiga koder per länk)", async () => {
    let klar;
    const onKod = vi.fn(() => new Promise((res) => { klar = res; }));
    render(<OpsDeladHandelse orsak="kod-kravs" onKod={onKod} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Kod" }), { target: { value: "hemligt1" } });
    const knapp = screen.getByRole("button", { name: "Öppna" });
    fireEvent.click(knapp);
    fireEvent.click(knapp);
    fireEvent.submit(knapp.closest("form"));
    expect(onKod).toHaveBeenCalledTimes(1);
    klar();
    await waitFor(() => expect(screen.getByRole("button", { name: "Öppna" })).not.toBeDisabled());
  });

  it("om appen inte kunde fråga servern står det, och koden står kvar i fältet", async () => {
    const onKod = vi.fn(async () => {
      throw new Error("nätverket");
    });
    render(<OpsDeladHandelse orsak="kod-kravs" onKod={onKod} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Kod" }), { target: { value: "hemligt1" } });
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Det gick inte att kontrollera koden just nu");
    expect(screen.getByRole("textbox", { name: "Kod" })).toHaveValue("hemligt1");
  });

  it("utan onKod står orsaken som text, inte som en ruta utan åtgärd", () => {
    const { container } = render(<OpsDeladHandelse orsak="kod-kravs" />);
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByText("Länken kräver en kod")).toBeInTheDocument();
  });

  it("⛔ fältet är ett textfält utan taligenkänning och utan autofyll", () => {
    render(<OpsDeladHandelse orsak="kod-kravs" onKod={vi.fn()} />);
    const falt = screen.getByRole("textbox", { name: "Kod" });
    expect(falt).toHaveAttribute("autocomplete", "off");
    expect(falt.closest("form")?.querySelector("[data-tal], button[aria-label*='Tala']")).toBeNull();
  });
});

describe("OpsDelad (en fil): kodrutan", () => {
  it("⛔ en fillänk med kod ritar samma kodruta när appen ger onKod", async () => {
    const onKod = vi.fn(async () => {});
    render(<OpsDelad orsak="kod-kravs" onKod={onKod} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Kod" }), { target: { value: "hemligt1" } });
    fireEvent.click(screen.getByRole("button", { name: "Öppna" }));
    await waitFor(() => expect(onKod).toHaveBeenCalledWith("hemligt1"));
  });

  it("utan onKod är orsaken text som förut, och de gamla orsakerna är oförändrade", () => {
    const { container, rerender } = render(<OpsDelad orsak="kod-kravs" />);
    expect(screen.getByText("Länken kräver en kod")).toBeInTheDocument();
    expect(container.querySelector("form")).toBeNull();
    rerender(<OpsDelad orsak="stangd" onKod={vi.fn()} />);
    expect(screen.getByText("Länken är stängd")).toBeInTheDocument();
    expect(container.querySelector("form")).toBeNull();
  });

  it("onKod måste vara en funktion", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsDelad orsak="kod-kravs" onKod="x" />)).toThrow(/onKod/);
  });
});
