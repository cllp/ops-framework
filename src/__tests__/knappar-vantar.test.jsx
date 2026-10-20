import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OpsAgenter, agenterManifest } from "../components/OpsAgenter.jsx";
import { LaggILista } from "../components/BibliotekLista.jsx";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsButton } from "../components/OpsButton.jsx";
import { OpsGruppFormular } from "../components/OpsGruppFormular.jsx";
import { OpsGruppHubb } from "../components/OpsHub.jsx";
import { OpsKatalogInstallning } from "../components/OpsKatalogInstallning.jsx";
import { OpsMedlemmar } from "../components/OpsMedlemmar.jsx";
import { OpsMinne } from "../components/OpsMinne.jsx";
import { OpsModulTyper } from "../components/OpsModulTyper.jsx";
import { OpsSkapaPanel } from "../components/OpsSkapaPanel.jsx";
import { OpsUtanMedlemskap } from "../components/OpsUtanMedlemskap.jsx";
import { byggPost } from "../lib/bibliotek.js";
import { validateKatalog } from "../lib/katalog.js";
import { defineModule, validateModuler } from "../lib/modul.js";
import { bidragForGrupp } from "../lib/modultyper.js";

/**
 * Knappar som väntar visar det (0.129.0, cllp/lifehub.app#217, CP 2026-10-13: "Vi behöver ha en progress bar på saker och ting som dröjer,
 * till exempel avfärda, spara, överallt, så att man vet vad som händer i appen").
 *
 * ══ ⛔ VAD SOM MÄTS ═════════════════════════════════════════════════════════════════════════════════════
 *
 * Varje prov trycker på en knapp vars handling ger ett löfte som ÄNNU INTE ÄR KLART, och mäter tre saker i ordning:
 *   1. knappen är upptagen medan löftet pågår (`aria-busy`, spärrad, en snurra, etiketten kvar),
 *   2. ett andra tryck under tiden startar inte handlingen en gång till,
 *   3. knappen är ledig igen när löftet är klart.
 * Det är samma tre mått för varje knapp, så att tabellen längre ned är en inventering som går att köra och inte en lista i ett dokument.
 *
 * ⛔ GRÖNT UTAN `jsdom`-CSS: provet mäter attribut och DOM, inte hur det ser ut. Hur en upptagen knapp ritas är `OpsButton`s sak och mäts i
 * `check-skalyta`. Rött utan rättelsen och grönt med den står i CHANGELOG 0.129.0.
 */

/** Ett löfte som avgörs när testet vill. */
function uppskjuten() {
  /** @type {(v?: unknown) => void} */
  let los = () => {};
  /** @type {(e: unknown) => void} */
  let avslag = () => {};
  const lofte = new Promise((a, b) => {
    los = a;
    avslag = b;
  });
  return { lofte, los, avslag };
}

/**
 * De tre måtten för en knapp. `hamta` hämtar knappen på nytt varje gång (en omritning byter inte elementet, men en knapp som försvinner ska ge ett fel och inte ett gammalt svar).
 * @param {() => HTMLElement} hamta @param {import("vitest").Mock} anrop @param {() => void} avgor
 */
async function provaVantar(hamta, anrop, avgor) {
  expect(hamta()).not.toHaveAttribute("aria-busy");
  fireEvent.click(hamta());
  await waitFor(() => expect(hamta()).toHaveAttribute("aria-busy", "true"));
  expect(hamta()).toBeDisabled();
  expect(hamta().querySelector("svg")).not.toBeNull();
  // Ett andra tryck: knappen är spärrad, och handlingen startar inte igen.
  fireEvent.click(hamta());
  expect(anrop).toHaveBeenCalledTimes(1);
  await act(async () => {
    avgor();
  });
  // Knappen får ha försvunnit när handlingen lyckats (ett formulär som stänger sig): då är den inte upptagen heller.
  await waitFor(() => {
    let knapp = null;
    try {
      knapp = hamta();
    } catch {
      return;
    }
    expect(knapp).not.toHaveAttribute("aria-busy");
  });
}

