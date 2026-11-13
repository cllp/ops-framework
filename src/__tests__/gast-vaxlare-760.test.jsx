import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastSida } from "../components/OpsGastSida.jsx";
import { vaxlarrad } from "../components/GastVaxlare.jsx";
import { useGastsidaInfo } from "../components/gastsidaInfo.js";
import { GASTNYLANK_SVAR } from "../lib/gast.js";

/**
 * Växlaren och Mina inbjudningar på gästsidan (0.215.0, cllp/lifehub.app#760 skiva 3). jsdom mäter text, knappar och anrop, inte utseendet.
 *
 * ⛔ VARJE PROV HAR SETTS FALLA (regel 4): mutationerna och utfallen står i rapporten.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});
afterEach(() => vi.restoreAllMocks());

const GRUPP = "a".repeat(64);
const PROJEKT = "b".repeat(64);
const ATERKALLAD = "c".repeat(64);
const OMROSTNING = "d".repeat(64);
const S = (/** @type {string} */ c) => c.repeat(43);
const SVAR = {
  [S("G")]: { ok: true, namn: "Per", funktion: "grupp", gruppnamn: "Källan", grupp: { namn: "Källan", funktioner: ["chatt"] } },
  // Servern ger aldrig `gruppnamn` för ett projekt. Svaret bär det här ändå, för att visa att växlaren inte läser det för ett projekt.
  [S("P")]: { ok: true, namn: "Per", funktion: "grupp", gruppnamn: "Källan", grupp: { namn: "Köket", funktioner: ["chatt"], projekt: { tagg: "koket" } } },
  [S("A")]: { ok: false, orsak: "aterkallad" },
  [S("O")]: { ok: true, namn: "Per", funktion: "rosta", sak: { titel: "Rep" } },
};

/** Ett minne med uppräkning, som `localStorage`. */
const lagringMed = (/** @type {Record<string, string>} */ start = {}) => {
  /** @type {Record<string, string>} */
  const d = { ...start };
  return {
    getItem: (/** @type {string} */ k) => d[k] ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => {
      d[k] = v;
    },
    removeItem: (/** @type {string} */ k) => {
      delete d[k];
    },
    key: (/** @type {number} */ i) => Object.keys(d)[i] ?? null,
    get length() {
      return Object.keys(d).length;
    },
    d,
  };
};

const fyra = () =>
  lagringMed({
    "ops-gast:senaste": GRUPP,
    "ops-gast:alla": JSON.stringify([GRUPP, PROJEKT, ATERKALLAD, OMROSTNING]),
    [`ops-gast:${GRUPP}`]: S("G"),
    [`ops-gast:${PROJEKT}`]: S("P"),
    [`ops-gast:${ATERKALLAD}`]: S("A"),
    [`ops-gast:${OMROSTNING}`]: S("O"),
    [`ops-gast:flik:${GRUPP}`]: "chatt",
  });

/**
 * Gruppvyn i proven: som `OpsGastGrupp` ritar den växlaren ur `GastsidaInfo` (0.215.0). Gästsidan ritar den inte själv för en gäst i en grupp.
 * @param {{ namn: string }} p
 */
function Gruppvy({ namn }) {
  const info = useGastsidaInfo();
  return (
    <div>
      <div data-grupp-visas="">{namn}</div>
      {info?.vaxlare}
    </div>
  );
}

const rita = (/** @type {Record<string, any>} */ props = {}) => {
  const lagring = props.lagring ?? fyra();
  const onHamta = vi.fn(async ({ sessionsnyckel }) => SVAR[sessionsnyckel] ?? { ok: false, orsak: "nej" });
  const onNyLank = vi.fn(async () => ({ ok: true, svar: GASTNYLANK_SVAR }));
  const utf = render(
    <OpsGastSida
      lank={null}
      onLos={vi.fn()}
      onHamta={onHamta}
      onNyLank={onNyLank}
      renderGrupp={({ grupp }) => <Gruppvy namn={grupp.namn} />}
      renderSak={({ sak }) => <div data-sak="">{sak.titel}</div>}
      intervallMs={0}
      lagring={lagring}
      {...props}
    />,
  );
  return { ...utf, lagring, onHamta, onNyLank };
};

/** Väntar tills elementet finns, och kastar annars (en `waitFor` som svarar `null` väntar inte). @param {string} sel */
const vanta = (sel) =>
  waitFor(() => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`${sel} finns inte än`);
    return /** @type {HTMLElement} */ (el);
  });

