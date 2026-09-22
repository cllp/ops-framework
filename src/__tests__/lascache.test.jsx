import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsDataProvider, useDokument, useSamling, useSamlingLive } from "../index.js";

/**
 * Läscachen, provad genom hookarna och inte mot modulen.
 *
 * ⛔ GENOM HOOKARNA, för det är där kravet bor: bolag-ops #256 handlar om att
 * TVÅ HOOKAR PÅ SAMMA MOUNT läste `data/pension` var för sig. Ett prov som
 * anropar `genomCachen` direkt hade bevisat att en Map fungerar, vilket ingen
 * tvivlade på, och missat att hookarna faktiskt delar nyckel.
 */

/**
 * En källa som RÄKNAR sina läsningar.
 *
 * ⛔ Räknaren är hela mätinstrumentet. "Sidan känns snabbare" går inte att göra
 * rött, men "två läsningar där det ska vara en" gör det.
 *
 * ⛔ Svaren dröjer en mikrotask, precis som kontraktets regel 1 kräver. En
 * synkron källa hade dolt just det fall cachen finns för: två hookar som frågar
 * INNAN det första svaret hunnit fram.
 */
function raknandeKalla({ kostnader = [{ id: "1" }], pension = { id: "pension", varde: 42 }, fel = null } = {}) {
  const rakning = { lista: 0, las: 0 };
  return {
    rakning,
    kalla: {
      async lista(samling) {
        rakning.lista += 1;
        if (fel) throw new Error(fel);
        return samling === "kostnader" ? kostnader : [];
      },
      async las() {
        rakning.las += 1;
        if (fel) throw new Error(fel);
        return pension;
      },
      async skapa(_s, d) {
        return { id: "ny", ...d };
      },
      async uppdatera(_s, id, d) {
        return { id, ...d };
      },
      async taBort() {},
    },
  };
}

/** @param {{ kalla: any, children: import("react").ReactNode }} props */
function Med({ kalla, children }) {
  return <OpsDataProvider kalla={kalla}>{children}</OpsDataProvider>;
}

function Lista() {
  const { data, laddar } = useSamling("kostnader");
  return <p>{laddar ? "laddar" : `rader: ${data.length}`}</p>;
}

function Dokument({ etikett }) {
  const { data, laddar } = useDokument("data", "pension");
  return <p>{laddar ? `${etikett}: laddar` : `${etikett}: ${data ? data.varde : "inget"}`}</p>;
}

