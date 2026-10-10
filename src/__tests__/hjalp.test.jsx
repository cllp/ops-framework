import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsHjalpSida } from "../components/OpsHjalpSida.jsx";
import { OpsModulSida } from "../components/OpsModulSida.jsx";
import { OpsViewHeader } from "../components/OpsView.jsx";
import { GRUND_ID } from "../hjalp/generell.js";
import { aktivHjalpSektion, hjalpSektioner, sokHjalp } from "../hjalp/sok.js";
import { defineModule } from "../lib/modul.js";
import { hjalpAdress, hjalpAnkare, lasHjalpAnkare } from "../lib/modilhjalp.js";

/**
 * Hjälp i två lager (0.92.0).
 *
 * ⛔ AVINSTALLERAD APP SYNNS INTE. Sökningen träffar apptext. Djuplänken pekar rätt.
 */

const I = () => <svg data-ikon="" />;

const HJALP = {
  rubrik: "Ekonomi",
  avsnitt: [
    {
      id: "kvitto",
      fraga: "Hur bokför jag ett kvitto?",
      svar: "Lägg in kvittot under Kostnader. Belopp och moms hör till Ekonomi.",
      sokord: ["moms", "bokföring"],
    },
  ],
};

function ekonomi(over = {}) {
  return defineModule({
    id: "ekonomi",
    namn: { sv: "Ekonomi", en: "Finance" },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: {
      ikon: <I />,
      rutt: "/ekonomi",
      startsida: "oversikt",
      delar: [{ id: "oversikt", namn: { sv: "Översikt", en: "Overview" }, ikon: <I />, rutt: "/ekonomi/oversikt" }],
    },
    hjalp: HJALP,
    ...over,
  });
}

function bibliotek() {
  return defineModule({
    id: "bibliotek",
    namn: { sv: "Bibliotek", en: "Library" },
    nav: [],
    routes: [],
    samlingar: [],
    kallor: {},
    skapar: [],
    hubb: {
      ikon: <I />,
      rutt: "/bibliotek",
      startsida: "lista",
      delar: [{ id: "lista", namn: { sv: "Bibliotek", en: "Library" }, ikon: <I />, rutt: "/bibliotek/lista" }],
    },
    hjalp: {
      rubrik: "Bibliotek",
      avsnitt: [
        {
          id: "svep",
          fraga: "Hur sveper jag mellan anteckningar?",
          svar: "Svep i sidled. Långtryck öppnar åtgärder. Röstinspelning finns under Ny.",
          sokord: ["svep", "långtryck", "röst"],
        },
      ],
    },
  });
}

describe("modulens hjalp-kontrakt", () => {
  it("utelämnat fält är null, och en tom lista kastas", () => {
    const utan = defineModule({
      id: "tom",
      namn: { sv: "Tom", en: "Empty" },
      nav: [],
      routes: [],
      samlingar: [],
      kallor: {},
      skapar: [],
      hubb: null,
    });
    expect(utan.hjalp).toBeNull();
    expect(() =>
      defineModule({
        id: "tom",
        namn: { sv: "Tom", en: "Empty" },
        nav: [],
        routes: [],
        samlingar: [],
        kallor: {},
        skapar: [],
        hubb: null,
        hjalp: { rubrik: "X", avsnitt: [] },
      }),
    ).toThrow(/avsnitt.*tom|inte vara tom/i);
  });

  it("bygger avsnitt och kräver sokord även tom", () => {
    const m = ekonomi();
    expect(m.hjalp?.rubrik).toBe("Ekonomi");
    expect(m.hjalp?.avsnitt).toHaveLength(1);
    expect(m.hjalp?.avsnitt[0].sokord).toContain("moms");
    expect(() =>
      ekonomi({
        hjalp: { rubrik: "E", avsnitt: [{ id: "a", fraga: "F", svar: "S" }] },
      }),
    ).toThrow(/sokord/);
  });
});