const klicka = async (/** @type {Element} */ el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

describe("växlaren", () => {
  it("raderna ur svaren: gruppens namn som rubrik, ett projekt med sitt eget namn och aldrig gruppens, en omröstning utan grupp", () => {
    expect(vaxlarrad(GRUPP, SVAR[S("G")])).toEqual({ id: GRUPP, grupp: "Källan", namn: "" });
    expect(vaxlarrad(PROJEKT, SVAR[S("P")])).toEqual({ id: PROJEKT, grupp: null, namn: "Köket", projekt: true });
    expect(vaxlarrad(OMROSTNING, SVAR[S("O")])).toEqual({ id: OMROSTNING, grupp: null, namn: "" });
    expect(vaxlarrad(ATERKALLAD, SVAR[S("A")])).toBeNull();
  });

  it("⛔ visar bara inbjudningar servern just svarat på, under gruppens namn, och aldrig den återkallade", async () => {
    const { onHamta } = rita();
    const nav = await screen.findByRole("navigation", { name: "Dina inbjudningar" });
    await waitFor(() => expect(within(nav).getAllByRole("button").filter((b) => b.hasAttribute("data-gast-vaxlare-rad"))).toHaveLength(3));
    // Varje sparad session frågades (golv: fyra).
    expect(new Set(onHamta.mock.calls.map(([a]) => a.sessionsnyckel)).size).toBeGreaterThanOrEqual(4);
    const kallan = /** @type {HTMLElement} */ (nav.querySelector('[data-gast-vaxlare-grupp="Källan"]'));
    expect(within(kallan).getByRole("heading")).toHaveTextContent("Källan");
    expect(within(kallan).getAllByRole("button").map((b) => b.textContent)).toEqual(["Hela gruppenVisas nu"]);
    // ⛔ Projektet under Projekt, aldrig under gruppens namn.
    const projekt = /** @type {HTMLElement} */ (nav.querySelector('[data-gast-vaxlare-grupp="projekt"]'));
    expect(within(projekt).getByRole("heading")).toHaveTextContent("Projekt");
    expect(within(projekt).getAllByRole("button").map((b) => b.textContent)).toEqual(["Köket"]);
    expect([...nav.querySelectorAll("[data-gast-vaxlare-grupp]")].map((e) => e.getAttribute("data-gast-vaxlare-grupp"))).toEqual(["Källan", "projekt", "handelser"]);
    const handelser = /** @type {HTMLElement} */ (nav.querySelector('[data-gast-vaxlare-grupp="handelser"]'));
    expect(within(handelser).getByRole("heading")).toHaveTextContent("Händelser och omröstningar");
    expect(nav.querySelector(`[data-gast-vaxlare-rad="${ATERKALLAD}"]`)).toBeNull();
    // Mina inbjudningar står sist.
    const knappar = within(nav).getAllByRole("button");
    expect(knappar[knappar.length - 1]).toHaveTextContent("Mina inbjudningar");
  });

  it("⛔ ett namn sparas aldrig på enheten", async () => {
    const { lagring } = rita();
    await screen.findByRole("navigation", { name: "Dina inbjudningar" });
    await waitFor(() => expect(document.querySelector(`[data-gast-vaxlare-rad="${PROJEKT}"]`)).not.toBeNull());
    const allt = JSON.stringify(lagring.d);
    for (const namn of ["Köket", "Källan", "Rep"]) expect(allt, namn).not.toContain(namn);
  });

  it("ett tryck öppnar den inbjudans egen session och gör den till den senast öppnade", async () => {
    const { lagring, onHamta } = rita();
    const rad = await vanta(`[data-gast-vaxlare-rad="${PROJEKT}"]`);
    onHamta.mockClear();
    await klicka(rad);
    await waitFor(() => expect(document.querySelector("[data-grupp-visas]")).toHaveTextContent("Köket"));
    expect(onHamta.mock.calls.map(([a]) => a.sessionsnyckel)).toEqual([S("P")]);
    expect(lagring.d["ops-gast:senaste"]).toBe(PROJEKT);
    expect(document.querySelector(`[data-gast-vaxlare-rad="${PROJEKT}"]`)).toHaveAttribute("aria-current", "true");
  });

  it("en inbjudan som dragits tillbaka efter prövningen tas bort ur växlaren, och sidan står kvar", async () => {
    const { onHamta } = rita();
    const rad = await vanta(`[data-gast-vaxlare-rad="${PROJEKT}"]`);
    onHamta.mockImplementation(async ({ sessionsnyckel }) => (sessionsnyckel === S("P") ? { ok: false, orsak: "aterkallad" } : SVAR[sessionsnyckel]));
    await klicka(rad);
    await waitFor(() => expect(document.querySelector(`[data-gast-vaxlare-rad="${PROJEKT}"]`)).toBeNull());
    expect(screen.getByRole("alert")).toHaveTextContent("Inbjudan gick inte att öppna");
    expect(document.querySelector("[data-grupp-visas]")).toHaveTextContent("Källan");
  });

  it("med en enda inbjudan står bara en liten länk Mina inbjudningar", async () => {
    rita({ lagring: lagringMed({ "ops-gast:senaste": GRUPP, [`ops-gast:${GRUPP}`]: S("G") }) });
    await waitFor(() => expect(document.querySelector('[data-gast-vaxlare="enkel"]')).not.toBeNull());
    expect(screen.queryByRole("navigation", { name: "Dina inbjudningar" })).toBeNull();
    expect(document.querySelector('[data-gast-mina-knapp="liten"]')).toHaveTextContent("Mina inbjudningar");
  });
});

describe("Mina inbjudningar", () => {
  it("adressen går till nyLank({ epost }), svaret är detsamma hur det än gick, och texten säger att en telefoninbjudan inte nås", async () => {
    const { onNyLank } = rita({ lagring: lagringMed({ "ops-gast:senaste": GRUPP, [`ops-gast:${GRUPP}`]: S("G") }) });
    await klicka(await vanta("[data-gast-mina-knapp]"));
    expect(screen.getByText(/telefonnummer når inte hit/)).toBeInTheDocument();
    expect(screen.getByText(/gäller en gång och i ett dygn/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Din e-postadress"), { target: { value: "per@extern.se" } });
    await klicka(screen.getByRole("button", { name: "Skicka länkarna" }));
    expect(onNyLank).toHaveBeenCalledWith({ epost: "per@extern.se" });
    expect(await screen.findByText(GASTNYLANK_SVAR)).toBeInTheDocument();
    // Ett fel ger samma svar.
    onNyLank.mockRejectedValueOnce(new Error("nätet"));
    await klicka(screen.getByRole("button", { name: "Tillbaka" }));
    await klicka(/** @type {HTMLElement} */ (document.querySelector("[data-gast-mina-knapp]")));
    fireEvent.change(screen.getByLabelText("Din e-postadress"), { target: { value: "per@extern.se" } });
    await klicka(screen.getByRole("button", { name: "Skicka länkarna" }));
    expect(await screen.findByText(GASTNYLANK_SVAR)).toBeInTheDocument();
    expect(screen.queryByText(/för många/i)).toBeNull();
  });
});

describe("⛔ Logga ut glömmer allt", () => {
  it("sessionerna, flikarna och växlarens namn försvinner, och inget ops-gast-värde står kvar", async () => {
    // Logga ut sitter i gruppens integritet, som gruppvyn ritar ur sammanhanget (`useGastsidaInfo`). Samma knapp som gästen trycker på.
    const MedInfo = ({ namn }) => {
      const info = useGastsidaInfo();
      return (
        <div>
          <div data-grupp-visas="">{namn}</div>
          {info?.integritet}
          {info?.vaxlare}
        </div>
      );
    };
    const { lagring } = rita({ renderGrupp: ({ grupp }) => <MedInfo namn={grupp.namn} /> });
    await waitFor(() => expect(document.querySelector(`[data-gast-vaxlare-rad="${PROJEKT}"]`)).not.toBeNull());
    // Golv: sessionerna, indexet och fliken fanns innan.
    expect(Object.keys(lagring.d).filter((k) => k.startsWith("ops-gast:")).length).toBeGreaterThanOrEqual(7);
    await klicka(screen.getByText("Integritet och dina uppgifter"));
    await klicka(screen.getByRole("button", { name: "Logga ut på den här enheten" }));
    expect(Object.keys(lagring.d).filter((k) => k.startsWith("ops-gast:"))).toEqual([]);
    expect(screen.queryByRole("navigation", { name: "Dina inbjudningar" })).toBeNull();
    expect(screen.queryByText("Köket")).toBeNull();
  });

  it("⛔ efter Logga ut och en ny inloggning med länken står den förra gästens inbjudningar inte i växlaren", async () => {
    const MedInfo = ({ namn }) => {
      const info = useGastsidaInfo();
      return (
        <div>
          <div data-grupp-visas="">{namn}</div>
          {info?.integritet}
          {info?.vaxlare}
        </div>
      );
    };
    const onLos = vi.fn(async () => ({ ok: true, sessionsnyckel: S("G") }));
    rita({ lank: { id: GRUPP, nyckel: "N".repeat(43) }, onLos, renderGrupp: ({ grupp }) => <MedInfo namn={grupp.namn} /> });
    await vanta(`[data-gast-vaxlare-rad="${PROJEKT}"]`);
    await klicka(screen.getByText("Integritet och dina uppgifter"));
    await klicka(screen.getByRole("button", { name: "Logga ut på den här enheten" }));
    await klicka(await screen.findByRole("button", { name: "Öppna" }));
    await waitFor(() => expect(document.querySelector("[data-grupp-visas]")).toHaveTextContent("Källan"));
    await vanta('[data-gast-vaxlare="enkel"]');
    expect(document.querySelector(`[data-gast-vaxlare-rad="${PROJEKT}"]`)).toBeNull();
  });
});

describe("⛔ var växlaren står för en gäst i en grupp (check:skalyta, 0.215.0)", () => {
  it("bara i gruppvyn via GastsidaInfo, aldrig ovanför den: en gruppvy som inte ritar den visar ingen växlare", async () => {
    rita({ renderGrupp: ({ grupp }) => <div data-grupp-visas="">{grupp.namn}</div> });
    await waitFor(() => expect(document.querySelector("[data-grupp-visas]")).not.toBeNull());
    await act(async () => {});
    expect(document.querySelector("[data-gast-vaxlare]")).toBeNull();
  });
});
