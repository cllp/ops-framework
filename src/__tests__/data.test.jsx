import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { skapaDatakalla, tillampaFraga } from "../data/kontrakt.js";
import { skapaJsonKalla, skapaMinneskalla } from "../data/adaptrar.js";
import { OpsDataProvider, useSamling } from "../data/useData.jsx";

describe("datakontraktet", () => {
  // ⛔ En halv adapter kraschar annars först den dag någon anropar just den
  // metoden, och felet pekar då mot anropsstället i stället för mot adaptern.
  it("vägrar en adapter som saknar en operation", () => {
    expect(() => skapaDatakalla({ namn: "halv", las: async () => null })).toThrow(/saknar lista, skapa, uppdatera, taBort/);
  });

  it("vägrar något som inte är en adapter alls", () => {
    expect(() => skapaDatakalla(/** @type {any} */ (null))).toThrow(/adapter krävs/);
  });
});

describe("frågor", () => {
  const rader = [
    { id: "1", namn: "Telia", belopp: 449, status: "oppen" },
    { id: "2", namn: "Fortnox", belopp: 399, status: "stangd" },
    { id: "3", namn: "Ahlsell", belopp: 1200, status: "oppen" },
  ];

  it("filtrerar, sorterar och begränsar", () => {
    const ut = tillampaFraga(rader, { dar: { status: "oppen" }, sortera: "belopp", riktning: "ner" });
    expect(ut.map((r) => r.id)).toEqual(["3", "1"]);
    expect(tillampaFraga(rader, { antal: 2 })).toHaveLength(2);
  });

  // ⛔ Array.sort muterar. En adapter som sorterade om sin egen lagring hade
  // tyst ändrat ordningen för nästa läsare.
  it("muterar inte listan den fick", () => {
    const original = [...rader];
    tillampaFraga(rader, { sortera: "namn" });
    expect(rader).toEqual(original);
  });
});

describe("minneskällan", () => {
  // ⛔ Kontraktet får inte avslöja att just den här källan är snabb. Ett
  // synkront API hade tvingat fram en omskrivning av varje anropsställe den dag
  // källan blev ett nätverksanrop.
  it("är asynkron även om inget väntar", () => {
    const kalla = skapaMinneskalla();
    expect(kalla.lista("x")).toBeInstanceOf(Promise);
  });

  it("skapar med id, läser tillbaka och uppdaterar", async () => {
    const kalla = skapaMinneskalla();
    const post = await kalla.skapa("kostnader", { namn: "Telia", belopp: 449 });
    expect(post.id).toBeTruthy();

    expect(await kalla.las("kostnader", post.id)).toMatchObject({ namn: "Telia" });

    const uppdaterad = await kalla.uppdatera("kostnader", post.id, { belopp: 500 });
    expect(uppdaterad).toMatchObject({ id: post.id, namn: "Telia", belopp: 500 });
  });

  // ⛔ "Finns inte" är inte ett fel. Skillnaden mot "kunde inte fråga" måste gå
  // att hantera olika, annars går den inte att hantera alls.
  it("ger null för en post som inte finns, inte ett fel", async () => {
    const kalla = skapaMinneskalla();
    await expect(kalla.las("kostnader", "saknas")).resolves.toBeNull();
  });

  it("kastar när något uppdateras som inte finns, i stället för att skapa det tyst", async () => {
    const kalla = skapaMinneskalla();
    await expect(kalla.uppdatera("kostnader", "saknas", { belopp: 1 })).rejects.toThrow(/finns inte/);
  });

  it("lämnar inte ut sin interna lagring", async () => {
    const kalla = skapaMinneskalla({ kostnader: [{ id: "1", belopp: 100 }] });
    const rader = await kalla.lista("kostnader");
    rader[0].belopp = 999;
    expect((await kalla.lista("kostnader"))[0].belopp).toBe(100);
  });
});

describe("json-källan", () => {
  /** @param {any} data @param {number} status */
  const svar = (data, status = 200) =>
    vi.fn(async () => /** @type {any} */ ({ ok: status >= 200 && status < 300, status, json: async () => data }));

  it("läser en samling ur en fil", async () => {
    const hamta = svar([{ id: "1", namn: "Telia" }]);
    const kalla = skapaJsonKalla({ bas: "/assets/data", hamta });
    expect(await kalla.lista("kostnader")).toHaveLength(1);
    expect(hamta).toHaveBeenCalledWith("/assets/data/kostnader.json");
  });

  // ⛔ fetch kastar INTE på 404 eller 500. Utan kontrollen blir ett serverfel en
  // tom lista, och appen visar "inga träffar" när sanningen är att den inte
  // kunde fråga.
  it("gör ett serverfel till ett fel, inte till en tom lista", async () => {
    const kalla = skapaJsonKalla({ bas: "/d", hamta: svar(null, 500) });
    await expect(kalla.lista("kostnader")).rejects.toThrow(/svarade 500/);
  });

  it("vägrar en fil som inte innehåller en lista", async () => {
    const kalla = skapaJsonKalla({ bas: "/d", hamta: svar({ inte: "en lista" }) });
    await expect(kalla.lista("kostnader")).rejects.toThrow(/inte en lista/);
  });

  // ⛔ En skrivning som ser ut att lyckas men försvinner vid omladdning är värre
  // än ett tydligt nej.
  it("nekar skrivningar i stället för att låtsas", async () => {
    const kalla = skapaJsonKalla({ bas: "/d", hamta: svar([]) });
    await expect(kalla.skapa("kostnader", {})).rejects.toThrow(/Byt datakälla/);
  });
});

describe("useSamling", () => {
  /** @param {{ samling?: string }} props */
  function Prov({ samling = "kostnader" }) {
    const { data, laddar, fel } = useSamling(samling);
    if (laddar) return <p>laddar</p>;
    if (fel) return <p>fel: {fel.message}</p>;
    return <p>rader: {data.length}</p>;
  }

  it("visar laddar först och data sedan", async () => {
    const kalla = skapaMinneskalla({ kostnader: [{ id: "1" }, { id: "2" }] });
    render(
      <OpsDataProvider kalla={kalla}>
        <Prov />
      </OpsDataProvider>,
    );
    expect(screen.getByText("laddar")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("rader: 2")).toBeInTheDocument());
  });

  // ⛔ Ett fel får aldrig se ut som tomhet. Att visa "0 rader" när servern
  // svarade 500 får användaren att dra en slutsats om sin data som inte stämmer.
  it("skiljer ett fel från en tom lista", async () => {
    const trasig = skapaJsonKalla({ bas: "/d", hamta: vi.fn(async () => /** @type {any} */ ({ ok: false, status: 500 })) });
    render(
      <OpsDataProvider kalla={trasig}>
        <Prov />
      </OpsDataProvider>,
    );
    await waitFor(() => expect(screen.getByText(/fel: .*svarade 500/)).toBeInTheDocument());
    expect(screen.queryByText("rader: 0")).not.toBeInTheDocument();
  });

  it("kräver en provider i stället för att tyst ge noll rader", () => {
    const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Prov />)).toThrow(/ingen OpsDataProvider/);
    } finally {
      tyst.mockRestore();
    }
  });
});
