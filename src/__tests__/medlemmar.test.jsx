import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpsMedlemmar } from "../components/OpsMedlemmar.jsx";
import { OpsUtanMedlemskap } from "../components/OpsUtanMedlemskap.jsx";

/**
 * Fas 2.5: medlemsvyn och sidan utan medlemskap (#137).
 *
 * ⛔ VÄLJARNA DRIVS INTE HÄR, av samma skäl som i profilvyn: `OpsSelect` är en
 * Radix Select och går inte att driva i jsdom. Det som mäts är vad som SYNS
 * och vilka knappar som FINNS, vilket är precis där reglerna i den här vyn
 * bor: ingen knapp på sin egen rad, inga knappar alls utan `kanAndra`.
 */

const med = (/** @type {string} */ userId, /** @type {string} */ roll) => ({
  medlemskap: { id: `${userId}_g`, userId, groupId: "g", roll, typ: "person", status: "aktiv" },
  namn: userId === "mig" ? "Jag Själv" : "Någon Annan",
});

describe("namnet kommer ur medlemskapet (#138, beslut A)", () => {
  const ur = (/** @type {string} */ userId, /** @type {object} */ extra) => ({
    medlemskap: { id: `${userId}_g`, userId, groupId: "g", roll: "medlem", typ: "person", status: "aktiv", namn: "", bild: "", ...extra },
  });

  it("visar medlemskapets namn utan att anroparen skickar något", () => {
    render(<OpsMedlemmar medlemmar={[ur("annan", { namn: "Ur Medlemskapet" })]} migUid="mig" />);
    expect(screen.getByText("Ur Medlemskapet")).toBeTruthy();
  });

  /*
   * ⛔ MEDLEMSKAPET VINNER ÖVER ETT INSKICKAT NAMN. Annars hade en vy som
   * råkar ha en gammal kopia i handen ritat den, och då är det inte längre
   * gruppens läsbara källa som avgör vad som syns.
   */
  it("låter medlemskapets namn gå före ett inskickat", () => {
    render(<OpsMedlemmar medlemmar={[{ ...ur("annan", { namn: "Ur Medlemskapet" }), namn: "Gammal Kopia" }]} migUid="mig" />);
    expect(screen.getByText("Ur Medlemskapet")).toBeTruthy();
    expect(screen.queryByText("Gammal Kopia")).toBe(null);
  });

  /*
   * ⛔ DET HÄR PROVET SAKNADES, OCH SVEPET VISADE DET. Mutationen som slutade
   * skicka `imageUrl` överlevde: alla andra prov läser namnet, och märket ser
   * likadant ut i strukturen oavsett om det är en bild eller initialer.
   */
  it("ritar bilden ur medlemskapet, inte bara initialerna", () => {
    const { container } = render(<OpsMedlemmar medlemmar={[ur("annan", { namn: "Med Bild", bild: "https://exempel/a.png" })]} migUid="mig" />);
    const bild = container.querySelector("img");
    expect(bild).toBeTruthy();
    expect(bild?.getAttribute("src")).toBe("https://exempel/a.png");
  });

  it("ritar initialer när bilden saknas, i stället för en trasig bildruta", () => {
    const { container } = render(<OpsMedlemmar medlemmar={[ur("annan", { namn: "Utan Bild", bild: "" })]} migUid="mig" />);
    expect(container.querySelector("img")).toBe(null);
  });

  it("⛔ ritar 'Namn saknas' och aldrig uid när namnet saknas, alltså för en rad skriven före fältet fanns (#218)", () => {
    const { container } = render(<OpsMedlemmar medlemmar={[ur("uid-utan-namn", {})]} migUid="mig" />);
    expect(screen.getByText("Namn saknas")).toBeTruthy();
    expect(container.textContent).not.toContain("uid-utan-namn");
  });
});

