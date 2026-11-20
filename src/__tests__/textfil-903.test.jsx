import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpsSamtal } from "../components/OpsMeddelanden.jsx";
import { BilagaVisning } from "../components/BilagaVisning.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createSamtalskalla } from "../data/samtalskalla.js";
import { MAX_KOMMENTARBILAGA, kommentarbilagaFel } from "../lib/handelsemodell.js";
import { MAX_MEDDELANDE } from "../lib/samtal.js";
import { TEXTFIL_FRAN, TEXTFIL_MAX_BYTE, arTextbilaga, textSomBilaga, textensBorjan, textfilnamn } from "../lib/textfil.js";

/**
 * Lång text i chatten blir en fil (0.246.0, cllp/lifehub.app#903). CP 2026-11-19: "Lång text i chatten. Lägg till som en fil, med storleksbegränsning istället."
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN (regel 4), mätt mot 0.245.0: en inklistring på 2 500 tecken hamnade i fältet och blev en bubbla, ingen "Gör till fil" fanns över
 * taket, och en textfil i tråden visade bara sitt namn. Utfallen står i ändringsloggen.
 */

const MEDLEMMAR = [
  { userId: "anna", namn: "Anna Ek", typ: "person", status: "aktiv" },
  { userId: "bo", namn: "Bo Lind", typ: "person", status: "aktiv" },
];
const namnFor = (/** @type {string} */ uid) => MEDLEMMAR.find((m) => m.userId === uid)?.namn ?? uid;

async function samtal(bilagor = true) {
  let t = 1_700_000_000_000;
  const s = /** @type {any} */ (createSamtalskalla({ kalla: createMemorySource({}), klocka: () => (t += 1000), ...(bilagor ? { bilagor: true, bilagaSamling: "bilagor" } : {}) }));
  const p = await s.oppnaPrivat({ groupId: "g", uid: "anna", annan: "bo" });
  return { s, p };
}

/** En text med svenska tecken och flera rader, `n` tecken lång. */
const langText = (/** @type {number} */ n) => {
  const rad = "Protokoll från styrelsemötet i Visby, punkt för punkt med åtgärder.\n";
  return `Mötesanteckningar 19 november\n\n${rad.repeat(Math.ceil(n / rad.length))}`.slice(0, n);
};

const klistra = (/** @type {string} */ text) => fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { files: [], getData: () => text, types: ["text/plain"] } });

describe("modellen: textSomBilaga, textfilnamn, textensBorjan", () => {
  it("⛔ en text blir en giltig bilaga (samma prövning som regeln), i UTF-8, och tillbaka till samma text", async () => {
    const text = langText(3000);
    const r = textSomBilaga(text);
    if (!("bilaga" in r)) throw new Error("ingen bilaga");
    expect(kommentarbilagaFel(r.bilaga)).toBeNull();
    expect(r.bilaga.typ).toBe("text/plain");
    expect(r.bilaga.namn).toBe("Mötesanteckningar 19 november.txt");
    const tillbaka = new TextDecoder().decode(Uint8Array.from(atob(r.bilaga.dataUrl.split(",")[1]), (c) => c.charCodeAt(0)));
    expect(tillbaka).toBe(text);
  });

  it("⛔ för stor är ett svar med siffrorna, aldrig en kapad fil; precis på taket ryms den", () => {
    const over = textSomBilaga("a".repeat(TEXTFIL_MAX_BYTE + 1));
    expect(over).toEqual({ forStor: { byte: TEXTFIL_MAX_BYTE + 1, tak: TEXTFIL_MAX_BYTE } });
    const pa = textSomBilaga("a".repeat(TEXTFIL_MAX_BYTE));
    if (!("bilaga" in pa)) throw new Error("taket ska rymmas");
    expect(pa.bilaga.dataUrl.length).toBeLessThanOrEqual(MAX_KOMMENTARBILAGA);
    expect(kommentarbilagaFel(pa.bilaga)).toBeNull();
    // ⛔ Svenska tecken är två byte: samma antal tecken med "ä" ryms inte.
    expect("forStor" in textSomBilaga("ä".repeat(TEXTFIL_MAX_BYTE / 2 + 1))).toBe(true);
    expect(textSomBilaga("  \n ")).toEqual({ tom: true });
  });

  it("filnamnet: första raden som inte är tom, utan tecken som inte går i ett namn, högst 40 tecken; annars Text.txt", () => {
    expect(textfilnamn("\n\n  Rapport: Q3/Q4 *utkast*  \nmer")).toBe("Rapport Q3 Q4 utkast.txt");
    expect(textfilnamn(`${"å".repeat(60)}\nx`)).toBe(`${"å".repeat(40)}.txt`);
    expect(textfilnamn("   \n\t")).toBe("Text.txt");
  });

  it("⛔ början: tre rader, med … när det finns mer, och bara början avkodas (ett avklippt å blir inte Windows-1252)", () => {
    const r = textSomBilaga(langText(400_000));
    if (!("bilaga" in r)) throw new Error("ingen bilaga");
    const b = textensBorjan(r.bilaga);
    expect(b.split("\n")).toHaveLength(3);
    expect(b.startsWith("Mötesanteckningar 19 november\nProtokoll från")).toBe(true);
    expect(b.endsWith("…")).toBe(true);
    expect(b).not.toMatch(/Ã|�/);
    const kort = textSomBilaga("En rad bara");
    if (!("bilaga" in kort)) throw new Error("ingen bilaga");
    expect(textensBorjan(kort.bilaga)).toBe("En rad bara");
  });

  it("början läser också en fil sparad i Windows-1252, och ingenting ur en bild", () => {
    const latin = `data:text/plain;base64,${btoa("R\xe4kning f\xf6r maj")}`;
    expect(textensBorjan({ dataUrl: latin, typ: "text/plain" })).toBe("Räkning för maj");
    expect(textensBorjan({ dataUrl: "data:image/png;base64,iVBORw0KGgo=", typ: "image/png" })).toBe("");
    expect(arTextbilaga({ typ: "text/csv" })).toBe(true);
    expect(arTextbilaga({ typ: "text/html" })).toBe(false);
  });
});

