import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsDataProvider, useDocument, useCollection, useLiveCollection } from "../index.js";

/**
 * Läscachen, provad genom hookarna och inte mot modulen.
 *
 * ⛔ GENOM HOOKARNA, för det är där kravet bor: bolag-ops #256 handlar om att
 * TVÅ HOOKAR PÅ SAMMA MOUNT läste `data/pension` var för sig. Ett prov som
 * anropar `throughCache` direkt hade bevisat att en Map fungerar, vilket ingen
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
function raknandeKalla({ kostnader = [{ id: "1" }], pension = { id: "pension", value: 42 }, error = null } = {}) {
  const rakning = { list: 0, read: 0 };
  return {
    rakning,
    source: {
      async list(collectionName) {
        rakning.list += 1;
        if (error) throw new Error(error);
        return collectionName === "kostnader" ? kostnader : [];
      },
      async read() {
        rakning.read += 1;
        if (error) throw new Error(error);
        return pension;
      },
      async create(_s, d) {
        return { id: "ny", ...d };
      },
      async update(_s, id, d) {
        return { id, ...d };
      },
      async remove() {},
    },
  };
}

/** @param {{ source: any, children: import("react").ReactNode }} props */
function Med({ source, children }) {
  return <OpsDataProvider source={source}>{children}</OpsDataProvider>;
}

function Lista() {
  const { data, loading } = useCollection("kostnader");
  return <p>{loading ? "loading" : `rows: ${data.length}`}</p>;
}

function Dokument({ label }) {
  const { data, loading } = useDocument("data", "pension");
  return <p>{loading ? `${label}: laddar` : `${label}: ${data ? data.value : "inget"}`}</p>;
}

