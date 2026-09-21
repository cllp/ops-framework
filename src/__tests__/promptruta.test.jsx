import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsPrompt } from "../components/OpsPrompt.jsx";
import { skapaPromptkalla } from "../lib/prompt.js";

describe("skapaPromptkalla", () => {
  it("kastar på en trasig konfiguration i stället för vid första frågan", () => {
    /*
     * ⛔ En källa utan `skicka` ser ut att fungera ända tills någon skrivit en
     * fråga och tryckt. Då upptäcks felet av användaren i stället för av den
     * som kopplade in rutan, och det är en hel release för sent.
     */
    expect(() => skapaPromptkalla()).toThrow(/skicka måste vara en funktion/);
    expect(() => skapaPromptkalla({ skicka: async () => ({ text: "x" }), maxTecken: 0 })).toThrow(/positivt tal/);
  });

  it("skickar den trimmade frågan och sammanhanget vidare", async () => {
    const skicka = vi.fn(async () => ({ text: "Svar", tokens: { in: 10, ut: 5 } }));
    const kalla = skapaPromptkalla({ skicka });

    const svar = await kalla.fraga({ prompt: "  Vad händer i oktober?  ", sammanhang: { manad: 10 } });

    expect(skicka).toHaveBeenCalledWith({ prompt: "Vad händer i oktober?", sammanhang: { manad: 10 } });
    expect(svar).toEqual({ text: "Svar", tokens: { in: 10, ut: 5 } });
  });

  it("stoppar en för lång fråga innan nätanropet", async () => {
    // ⛔ Här och inte i funktionen på andra sidan: en fråga som avvisas efter
    // ett nätanrop har redan kostat väntan, och felet är något användaren kan
    // rätta själv innan hen trycker.
    const skicka = vi.fn(async () => ({ text: "Svar" }));
    const kalla = skapaPromptkalla({ skicka, maxTecken: 10 });

    await expect(kalla.fraga({ prompt: "x".repeat(11) })).rejects.toThrow(/Taket är 10/);
    await expect(kalla.fraga({ prompt: "   " })).rejects.toThrow(/Skriv en fråga/);
    expect(skicka).not.toHaveBeenCalled();
  });

  it("gör ett tomt svar till ett fel, inte till en tom yta", async () => {
    /*
     * ⛔ En tyst nedsläppsväg hade ritat en tom svarsyta, och en tom yta ser ut
     * som att modellen inte hade något att säga. Skillnaden mot "anropet gick
     * sönder" är skillnaden mellan att fråga om igen och att ge upp.
     */
    for (const trasigt of [null, {}, { text: "" }, { text: "   " }]) {
      const kalla = skapaPromptkalla({ skicka: async () => trasigt });
      await expect(kalla.fraga({ prompt: "hej" })).rejects.toThrow(/tomt/);
    }
  });
});