describe("hjalpSektioner och sök", () => {
  it("⛔ visar inte en avinstallerad app", () => {
    const moduler = [ekonomi(), bibliotek()];
    const medBada = hjalpSektioner({ moduler, grupp: { moduler: ["ekonomi", "bibliotek"] } });
    expect(medBada.map((s) => s.id)).toEqual([GRUND_ID, "ekonomi", "bibliotek"]);

    const baraEkonomi = hjalpSektioner({ moduler, grupp: { moduler: ["ekonomi"] } });
    expect(baraEkonomi.map((s) => s.id)).toEqual([GRUND_ID, "ekonomi"]);
    expect(baraEkonomi.some((s) => s.id === "bibliotek")).toBe(false);

    // Golv: minst grund + en app när något är installerat.
    expect(baraEkonomi.length).toBeGreaterThanOrEqual(2);
  });

  it("⛔ hubb:null med hjalp syns även när id:t inte står i groups.moduler (Agenter)", () => {
    const agenter = defineModule({
      id: "agenter",
      namn: { sv: "Agenter", en: "Agents" },
      nav: [],
      routes: [],
      samlingar: [],
      kallor: {},
      skapar: [],
      hubb: null,
      hjalp: {
        rubrik: "Agenter",
        avsnitt: [
          {
            id: "vad",
            fraga: "Vad är en agent?",
            svar: "Agenten hör till gruppen. Nycklarna hör till dig.",
            sokord: ["ai"],
          },
        ],
      },
    });
    const sektioner = hjalpSektioner({
      moduler: [ekonomi(), agenter],
      grupp: { moduler: ["ekonomi"] },
    });
    expect(sektioner.map((s) => s.id)).toEqual([GRUND_ID, "ekonomi", "agenter"]);
    // Avinstallerad app med hubb syns fortfarande inte.
    expect(sektioner.some((s) => s.id === "bibliotek")).toBe(false);
  });

  it("söker i apptext och sökord, och rubrik går före", () => {
    const sektioner = hjalpSektioner({
      moduler: [ekonomi(), bibliotek()],
      grupp: { moduler: ["ekonomi", "bibliotek"] },
    });
    const moms = sokHjalp(sektioner, "moms");
    expect(moms.some((t) => t.avsnitt.id === "kvitto")).toBe(true);
    expect(moms.some((t) => t.avsnitt.id === "svep")).toBe(false);

    const svep = sokHjalp(sektioner, "svep");
    expect(svep[0].avsnitt.fraga).toMatch(/sveper/i);
  });

  it("djuplänken läser och pekar", () => {
    expect(hjalpAnkare("ekonomi")).toBe("#hjalp/ekonomi");
    expect(hjalpAdress("/hjalp", "ekonomi")).toBe("/hjalp#hjalp/ekonomi");
    expect(lasHjalpAnkare("#hjalp/ekonomi")).toBe("ekonomi");
    expect(lasHjalpAnkare("#annat")).toBeNull();

    const sektioner = hjalpSektioner({ moduler: [ekonomi()], grupp: { moduler: ["ekonomi"] } });
    expect(aktivHjalpSektion(sektioner, "#hjalp/ekonomi")).toBe("ekonomi");
    expect(aktivHjalpSektion(sektioner, "#hjalp/bibliotek")).toBeNull();
    expect(aktivHjalpSektion(sektioner, "#hjalp/grund")).toBe(GRUND_ID);
  });
});

describe("OpsHjalpSida", () => {
  it("ritar Grundfunktioner och installerade appar, inte avinstallerade", () => {
    render(
      <OpsHjalpSida
        moduler={[ekonomi(), bibliotek()]}
        grupp={{ moduler: ["ekonomi"] }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Grundfunktioner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ekonomi" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bibliotek" })).toBeNull();
    expect(screen.getByText("Hur bokför jag ett kvitto?")).toBeInTheDocument();
  });

  it("söker och träffar apptext", () => {
    render(
      <OpsHjalpSida
        moduler={[ekonomi(), bibliotek()]}
        grupp={{ moduler: ["ekonomi", "bibliotek"] }}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Sök i hjälpen" }), { target: { value: "långtryck" } });
    expect(screen.getByText(/sveper jag mellan/i)).toBeInTheDocument();
    expect(screen.queryByText("Hur bokför jag ett kvitto?")).toBeNull();
  });

  it("sätter data-hjalp-sektion för djuplänken", () => {
    const { container } = render(
      <OpsHjalpSida
        moduler={[ekonomi()]}
        grupp={{ moduler: ["ekonomi"] }}
        hash="#hjalp/ekonomi"
      />,
    );
    expect(container.querySelector('[data-hjalp-sektion="ekonomi"]')).not.toBeNull();
    expect(container.querySelector('[data-hjalp-sektion="grund"]')).not.toBeNull();
  });
});

describe("frågetecknet i modulramen och vyn", () => {
  it("öppnar hjälpen på modulens avsnitt", () => {
    const onNavigate = vi.fn((_h, e) => e.preventDefault());
    render(
      <OpsModulSida modul={ekonomi()} activeHref="/ekonomi" hubHref="/hub" onNavigate={onNavigate}>
        <p>översikt</p>
      </OpsModulSida>,
    );
    const lank = screen.getByRole("link", { name: "Hjälp för appen" });
    expect(lank.getAttribute("href")).toBe("/hjalp#hjalp/ekonomi");
    fireEvent.click(lank);
    expect(onNavigate).toHaveBeenCalledWith("/hjalp#hjalp/ekonomi", expect.anything());
  });

  it("ritar ingen hjälpknapp när modulen saknar hjalp", () => {
    const utan = defineModule({
      id: "liv",
      namn: { sv: "Liv", en: "Life" },
      nav: [],
      routes: [],
      samlingar: [],
      kallor: {},
      skapar: [],
      hubb: {
        ikon: <I />,
        rutt: "/liv",
        startsida: "a",
        delar: [{ id: "a", namn: { sv: "A", en: "A" }, ikon: <I />, rutt: "/liv/a" }],
      },
    });
    render(
      <OpsModulSida modul={utan} activeHref="/liv" hubHref="/hub">
        <p>x</p>
      </OpsModulSida>,
    );
    expect(screen.queryByRole("link", { name: "Hjälp för appen" })).toBeNull();
  });

  it("OpsViewHeader med hjalpHref är en länk, inte en hopfällning", () => {
    const onNavigate = vi.fn((_h, e) => e.preventDefault());
    const { container } = render(
      <OpsViewHeader title="Kostnader" description="Kort." hjalpHref="/hjalp#hjalp/ekonomi" onNavigate={onNavigate} />,
    );
    expect(container.querySelector("details")).toBeNull();
    const lank = screen.getByRole("link", { name: "Öppna hjälpen" });
    expect(lank.getAttribute("href")).toBe("/hjalp#hjalp/ekonomi");
    fireEvent.click(lank);
    expect(onNavigate).toHaveBeenCalledWith("/hjalp#hjalp/ekonomi", expect.anything());
  });
});