describe("OpsButton: väntar när onClick ger ett löfte och busy inte är satt", () => {
  it("upptagen tills löftet är klart, med etiketten kvar, och ledig igen efteråt", async () => {
    const d = uppskjuten();
    const onClick = vi.fn(() => d.lofte);
    render(<OpsButton onClick={onClick}>Spara</OpsButton>);
    const knapp = screen.getByRole("button", { name: "Spara" });
    await provaVantar(() => screen.getByRole("button", { name: "Spara" }), onClick, d.los);
    expect(knapp).toHaveTextContent("Spara");
    expect(knapp).not.toBeDisabled();
  });

  it("⛔ två tryck i SAMMA tick startar handlingen en gång (spärren sitter i en ref, inte bara i tillståndet)", async () => {
    const d = uppskjuten();
    const onClick = vi.fn(() => d.lofte);
    render(<OpsButton onClick={onClick}>Radera</OpsButton>);
    const knapp = screen.getByRole("button", { name: "Radera" });
    // Båda trycken inuti en `act`: ingen omritning hinner emellan, så det andra trycket ser samma tillstånd som det första.
    act(() => {
      knapp.click();
      knapp.click();
    });
    expect(onClick).toHaveBeenCalledTimes(1);
    await act(async () => d.los());
  });

  it("⛔ ett löfte som avslås gör knappen ledig igen, och avslagningen sväljs inte: den når den som lyssnar på unhandledrejection", async () => {
    const lyssnare = process.listeners("unhandledRejection");
    process.removeAllListeners("unhandledRejection");
    /** @type {unknown[]} */
    const sedda = [];
    const mitt = (/** @type {unknown} */ fel) => sedda.push(fel);
    process.on("unhandledRejection", mitt);
    try {
      const d = uppskjuten();
      const onClick = vi.fn(() => d.lofte);
      render(<OpsButton onClick={onClick}>Skicka</OpsButton>);
      fireEvent.click(screen.getByRole("button", { name: "Skicka" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Skicka" })).toHaveAttribute("aria-busy", "true"));
      const fel = new Error("nätet föll");
      await act(async () => d.avslag(fel));
      await waitFor(() => expect(screen.getByRole("button", { name: "Skicka" })).not.toHaveAttribute("aria-busy"));
      expect(screen.getByRole("button", { name: "Skicka" })).not.toBeDisabled();
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
      });
      expect(sedda).toEqual([fel]);
    } finally {
      process.off("unhandledRejection", mitt);
      for (const l of lyssnare) process.on("unhandledRejection", l);
    }
  });

  it("ett returvärde som inte är ett löfte lämnas orört: ingen snurra, och två tryck är två anrop", () => {
    const onClick = vi.fn(() => 42);
    render(<OpsButton onClick={onClick}>Öppna</OpsButton>);
    const knapp = screen.getByRole("button", { name: "Öppna" });
    fireEvent.click(knapp);
    fireEvent.click(knapp);
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(knapp).not.toHaveAttribute("aria-busy");
    expect(knapp.querySelector("svg")).toBeNull();
  });

  it("⛔ är busy satt, också till false, styr appen: knappen lägger varken snurra eller spärr ovanpå", async () => {
    const d = uppskjuten();
    const onClick = vi.fn(() => d.lofte);
    const { rerender } = render(<OpsButton busy={false} onClick={onClick}>Spara</OpsButton>);
    const knapp = screen.getByRole("button", { name: "Spara" });
    fireEvent.click(knapp);
    fireEvent.click(knapp);
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(knapp).not.toHaveAttribute("aria-busy");
    // Och appens true består också när löftet är klart: det är appens tillstånd.
    rerender(<OpsButton busy onClick={onClick}>Spara</OpsButton>);
    await act(async () => d.los());
    expect(screen.getByRole("button", { name: "Spara" })).toHaveAttribute("aria-busy", "true");
  });

  it("en länk (href) väntar på samma sätt, och en spärrad länk har inget href", async () => {
    const d = uppskjuten();
    const onClick = vi.fn(() => d.lofte);
    render(<OpsButton href="#ut" onClick={onClick}>Hämta</OpsButton>);
    const lank = screen.getByRole("link", { name: "Hämta" });
    expect(lank).toHaveAttribute("href", "#ut");
    fireEvent.click(lank);
    // En länk utan href har ingen länkroll, så den hittas på texten.
    await waitFor(() => expect(screen.getByText("Hämta").closest("a")).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByText("Hämta").closest("a")).not.toHaveAttribute("href");
    await act(async () => d.los());
    await waitFor(() => expect(screen.getByRole("link", { name: "Hämta" })).toHaveAttribute("href", "#ut"));
  });

  it("en knapp som tas bort medan löftet pågår ger inget fel när löftet blir klart", async () => {
    const fel = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const d = uppskjuten();
      const { unmount } = render(<OpsButton onClick={() => d.lofte}>Ta bort</OpsButton>);
      fireEvent.click(screen.getByRole("button", { name: "Ta bort" }));
      unmount();
      await act(async () => d.los());
      expect(fel).not.toHaveBeenCalled();
    } finally {
      fel.mockRestore();
    }
  });
});

