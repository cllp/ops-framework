import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpsKatalogInstallning } from "../components/OpsKatalogInstallning.jsx";
import { validateKatalog } from "../lib/katalog.js";

/**
 * Inställningsvyn (#112).
 *
 * ⛔ DE TVÅ VIKTIGASTE RADERNA HÄR ÄR DE SOM HANDLAR OM VAD VYN INTE GÖR: den
 * raderar aldrig, och den låter inte en medlem spara. Ett prov som bara
 * kontrollerar att en kategori går att lägga till är grönt även när båda de
 * egenskaperna gått förlorade.
 */

const IKONER = ["check", "bell"];
const KATEGORIER = validateKatalog(
  [
    { id: "uppgift", namn: { sv: "Uppgifter", en: "Tasks" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0 },
    { id: "gammal", namn: { sv: "Gammal sort" }, farg: 2, ikon: "bell", fas: "klar", ordning: 1, arkiverad: true },
  ],
  { ikoner: IKONER },
);

const rita = (props = {}) =>
  render(
    <OpsKatalogInstallning
      kategorier={KATEGORIER}
      ikoner={IKONER}
      kanAndra
      onSpara={() => {}}
      onArkivera={() => {}}
      {...props}
    />,
  );

describe("inställningsvyn", () => {
  it("visar kategorierna, och de arkiverade för sig", () => {
    rita();
    expect(screen.getByText("Uppgifter")).toBeInTheDocument();
    // ⛔ Den arkiverade syns fortfarande. Den är inte borta, den går bara inte
    // att välja för nya poster, och en vy som dolde den gjorde "ta fram igen"
    // omöjligt.
    expect(screen.getByText("Gammal sort")).toBeInTheDocument();
    expect(screen.getByText("Arkiverad")).toBeInTheDocument();
  });

  it("⛔ har ingen knapp som raderar, bara arkivera och ta fram", () => {
    /*
     * En raderad kategori lämnar varje rad som pekar på den utan kategori. De
     * raderna blir omöjliga att filtrera och räkna, och felet upptäcks långt
     * efter att någon tryckt på knappen.
     */
    rita();
    expect(screen.queryByRole("button", { name: /radera/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /ta bort/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Arkivera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ta fram" })).toBeInTheDocument();
  });

  it("arkiverar med ett anrop utåt, och vyn skriver inte själv", () => {
    const onArkivera = vi.fn();
    rita({ onArkivera });
    fireEvent.click(screen.getByRole("button", { name: "Arkivera" }));
    expect(onArkivera).toHaveBeenCalledWith(expect.objectContaining({ id: "uppgift" }), true);
  });

  it("tar fram en arkiverad igen, alltså är arkiveringen ångrbar", () => {
    const onArkivera = vi.fn();
    rita({ onArkivera });
    fireEvent.click(screen.getByRole("button", { name: "Ta fram" }));
    expect(onArkivera).toHaveBeenCalledWith(expect.objectContaining({ id: "gammal" }), false);
  });

  it("⛔ en medlem som inte är ägare ser vyn men kan inte ändra, med skälet utskrivet", () => {
    rita({ kanAndra: false });
    expect(screen.getByText("Du kan läsa katalogen, inte ändra den")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lägg till kategori" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Arkivera" })).toBeNull();
    // ⛔ Och vyn säger att den inte är låset. Den som tror att en dold knapp är
    // ett skydd bygger nästa funktion på samma antagande.
    expect(screen.getByText(/regler, inte i den här vyn/)).toBeInTheDocument();
  });

  it("lägger till en kategori och skickar den byggd utåt", () => {
    const onSpara = vi.fn();
    rita({ onSpara });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));

    fireEvent.change(screen.getByLabelText(/Nyckel/), { target: { value: "resa" } });
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Resor" } });
    fireEvent.change(screen.getByLabelText(/Namn på engelska/), { target: { value: "Travel" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).toHaveBeenCalledTimes(1);
    // ⛔ Ikonen är den första tillåtna utan att någon rört väljaren: en ny
    // kategori börjar giltig, i stället för att vägras när allt annat fyllts i.
    expect(onSpara.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: "resa", namn: { sv: "Resor", en: "Travel" }, ikon: IKONER[0], fas: "aktiv" }),
    );
  });

  it("⛔ ett ogiltigt värde sparas inte, och skälet från valideringen visas som det är", () => {
    /*
     * Samma validering som vid uppstart, inte en egen i formuläret. En andra
     * uppsättning regler glider isär från den som faktiskt gäller, och då går
     * det att spara något som sedan vägrar läsas in.
     */
    const onSpara = vi.fn();
    rita({ onSpara });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));
    fireEvent.change(screen.getByLabelText(/Nyckel/), { target: { value: "Min.Kategori" } });
    fireEvent.change(screen.getByLabelText(/Namn på svenska/), { target: { value: "Fel nyckel" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));

    expect(onSpara).not.toHaveBeenCalled();
    expect(screen.getByText(/små bokstäver/)).toBeInTheDocument();
  });

  it("⛔ nyckeln går inte att ändra på en befintlig kategori", () => {
    // Varje rad i databasen pekar på den. Gick den att ändra skulle kopplingen
    // till allt som redan skrivits försvinna, tyst.
    rita();
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    expect(screen.getByLabelText(/Nyckel/)).toBeDisabled();
  });

  it("säger i formuläret att en omdöpning behåller kopplingen", () => {
    // Utan den meningen vågar ingen döpa om något, och då är hela vyn en
    // knapp folk är rädda för.
    rita();
    fireEvent.click(screen.getAllByRole("button", { name: "Ändra" })[0]);
    expect(screen.getByText(/behåller kopplingen/)).toBeInTheDocument();
  });

  it("⛔ färgen väljs som PLATS och inte som färgkod", () => {
    rita();
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));

    // Väljaren visar en plats, inte en färgkod.
    expect(screen.getByLabelText(/^Färg/)).toHaveTextContent("Plats 1");
    // ⛔ Och det finns ingen ruta att skriva en hex i. En färgkod i
    // konfigurationen följer inte med när temat byter, så formuläret får inte
    // ens erbjuda det.
    expect(screen.queryByRole("textbox", { name: /Färg/ })).toBeNull();
    expect(screen.getByText(/mätta mot kontrastgolvet/)).toBeInTheDocument();
  });

  it("⛔ ikonen väljs ur tillåtelselistan och går inte att skriva fritt", () => {
    rita();
    fireEvent.click(screen.getByRole("button", { name: "Lägg till kategori" }));

    expect(screen.getByLabelText(/^Ikon/)).toHaveTextContent(IKONER[0]);
    expect(screen.queryByRole("textbox", { name: /Ikon/ })).toBeNull();
  });

  it("⛔ vägrar monteras utan tillåtelselista, i stället för att tillåta vad som helst", () => {
    // Utan lista går det att spara en ikon som inte finns, och den blir en tom
    // ruta i varje vy.
    expect(() => render(<OpsKatalogInstallning kategorier={[]} ikoner={[]} onSpara={() => {}} onArkivera={() => {}} />)).toThrow(/ikoner krävs/);
  });

  it("visar namnet på valt språk", () => {
    rita({ sprak: "en" });
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    // Den utan engelskt namn faller tillbaka på svenskan i stället för att bli tom.
    expect(screen.getByText("Gammal sort")).toBeInTheDocument();
  });
});