describe("OpsMedlemmar", () => {
  it("⛔ migUid krävs, annars är skyddet en gissning", () => {
    expect(() => render(<OpsMedlemmar medlemmar={[]} migUid={/** @type {any} */ (undefined)} />)).toThrow(/OpsMedlemmar: migUid krävs/);
  });

  it("tomhet är ett svar", () => {
    render(<OpsMedlemmar medlemmar={[]} migUid="mig" />);
    expect(screen.getByText("Gruppen har inga medlemmar än.")).toBeTruthy();
  });

  it("listar medlemmarna med roll", () => {
    render(<OpsMedlemmar medlemmar={[med("mig", "agare"), med("annan", "medlem")]} migUid="mig" />);
    expect(screen.getByText("Jag Själv")).toBeTruthy();
    expect(screen.getByText("Någon Annan")).toBeTruthy();
    expect(screen.getByText("Ägare")).toBeTruthy();
  });

  it("min egen rad är märkt", () => {
    render(<OpsMedlemmar medlemmar={[med("mig", "agare")]} migUid="mig" />);
    expect(screen.getByText("Du")).toBeTruthy();
  });

  it("⛔ utan kanAndra finns inga knappar alls", () => {
    render(<OpsMedlemmar medlemmar={[med("mig", "agare"), med("annan", "medlem")]} migUid="mig" onTaBort={() => {}} onBjudIn={() => {}} />);
    expect(screen.queryByRole("button", { name: "Ta bort" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bjud in" })).toBeNull();
  });

  it("⛔ ALDRIG en Ta bort-knapp på sin egen rad", () => {
    render(<OpsMedlemmar medlemmar={[med("mig", "agare")]} migUid="mig" kanAndra onTaBort={() => {}} />);
    expect(screen.queryByRole("button", { name: "Ta bort" })).toBeNull();
  });

  it("men på någon annans rad", () => {
    const onTaBort = vi.fn();
    render(<OpsMedlemmar medlemmar={[med("mig", "agare"), med("annan", "medlem")]} migUid="mig" kanAndra onTaBort={onTaBort} />);
    const knappar = screen.getAllByRole("button", { name: "Ta bort" });
    expect(knappar).toHaveLength(1);
    fireEvent.click(knappar[0]);
    expect(onTaBort).toHaveBeenCalledWith({ userId: "annan" });
  });

  it("⛔ rollväljaren finns inte heller på min egen rad", () => {
    render(<OpsMedlemmar medlemmar={[med("mig", "agare"), med("annan", "medlem")]} migUid="mig" kanAndra onAndraRoll={() => {}} />);
    expect(screen.queryByLabelText("Roll, Jag Själv")).toBeNull();
    expect(screen.getByLabelText("Roll, Någon Annan")).toBeTruthy();
  });

  it("väntande inbjudningar syns, annars ser det ut som att inget hände", () => {
    render(
      <OpsMedlemmar
        medlemmar={[med("mig", "agare")]}
        inbjudningar={[{ id: "i1", epost: "ny@x.se", roll: "medlem" }]}
        migUid="mig"
        kanAndra
      />,
    );
    expect(screen.getByText("ny@x.se")).toBeTruthy();
    expect(screen.getByText("Väntar")).toBeTruthy();
  });

  it("⛔ noten om att inget mejl skickas står i formuläret", () => {
    render(<OpsMedlemmar medlemmar={[]} migUid="mig" kanAndra onBjudIn={() => {}} />);
    expect(screen.getByText(/Inget mejl skickas/)).toBeTruthy();
  });

  /*
   * ⛔ DET HÄR PROVET VAKTAR NU FÄLTTYPEN, och det var inte meningen från
   * början. Komponenten hade en egen `trim`, svepet tog bort den, och
   * ingenting blev rött: `type="email"` gör att webbläsaren sanerar bort
   * blanksteg innan värdet når `onChange`. Trimmen togs då bort, och provet
   * mäter i stället att adressen kommer fram ren. Byter någon `type` till
   * `text` faller det här provet, vilket är precis vad man vill veta.
   */
  it("Bjud in är avstängd utan adress, och adressen kommer fram utan blanksteg", async () => {
    const onBjudIn = vi.fn();
    render(<OpsMedlemmar medlemmar={[]} migUid="mig" kanAndra onBjudIn={onBjudIn} />);
    const knapp = screen.getByRole("button", { name: "Bjud in" });
    expect(knapp.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: " ny@x.se " } });
    fireEvent.click(screen.getByRole("button", { name: "Bjud in" }));
    expect(onBjudIn).toHaveBeenCalledWith({ epost: "ny@x.se", roll: "medlem" });
  });
});

describe("OpsUtanMedlemskap", () => {
  it("säger vad som gäller, aldrig en tom app", () => {
    render(<OpsUtanMedlemskap />);
    expect(screen.getByText("Du är inte med i någon grupp")).toBeTruthy();
    expect(screen.getByText(/Be om en inbjudan/)).toBeTruthy();
  });

  it("⛔ visar vilket konto man är inloggad med, eftersom fel konto är vanligast", () => {
    render(<OpsUtanMedlemskap inloggadSom="fel@konto.se" />);
    expect(screen.getByText("fel@konto.se")).toBeTruthy();
  });

  it("kontakten syns när appen skickar in den", () => {
    render(<OpsUtanMedlemskap kontakt="Be CP om en inbjudan." />);
    expect(screen.getByText("Be CP om en inbjudan.")).toBeTruthy();
  });

  it("utloggningen finns, för den som loggat in med fel konto", () => {
    const onLoggaUt = vi.fn();
    render(<OpsUtanMedlemskap onLoggaUt={onLoggaUt} />);
    fireEvent.click(screen.getByRole("button", { name: "Logga ut" }));
    expect(onLoggaUt).toHaveBeenCalledTimes(1);
  });
});
