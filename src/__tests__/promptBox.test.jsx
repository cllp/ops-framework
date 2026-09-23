import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsPrompt } from "../components/OpsPrompt.jsx";
import { createPromptSource } from "../lib/prompt.js";

describe("createPromptSource", () => {
  it("kastar på en trasig konfiguration i stället för vid första frågan", () => {
    /*
     * ⛔ En källa utan `send` ser ut att fungera ända tills någon skrivit en
     * fråga och tryckt. Då upptäcks felet av användaren i stället för av den
     * som kopplade in rutan, och det är en hel release för sent.
     */
    expect(() => createPromptSource()).toThrow(/send måste vara en funktion/);
    expect(() => createPromptSource({ send: async () => ({ text: "x" }), maxChars: 0 })).toThrow(/positivt tal/);
  });

  it("skickar den trimmade frågan och sammanhanget vidare", async () => {
    const send = vi.fn(async () => ({ text: "Svar", tokens: { in: 10, out: 5 } }));
    const source = createPromptSource({ send });

    const answer = await source.ask({ prompt: "  Vad händer i oktober?  ", context: { month: 10 } });

    expect(send).toHaveBeenCalledWith({ prompt: "Vad händer i oktober?", context: { month: 10 } });
    expect(answer).toEqual({ text: "Svar", tokens: { in: 10, out: 5 } });
  });

  it("stoppar en för lång fråga innan nätanropet", async () => {
    // ⛔ Här och inte i funktionen på andra sidan: en fråga som avvisas efter
    // ett nätanrop har redan kostat väntan, och felet är något användaren kan
    // rätta själv innan hen trycker.
    const send = vi.fn(async () => ({ text: "Svar" }));
    const source = createPromptSource({ send, maxChars: 10 });

    await expect(source.ask({ prompt: "x".repeat(11) })).rejects.toThrow(/Taket är 10/);
    await expect(source.ask({ prompt: "   " })).rejects.toThrow(/Skriv en fråga/);
    expect(send).not.toHaveBeenCalled();
  });

  it("gör ett tomt svar till ett fel, inte till en tom yta", async () => {
    /*
     * ⛔ En tyst nedsläppsväg hade ritat en tom svarsyta, och en tom yta ser ut
     * som att modellen inte hade något att säga. Skillnaden mot "anropet gick
     * sönder" är skillnaden mellan att fråga om igen och att ge upp.
     */
    for (const trasigt of [null, {}, { text: "" }, { text: "   " }]) {
      const source = createPromptSource({ send: async () => trasigt });
      await expect(source.ask({ prompt: "hej" })).rejects.toThrow(/tomt/);
    }
  });
});