describe("OpsPrompt", () => {
  const kallaSom = (skicka) => skapaPromptkalla({ skicka });

  it("visar svaret som markdown och inte som brädgårdar", async () => {
    // ⛔ En modell svarar i markdown om man inte ber den låta bli. Renderat som
    // text får läsaren `## Rubrik` rakt av, vilket är felet bolag-ops #249 finns för.
    render(
      <OpsPrompt kalla={kallaSom(async () => ({ text: "## Oktober\n\nMoms den 12:e." }))} label="Fråga om din ekonomi" />,
    );

    fireEvent.change(screen.getByLabelText("Fråga om din ekonomi"), { target: { value: "Vad händer?" } });
    fireEvent.click(screen.getByRole("button", { name: "Fråga" }));

    const rubrik = await screen.findByText("Oktober");
    expect(rubrik.tagName).toBe("H4");
    expect(document.body.textContent).not.toContain("## Oktober");
  });

  it("skickar inte två gånger för ett tryck", async () => {
    /*
     * ⛔ Två anrop för samma fråga är två fakturor för ett svar. Knappen stängs
     * av under väntan, men provet trycker ändå två gånger: Enter i fältet går
     * förbi knappen, så vakten måste sitta i funktionen och inte bara i DOM:en.
     */
    let slapp;
    const skicka = vi.fn(() => new Promise((r) => { slapp = () => r({ text: "Svar" }); }));
    render(<OpsPrompt kalla={kallaSom(skicka)} label="Fråga" />);

    const falt = screen.getByLabelText("Fråga");
    fireEvent.change(falt, { target: { value: "Vad händer?" } });

    /*
     * ⛔ GENVÄGEN OCH INTE KNAPPEN, och den rättelsen kom ur mutationsprovet.
     * Ett prov som tryckte på knappen två gånger var grönt även utan vakten,
     * eftersom knappen stängs av av sitt eget `disabled`. Vakten satt alltså
     * oprövad, och kommentaren bredvid den påstod ett skydd den inte gav.
     *
     * Cmd plus Enter går förbi knappen och når `fraga` direkt. Det är den väg
     * vakten finns för.
     */
    fireEvent.keyDown(falt, { key: "Enter", metaKey: true });
    fireEvent.keyDown(falt, { key: "Enter", metaKey: true });

    expect(skicka).toHaveBeenCalledTimes(1);
    slapp();
    expect(await screen.findByText("Svar")).toBeInTheDocument();
  });

  it("behåller förra svaret när ett anrop går sönder, och säger vad som hände", async () => {
    /*
     * ⛔ Det som stod där var sant innan. Att kasta bort det straffar
     * användaren för ett fel som inte var hens, och en sida som töms ser
     * dessutom ut att ha tappat bort sig.
     */
    const skicka = vi
      .fn()
      .mockResolvedValueOnce({ text: "Första svaret" })
      .mockRejectedValueOnce(new Error("Funktionen svarade inte"));
    render(<OpsPrompt kalla={kallaSom(skicka)} label="Fråga" />);

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
    const skicka = vi.fn(async () => ({ text: "Svar" }));
    render(<OpsPrompt kalla={kallaSom(skicka)} label="Fråga" forslag={["Vad händer i oktober?"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Vad händer i oktober?" }));

    expect(screen.getByLabelText("Fråga")).toHaveValue("Vad händer i oktober?");
    expect(skicka).not.toHaveBeenCalled();
    /*
     * ⛔ OCH INGET FEL SYNS, vilket är det som faktiskt fäller mutationen.
     * Ett förslag som skickar sig självt läser `text` innan React hunnit
     * uppdatera den, alltså skickas en tom fråga och rutan svarar "Skriv en
     * fråga först" på ett tryck användaren just gjorde rätt.
     */
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("skickar inte på Enter ensamt", () => {
    // ⛔ En fråga är ofta flera rader. Skickade Enter vore radbrytning omöjlig
    // utan att man först lärt sig en genväg, och då skickas halva frågor.
    const skicka = vi.fn(async () => ({ text: "Svar" }));
    render(<OpsPrompt kalla={kallaSom(skicka)} label="Fråga" />);

    const falt = screen.getByLabelText("Fråga");
    fireEvent.change(falt, { target: { value: "Rad ett" } });
    fireEvent.keyDown(falt, { key: "Enter" });

    expect(skicka).not.toHaveBeenCalled();
  });

  it("lägger ett längdfel vid fältet, inte i svarsytan", async () => {
    // ⛔ Den som ska rätta något behöver se VAD som är fel utan att leta. Ett
    // fel man kan åtgärda där man står hör till fältet.
    const kalla = skapaPromptkalla({ skicka: async () => ({ text: "Svar" }), maxTecken: 5 });
    render(<OpsPrompt kalla={kalla} label="Fråga" />);

    fireEvent.change(screen.getByLabelText("Fråga"), { target: { value: "alldeles för lång fråga" } });
    fireEvent.click(screen.getByRole("button", { name: "Fråga" }));

    const felrad = await screen.findByText(/Taket är 5/);
    /*
     * ⛔ KOPPLINGEN PROVAS, INTE BARA ATT TEXTEN FINNS. `OpsField` ger sitt fel
     * `role="alert"`, så ett prov som letade efter frånvaron av en alert var
     * rött mot rätt kod: båda felplatserna är alerts. Det som skiljer dem är
     * att fältets fel pekas ut av `aria-describedby`, alltså läses upp när man
     * står i fältet, och svarsytans inte gör det.
     */
    const falt = screen.getByLabelText("Fråga");
    expect(falt.getAttribute("aria-describedby") || "").toContain(felrad.id);
    expect(falt.getAttribute("aria-invalid")).toBe("true");
  });

  it("kastar utan källa eller etikett", () => {
    // ⛔ Samma val som OpsEventList gör med atgardsforklaring: hellre ett fel
    // än en ruta som ser färdig ut och inte leder någonstans.
    expect(() => render(<OpsPrompt label="Fråga" />)).toThrow(/skapaPromptkalla/);
    expect(() => render(<OpsPrompt kalla={kallaSom(async () => ({ text: "x" }))} />)).toThrow(/label krävs/);
  });
});
