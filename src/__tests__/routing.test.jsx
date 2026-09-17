import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { skapaRoutingKalla } from "../data/routing.js";
import { skapaMinneskalla } from "../data/adaptrar.js";
import { OpsDataProvider, useSamlingLive } from "../data/useData.jsx";

/**
 * ⛔ SAMLINGSNAMNEN ÄR PÅHITTADE. Ramverket får inte kunna bero på den app som
 * adopterar sömmen först, och ett prov som säger `kostnader` eller `inkorg` gör
 * det svårt att se när det börjar.
 */

/**
 * En källa som kan strömma, byggd på minneskällan.
 *
 * ⛔ SAMLINGSNAMNET ÄR ETT ARGUMENT OCH INTE INBAKAT. Första versionen hade
 * `saker` hårdkodat, och provet mot hooken blev rött med `antal=0`: strömmen
 * levererade, men ur en samling som inte var den provet routade. Ett
 * provhjälpmedel som tyst svarar med tomhet mäter ingenting.
 *
 * @param {string} [samling] @param {{ id: string }[]} [rader]
 */
function stromkalla(samling = "saker", rader = []) {
  const bas = skapaMinneskalla({ [samling]: rader });
  const lyssnare = [];
  return {
    ...bas,
    prenumerera: (samling, fraga, l) => {
      lyssnare.push(l);
      bas.lista(samling, fraga).then((r) => l.vidData(r));
      return () => {
        const i = lyssnare.indexOf(l);
        if (i >= 0) lyssnare.splice(i, 1);
      };
    },
    antalLyssnare: () => lyssnare.length,
  };
}

describe("skapaRoutingKalla, uppsättningen", () => {
  it("kräver en standard", () => {
    // ⛔ Utan standard blir en glömd rutt ett fel som dyker upp först den dag
    // någon öppnar just den vyn.
    expect(() => skapaRoutingKalla(/** @type {any} */ ({}))).toThrow(/standard krävs/);
    expect(() => skapaRoutingKalla(/** @type {any} */ (null))).toThrow(/standard krävs/);
  });

  it("avvisar en rutt som inte är en datakälla, vid uppstart", () => {
    // ⛔ Annars ger den `undefined is not a function` först den dag samlingen
    // läses, och felet pekar mot vyn i stället för mot uppsättningen.
    const standard = skapaMinneskalla({});
    expect(() => skapaRoutingKalla({ standard, rutter: { saker: /** @type {any} */ ({}) } })).toThrow(/saknar las/);
    expect(() => skapaRoutingKalla({ standard, rutter: { saker: /** @type {any} */ (null) } })).toThrow(
      /pekar inte på en datakälla/,
    );
  });

  it("nämner samlingen i felet, inte bara att något är fel", () => {
    const standard = skapaMinneskalla({});
    expect(() => skapaRoutingKalla({ standard, rutter: { mittfall: /** @type {any} */ ({ las: () => {} }) } })).toThrow(
      /"mittfall"/,
    );
  });
});

describe("routningen", () => {
  it("skickar en samling till sin rutt och resten till standarden", async () => {
    const ettstalle = skapaMinneskalla({ saker: [{ id: "a", var: "rutt" }] });
    const standard = skapaMinneskalla({ saker: [{ id: "b", var: "standard" }], annat: [{ id: "c" }] });
    const kalla = skapaRoutingKalla({ standard, rutter: { saker: ettstalle } });

    expect((await kalla.lista("saker")).map((r) => r.id)).toEqual(["a"]);
    expect((await kalla.lista("annat")).map((r) => r.id)).toEqual(["c"]);
  });

  it("routar alla fem operationerna, inte bara läsningarna", async () => {
    // ⛔ Ett prov per operation, eftersom en glömd `taBort` i sömmen skriver till
    // FEL DATABAS. Det felet upptäcks när någon saknar en post, alltså långt
    // efteråt och utan spår.
    const mal = skapaMinneskalla({ saker: [{ id: "a", tal: 1 }] });
    const standard = skapaMinneskalla({ saker: [{ id: "z", tal: 99 }] });
    const kalla = skapaRoutingKalla({ standard, rutter: { saker: mal } });

    expect(await kalla.las("saker", "a")).toMatchObject({ id: "a" });
    expect(await kalla.las("saker", "z")).toBeNull();

    const ny = await kalla.skapa("saker", { tal: 2 });
    expect(await mal.las("saker", ny.id)).toMatchObject({ tal: 2 });
    expect(await standard.las("saker", ny.id)).toBeNull();

    await kalla.uppdatera("saker", "a", { tal: 3 });
    expect(await mal.las("saker", "a")).toMatchObject({ tal: 3 });

    await kalla.taBort("saker", "a");
    expect(await mal.las("saker", "a")).toBeNull();
    // Standardens egen post är orörd.
    expect(await standard.las("saker", "z")).toMatchObject({ tal: 99 });
  });

  it("går att inspektera, så uppsättningen kan mätas", () => {
    // ⛔ En routing man inte kan inspektera är en routing man får gissa om, och
    // den gissningen står sedan i ett dokument som ruttnar.
    const mal = skapaMinneskalla({});
    const standard = skapaMinneskalla({});
    const kalla = skapaRoutingKalla({ standard, rutter: { saker: mal } });
    expect(kalla.kallaFor("saker")).toBe(mal);
    expect(kalla.kallaFor("annat")).toBe(standard);
  });
});