describe("läscachen", () => {
  it("läser en gång när två hookar frågar efter samma dokument", async () => {
    /*
     * ⛔ DET HÄR ÄR #256, ORDAGRANT. Översiktens hook och pensionshooken läste
     * `data/pension` var för sig på samma mount. Ingen av dem gjorde fel, de
     * visste bara inte om varandra.
     */
    const { source, rakning } = raknandeKalla();
    render(
      <Med source={source}>
        <Dokument label="a" />
        <Dokument label="b" />
      </Med>,
    );

    await waitFor(() => expect(screen.getByText("a: 42")).toBeInTheDocument());
    expect(screen.getByText("b: 42")).toBeInTheDocument();
    expect(rakning.read).toBe(1);
  });

  it("hämtar inte om vid ommontering, och blinkar inte till en spinner", async () => {
    /*
     * ⛔ PROVET LÄSER VARJE RENDERPASS OCH INTE BARA SLUTRESULTATET, och det är
     * en rättelse värd att minnas. Först stod här ett `getByText("rows: 1")`
     * direkt efter ommonteringen, och det provet var GRÖNT även när cachen bara
     * lästes inne i effekten: `render` i testbiblioteket kör effekterna innan
     * det returnerar, så mellanläget hann aldrig synas. I en webbläsare målas
     * det däremot, och just det blinkandet är vad som får en sida att kännas
     * långsam fast ingenting hämtas.
     *
     * Med en lista över vad komponenten faktiskt renderade blir påståendet det
     * man menade: att `loading` aldrig var sant.
     */
    const { source, rakning } = raknandeKalla();
    /** @type {string[]} */
    const pass = [];
    function Loggande() {
      const { data, loading } = useCollection("kostnader");
      pass.push(loading ? "loading" : `rows: ${data.length}`);
      return <p>{loading ? "loading" : `rows: ${data.length}`}</p>;
    }

    const forsta = render(
      <Med source={source}>
        <Loggande />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rows: 1")).toBeInTheDocument());
    forsta.unmount();

    pass.length = 0;
    render(
      <Med source={source}>
        <Loggande />
      </Med>,
    );

    expect(pass).not.toContain("loading");
    expect(screen.getByText("rows: 1")).toBeInTheDocument();
    expect(rakning.list).toBe(1);
  });

  it("går till källan igen när uppdatera anropas", async () => {
    /*
     * ⛔ UTAN DEN HÄR ÄR CACHEN EN ÅTERVÄNDSGRÄND. Den som skriver något och
     * sedan trycker uppdatera skulle få tillbaka exakt det gamla svaret, och
     * knappen hade sett ut att fungera medan ingenting hände.
     */
    const { source, rakning } = raknandeKalla();
    function MedKnapp() {
      const { data, loading, update } = useCollection("kostnader");
      return (
        <>
          <p>{loading ? "loading" : `rows: ${data.length}`}</p>
          <button type="button" onClick={update}>
            Uppdatera
          </button>
        </>
      );
    }

    render(
      <Med source={source}>
        <MedKnapp />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rows: 1")).toBeInTheDocument());
    expect(rakning.list).toBe(1);

    screen.getByRole("button", { name: "Uppdatera" }).click();
    await waitFor(() => expect(rakning.list).toBe(2));
  });

  it("cachar aldrig ett fel", async () => {
    /*
     * ⛔ ETT CACHAT FEL GÖR EN NÄTVERKSSTÖT PERMANENT. Resten av sessionen hade
     * svarat med samma fel utan att någonsin prova igen, och "försök igen" hade
     * blivit en knapp som ljuger.
     */
    let trasig = true;
    const rakning = { list: 0 };
    const source = {
      async list() {
        rakning.list += 1;
        if (trasig) throw new Error("nätet");
        return [{ id: "1" }, { id: "2" }];
      },
      async read() {
        return null;
      },
      async create(_s, d) {
        return { id: "ny", ...d };
      },
      async update(_s, id, d) {
        return { id, ...d };
      },
      async remove() {},
    };

    function Prov() {
      const { data, loading, error } = useCollection("kostnader");
      if (loading) return <p>loading</p>;
      if (error) return <p>error</p>;
      return <p>rows: {data.length}</p>;
    }

    const forsta = render(
      <Med source={source}>
        <Prov />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("error")).toBeInTheDocument());
    forsta.unmount();

    trasig = false;
    render(
      <Med source={source}>
        <Prov />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rows: 2")).toBeInTheDocument());
    expect(rakning.list).toBe(2);
  });

  it("cachar ett dokument som inte finns, i stället för att leta varje gång", async () => {
    /*
     * ⛔ `null` ÄR ETT SVAR OCH INTE ETT SAKNAT SVAR. Blandades de ihop skulle
     * just de dokument som inte finns läsas om vid varje mount, alltså precis de
     * som kostar mest att leta efter.
     */
    const rakning = { read: 0 };
    const source = {
      async list() {
        return [];
      },
      async read() {
        rakning.read += 1;
        return null;
      },
      async create(_s, d) {
        return { id: "ny", ...d };
      },
      async update(_s, id, d) {
        return { id, ...d };
      },
      async remove() {},
    };

    const forsta = render(
      <Med source={source}>
        <Dokument label="a" />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("a: inget")).toBeInTheDocument());
    forsta.unmount();

    render(
      <Med source={source}>
        <Dokument label="b" />
      </Med>,
    );
    expect(screen.getByText("b: inget")).toBeInTheDocument();
    expect(rakning.read).toBe(1);
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
      <Med source={a.source}>
        <Lista />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rows: 1")).toBeInTheDocument());
    forsta.unmount();

    render(
      <Med source={b.source}>
        <Lista />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rows: 3")).toBeInTheDocument());
    expect(b.rakning.list).toBe(1);
  });

  it("låter strömmen vara i fred", async () => {
    /*
     * ⛔ `useLiveCollection` VARKEN LÄSER ELLER SKRIVER CACHEN. En ström är sin egen
     * sanning. Serverades den ur cachen skulle den visa en ögonblicksbild och
     * sedan rätta sig själv, och vilken bild man ser hade berott på vilken hook
     * som råkade montera först.
     */
    const { source, rakning } = raknandeKalla();
    function Ström() {
      const { data, loading } = useLiveCollection("kostnader");
      return <p>{loading ? "loading" : `ström: ${data.length}`}</p>;
    }

    const forsta = render(
      <Med source={source}>
        <Lista />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rows: 1")).toBeInTheDocument());
    forsta.unmount();

    render(
      <Med source={source}>
        <Ström />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("ström: 1")).toBeInTheDocument());
    // Två läsningar: en cachad för `useCollection`, en egen för strömmen.
    expect(rakning.list).toBe(2);
  });

  it("frågar om igen när frågan ändras", async () => {
    // ⛔ Nyckeln bär frågan. Gjorde den inte det skulle ett filtrerat urval
    // serveras ur samma låda som det ofiltrerade, alltså fel rader utan att
    // något ser fel ut.
    const { source, rakning } = raknandeKalla();
    function MedFraga({ status }) {
      const { data, loading } = useCollection("kostnader", { where: { status } });
      return <p>{loading ? "loading" : `rows: ${data.length}`}</p>;
    }

    const ut = render(
      <Med source={source}>
        <MedFraga status="oppen" />
      </Med>,
    );
    await waitFor(() => expect(screen.getByText("rows: 1")).toBeInTheDocument());

    ut.rerender(
      <Med source={source}>
        <MedFraga status="stangd" />
      </Med>,
    );
    await waitFor(() => expect(rakning.list).toBe(2));
  });
});
