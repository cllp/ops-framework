import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutingSource } from "../data/routing.js";
import { createMemorySource } from "../data/adapters.js";
import { OpsDataProvider, useLiveCollection } from "../data/useData.jsx";

/**
 * ⛔ SAMLINGSNAMNEN ÄR PÅHITTADE. Ramverket får inte kunna bero på den app som
 * adopterar sömmen först, och ett prov som säger `kostnader` eller `inkorg` gör
 * det svårt att se när det börjar.
 */

/**
 * En källa som kan strömma, byggd på minneskällan.
 *
 * ⛔ SAMLINGSNAMNET ÄR ETT ARGUMENT OCH INTE INBAKAT. Första versionen hade
 * `saker` hårdkodat, och provet mot hooken blev rött med `limit=0`: strömmen
 * levererade, men ur en samling som inte var den provet routade. Ett
 * provhjälpmedel som tyst svarar med tomhet mäter ingenting.
 *
 * @param {string} [collectionName] @param {{ id: string }[]} [rows]
 */
function stromkalla(collectionName = "saker", rows = []) {
  const bas = createMemorySource({ [collectionName]: rows });
  const lyssnare = [];
  return {
    ...bas,
    subscribe: (collectionName, query, l) => {
      lyssnare.push(l);
      bas.list(collectionName, query).then((r) => l.onData(r));
      return () => {
        const i = lyssnare.indexOf(l);
        if (i >= 0) lyssnare.splice(i, 1);
      };
    },
    antalLyssnare: () => lyssnare.length,
  };
}

describe("createRoutingSource, uppsättningen", () => {
  it("kräver en standard", () => {
    // ⛔ Utan standard blir en glömd rutt ett fel som dyker upp först den dag
    // någon öppnar just den vyn.
    expect(() => createRoutingSource(/** @type {any} */ ({}))).toThrow(/standard krävs/);
    expect(() => createRoutingSource(/** @type {any} */ (null))).toThrow(/standard krävs/);
  });

  it("avvisar en rutt som inte är en datakälla, vid uppstart", () => {
    // ⛔ Annars ger den `undefined is not a function` först den dag samlingen
    // läses, och felet pekar mot vyn i stället för mot uppsättningen.
    const standard = createMemorySource({});
    expect(() => createRoutingSource({ standard, routes: { saker: /** @type {any} */ ({}) } })).toThrow(/saknar read/);
    expect(() => createRoutingSource({ standard, routes: { saker: /** @type {any} */ (null) } })).toThrow(
      /pekar inte på en datakälla/,
    );
  });

  it("nämner samlingen i felet, inte bara att något är fel", () => {
    const standard = createMemorySource({});
    expect(() => createRoutingSource({ standard, routes: { mittfall: /** @type {any} */ ({ read: () => {} }) } })).toThrow(
      /"mittfall"/,
    );
  });
});

describe("routningen", () => {
  it("skickar en samling till sin rutt och resten till standarden", async () => {
    const ettstalle = createMemorySource({ saker: [{ id: "a", var: "rutt" }] });
    const standard = createMemorySource({ saker: [{ id: "b", var: "standard" }], annat: [{ id: "c" }] });
    const source = createRoutingSource({ standard, routes: { saker: ettstalle } });

    expect((await source.list("saker")).map((r) => r.id)).toEqual(["a"]);
    expect((await source.list("annat")).map((r) => r.id)).toEqual(["c"]);
  });

  it("routar alla fem operationerna, inte bara läsningarna", async () => {
    // ⛔ Ett prov per operation, eftersom en glömd `remove` i sömmen skriver till
    // FEL DATABAS. Det felet upptäcks när någon saknar en post, alltså långt
    // efteråt och utan spår.
    const mal = createMemorySource({ saker: [{ id: "a", tal: 1 }] });
    const standard = createMemorySource({ saker: [{ id: "z", tal: 99 }] });
    const source = createRoutingSource({ standard, routes: { saker: mal } });

    expect(await source.read("saker", "a")).toMatchObject({ id: "a" });
    expect(await source.read("saker", "z")).toBeNull();

    const ny = await source.create("saker", { tal: 2 });
    expect(await mal.read("saker", ny.id)).toMatchObject({ tal: 2 });
    expect(await standard.read("saker", ny.id)).toBeNull();

    await source.update("saker", "a", { tal: 3 });
    expect(await mal.read("saker", "a")).toMatchObject({ tal: 3 });

    await source.remove("saker", "a");
    expect(await mal.read("saker", "a")).toBeNull();
    // Standardens egen post är orörd.
    expect(await standard.read("saker", "z")).toMatchObject({ tal: 99 });
  });

  it("går att inspektera, så uppsättningen kan mätas", () => {
    // ⛔ En routing man inte kan inspektera är en routing man får gissa om, och
    // den gissningen står sedan i ett dokument som ruttnar.
    const mal = createMemorySource({});
    const standard = createMemorySource({});
    const source = createRoutingSource({ standard, routes: { saker: mal } });
    expect(source.sourceFor("saker")).toBe(mal);
    expect(source.sourceFor("annat")).toBe(standard);
  });
});