describe("chatten: en lång inklistring blir en fil", () => {
  it("⛔ från gränsen blir inklistringen en fil i utkastet, fältet förblir tomt, och meddelandet bär filen", async () => {
    const { s, p } = await samtal();
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    const text = langText(TEXTFIL_FRAN);
    const ejStoppad = klistra(text);
    expect(ejStoppad).toBe(false);
    expect(/** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox")).value).toBe("");
    await waitFor(() => expect(document.querySelector("[data-textfil-notis]")).toHaveTextContent("Den långa texten blev en fil."));
    const utkast = /** @type {HTMLElement} */ (document.querySelector("[data-bilageutkast]"));
    expect(within(utkast).getByRole("button", { name: "Visa: Mötesanteckningar 19 november.txt" })).toBeInTheDocument();
    expect(utkast.querySelector("[data-textfil-borjan]")?.textContent).toMatch(/^Mötesanteckningar 19 november\nProtokoll från/);
    fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
    await waitFor(async () => expect((await s.meddelanden(p.id)).at(-1)?.bilaga).toEqual({ namn: "Mötesanteckningar 19 november.txt", typ: "text/plain" }));
  });

  it("under gränsen klistras texten in i fältet som förut", async () => {
    const { s, p } = await samtal();
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    expect(klistra(langText(TEXTFIL_FRAN - 1))).toBe(true);
    expect(document.querySelector("[data-bilageutkast]")).toBeNull();
  });

  it("⛔ en bilaga väntar redan: inklistringen går till fältet, ingen bilaga ersätts", async () => {
    const { s, p } = await samtal();
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    klistra(langText(TEXTFIL_FRAN));
    await screen.findByRole("button", { name: "Ta bort bilagan" });
    expect(klistra(`Andra ${langText(TEXTFIL_FRAN)}`)).toBe(true);
    expect(within(/** @type {HTMLElement} */ (document.querySelector("[data-bilageutkast]"))).getByRole("button", { name: /^Visa: Mötesanteckningar/ })).toBeInTheDocument();
  });

  it("⛔ en text som inte ryms ens som fil: beskedet säger storleken och taket, och texten går till fältet", async () => {
    const { s, p } = await samtal();
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    expect(klistra("a".repeat(TEXTFIL_MAX_BYTE + 10))).toBe(true);
    expect(await screen.findByRole("alert")).toHaveTextContent(/^Texten är för stor även för en fil \(.+, taket är .+\)\. Dela upp den\.$/);
    expect(screen.queryByRole("button", { name: "Ta bort bilagan" })).toBeNull();
  });

  it("utan bilagor i chatten (källan saknar dem) händer ingenting nytt", async () => {
    const { s, p } = await samtal(false);
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    expect(klistra(langText(TEXTFIL_FRAN))).toBe(true);
    expect(document.querySelector("[data-bilageutkast]")).toBeNull();
  });
});

describe("över meddelandets tak: Gör till fil", () => {
  it("⛔ knappen gör texten till en fil och tömmer fältet; Skicka går att trycka igen", async () => {
    const { s, p } = await samtal();
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    const falt = /** @type {HTMLTextAreaElement} */ (screen.getByRole("textbox"));
    fireEvent.change(falt, { target: { value: langText(MAX_MEDDELANDE + 50) } });
    expect(screen.getByRole("alert")).toHaveTextContent("Texten är 50 tecken för lång för ett meddelande.");
    expect(screen.getByRole("button", { name: "Skicka" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Gör till fil" }));
    expect(falt.value).toBe("");
    expect(await screen.findByRole("button", { name: "Ta bort bilagan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skicka" })).not.toBeDisabled();
  });

  it("utan bilagor står raden som förut, utan knappen", async () => {
    const { s, p } = await samtal(false);
    render(<OpsSamtal kalla={s} uid="anna" samtal={p} rubrik="Bo" namnFor={namnFor} medlemmar={MEDLEMMAR} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a".repeat(MAX_MEDDELANDE + 5) } });
    expect(screen.getByRole("alert")).toHaveTextContent("Texten är 5 tecken för lång. Korta den för att skicka.");
    expect(screen.queryByRole("button", { name: "Gör till fil" })).toBeNull();
  });
});

describe("bubblan: en textfil visar sina första rader", () => {
  it("⛔ namnet, storleken och tre rader; ett tryck öppnar hela texten", async () => {
    const r = textSomBilaga(langText(5000));
    if (!("bilaga" in r)) throw new Error("ingen bilaga");
    render(<BilagaVisning bilaga={r.bilaga} alt="Bilaga" sprak="sv" />);
    const knapp = screen.getByRole("button", { name: "Visa: Mötesanteckningar 19 november.txt" });
    expect(knapp.querySelector("[data-textfil-borjan]")?.textContent?.split("\n")).toHaveLength(3);
    fireEvent.click(knapp);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("en PDF har ingen början att visa, bara namnet som förut", () => {
    const pdf = "data:application/pdf;base64,JVBERi0=";
    render(<BilagaVisning bilaga={{ dataUrl: pdf, namn: "a.pdf", typ: "application/pdf", tecken: pdf.length }} alt="Bilaga" sprak="sv" />);
    expect(document.querySelector("[data-textfil-borjan]")).toBeNull();
  });
});