describe("realtid per samling", () => {
  it("svarar per samling och inte per källa", () => {
    // ⛔ DET EGENTLIGA PROVET. `typeof kalla.prenumerera === "function"` är ett
    // sant svar om en källa och en lögn om en routande: den kan strömma en
    // samling och inte en annan, alltså har frågan två svar.
    const strommar = stromkalla("strommande", [{ id: "a" }]);
    const stilla = skapaMinneskalla({ stillsamt: [{ id: "b" }] });
    const kalla = skapaRoutingKalla({ standard: stilla, rutter: { strommande: strommar } });

    expect(kalla.kanPrenumerera("strommande")).toBe(true);
    expect(kalla.kanPrenumerera("stillsamt")).toBe(false);
  });

  it("exponerar inte prenumerera när ingen källa kan", () => {
    // ⛔ Annars hade den routande källan påstått en förmåga ingen av dess källor
    // har, och läsaren tagit strömvägen för att sedan kasta.
    const kalla = skapaRoutingKalla({ standard: skapaMinneskalla({}), rutter: { x: skapaMinneskalla({}) } });
    expect(kalla.prenumerera).toBeUndefined();
  });

  it("exponerar prenumerera när minst en källa kan", () => {
    const kalla = skapaRoutingKalla({ standard: skapaMinneskalla({}), rutter: { s: stromkalla() } });
    expect(typeof kalla.prenumerera).toBe("function");
  });

  it("kastar med samlingens namn för en samling som inte kan strömma", () => {
    // ⛔ Alternativet vore en lyssnare som aldrig levererar, alltså en vy som
    // väntar för alltid och ser ut som att ingenting händer i systemet.
    const kalla = skapaRoutingKalla({ standard: skapaMinneskalla({}), rutter: { s: stromkalla() } });
    expect(() =>
      /** @type {any} */ (kalla).prenumerera("stillsamt", undefined, { vidData: () => {}, vidFel: () => {} }),
    ).toThrow(/"stillsamt"/);
    expect(() =>
      /** @type {any} */ (kalla).prenumerera("stillsamt", undefined, { vidData: () => {}, vidFel: () => {} }),
    ).toThrow(/kanPrenumerera/);
  });

  it("strömmar den samling som kan", async () => {
    const strommar = stromkalla("s", [{ id: "a" }]);
    const kalla = skapaRoutingKalla({ standard: skapaMinneskalla({}), rutter: { s: strommar } });
    const mottaget = [];
    const avsluta = /** @type {any} */ (kalla).prenumerera("s", undefined, {
      vidData: (r) => mottaget.push(r),
      vidFel: () => {},
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
 * Utan det här provet vore påståendet "useSamlingLive faller tillbaka ärligt"
 * obevisat, och det är hela skälet att `kanPrenumerera` finns. Mätt: tas raden i
 * useData.jsx bort blir det här provet rött, medan alla ovan förblir gröna.
 */
describe("useSamlingLive mot en routande källa", () => {
  /** @param {{ samling: string }} props */
  function Vy({ samling }) {
    const { data, laddar, realtid } = useSamlingLive(samling);
    return (
      <span data-testid="tillstand">{`${laddar ? "laddar" : "klar"} realtid=${String(realtid)} antal=${data.length}`}</span>
    );
  }

  /** @param {any} kalla @param {string} samling */
  const rita = (kalla, samling) =>
    render(
      <OpsDataProvider kalla={kalla}>
        <Vy samling={samling} />
      </OpsDataProvider>,
    );

  it("rapporterar realtid för den samling som strömmar", async () => {
    const kalla = skapaRoutingKalla({
      standard: skapaMinneskalla({ stillsamt: [{ id: "b" }] }),
      rutter: { strommande: stromkalla("strommande", [{ id: "a" }]) },
    });
    rita(kalla, "strommande");
    await waitFor(() => expect(screen.getByTestId("tillstand").textContent).toBe("klar realtid=true antal=1"));
  });

  it("faller tillbaka och SÄGER det för den samling som inte strömmar", async () => {
    // ⛔ En app som tror sig ha realtid och inte har det ser exakt likadan ut som
    // en som har det, ända tills någon undrar varför en post inte dök upp.
    const kalla = skapaRoutingKalla({
      standard: skapaMinneskalla({ stillsamt: [{ id: "b" }, { id: "c" }] }),
      rutter: { strommande: stromkalla("strommande", [{ id: "a" }]) },
    });
    rita(kalla, "stillsamt");
    await waitFor(() => expect(screen.getByTestId("tillstand").textContent).toBe("klar realtid=false antal=2"));
  });
});