describe("realtid per samling", () => {
  it("svarar per samling och inte per källa", () => {
    // ⛔ DET EGENTLIGA PROVET. `typeof source.subscribe === "function"` är ett
    // sant svar om en källa och en lögn om en routande: den kan strömma en
    // samling och inte en annan, alltså har frågan två svar.
    const strommar = stromkalla("strommande", [{ id: "a" }]);
    const stilla = createMemorySource({ stillsamt: [{ id: "b" }] });
    const source = createRoutingSource({ standard: stilla, routes: { strommande: strommar } });

    expect(source.canSubscribe("strommande")).toBe(true);
    expect(source.canSubscribe("stillsamt")).toBe(false);
  });

  it("exponerar inte prenumerera när ingen källa kan", () => {
    // ⛔ Annars hade den routande källan påstått en förmåga ingen av dess källor
    // har, och läsaren tagit strömvägen för att sedan kasta.
    const source = createRoutingSource({ standard: createMemorySource({}), routes: { x: createMemorySource({}) } });
    expect(source.subscribe).toBeUndefined();
  });

  it("exponerar prenumerera när minst en källa kan", () => {
    const source = createRoutingSource({ standard: createMemorySource({}), routes: { s: stromkalla() } });
    expect(typeof source.subscribe).toBe("function");
  });

  it("kastar med samlingens namn för en samling som inte kan strömma", () => {
    // ⛔ Alternativet vore en lyssnare som aldrig levererar, alltså en vy som
    // väntar för alltid och ser ut som att ingenting händer i systemet.
    const source = createRoutingSource({ standard: createMemorySource({}), routes: { s: stromkalla() } });
    expect(() =>
      /** @type {any} */ (source).subscribe("stillsamt", undefined, { onData: () => {}, onError: () => {} }),
    ).toThrow(/"stillsamt"/);
    expect(() =>
      /** @type {any} */ (source).subscribe("stillsamt", undefined, { onData: () => {}, onError: () => {} }),
    ).toThrow(/canSubscribe/);
  });

  it("strömmar den samling som kan", async () => {
    const strommar = stromkalla("s", [{ id: "a" }]);
    const source = createRoutingSource({ standard: createMemorySource({}), routes: { s: strommar } });
    const mottaget = [];
    const avsluta = /** @type {any} */ (source).subscribe("s", undefined, {
      onData: (r) => mottaget.push(r),
      onError: () => {},
    });
    // ⛔ RADERNA KONTROLLERAS, INTE BARA ATT EN LEVERANS SKEDDE. Provet räknade
    // först bara leveranser, och passerade därför med en TOM lista: hjälpmedlet
    // hade fel samlingsnamn och strömmade ur en samling som inte fanns. Ett prov
    // som bara räknar anrop kan inte se det.
    await vi.waitFor(() => expect(mottaget).toEqual([[{ id: "a" }]]));
    expect(strommar.antalLyssnare()).toBe(1);
    avsluta();
    expect(strommar.antalLyssnare()).toBe(0);
  });
});

/**
 * ⛔ HOOKEN PROVAS MOT SÖMMEN, inte bara sömmen för sig.
 *
 * Utan det här provet vore påståendet "useLiveCollection faller tillbaka ärligt"
 * obevisat, och det är hela skälet att `canSubscribe` finns. Mätt: tas raden i
 * useData.jsx bort blir det här provet rött, medan alla ovan förblir gröna.
 */
describe("useLiveCollection mot en routande källa", () => {
  /** @param {{ collectionName: string }} props */
  function Vy({ collectionName }) {
    const { data, loading, realtime } = useLiveCollection(collectionName);
    return (
      <span data-testid="tillstand">{`${loading ? "loading" : "klar"} realtid=${String(realtime)} antal=${data.length}`}</span>
    );
  }

  /** @param {any} source @param {string} collectionName */
  const rita = (source, collectionName) =>
    render(
      <OpsDataProvider source={source}>
        <Vy collectionName={collectionName} />
      </OpsDataProvider>,
    );

  it("rapporterar realtid för den samling som strömmar", async () => {
    const source = createRoutingSource({
      standard: createMemorySource({ stillsamt: [{ id: "b" }] }),
      routes: { strommande: stromkalla("strommande", [{ id: "a" }]) },
    });
    rita(source, "strommande");
    await waitFor(() => expect(screen.getByTestId("tillstand").textContent).toBe("klar realtid=true antal=1"));
  });

  it("faller tillbaka och SÄGER det för den samling som inte strömmar", async () => {
    // ⛔ En app som tror sig ha realtid och inte har det ser exakt likadan ut som
    // en som har det, ända tills någon undrar varför en post inte dök upp.
    const source = createRoutingSource({
      standard: createMemorySource({ stillsamt: [{ id: "b" }, { id: "c" }] }),
      routes: { strommande: stromkalla("strommande", [{ id: "a" }]) },
    });
    rita(source, "stillsamt");
    await waitFor(() => expect(screen.getByTestId("tillstand").textContent).toBe("klar realtid=false antal=2"));
  });
});
