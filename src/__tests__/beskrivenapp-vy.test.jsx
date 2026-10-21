import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OpsBeskrivenApp } from "../components/OpsBeskrivenApp.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBeskrivenAppKalla } from "../data/beskrivenappkalla.js";
import { MAX_LANKVARDE, MAX_TEXTVARDE } from "../lib/beskrivenapp.js";
import { MAX_SKAPARNAMN } from "../lib/skapare.js";

/**
 * Den beskrivna appens vy. jsdom mäter att rätt text och rätt kontroller finns och att ett tryck gör rätt sak i källan.
 * Hur det ser ut mäts i montaget, med Playwright.
 */

const utlaning = () => ({
  format: 1,
  id: "utlaning",
  namn: "Utlåning",
  ikon: "book",
  beskrivning: "Vad som är utlånat och till vem.",
  listor: [
    {
      id: "saker",
      namn: "Saker",
      falt: [
        { id: "namn", namn: "Sak", typ: "text", krav: true },
        { id: "lanad-av", namn: "Lånad av", typ: "person" },
        { id: "tillbaka", namn: "Återlämnas", typ: "datum" },
        { id: "skick", namn: "Skick", typ: "val", val: ["Bra", "Sliten", "Trasig"] },
      ],
      rubrikfalt: "namn",
    },
    {
      id: "personer",
      namn: "Personer",
      falt: [
        { id: "namn", namn: "Namn", typ: "text", krav: true },
        { id: "antal", namn: "Antal lån", typ: "tal" },
        { id: "aktiv", namn: "Aktiv", typ: "janej" },
      ],
      rubrikfalt: "namn",
      visning: "tabell",
    },
  ],
});

const skapare = (uid = "uid-1", namn = "Kim") => () => ({ uid, namn, typ: "manniska", kalla: "appar" });
const MEDLEMMAR = [
  { userId: "uid-1", namn: "Kim", typ: "person", status: "aktiv" },
  { userId: "uid-2", namn: "Alex", typ: "person", status: "aktiv" },
  { userId: "uid-3", namn: "Gammal", typ: "person", status: "avslutad" },
  { userId: "agent-1", namn: "Agenten", typ: "agent", status: "aktiv" },
];
const MIG = { uid: "uid-1", roll: "medlem" };
const rad = (extra = {}) => ({ groupId: "cps-ab", appId: "utlaning", lista: "saker", varden: { namn: "Borr" }, skapadAv: { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "appar" }, skapad: 10, andrad: 10, ...extra });

/**
 * @param {{ seed?: any[], jag?: any, besk?: any, source?: any, sprak?: any, hubHref?: string, medlemmar?: any[], som?: () => any }} [o]
 */
function montera(o = {}) {
  const source = o.source ?? createMemorySource({ appdata: o.seed ?? [] });
  const kalla = createBeskrivenAppKalla({ source, collection: "appdata", groupId: "cps-ab", beskrivning: o.besk ?? utlaning(), skapare: o.som ?? skapare() });
  const ui = (
    <OpsBeskrivenApp beskrivning={o.besk ?? utlaning()} kalla={kalla} jag={o.jag === undefined ? MIG : o.jag} medlemmar={o.medlemmar ?? MEDLEMMAR} sprak={o.sprak} hubHref={o.hubHref} />
  );
  const user = userEvent.setup();
  render(ui);
  return { source, kalla, user };
}

/** Fyller textfältet med en etikett. */
async function skriv(user, etikett, text) {
  const falt = screen.getByLabelText(etikett);
  await user.clear(falt);
  if (text) await user.type(falt, text);
}