describe("läscachen", () => {
  it("läser en gång när två hookar frågar efter samma dokument", async () => {
    /*
     * ⛔ DET HÄR ÄR #256, ORDAGRANT. Översiktens hook och pensionshooken läste
     * `data/pension` var för sig på samma mount. Ingen av dem gjorde fel, de
     * visste bara inte om varandra.
     */
    const { kalla, rakning } = raknandeKalla();
    render(
      <Med kalla={kalla}>
        <Dokument etikett="a" />
        <Dokument etikett="b" />
      </Med>,
    );

    await waitFor(() => expect(screen.getByText("a: 42")).toBeInTheDocument());
    expect(screen.getByText("b: 42")).toBeInTheDocument();
    expect(rakning.las).toBe(1);
  });

  it("hämtar inte om vid ommontering, och blinkar inte till en spinner", async () => {
    /*
     * ⛔ PROVET LÄSER VARJE RENDERPASS OCH INTE BARA SLUTRESULTATET, och det är
     * en rättelse värd att minnas. Först stod här ett `getByText("rader: 1")`
     * direkt efter ommonteringen, och det provet var GRÖNT även när cachen bara
     * lästes inne i effekten: `render` i testbiblioteket kör effekterna innan
     * det returnerar, så mellanläget hann aldrig synas. I en webbläsare målas
     * det däremot, och just det blinkandet är vad som får en sida att kännas
     * långsam fast ingenting hämtas.
     *
     * Med en lista över vad komponenten faktiskt renderade blir påståendet det
     * man menade: att `laddar` aldrig var sant.
     */
    const { kalla, rakning } = raknandeKalla();
    /** @type {string[]} */
    const pass = [];
    function Loggande() {
      const { data, laddar } = useSamling("kostnader");
      pass.push(laddar ? "laddar" : `rader: ${data.length}`);
      return <p>{laddar ? "laddar" : `rader: ${data.length}`}</p>;
    }

    const forsta = render(
      <Med kalla={kalla}>
        <Loggande />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rader: 1")).toBeInTheDocument());
    forsta.unmount();

    pass.length = 0;
    render(
      <Med kalla={kalla}>
        <Loggande />
      </Med>,
    );

    expect(pass).not.toContain("laddar");
    expect(screen.getByText("rader: 1")).toBeInTheDocument();
    expect(rakning.lista).toBe(1);
  });

  it("går till källan igen när uppdatera anropas", async () => {
    /*
     * ⛔ UTAN DEN HÄR ÄR CACHEN EN ÅTERVÄNDSGRÄND. Den som skriver något och
     * sedan trycker uppdatera skulle få tillbaka exakt det gamla svaret, och
     * knappen hade sett ut att fungera medan ingenting hände.
     */
    const { kalla, rakning } = raknandeKalla();
    function MedKnapp() {
      const { data, laddar, uppdatera } = useSamling("kostnader");
      return (
        <>
          <p>{laddar ? "laddar" : `rader: ${data.length}`}</p>
          <button type="button" onClick={uppdatera}>
            Uppdatera
          </button>
        </>
      );
    }

    render(
      <Med kalla={kalla}>
        <MedKnapp />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rader: 1")).toBeInTheDocument());
    expect(rakning.lista).toBe(1);

    screen.getByRole("button", { name: "Uppdatera" }).click();
    await waitFor(() => expect(rakning.lista).toBe(2));
  });

  it("cachar aldrig ett fel", async () => {
    /*
     * ⛔ ETT CACHAT FEL GÖR EN NÄTVERKSSTÖT PERMANENT. Resten av sessionen hade
     * svarat med samma fel utan att någonsin prova igen, och "försök igen" hade
     * blivit en knapp som ljuger.
     */
    let trasig = true;
    const rakning = { lista: 0 };
    const kalla = {
      async lista() {
        rakning.lista += 1;
        if (trasig) throw new Error("nätet");
        return [{ id: "1" }, { id: "2" }];
      },
      async las() {
        return null;
      },
      async skapa(_s, d) {
        return { id: "ny", ...d };
      },
      async uppdatera(_s, id, d) {
        return { id, ...d };
      },
      async taBort() {},
    };

    function Prov() {
      const { data, laddar, fel } = useSamling("kostnader");
      if (laddar) return <p>laddar</p>;
      if (fel) return <p>fel</p>;
      return <p>rader: {data.length}</p>;
    }

    const forsta = render(
      <Med kalla={kalla}>
        <Prov />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("fel")).toBeInTheDocument());
    forsta.unmount();

    trasig = false;
    render(
      <Med kalla={kalla}>
        <Prov />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rader: 2")).toBeInTheDocument());
    expect(rakning.lista).toBe(2);
  });

  it("cachar ett dokument som inte finns, i stället för att leta varje gång", async () => {
    /*
     * ⛔ `null` ÄR ETT SVAR OCH INTE ETT SAKNAT SVAR. Blandades de ihop skulle
     * just de dokument som inte finns läsas om vid varje mount, alltså precis de
     * som kostar mest att leta efter.
     */
    const rakning = { las: 0 };
    const kalla = {
      async lista() {
        return [];
      },
      async las() {
        rakning.las += 1;
        return null;
      },
      async skapa(_s, d) {
        return { id: "ny", ...d };
      },
      async uppdatera(_s, id, d) {
        return { id, ...d };
      },
      async taBort() {},
    };

    const forsta = render(
      <Med kalla={kalla}>
        <Dokument etikett="a" />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("a: inget")).toBeInTheDocument());
    forsta.unmount();

    render(
      <Med kalla={kalla}>
        <Dokument etikett="b" />
      </Med>,
    );
    expect(screen.getByText("b: inget")).toBeInTheDocument();
    expect(rakning.las).toBe(1);
  });

  it("delar aldrig cache mellan två källor", async () => {
    /*
     * ⛔ CACHEN HÖR TILL KÄLLAN. En modulglobal hade låtit ett prov se ett annat
     * provs data, och den sortens fel dyker upp först när någon lägger till ett
     * prov någon annanstans i sviten.
     */
    const a = raknandeKalla({ kostnader: [{ id: "1" }] });
    const b = raknandeKalla({ kostnader: [{ id: "1" }, { id: "2" }, { id: "3" }] });

    const forsta = render(
      <Med kalla={a.kalla}>
        <Lista />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rader: 1")).toBeInTheDocument());
    forsta.unmount();

    render(
      <Med kalla={b.kalla}>
        <Lista />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rader: 3")).toBeInTheDocument());
    expect(b.rakning.lista).toBe(1);
  });

  it("låter strömmen vara i fred", async () => {
    /*
     * ⛔ `useSamlingLive` VARKEN LÄSER ELLER SKRIVER CACHEN. En ström är sin egen
     * sanning. Serverades den ur cachen skulle den visa en ögonblicksbild och
     * sedan rätta sig själv, och vilken bild man ser hade berott på vilken hook
     * som råkade montera först.
     */
    const { kalla, rakning } = raknandeKalla();
    function Ström() {
      const { data, laddar } = useSamlingLive("kostnader");
      return <p>{laddar ? "laddar" : `ström: ${data.length}`}</p>;
    }

    const forsta = render(
      <Med kalla={kalla}>
        <Lista />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rader: 1")).toBeInTheDocument());
    forsta.unmount();

    render(
      <Med kalla={kalla}>
        <Ström />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("ström: 1")).toBeInTheDocument());
    // Två läsningar: en cachad för `useSamling`, en egen för strömmen.
    expect(rakning.lista).toBe(2);
  });

  it("frågar om igen när frågan ändras", async () => {
    // ⛔ Nyckeln bär frågan. Gjorde den inte det skulle ett filtrerat urval
    // serveras ur samma låda som det ofiltrerade, alltså fel rader utan att
    // något ser fel ut.
    const { kalla, rakning } = raknandeKalla();
    function MedFraga({ status }) {
      const { data, laddar } = useSamling("kostnader", { dar: { status } });
      return <p>{laddar ? "laddar" : `rader: ${data.length}`}</p>;
    }

    const ut = render(
      <Med kalla={kalla}>
        <MedFraga status="oppen" />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rader: 1")).toBeInTheDocument());

    ut.rerender(
      <Med kalla={kalla}>
        <MedFraga status="stangd" />
      </Med>,
    );
    await waitFor(() => expect(rakning.lista).toBe(2));
  });
});
