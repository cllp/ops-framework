import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OpsBreakdown } from "../components/OpsBreakdown.jsx";
import { OpsAttributes } from "../components/OpsAttributes.jsx";

const grupper = [
  {
    id: "bostad",
    label: "Bostad",
    value: "12 000 kr",
    count: 3,
    on: true,
    poster: [
      { id: "brf", label: "Riksbyggen", value: "10 918 kr", hint: "Månadsvis" },
      { id: "el", label: "GEAB", value: "979 kr" },
    ],
  },
  { id: "mat", label: "Mat", value: "5 000 kr", count: 1, on: false, poster: [{ id: "ica", label: "ICA", value: "5 000 kr" }] },
  { id: "tomt", label: "Utan poster", value: "0 kr", on: true },
];

const total = { label: "Fasta kostnader", value: "12 000 kr/mån" };

describe("OpsBreakdown", () => {
  it("visar totalen först och uppdelningen under", () => {
    // ⛔ Ordningen är inte kosmetik. Läser man uppifrån vill man ha svaret
    // först. En summa i foten tvingar en att läsa hela listan för att få veta
    // vad den blev.
    const { container } = render(<OpsBreakdown groups={grupper} onToggle={() => {}} total={total} />);
    const text = /** @type {string} */ (container.textContent);
    expect(text.indexOf("Fasta kostnader")).toBeLessThan(text.indexOf("Bostad"));
  });

  it("håller posterna dolda tills gruppen fälls ut", () => {
    render(<OpsBreakdown groups={grupper} onToggle={() => {}} total={total} />);
    expect(screen.queryByText("Riksbyggen")).not.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Visa poster i Bostad" }));
    expect(screen.getByText("Riksbyggen")).toBeVisible();
    expect(screen.getByText("GEAB")).toBeVisible();
  });

  it("säger om gruppen är utfälld, i stället för att bara vrida en pil", () => {
    // ⛔ En roterad chevron är osynlig för en skärmläsare. aria-expanded är det
    // enda som faktiskt bär tillståndet.
    render(<OpsBreakdown groups={grupper} onToggle={() => {}} total={total} />);
    const knapp = screen.getByRole("button", { name: "Visa poster i Bostad" });
    expect(knapp).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(knapp);
    expect(knapp).toHaveAttribute("aria-expanded", "true");
  });

  it("skiljer utfällning från nedtoning, och nästlar dem inte", () => {
    // ⛔ Det viktiga provet. Gesten "tryck på raden" ska betyda nedtoning här
    // precis som i OpsToggleRow, annars betyder samma tryck olika saker på två
    // sidor i samma app. Och en <button> i en <button> är ogiltig HTML som
    // webbläsaren river isär, så de måste vara syskon.
    const onToggle = vi.fn();
    render(<OpsBreakdown groups={grupper} onToggle={onToggle} total={total} />);

    const fall = screen.getByRole("button", { name: "Visa poster i Bostad" });
    fireEvent.click(fall);
    expect(onToggle).not.toHaveBeenCalled(); // utfällning tonar inte ned

    fireEvent.click(screen.getByRole("button", { name: /^Bostad/ }));
    expect(onToggle).toHaveBeenCalledWith("bostad", false);

    expect(fall.querySelector("button")).toBeNull();
    expect(screen.getByRole("button", { name: /^Bostad/ }).querySelector("button")).toBeNull();
  });

  it("bär gruppens tillstånd i aria-pressed och stryker över beloppet", () => {
    render(<OpsBreakdown groups={grupper} onToggle={() => {}} total={total} />);
    expect(screen.getByRole("button", { name: /^Bostad/ })).toHaveAttribute("aria-pressed", "true");

    const mat = screen.getByRole("button", { name: /^Mat/ });
    expect(mat).toHaveAttribute("aria-pressed", "false");
    expect(within(mat).getByText("5 000 kr")).toHaveClass("line-through");
  });

  it("ger en grupp utan poster ingen utfällningsknapp", () => {
    // ⛔ En chevron som inte öppnar något är ett löfte som inte infrias, och den
    // som trycker drar slutsatsen att sidan är trasig.
    render(<OpsBreakdown groups={grupper} onToggle={() => {}} total={total} />);
    expect(screen.queryByRole("button", { name: "Visa poster i Utan poster" })).toBeNull();
  });

  it("visar det tomma läget i stället för en tom ram", () => {
    render(<OpsBreakdown groups={[]} onToggle={() => {}} total={total} empty={<p>Inga kostnader</p>} />);
    expect(screen.getByText("Inga kostnader")).toBeInTheDocument();
    expect(screen.queryByText("Fasta kostnader")).toBeNull();
  });

  it("summerar ingenting själv", () => {
    // ⛔ Regressionsprov för en frestelse, inte för en bugg vi haft. Räknade
    // komponenten ihop gruppernas värden skulle den behöva tolka "[okänt]",
    // intervall och främmande valuta, alltså gissa. Totalen kommer utifrån.
    render(<OpsBreakdown groups={grupper} onToggle={() => {}} total={{ label: "Summa", value: "sju stycken" }} />);
    expect(screen.getByText("sju stycken")).toBeInTheDocument();
  });
});

describe("OpsAttributes", () => {
  it("ritar etikett och värde som ett par en skärmläsare kan följa", () => {
    render(<OpsAttributes rows={[{ label: "OCR", value: "165846692" }]} ariaLabel="Om posten" />);
    const list = screen.getByLabelText("Om posten");
    expect(list.tagName).toBe("DL");
    expect(within(list).getByText("OCR").tagName).toBe("DT");
    expect(within(list).getByText("165846692").tagName).toBe("DD");
  });

  it("hoppar över tomma fält och ritar ingenting när allt är tomt", () => {
    // ⛔ Ett bindestreck eller ett "[okänt]" ser ut som ett mätt värde när man
    // skummar, och att veta noll och att inte veta är motsatser.
    const { container } = render(
      <OpsAttributes rows={[{ label: "Har", value: "ja" }, { label: "Saknas", value: null }, { label: "Tom", value: "" }]} />,
    );
    expect(screen.getByText("Har")).toBeInTheDocument();
    expect(screen.queryByText("Saknas")).toBeNull();
    expect(screen.queryByText("Tom")).toBeNull();

    const { container: inget } = render(<OpsAttributes rows={[{ label: "Saknas", value: undefined }]} />);
    expect(inget.querySelector("dl")).toBeNull();
    expect(container.querySelector("dl")).not.toBeNull();
  });

  it("behåller noll, eftersom noll är ett värde", () => {
    // ⛔ Filtret får inte falla på falsy. `0 kr` är ett mätt svar, och att tappa
    // det vore att göra ett känt värde till ett okänt.
    render(<OpsAttributes rows={[{ label: "Belopp", value: 0 }]} />);
    expect(screen.getByText("Belopp")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("kastar när samma etikett finns två gånger", () => {
    // ⛔ Två rader med samma etikett påstår att samma fält har två värden, och
    // läsaren kan inte avgöra vilket som gäller. Nästan alltid samma fält hämtat
    // ur två källor, alltså ett riktigt fel.
    expect(() =>
      render(<OpsAttributes rows={[{ label: "Belopp", value: "1 kr" }, { label: "Belopp", value: "2 kr" }]} />),
    ).toThrow(/två gånger/);
  });
});