describe("OpsPrompt", () => {
  const sourceAs = (send) => createPromptSource({ send });

  it("visar svaret som markdown och inte som brädgårdar", async () => {
    // ⛔ En modell svarar i markdown om man inte ber den låta bli. Renderat som
    // text får läsaren `## Title` rakt av, vilket är felet bolag-ops #249 finns för.
    render(
      <OpsPrompt source={sourceAs(async () => ({ text: "## Oktober\n\nMoms den 12:e." }))} label="Fråga om din ekonomi" />,
    );

    fireEvent.change(screen.getByLabelText("Fråga om din ekonomi"), { target: { value: "Vad händer?" } });
    fireEvent.click(screen.getByRole("button", { name: "Fråga" }));

    const title = await screen.findByText("Oktober");
    expect(title.tagName).toBe("H4");
    expect(document.body.textContent).not.toContain("## Oktober");
  });

  it("skickar inte två gånger för ett tryck", async () => {
    /*
     * ⛔ Två anrop för samma fråga är två fakturor för ett svar. Knappen stängs
     * av under väntan, men provet trycker ändå två gånger: Enter i fältet går
     * förbi knappen, så vakten måste sitta i funktionen och inte bara i DOM:en.
     */
    let slapp;
    const send = vi.fn(() => new Promise((r) => { slapp = () => r({ text: "Svar" }); }));
    render(<OpsPrompt source={sourceAs(send)} label="Fråga" />);

    const falt = screen.getByLabelText("Fråga");
    fireEvent.change(falt, { target: { value: "Vad händer?" } });

    /*
     * ⛔ GENVÄGEN OCH INTE KNAPPEN, och den rättelsen kom ur mutationsprovet.
     * Ett prov som tryckte på knappen två gånger var grönt även utan vakten,
     * eftersom knappen stängs av av sitt eget `disabled`. Vakten satt alltså
     * oprövad, och kommentaren bredvid den påstod ett skydd den inte gav.
     *
     * Cmd plus Enter går förbi knappen och når `ask` direkt. Det är den väg
     * vakten finns för.
     */
    fireEvent.keyDown(falt, { key: "Enter", metaKey: true });
    fireEvent.keyDown(falt, { key: "Enter", metaKey: true });

    expect(send).toHaveBeenCalledTimes(1);
    slapp();
    expect(await screen.findByText("Svar")).toBeInTheDocument();
  });

  it("behåller förra svaret när ett anrop går sönder, och säger vad som hände", async () => {
    /*
     * ⛔ Det som stod där var sant innan. Att kasta bort det straffar
     * användaren för ett fel som inte var hens, och en sida som töms ser
     * dessutom ut att ha tappat bort sig.
     */
    const send = vi
      .fn()
      .mockResolvedValueOnce({ text: "Första svaret" })
      .mockRejectedValueOnce(new Error("Funktionen svarade inte"));
    render(<OpsPrompt source={sourceAs(send)} label="Fråga" />);

    const falt = screen.getByLabelText("Fråga");
    fireEvent.change(falt, { target: { value: "ett" } });
    fireEvent.click(screen.getByRole("button", { name: "Fråga" }));
    expect(await screen.findByText("Första svaret")).toBeInTheDocument();

    fireEvent.change(falt, { target: { value: "två" } });
    fireEvent.click(screen.getByRole("button", { name: "Fråga" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Funktionen svarade inte");
    expect(screen.getByText("Första svaret")).toBeInTheDocument();
  });

  it("lägger ett förslag i fältet i stället för att skicka det", async () => {
    /*
     * ⛔ Ett förslag som skickar sig självt gör ett klick till ett anrop man
     * inte hann läsa, och man kan inte längre ändra ett ord innan man frågar.
     */
    const send = vi.fn(async () => ({ text: "Svar" }));
    render(<OpsPrompt source={sourceAs(send)} label="Fråga" suggestions={["Vad händer i oktober?"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Vad händer i oktober?" }));

    expect(screen.getByLabelText("Fråga")).toHaveValue("Vad händer i oktober?");
    expect(send).not.toHaveBeenCalled();

    /*
     * ⛔ OCH INGET FEL SYNS, vilket är det som faktiskt fäller mutationen.
     * Ett förslag som skickar sig självt läser `text` innan React hunnit
     * uppdatera den, alltså skickas en tom fråga och rutan svarar "Skriv en
     * fråga först" på ett tryck användaren just gjorde rätt.
     *
     * ⛔ MIKROTASKARNA MÅSTE TÖMMAS FÖRST. Felet sätts i en `catch`, alltså
     * efter minst ett varv i kön, och ett synkront `queryByRole` direkt efter
     * klicket hann titta innan det renderades. Provet var grönt mot mutationen
     * av exakt det skälet.
     */
    await act(async () => {});
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("skickar inte på Enter ensamt", () => {
    // ⛔ En fråga är ofta flera rader. Skickade Enter vore radbrytning omöjlig
    // utan att man först lärt sig en genväg, och då skickas halva frågor.
    const send = vi.fn(async () => ({ text: "Svar" }));
    render(<OpsPrompt source={sourceAs(send)} label="Fråga" />);

    const falt = screen.getByLabelText("Fråga");
    fireEvent.change(falt, { target: { value: "Rad ett" } });
    fireEvent.keyDown(falt, { key: "Enter" });

    expect(send).not.toHaveBeenCalled();
  });

  it("lägger ett längdfel vid fältet, inte i svarsytan", async () => {
    // ⛔ Den som ska rätta något behöver se VAD som är fel utan att leta. Ett
    // fel man kan åtgärda där man står hör till fältet.
    const source = createPromptSource({ send: async () => ({ text: "Svar" }), maxChars: 5 });
    render(<OpsPrompt source={source} label="Fråga" />);

    fireEvent.change(screen.getByLabelText("Fråga"), { target: { value: "alldeles för lång fråga" } });
    fireEvent.click(screen.getByRole("button", { name: "Fråga" }));

    const errorRow = await screen.findByText(/Taket är 5/);
    /*
     * ⛔ KOPPLINGEN PROVAS, INTE BARA ATT TEXTEN FINNS. `OpsField` ger sitt fel
     * `role="alert"`, så ett prov som letade efter frånvaron av en alert var
     * rött mot rätt kod: båda felplatserna är alerts. Det som skiljer dem är
     * att fältets fel pekas ut av `aria-describedby`, alltså läses upp när man
     * står i fältet, och svarsytans inte gör det.
     */
    const falt = screen.getByLabelText("Fråga");
    expect(falt.getAttribute("aria-describedby") || "").toContain(errorRow.id);
    expect(falt.getAttribute("aria-invalid")).toBe("true");
  });

  it("kastar utan källa eller etikett", () => {
    // ⛔ Samma val som OpsEventList gör med atgardsforklaring: hellre ett fel
    // än en ruta som ser färdig ut och inte leder någonstans.
    expect(() => render(<OpsPrompt label="Fråga" />)).toThrow(/createPromptSource/);
    expect(() => render(<OpsPrompt source={sourceAs(async () => ({ text: "x" }))} />)).toThrow(/label krävs/);
  });
});