describe("OpsBeskrivenApp: en tom app", () => {
  it("visar en flik per lista med antal, och varje lista säger att den är tom", async () => {
    montera();
    await screen.findByText("Saker är tom.");
    expect(screen.getByRole("tab", { name: /Saker/ })).toHaveTextContent("0");
    expect(screen.getByRole("tab", { name: /Personer/ })).toBeInTheDocument();
    expect(screen.getByText("Tryck på Ny för att lägga till den första raden.")).toBeInTheDocument();
    expect(screen.getByText("Vad som är utlånat och till vem.")).toBeInTheDocument();
    // Den andra listan har sin egen text, med sitt eget namn.
    await userEvent.setup().click(screen.getByRole("tab", { name: /Personer/ }));
    expect(await screen.findByText("Personer är tom.")).toBeInTheDocument();
  });

  it("en app med en enda lista har ingen flikrad", async () => {
    const besk = utlaning();
    besk.listor = [besk.listor[0]];
    montera({ besk });
    await screen.findByText("Saker är tom.");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("en läsning som misslyckas visas som ett fel och inte som en tom lista", async () => {
    const source = { list: async () => { throw new Error("Databasen svarade inte"); }, read: async () => null, create: async () => ({ id: "x" }), update: async () => {}, remove: async () => {} };
    montera({ source });
    const fel = await screen.findByRole("alert");
    expect(fel).toHaveTextContent("Raderna gick inte att läsa: Databasen svarade inte");
    expect(screen.queryByText("Saker är tom.")).toBeNull();
  });

  it("en trasig rad räknas och förklaras, och släcker inte de andra", async () => {
    montera({ seed: [{ id: "bra", ...rad() }, { id: "skev", ...rad({ lista: "borta" }) }] });
    await screen.findByText("Borr");
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("1 rad kunde inte läsas och visas inte.");
    expect(status).toHaveTextContent("skev:");
  });
});

describe("OpsBeskrivenApp: skapa", () => {
  it("Ny öppnar ett formulär ur fältens typ, och Spara skapar raden i källan med rätt skapare", async () => {
    const { source, user } = montera();
    await screen.findByText("Saker är tom.");
    await user.click(screen.getByRole("button", { name: "Ny rad i Saker" }));
    expect(screen.getByRole("heading", { name: "Ny rad" })).toBeInTheDocument();
    // Ett fält per fält i beskrivningen, med sin etikett.
    expect(screen.getByLabelText(/Sak/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Lånad av" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tillbaka" })).toBeInTheDocument();
    // Radix lägger en dold <select aria-hidden> i ett <form> för formulärsändning. Den syns inte och går inte att nå. En synlig finns aldrig.
    expect(document.querySelector("select:not([aria-hidden='true'])")).toBeNull();
    await skriv(user, /Sak/, "Borrmaskin");
    await user.click(screen.getByRole("combobox", { name: "Skick" }));
    await user.click(screen.getByRole("option", { name: "Sliten" }));
    await user.click(screen.getByRole("combobox", { name: "Lånad av" }));
    // Bara aktiva personer väljs: inte en avslutad medlem och inte agenten.
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Ingen", "Kim", "Alex"]);
    await user.click(screen.getByRole("option", { name: "Alex" }));
    await user.click(screen.getByRole("button", { name: "Spara" }));

    // Tillbaka i listan, med raden.
    const radknapp = await screen.findByRole("button", { name: "Borrmaskin" });
    expect(radknapp).toHaveTextContent("Lånad av: Alex · Skick: Sliten");
    const lagrade = await source.list("appdata", {});
    expect(lagrade).toHaveLength(1);
    expect(lagrade[0]).toMatchObject({
      groupId: "cps-ab",
      appId: "utlaning",
      lista: "saker",
      varden: { namn: "Borrmaskin", skick: "Sliten", "lanad-av": "uid-2" },
      skapadAv: { uid: "uid-1", namn: "Kim", typ: "manniska" },
    });
    expect(screen.getByRole("tab", { name: /Saker/ })).toHaveTextContent("1");
  });

  it("ett krävt fält som saknas visas på fältet och sparar ingenting", async () => {
    const { source, user } = montera();
    await screen.findByText("Saker är tom.");
    await user.click(screen.getByRole("button", { name: "Ny rad i Saker" }));
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(await screen.findByText("krävs.")).toBeInTheDocument();
    expect(screen.getByText("Rätta fälten som är markerade.")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText(/Sak/)).toBeInvalid();
    expect(await source.list("appdata", {})).toHaveLength(0);
    // Fältet rättas och sparas.
    await skriv(user, /Sak/, "Hammare");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await screen.findByRole("button", { name: "Hammare" });
    expect(await source.list("appdata", {})).toHaveLength(1);
  });

  it("ett sparande som misslyckas visas i formuläret, tyst aldrig, och det personen skrivit står kvar", async () => {
    const intern = createMemorySource();
    const source = {
      list: (...a) => intern.list(...a),
      read: (...a) => intern.read(...a),
      update: (...a) => intern.update(...a),
      remove: (...a) => intern.remove(...a),
      create: async () => {
        throw new Error("Nätet låg nere");
      },
    };
    const { user } = montera({ source });
    await screen.findByText("Saker är tom.");
    await user.click(screen.getByRole("button", { name: "Ny rad i Saker" }));
    await skriv(user, /Sak/, "Borrmaskin");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    expect(await screen.findByText("Nätet låg nere")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Nätet låg nere");
    expect(screen.getByLabelText(/Sak/)).toHaveValue("Borrmaskin");
    // Knappen går att trycka igen: en spärr som fastnat hade gjort felet permanent.
    expect(screen.getByRole("button", { name: "Spara" })).not.toBeDisabled();
  });

  it("Tillbaka lämnar formuläret utan att spara", async () => {
    const { source, user } = montera();
    await screen.findByText("Saker är tom.");
    await user.click(screen.getByRole("button", { name: "Ny rad i Saker" }));
    await skriv(user, /Sak/, "Borrmaskin");
    await user.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(await screen.findByText("Saker är tom.")).toBeInTheDocument();
    expect(await source.list("appdata", {})).toHaveLength(0);
  });
});

describe("OpsBeskrivenApp: öppna, ändra och ta bort", () => {
  it("ett tryck på raden öppnar den med sina värden, och Spara ändrar den", async () => {
    const { source, user } = montera({ seed: [{ id: "r1", ...rad({ varden: { namn: "Borr", skick: "Bra" } }) }] });
    await user.click(await screen.findByRole("button", { name: "Borr" }));
    expect(screen.getByRole("heading", { name: "Borr" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Sak/)).toHaveValue("Borr");
    expect(screen.getByRole("combobox", { name: "Skick" })).toHaveTextContent("Bra");
    await skriv(user, /Sak/, "Borrmaskin");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await screen.findByRole("button", { name: "Borrmaskin" });
    expect((await source.read("appdata", "r1")).varden).toEqual({ namn: "Borrmaskin", skick: "Bra" });
    expect((await source.read("appdata", "r1")).skapadAv.uid).toBe("uid-1");
  });

  it("Ta bort frågar först, Avbryt behåller raden och Ta bort i frågan tar bort den", async () => {
    const { source, user } = montera({ seed: [{ id: "r1", ...rad() }] });
    await user.click(await screen.findByRole("button", { name: "Borr" }));
    await user.click(screen.getByRole("button", { name: "Ta bort" }));
    const ruta = await screen.findByRole("dialog");
    expect(ruta).toHaveTextContent('Ta bort "Borr"? Det går inte att ångra.');
    expect(await source.list("appdata", {})).toHaveLength(1);
    await user.click(within(ruta).getByRole("button", { name: "Avbryt" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await source.list("appdata", {})).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Ta bort" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ta bort" }));
    expect(await screen.findByText("Saker är tom.")).toBeInTheDocument();
    expect(await source.list("appdata", {})).toHaveLength(0);
  });

  it("ett borttagning som misslyckas visas i frågan och raden är kvar", async () => {
    const intern = createMemorySource({ appdata: [{ id: "r1", ...rad() }] });
    const source = {
      list: (...a) => intern.list(...a),
      read: (...a) => intern.read(...a),
      create: (...a) => intern.create(...a),
      update: (...a) => intern.update(...a),
      remove: async () => {
        throw new Error("Behörighet saknas");
      },
    };
    const { user } = montera({ source });
    await user.click(await screen.findByRole("button", { name: "Borr" }));
    await user.click(screen.getByRole("button", { name: "Ta bort" }));
    const ruta = await screen.findByRole("dialog");
    await user.click(within(ruta).getByRole("button", { name: "Ta bort" }));
    expect(await within(ruta).findByRole("alert")).toHaveTextContent("Behörighet saknas");
    expect(await intern.list("appdata", {})).toHaveLength(1);
  });

  it("någon annans rad öppnas låst: inga Spara och inga Ta bort, bara Stäng", async () => {
    const annans = { id: "r2", ...rad({ varden: { namn: "Hammare" }, skapadAv: { uid: "uid-2", namn: "Alex", typ: "manniska", kalla: "appar" } }) };
    const { user } = montera({ seed: [annans] });
    await user.click(await screen.findByRole("button", { name: "Hammare" }));
    expect(screen.getByLabelText(/Sak/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ta bort" })).toBeNull();
    expect(screen.getByText(/Du kan läsa raden men inte ändra den/)).toBeInTheDocument();
    expect(screen.getByText(/Skapad av Alex\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Stäng" }));
    expect(await screen.findByRole("button", { name: "Hammare" })).toBeInTheDocument();
  });

  it("⛔ en rad som en personlig API-nyckel skrev heter 'Skapad av Alex via Byggagent.' (0.135.0, lifehub.app#409), och en rad för hand 'Skapad av Alex.'", async () => {
    const viaNyckel = { id: "r2", ...rad({ varden: { namn: "Hammare" }, skapadAv: { uid: "uid-2", namn: "Alex", typ: "manniska", kalla: "api", via: { nyckelId: "0123456789abcdef", namn: "Byggagent" } } }) };
    const { user } = montera({ seed: [viaNyckel] });
    await user.click(await screen.findByRole("button", { name: "Hammare" }));
    expect(screen.getByText(/Skapad av Alex via Byggagent\./)).toBeInTheDocument();
  });

  it("en admin och ägare ändrar och tar bort någon annans rad, samma villkor som regeln", async () => {
    const annans = { id: "r2", ...rad({ varden: { namn: "Hammare" }, skapadAv: { uid: "uid-2", namn: "Alex", typ: "manniska", kalla: "appar" } }) };
    for (const roll of ["admin", "agare"]) {
      const { user } = montera({ seed: [annans], jag: { uid: "uid-9", roll }, som: skapare("uid-9", "Pat") });
      await user.click(await screen.findByRole("button", { name: "Hammare" }));
      expect(screen.getByRole("button", { name: "Spara" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ta bort" })).toBeInTheDocument();
      cleanup();
    }
  });
});

describe("OpsBeskrivenApp: den som inte är medlem", () => {
  it("jag null: ingen Ny-knapp och raderna går bara att läsa", async () => {
    const { user } = montera({ seed: [{ id: "r1", ...rad() }], jag: null });
    expect(screen.queryByRole("button", { name: /Ny rad i/ })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Borr" }));
    expect(screen.queryByRole("button", { name: "Spara" })).toBeNull();
    expect(screen.getByLabelText(/Sak/)).toBeDisabled();
  });

  it("en tom lista utan Ny säger att det inte finns något att visa, inte att man ska trycka på Ny", async () => {
    montera({ jag: null });
    expect(await screen.findByText("Det finns inga rader att visa.")).toBeInTheDocument();
    expect(screen.queryByText(/Tryck på Ny/)).toBeNull();
  });
});

describe("OpsBeskrivenApp: sök", () => {
  const seed = [
    { id: "a", ...rad({ varden: { namn: "Borrmaskin", skick: "Bra" }, andrad: 30 }) },
    { id: "b", ...rad({ varden: { namn: "Hammare", skick: "Trasig" }, andrad: 20 }) },
    { id: "c", ...rad({ varden: { namn: "Såg", "lanad-av": "uid-2" }, andrad: 10 }) },
  ];

  it("filtrerar på alla fältens visade värden, utan hänsyn till versaler", async () => {
    const { user } = montera({ seed });
    await screen.findByRole("button", { name: "Borrmaskin" });
    const sok = screen.getByRole("searchbox", { name: "Sök: Saker" });
    await user.type(sok, "HAMM");
    expect(screen.queryByRole("button", { name: "Borrmaskin" })).toBeNull();
    expect(screen.getByRole("button", { name: "Hammare" })).toBeInTheDocument();
    // Sökning på ett fält som inte är rubriken, och på en person med namn och inte id.
    await user.clear(sok);
    await user.type(sok, "trasig");
    expect(screen.getByRole("button", { name: "Hammare" })).toBeInTheDocument();
    await user.clear(sok);
    await user.type(sok, "alex");
    expect(screen.getByRole("button", { name: "Såg" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hammare" })).toBeNull();
  });

  it("ingen träff säger det, med sökordet", async () => {
    const { user } = montera({ seed });
    await screen.findByRole("button", { name: "Borrmaskin" });
    await user.type(screen.getByRole("searchbox", { name: "Sök: Saker" }), "xyz");
    expect(screen.getByText("Inga träffar.")).toBeInTheDocument();
    expect(screen.getByText('Inget matchar "xyz".')).toBeInTheDocument();
  });

  it("raderna står nyast ändrad först", async () => {
    montera({ seed });
    await screen.findByRole("button", { name: "Borrmaskin" });
    const lista = screen.getByRole("list", { name: "Saker" });
    expect(within(lista).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Borrmaskin", "Hammare", "Såg"]);
  });
});

describe("OpsBeskrivenApp: tabell", () => {
  const seed = [{ id: "p1", ...rad({ lista: "personer", varden: { namn: "Kim", antal: 1234.5, aktiv: true } }) }];

  it("visning tabell ritar en tabell med rubrikfältet först och värden som text", async () => {
    const { user } = montera({ seed });
    await user.click(await screen.findByRole("tab", { name: /Personer/ }));
    const tabell = await screen.findByRole("table", { name: "Personer" });
    const huvud = within(tabell).getAllByRole("columnheader").map((h) => h.textContent);
    expect(huvud).toEqual(["Namn", "Antal lån", "Aktiv"]);
    const celler = within(tabell).getAllByRole("cell").map((c) => c.textContent);
    expect(celler[0]).toBe("Kim");
    expect(celler[1].replace(/\s/g, " ")).toBe("1 234,5");
    expect(celler[2]).toBe("Ja");
  });

  it("rubrikcellen öppnar raden, som ett formulär ur fältens typ: tal, ja/nej", async () => {
    const { source, user } = montera({ seed });
    await user.click(await screen.findByRole("tab", { name: /Personer/ }));
    await user.click(await screen.findByRole("button", { name: "Kim" }));
    expect(screen.getByLabelText(/Antal lån/)).toHaveValue(1234.5);
    expect(screen.getByRole("switch", { name: "Aktiv" })).toBeChecked();
    await user.click(screen.getByRole("switch", { name: "Aktiv" }));
    await skriv(user, /Antal lån/, "7");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await screen.findByRole("table", { name: "Personer" });
    expect((await source.read("appdata", "p1")).varden).toEqual({ namn: "Kim", antal: 7, aktiv: false });
  });

  it("ett tömt talfält sparas utan värde", async () => {
    const { source, user } = montera({ seed });
    await user.click(await screen.findByRole("tab", { name: /Personer/ }));
    await user.click(await screen.findByRole("button", { name: "Kim" }));
    // En <input type="number"> släpper inte in text, så ett tal som inte går att läsa kommer som en tom sträng. Fältet töms och
    // är frivilligt: det sparas utan värde. Prövningen av en text i ett talfält ligger i validateRad (beskrivenapp.test.js).
    await skriv(user, /Antal lån/, "");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await screen.findByRole("table", { name: "Personer" });
    expect((await source.read("appdata", "p1")).varden).toEqual({ namn: "Kim", aktiv: true });
  });
});

describe("OpsBeskrivenApp: datum och person", () => {
  it("ett sparat datum visas som datum och en person med namn, och en som lämnat gruppen som Okänd medlem", async () => {
    montera({
      seed: [
        { id: "a", ...rad({ varden: { namn: "Borr", tillbaka: "2026-10-20", "lanad-av": "uid-2" } }) },
        { id: "b", ...rad({ varden: { namn: "Såg", "lanad-av": "uid-borta" } }) },
      ],
    });
    const a = await screen.findByRole("button", { name: "Borr" });
    expect(a).toHaveTextContent("Lånad av: Alex");
    expect(a).toHaveTextContent("Återlämnas: 2026-10-20");
    const b = screen.getByRole("button", { name: "Såg" });
    expect(b).toHaveTextContent("Lånad av: Okänd medlem");
    expect(b).not.toHaveTextContent("uid-borta");
  });

  it("datumet väljs i ramverkets kalender och sparas som ÅÅÅÅ-MM-DD", async () => {
    const { source, user } = montera({ seed: [{ id: "a", ...rad({ varden: { namn: "Borr", tillbaka: "2026-10-12" } }) }] });
    await user.click(await screen.findByRole("button", { name: "Borr" }));
    const knapp = screen.getByRole("button", { name: /Återlämnas/ });
    expect(knapp).toHaveTextContent("2026-10-12");
    await user.click(knapp);
    await user.click(screen.getByRole("button", { name: /20 oktober 2026|October 20th, 2026|Tuesday, October 20/ }));
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await screen.findByRole("button", { name: "Borr" });
    expect((await source.read("appdata", "a")).varden.tillbaka).toBe("2026-10-20");
  });
});

describe("OpsBeskrivenApp: en beskrivning är text och inget annat", () => {
  it("namn, alternativ och värden med HTML skrivs som text, och en länk blir aldrig en länk", async () => {
    const besk = utlaning();
    besk.listor[0].falt.push({ id: "lank", namn: "Sida", typ: "lank" });
    besk.listor[0].falt[0].namn = "<img src=x onerror=alert(1)>";
    besk.listor[0].falt[3].val = ["<b>Bra</b>", "Sliten"];
    const { source } = montera({
      besk,
      seed: [{ id: "a", ...rad({ varden: { namn: "<script>alert(1)</script>", lank: "https://example.com/x", skick: "<b>Bra</b>" } }) }],
    });
    const radknapp = await screen.findByRole("button", { name: "<script>alert(1)</script>" });
    expect(radknapp).toHaveTextContent("Sida: https://example.com/x");
    expect(radknapp).toHaveTextContent("Skick: <b>Bra</b>");
    expect(document.querySelector("script, img[onerror], b")).toBeNull();
    expect(document.querySelector("a[href^='https://example.com']")).toBeNull();
    expect(source).toBeDefined();
  });

  it("en beskrivning som inte håller ritas inte: felen visas, vyn kastar inte", () => {
    const kalla = createBeskrivenAppKalla({ source: createMemorySource(), collection: "appdata", groupId: "cps-ab", beskrivning: utlaning(), skapare: skapare() });
    const dalig = { ...utlaning(), ikon: "bokhylla", listor: [{ id: "x", namn: "X", falt: [], rubrikfalt: "namn" }] };
    render(<OpsBeskrivenApp beskrivning={dalig} kalla={kalla} jag={MIG} medlemmar={MEDLEMMAR} />);
    expect(screen.getByText("Appen går inte att visa.")).toBeInTheDocument();
    expect(screen.getByText(/ikon: okänd ikon "bokhylla"/)).toBeInTheDocument();
    expect(screen.getByText(/listor\[0\]\.id: "x" är inget giltigt id/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ny rad/ })).toBeNull();
  });
});

describe("OpsBeskrivenApp: ramen och språket", () => {
  it("hubHref ger en tillbaka-rad med appens namn, och utan hubHref finns ingen", async () => {
    montera({ hubHref: "/hub" });
    await screen.findByText("Saker är tom.");
    expect(screen.getByRole("link", { name: /Tillbaka/ })).toHaveAttribute("href", "/hub");
    expect(screen.getByRole("heading", { name: "Utlåning" })).toBeInTheDocument();
  });

  it("utan hubHref finns ingen tillbaka-rad", async () => {
    montera();
    await screen.findByText("Saker är tom.");
    expect(screen.queryByRole("link", { name: /Tillbaka/ })).toBeNull();
  });

  it("engelska ger vyns egna ord på engelska, och beskrivningens ord som de är", async () => {
    const { user } = montera({ sprak: "en" });
    await screen.findByText("Saker is empty.");
    expect(screen.getByText("Press New to add the first row.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New row in Saker" }));
    expect(screen.getByRole("heading", { name: "New row" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("språket kan komma ur appens OpsSprakProvider", async () => {
    const source = createMemorySource();
    const kalla = createBeskrivenAppKalla({ source, collection: "appdata", groupId: "cps-ab", beskrivning: utlaning(), skapare: skapare() });
    render(
      <OpsSprakProvider sprak="en">
        <OpsBeskrivenApp beskrivning={utlaning()} kalla={kalla} jag={MIG} medlemmar={MEDLEMMAR} />
      </OpsSprakProvider>,
    );
    expect(await screen.findByText("Saker is empty.")).toBeInTheDocument();
  });
});

describe("OpsBeskrivenApp: propsen som krävs", () => {
  const kalla = () => createBeskrivenAppKalla({ source: createMemorySource(), collection: "appdata", groupId: "cps-ab", beskrivning: utlaning(), skapare: skapare() });

  it("jag, kalla och medlemmar krävs, och null för jag är ett svar", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsBeskrivenApp beskrivning={utlaning()} kalla={kalla()} medlemmar={[]} jag={undefined} />)).toThrow(/jag krävs/);
    expect(() => render(<OpsBeskrivenApp beskrivning={utlaning()} kalla={undefined} medlemmar={[]} jag={MIG} />)).toThrow(/kalla krävs/);
    expect(() => render(<OpsBeskrivenApp beskrivning={utlaning()} kalla={kalla()} medlemmar={undefined} jag={MIG} />)).toThrow(/medlemmar krävs/);
    spy.mockRestore();
    render(<OpsBeskrivenApp beskrivning={utlaning()} kalla={kalla()} medlemmar={[]} jag={null} />);
    expect(await screen.findByText("Saker är tom.")).toBeInTheDocument();
  });

  it("ram kräver activeHref och modul", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OpsBeskrivenApp beskrivning={utlaning()} kalla={kalla()} medlemmar={[]} jag={MIG} ram={{ farAndra: true }} />)).toThrow(/ram kräver activeHref och modul/);
    expect(() => render(<OpsBeskrivenApp beskrivning={utlaning()} kalla={kalla()} medlemmar={[]} jag={MIG} ram={{}} />)).toThrow(/ram.farAndra krävs/);
    spy.mockRestore();
  });
});

describe("OpsBeskrivenApp: ett fält-id får aldrig läsa ur prototypen", () => {
  // `constructor` är ett giltigt id (små bokstäver) och en nyckel på varje objekt. Läses `rad.varden["constructor"]` rakt av
  // är värdet för en rad som saknar fältet funktionen `Object`, och vyn skrev "function Object() { [native code] }" i listan,
  // fyllde formuläret med den och sparade den. Mätt av granskningen av 0.99.0.
  const medKonstruktor = () => {
    const besk = utlaning();
    besk.listor[0].falt.push({ id: "constructor", namn: "Konstruktör", typ: "text" });
    return besk;
  };

  it("en rad som saknar fältet visar ingenting för det, i listan och i sökningen", async () => {
    const { user } = montera({ besk: medKonstruktor(), seed: [{ id: "a", ...rad({ varden: { namn: "Borr" } }) }] });
    const radknapp = await screen.findByRole("button", { name: "Borr" });
    expect(radknapp.textContent).not.toMatch(/function|native code|Konstruktör/);
    await user.type(screen.getByRole("searchbox", { name: "Sök: Saker" }), "native");
    expect(screen.getByText("Inga träffar.")).toBeInTheDocument();
  });

  it("formuläret startar med ett tomt fält och sparar inte funktionens text", async () => {
    const { source, user } = montera({ besk: medKonstruktor(), seed: [{ id: "a", ...rad({ varden: { namn: "Borr" } }) }] });
    await user.click(await screen.findByRole("button", { name: "Borr" }));
    expect(screen.getByLabelText(/Konstruktör/)).toHaveValue("");
    // Inget fältfel heller: `faltfel["constructor"]` på ett tomt objekt är samma funktion.
    expect(screen.queryByText(/function|native code/)).toBeNull();
    await skriv(user, /Sak/, "Borrmaskin");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await screen.findByRole("button", { name: "Borrmaskin" });
    expect((await source.read("appdata", "a")).varden).toEqual({ namn: "Borrmaskin" });
  });

  it("ett fält som faktiskt heter constructor och har ett värde visas, fylls i och sparas som vilket annat fält som helst", async () => {
    const varden = { namn: "Borr", constructor: "Bosch" };
    const { source, user } = montera({ besk: medKonstruktor(), seed: [{ id: "a", ...rad({ varden }) }] });
    const radknapp = await screen.findByRole("button", { name: "Borr" });
    expect(radknapp).toHaveTextContent("Konstruktör: Bosch");
    await user.click(radknapp);
    expect(screen.getByLabelText(/Konstruktör/)).toHaveValue("Bosch");
    await skriv(user, /Konstruktör/, "Makita");
    await user.click(screen.getByRole("button", { name: "Spara" }));
    await screen.findByRole("button", { name: "Borr" });
    const sparad = (await source.read("appdata", "a")).varden;
    expect(Object.hasOwn(sparad, "constructor")).toBe(true);
    expect(sparad.constructor).toBe("Makita");
  });

  it("ett fältfel på ett annat fält hamnar inte på constructor", async () => {
    const besk = medKonstruktor();
    besk.listor[0].falt[4].typ = "tal";
    const { user } = montera({ besk });
    await screen.findByText("Saker är tom.");
    await user.click(screen.getByRole("button", { name: "Ny rad i Saker" }));
    await user.click(screen.getByRole("button", { name: "Spara" }));
    // Bara "Sak" (krävs) är fel. Konstruktör-fältet är orört och bär inget fel.
    expect(await screen.findByText("krävs.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Sak/)).toBeInvalid();
    expect(screen.getByLabelText(/Konstruktör/)).not.toBeInvalid();
  });

  it("tabellen läser samma sätt: en rad utan fältet får en tom cell", async () => {
    const besk = medKonstruktor();
    besk.listor[0].visning = "tabell";
    montera({ besk, seed: [{ id: "a", ...rad({ varden: { namn: "Borr" } }) }] });
    const tabell = await screen.findByRole("table", { name: "Saker" });
    expect(within(tabell).getAllByRole("cell").map((c) => c.textContent).join("|")).not.toMatch(/function|native code/);
  });
});

describe("OpsBeskrivenApp: fältet id är upptaget", () => {
  it("en beskrivning med ett fält som heter id ritas inte: felet säger varför och vad man skriver i stället", () => {
    const besk = utlaning();
    besk.listor[1].falt.push({ id: "id", namn: "Löpnummer", typ: "tal" });
    const kalla = createBeskrivenAppKalla({ source: createMemorySource(), collection: "appdata", groupId: "cps-ab", beskrivning: utlaning(), skapare: skapare() });
    render(<OpsBeskrivenApp beskrivning={besk} kalla={kalla} jag={MIG} medlemmar={MEDLEMMAR} />);
    expect(screen.getByText("Appen går inte att visa.")).toBeInTheDocument();
    expect(screen.getByText(/listor\[1\]\.falt\[3\]\.id: "id" är upptaget, det är radens egen nyckel/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("OpsBeskrivenApp: ett stort värde ritas och söks bara till sitt tak", () => {
  // Regeln låser inte hur långt ett värde är (den känner inte beskrivningen), och validateRad körs bara i klienten. En rad skriven
  // förbi klienten kan alltså bära ett värde på hundratals kilobyte. Vyn kortar det den ritar, och sökningen läser det som ritas.
  const STORT = 5000;
  const lang = (marke) => `${"a".repeat(1000)}${marke}${"b".repeat(STORT)}`;

  it("text och val kortas till MAX_TEXTVARDE i listan, rubriken och sökningen", async () => {
    const { user } = montera({ seed: [{ id: "a", ...rad({ varden: { namn: lang("RUBRIKMARKE"), skick: lang("SKICKMARKE") } }) }] });
    const radknapp = await screen.findByRole("button", { name: /^a+/ });
    expect(radknapp.getAttribute("aria-label")).toHaveLength(MAX_TEXTVARDE);
    expect(radknapp.getAttribute("aria-label")).toMatch(/\.\.\.$/);
    // Rubrik (200) plus fältets namn och ett värde (200): ingenting av de 6000 tecknen som skrevs.
    expect(radknapp.textContent.length).toBeLessThanOrEqual(MAX_TEXTVARDE + "Skick: ".length + MAX_TEXTVARDE);
    // Det som låg bortom taket finns inte att söka på, för det ritas inte.
    await user.type(screen.getByRole("searchbox", { name: "Sök: Saker" }), "skickmarke");
    expect(screen.getByText("Inga träffar.")).toBeInTheDocument();
  });

  it("en länk kortas till MAX_LANKVARDE, och en lång text till raden i listan", async () => {
    const besk = utlaning();
    besk.listor[0].falt.push({ id: "lank", namn: "Sida", typ: "lank" }, { id: "anteckning", namn: "Anteckning", typ: "langtext" });
    const varden = { namn: "Borr", lank: `https://example.com/${"x".repeat(STORT)}`, anteckning: "y".repeat(STORT) };
    montera({ besk, seed: [{ id: "a", ...rad({ varden }) }] });
    const radknapp = await screen.findByRole("button", { name: "Borr" });
    const meta = radknapp.querySelector("[data-beskriven-rad] > span:last-child").textContent;
    // METAFALT (3) fält visas: Sida (högst 2000), Anteckning (högst 80). Bortom dem skulle 10 000 tecken ha stått här.
    expect(meta.length).toBeLessThanOrEqual("Sida: ".length + MAX_LANKVARDE + " · Anteckning: ".length + 80);
    expect(meta).toContain("...");
  });

  it("tabellens celler kortas på samma sätt", async () => {
    const besk = utlaning();
    besk.listor[0].visning = "tabell";
    montera({ besk, seed: [{ id: "a", ...rad({ varden: { namn: "Borr", skick: lang("X") } }) }] });
    const tabell = await screen.findByRole("table", { name: "Saker" });
    const celler = within(tabell).getAllByRole("cell").map((c) => c.textContent);
    expect(Math.max(...celler.map((c) => c.length))).toBeLessThanOrEqual(MAX_TEXTVARDE);
  });

  it("ett värde av fel typ kortas också: en lång text i ett talfält ritas inte i full längd", async () => {
    montera({ seed: [{ id: "p", ...rad({ lista: "personer", varden: { namn: "Kim", antal: "9".repeat(STORT) } }) }] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /Personer/ }));
    const tabell = await screen.findByRole("table", { name: "Personer" });
    expect(Math.max(...within(tabell).getAllByRole("cell").map((c) => c.textContent.length))).toBeLessThanOrEqual(MAX_TEXTVARDE);
  });

  it("skaparens namn kortas i formulärets rubrikrad", async () => {
    const skapadAv = { uid: "uid-2", namn: "N".repeat(STORT), typ: "manniska", kalla: "appar" };
    const { user } = montera({ seed: [{ id: "a", ...rad({ skapadAv }) }] });
    await user.click(await screen.findByRole("button", { name: "Borr" }));
    const rubrikrad = screen.getByText(/Skapad av N+/);
    expect(rubrikrad.textContent.length).toBeLessThanOrEqual("Saker · Skapad av .".length + MAX_SKAPARNAMN);
  });
});