/*
 * ══ ⛔ INVENTERINGEN, SOM PROV ═══════════════════════════════════════════════════════════════════════════
 *
 * Varje rad är en knapp i ramverket vars handling kan ge ett löfte och som före 0.129.0 saknade `busy`. De täcks av `OpsButton` (utan en rad
 * kod på anropsstället) utom de som står markerade "lokal rättelse": där svalde funktionen löftet (`void x()`, ett `.then` utan return) och
 * ger nu tillbaka det, eller så är knappen en `type="submit"` som saknar `onClick` att läsa ett löfte ur. Knapparna som INTE är med
 * och varför står i CHANGELOG 0.129.0.
 */
describe("knapparna i ramverket som väntar (inventeringen)", () => {
  const med = (/** @type {string} */ userId, /** @type {string} */ roll) => ({
    medlemskap: { id: `${userId}_g`, userId, groupId: "g", roll, typ: "person", status: "aktiv", namn: "Annan Person", bild: "" },
  });

  it("OpsMedlemmar: Ta bort", async () => {
    const d = uppskjuten();
    const onTaBort = vi.fn(() => d.lofte);
    render(<OpsMedlemmar medlemmar={[med("annan", "medlem")]} migUid="mig" kanAndra onTaBort={onTaBort} />);
    await provaVantar(() => screen.getByRole("button", { name: "Ta bort" }), onTaBort, d.los);
  });

  it("OpsMedlemmar: Återkalla en väntande inbjudan", async () => {
    const d = uppskjuten();
    const onAterkalla = vi.fn(() => d.lofte);
    render(<OpsMedlemmar medlemmar={[med("mig", "agare")]} inbjudningar={[{ id: "i1", epost: "x@exempel.se", roll: "medlem" }]} migUid="mig" kanAndra onAterkalla={onAterkalla} />);
    await provaVantar(() => screen.getByRole("button", { name: "Återkalla" }), onAterkalla, d.los);
  });

  it("OpsMedlemmar: Bjud in", async () => {
    const d = uppskjuten();
    const onBjudIn = vi.fn(() => d.lofte);
    render(<OpsMedlemmar medlemmar={[med("mig", "agare")]} migUid="mig" kanAndra onBjudIn={onBjudIn} />);
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "ny@exempel.se" } });
    await provaVantar(() => screen.getByRole("button", { name: "Bjud in" }), onBjudIn, d.los);
  });

  const rad = (/** @type {string} */ id) => ({
    id,
    groupId: "cps-ab",
    text: "Budgeten är klar.",
    kalla: { slag: "trad", samtal: "cps-ab|grupp", trad: "rot", meddelande: "svar" },
    lyftAv: { uid: "kim", namn: "Kim", typ: "manniska", kalla: "minne" },
    lyft: 1_700_000_000_000,
    andrad: 1_700_000_000_000,
  });

  it("OpsMinne: Ta bort", async () => {
    const d = uppskjuten();
    const onTaBort = vi.fn(() => d.lofte);
    render(<OpsMinne rader={[rad("a")]} uid="kim" arAgare={false} onAndra={async () => {}} onTaBort={onTaBort} hubHref="/hub" />);
    await provaVantar(() => screen.getByRole("button", { name: "Ta bort" }), onTaBort, d.los);
  });

  it("OpsMinne: Spara en ändring (lokal rättelse: en submit-knapp har ingen onClick att läsa ett löfte ur)", async () => {
    const d = uppskjuten();
    const onAndra = vi.fn(() => d.lofte);
    render(<OpsMinne rader={[rad("a")]} uid="kim" arAgare={false} onAndra={onAndra} onTaBort={async () => {}} hubHref="/hub" />);
    fireEvent.click(screen.getByRole("button", { name: "Ändra" }));
    await provaVantar(() => screen.getByRole("button", { name: "Spara" }), onAndra, d.los);
  });

  it("OpsUtanMedlemskap: Skapa grupp", async () => {
    const d = uppskjuten();
    const onSkapaGrupp = vi.fn(() => d.lofte);
    render(<OpsUtanMedlemskap onSkapaGrupp={onSkapaGrupp} namnForval="Mitt bolag" />);
    await provaVantar(() => screen.getByRole("button", { name: "Skapa grupp" }), onSkapaGrupp, d.los);
  });

  const KATEGORIER = validateKatalog(
    [{ id: "uppgift", namn: { sv: "Uppgifter" }, farg: 1, ikon: "check", fas: "aktiv", ordning: 0, texter: { lofte: { sv: "Försvinner när den är gjord." } } }],
    { ikoner: ["check", "bell"], textnycklar: ["lofte"], grupp: false },
  );

  it("OpsKatalogInstallning: Arkivera", async () => {
    const d = uppskjuten();
    const onArkivera = vi.fn(() => d.lofte);
    render(
      <OpsKatalogInstallning
        kategorier={KATEGORIER}
        ikoner={["check", "bell"]}
        textnycklar={[{ nyckel: "lofte", etikett: { sv: "Löfte" }, hjalp: "Vad som får raden att försvinna." }]}
        kanAndra
        onSpara={() => {}}
        onArkivera={onArkivera}
        groupId="cps-ab"
      />,
    );
    await provaVantar(() => screen.getByRole("button", { name: "Arkivera" }), onArkivera, d.los);
  });

  it("OpsModulTyper: Dölj", async () => {
    const ekonomi = defineModule({
      id: "ekonomi",
      namn: { sv: "Ekonomi" },
      nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: null,
      typer: { inkorg: [{ id: "uppdatering", namn: { sv: "Ekonomisk uppdatering" } }] },
    });
    const d = uppskjuten();
    const onAndra = vi.fn(() => d.lofte);
    render(<OpsModulTyper yta="inkorg" bidrag={bidragForGrupp("inkorg", { bas: [], moduler: [ekonomi], modulerPa: ["ekonomi"], avvikelser: [] })} kanAndra onAndra={onAndra} />);
    await provaVantar(() => screen.getByRole("button", { name: /Dölj/ }), onAndra, d.los);
  });

  it("OpsGruppHubb: Installera (lokal rättelse: svaret kastades bort i en blockkropp)", async () => {
    const I = (/** @type {string} */ n) => <svg data-ikon={n} />;
    const resor = { id: "resor", namn: { sv: "Resor" }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: { ikon: I("plan"), rutt: "/resor", startsida: "kommande", delar: [{ id: "kommande", namn: { sv: "Kommande" }, ikon: I("k"), rutt: "/resor/kommande" }] } };
    const inkorg = { id: "inkorg", namn: { sv: "Inkorg" }, nav: [], routes: [], samlingar: [], kallor: {}, skapar: [], hubb: null };
    const d = uppskjuten();
    const onInstallera = vi.fn(() => d.lofte);
    render(<OpsGruppHubb grupp={{ id: "bolaget", namn: { sv: "Bolaget" }, moduler: ["inkorg"] }} moduler={validateModuler([resor, inkorg])} installera={{ onInstallera }} />);
    await provaVantar(() => screen.getByRole("button", { name: "Installera Resor" }), onInstallera, d.los);
  });

  const poster = [{ ...byggPost({ groupId: "cps-ab", typ: "anteckning", rubrik: "Protokoll", text: "Vi beslutade om bokslutet.", skapadAv: { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" }, skapad: 1_700_000_000_000, andrad: 1_700_000_000_000 }), id: "a" }];

  it("OpsBibliotek: Radera posten (lokal rättelse: löftet svaldes i korRadera)", async () => {
    const user = userEvent.setup();
    const d = uppskjuten();
    const onRadera = vi.fn(() => d.lofte);
    function Host() {
      const [vald, setVald] = useState(/** @type {any} */ (null));
      return (
        <OpsBibliotek hubHref="/hub" poster={poster} jag={{ uid: "uid-1", roll: "medlem" }} vald={vald} skapar={null} onOppna={setVald} onStang={() => setVald(null)} onSkapa={() => {}} onSpara={() => {}} onRadera={onRadera} />
      );
    }
    render(<Host />);
    await user.click(screen.getByRole("button", { name: "Protokoll" }));
    await user.click(screen.getByRole("button", { name: "Åtgärder för Protokoll" }));
    await user.click(screen.getByRole("menuitem", { name: "Radera" }));
    await provaVantar(() => screen.getByRole("button", { name: "Radera posten" }), onRadera, d.los);
  });

  it("LaggILista: Lägg i <lista> (lokal rättelse: löftet kastades bort med void)", async () => {
    const lista = { ...byggPost({ groupId: "cps-ab", typ: "lista", rubrik: "Spellista", poster: [], skapadAv: { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" }, skapad: 1, andrad: 1 }), id: "l1" };
    const d = uppskjuten();
    const onSpara = vi.fn(() => d.lofte);
    render(<LaggILista post={poster[0]} listor={[lista]} onSpara={onSpara} onKlar={() => {}} />);
    await provaVantar(() => screen.getByRole("button", { name: "Lägg i Spellista" }), onSpara, d.los);
  });

  const GRANSER = { namn: 40, beskrivning: 200, roll: 120, instruktioner: 4000, minne: 500, skillNamn: 80, skillBeskrivning: 300, skillText: 12000 };
  const agentFalt = {
    modul: validateModuler([agenterManifest()])[0],
    hubHref: "/hub",
    ram: { farAndra: true },
    agenter: [{ id: "ops", namn: "Ops", status: "aktiv" }],
    granser: GRANSER,
    installning: { namn: "Ops", roll: "Assistent", beskrivning: "Hjälper", instruktioner: "", minnePa: true },
    skills: [],
    verktyg: [],
    minne: [{ id: "m1", text: "Gillar korta svar" }],
  };

  it("OpsAgenter: Ta bort ett minne (lokal rättelse: kor() svalde löftet)", async () => {
    const d = uppskjuten();
    const onTaBortMinne = vi.fn(() => d.lofte);
    render(<OpsAgenter {...agentFalt} onTaBortMinne={onTaBortMinne} activeHref="/agenter?agent=ops&lage=installningar&avsnitt=kunskap" />);
    await provaVantar(() => screen.getByRole("button", { name: "Ta bort" }), onTaBortMinne, d.los);
  });

  it("OpsAgenter: Spara när appen inte sätter sparar (busy={sparar} var alltid false och lämnade knappen utan snurra)", async () => {
    const d = uppskjuten();
    const onSparaIdentitet = vi.fn(() => d.lofte);
    render(<OpsAgenter {...agentFalt} onSparaIdentitet={onSparaIdentitet} activeHref="/agenter?agent=ops&lage=installningar&avsnitt=om" />);
    await provaVantar(() => screen.getByRole("button", { name: "Spara" }), onSparaIdentitet, d.los);
  });
});

describe("Ny grupp: formuläret i skapa-panelen visar att gruppen skapas (0.129.0, cllp/lifehub.app#365)", () => {
  /** @param {Record<string, unknown>} [extra] */
  function iPanel(extra = {}) {
    const d = uppskjuten();
    const onSkapa = vi.fn(() => d.lofte);
    const onSkapad = vi.fn();
    render(
      <OpsSkapaPanel titel="Ny grupp" kolumn="smal" onTillbaka={() => {}} sparaEtikett="Spara" formId="ny-grupp">
        <OpsGruppFormular formId="ny-grupp" sprak="sv" onSkapa={onSkapa} onSkapad={onSkapad} {...extra} />
      </OpsSkapaPanel>,
    );
    return { d, onSkapa, onSkapad };
  }
  const status = () => /** @type {HTMLElement} */ (document.querySelector("[data-skapa-status]"));
  const skrivNamn = () => fireEvent.change(screen.getByLabelText(/Gruppnamn/), { target: { value: "Travel" } });

  it("⛔ panelens Spara blir upptagen medan gruppen skapas, ett andra tryck gör ingenting, och den är ledig igen när anropet svarat", async () => {
    const { d, onSkapa, onSkapad } = iPanel();
    skrivNamn();
    expect(status()).toBeEmpty();
    await provaVantar(() => screen.getByRole("button", { name: "Spara" }), onSkapa, () => d.los({ groupId: "travel", fel: [] }));
    expect(onSkapad).toHaveBeenCalledWith("travel", expect.objectContaining({ groupId: "travel" }));
    expect(status()).toBeEmpty();
  });

  it("⛔ statusraden bredvid knapparna säger vad som pågår: gruppen, och hur många inbjudningar som skickas med", async () => {
    const { d } = iPanel();
    skrivNamn();
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "anna@exempel.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till" }));
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "bo@exempel.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Lägg till" }));
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(status()).toHaveTextContent("Skapar gruppen och skickar 2 inbjudningar"));
    // Texten står på ETT ställe: formulärets egen rad längst ned är tyst när en panel skriver.
    expect(screen.getAllByRole("status").filter((r) => r.textContent)).toHaveLength(1);
    await act(async () => d.los({ groupId: "travel", fel: [] }));
    await waitFor(() => expect(status()).toBeEmpty());
  });

  it("utan inbjudningar står bara att gruppen skapas", async () => {
    const { d } = iPanel();
    skrivNamn();
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(status()).toHaveTextContent(/^Skapar gruppen$/));
    await act(async () => d.los({ groupId: "a", fel: [] }));
  });

  it("⛔ en adress som står kvar i fältet räknas med, eftersom den skickas med: en inbjudan", async () => {
    const { d, onSkapa } = iPanel();
    skrivNamn();
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "kvar@exempel.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(status()).toHaveTextContent("Skapar gruppen och skickar en inbjudan"));
    // Samma lista som texten räknar är den som skickas.
    expect(onSkapa).toHaveBeenCalledWith(expect.objectContaining({ inbjudningar: [{ epost: "kvar@exempel.se", roll: "medlem" }] }));
    await act(async () => d.los({ groupId: "b", fel: [] }));
  });

  it("⛔ faller anropet står felet kvar och knappen är ledig, statusraden tom", async () => {
    const { d, onSkapad } = iPanel();
    skrivNamn();
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Spara" })).toHaveAttribute("aria-busy", "true"));
    await act(async () => d.avslag(new Error("Du får inte skapa fler grupper.")));
    await waitFor(() => expect(screen.getByRole("button", { name: "Spara" })).not.toHaveAttribute("aria-busy"));
    expect(screen.getByText("Du får inte skapa fler grupper.")).toBeInTheDocument();
    expect(status()).toBeEmpty();
    expect(onSkapad).not.toHaveBeenCalled();
  });

  it("i redigeringsläge står Sparar, och efter en lyckad sparning är panelen tyst", async () => {
    const d = uppskjuten();
    const onSpara = vi.fn(() => d.lofte);
    render(
      <OpsSkapaPanel titel="Redigera grupp" kolumn="smal" onTillbaka={() => {}} sparaEtikett="Spara" formId="redigera">
        <OpsGruppFormular formId="redigera" sprak="sv" grupp={{ id: "g1", namn: { sv: "Travel" } }} onSpara={onSpara} />
      </OpsSkapaPanel>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(status()).toHaveTextContent(/^Sparar$/));
    await act(async () => d.los());
    await waitFor(() => expect(status()).toBeEmpty());
  });

  it("utan en panel skriver formuläret sin egen rad, med samma text", async () => {
    const d = uppskjuten();
    render(<OpsGruppFormular formId="ensam" sprak="sv" onSkapa={() => d.lofte} />);
    fireEvent.change(screen.getByLabelText(/Gruppnamn/), { target: { value: "Travel" } });
    fireEvent.submit(document.querySelector("form#ensam") ?? document.body);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Skapar gruppen"));
    await act(async () => d.los({ groupId: "x", fel: [] }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("på engelska: Creating the group", async () => {
    const { d } = iPanel({ sprak: "en" });
    fireEvent.change(screen.getByLabelText(/Group name/), { target: { value: "Travel" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(status()).toHaveTextContent("Creating the group"));
    await act(async () => d.los({ groupId: "x", fel: [] }));
  });
});
