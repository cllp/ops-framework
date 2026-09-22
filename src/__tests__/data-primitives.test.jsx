import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsTable } from "../components/OpsTable.jsx";
import { OpsStat } from "../components/OpsStat.jsx";
import { OpsBanner } from "../components/OpsBanner.jsx";
import { OpsEmpty } from "../components/OpsEmpty.jsx";
import { OpsTag } from "../components/OpsTag.jsx";
import { OpsTabs, OpsTabPanel } from "../components/OpsTabs.jsx";
import { OpsCheckbox, OpsSwitch } from "../components/OpsToggle.jsx";
import { OpsProvenance } from "../components/OpsProvenance.jsx";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent, MISSING, NUMBER_SPACE } from "../lib/format.js";

/** @param {() => void} kor @param {RegExp} meddelande */
function forvantaKrasch(kor, meddelande) {
  const tyst = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(kor).toThrow(meddelande);
  } finally {
    tyst.mockRestore();
  }
}

const KOLUMNER = [
  { key: "titel", label: "Leverantör" },
  { key: "belopp", label: "Belopp", numeric: true },
];
const RADER = [
  { id: "1", title: "Fortnox", belopp: "1 200 kr" },
  { id: "2", title: "Telia", belopp: "449 kr" },
];

describe("OpsTable", () => {
  it("bygger en riktig tabell med kolumnrubriker", () => {
    render(<OpsTable caption="Kostnader 2026" columns={KOLUMNER} rows={RADER} />);
    expect(screen.getByRole("table", { name: "Kostnader 2026" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Leverantör" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); // rubrikrad + tva datarader
  });

  // ⛔ Utan caption är en tabell bara ett rutnät av lösryckta värden för den
  // som lyssnar i stället för ser.
  it("vägrar en tabell utan caption", () => {
    forvantaKrasch(() => render(<OpsTable columns={KOLUMNER} rows={RADER} />), /caption krävs/);
  });

  it("behåller namnet för skärmläsare även när rubriken döljs visuellt", () => {
    render(<OpsTable caption="Kostnader 2026" hideCaption columns={KOLUMNER} rows={RADER} />);
    expect(screen.getByRole("table", { name: "Kostnader 2026" })).toBeInTheDocument();
  });

  it("visar tomt tillstånd i stället för en tabell utan rader", () => {
    render(<OpsTable caption="Kostnader" columns={KOLUMNER} rows={[]} empty={<OpsEmpty title="Inga kostnader" />} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Inga kostnader")).toBeInTheDocument();
  });
});

describe("OpsBanner", () => {
  // ⛔ Rollen växlar med tonen. Ger man allt role="alert" slutar användaren
  // lita på avbrotten, och då går det riktiga felet förlorat i bruset.
  it("avbryter för fel men inte för information", () => {
    const { unmount } = render(<OpsBanner tone="danger" title="Deployen misslyckades" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Deployen misslyckades");
    unmount();

    render(<OpsBanner tone="info" title="Uppdaterad i går" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Uppdaterad i går");
  });

  it("namnger stängknappen", () => {
    render(<OpsBanner title="Klart" onDismiss={() => {}} dismissLabel="Stäng meddelandet" />);
    expect(screen.getByRole("button", { name: "Stäng meddelandet" })).toBeInTheDocument();
  });
});

describe("OpsEmpty", () => {
  // ⛔ "Inga träffar" och "hämtar" ser likadana ut men betyder motsatta saker.
  it("säger hämtar i stället för tomt medan det laddar", () => {
    render(<OpsEmpty busy title="Inga kostnader" description="Lägg till den första" />);
    expect(screen.getByText("Hämtar")).toBeInTheDocument();
    expect(screen.queryByText("Inga kostnader")).not.toBeInTheDocument();
    expect(screen.queryByText("Lägg till den första")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});

describe("OpsTag", () => {
  it("ger samma ton för samma etikett varje gång", () => {
    const { container: a } = render(<OpsTag label="Mat" />);
    const { container: b } = render(<OpsTag label="Mat" />);
    expect(a.firstChild.className).toBe(b.firstChild.className);
  });

  it("skiljer olika etiketter åt", () => {
    const klasser = new Set(
      ["Mat", "Bil", "Bostad", "IT", "Streaming", "Försäkring", "Skola", "Transport"].map(
        (l) => render(<OpsTag label={l} />).container.firstChild.className,
      ),
    );
    expect(klasser.size).toBeGreaterThan(1);
  });

  // ⛔ Utan etikettnamnet läser skärmläsaren upp "ta bort" tio gånger i rad.
  it("säger vilken etikett bort-knappen tar bort", () => {
    render(<OpsTag label="Systembolaget" onRemove={() => {}} />);
    expect(screen.getByRole("button", { name: "Ta bort Systembolaget" })).toBeInTheDocument();
  });
});

describe("OpsTabs", () => {
  const FLIKAR = [
    { id: "a", label: "Utfall" },
    { id: "b", label: "Prognos" },
  ];

  it("visar bara den aktiva panelen", () => {
    render(
      <OpsTabs tabs={FLIKAR} value="a" onChange={() => {}} ariaLabel="Vy">
        <OpsTabPanel id="a">Utfallet</OpsTabPanel>
        <OpsTabPanel id="b">Prognosen</OpsTabPanel>
      </OpsTabs>,
    );
    expect(screen.getByRole("tab", { name: "Utfall", selected: true })).toBeInTheDocument();
    expect(screen.getByText("Utfallet")).toBeInTheDocument();
    expect(screen.queryByText("Prognosen")).not.toBeInTheDocument();
  });

  // ⛔ `element.click()` räcker inte mot Radix, som lyssnar på pointer-events.
  // Ett test som använder det blir grönt av fel skäl på en enklare komponent
  // och rött här, vilket är precis rätt: interaktionen ska provas som en
  // användare gör den, inte som DOM:en råkar tillåta.
  it("byter flik när man klickar", async () => {
    const onChange = vi.fn();
    render(
      <OpsTabs tabs={FLIKAR} value="a" onChange={onChange} ariaLabel="Vy">
        <OpsTabPanel id="a">Utfallet</OpsTabPanel>
      </OpsTabs>,
    );
    await userEvent.click(screen.getByRole("tab", { name: "Prognos" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("vägrar en namnlös flikrad", () => {
    forvantaKrasch(
      () =>
        render(
          <OpsTabs tabs={FLIKAR} value="a" onChange={() => {}}>
            <OpsTabPanel id="a">x</OpsTabPanel>
          </OpsTabs>,
        ),
      /ariaLabel krävs/,
    );
  });
});

describe("kryssruta och reglage", () => {
  // ⛔ Bygger på ett riktigt input-element, inte ett div med role.
  it("kryssrutan är ett riktigt fält som går att nå via sin etikett", () => {
    const onChange = vi.fn();
    render(<OpsCheckbox label="Visa arkiverade" checked={false} onChange={onChange} />);
    const ruta = screen.getByRole("checkbox", { name: "Visa arkiverade" });
    ruta.click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reglaget annonseras som switch, inte som kryssruta", () => {
    render(<OpsSwitch label="Mörkt läge" checked onChange={() => {}} />);
    expect(screen.getByRole("switch", { name: "Mörkt läge" })).toBeChecked();
  });
});

describe("OpsProvenance", () => {
  // ⛔ Ordet skrivs alltid ut. En färgad prick går inte att läsa upp.
  it("bär betydelsen i text", () => {
    render(<OpsProvenance kind="agent" />);
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("vägrar ett okänt slag", () => {
    forvantaKrasch(() => render(<OpsProvenance kind="robot" />), /okänt kind/);
  });
});

describe("OpsStat", () => {
  it("visar etikett, värde och jämförelse", () => {
    render(<OpsStat label="Öppna ärenden" value="12" hint="3 fler än i går" />);
    expect(screen.getByText("Öppna ärenden")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3 fler än i går")).toBeInTheDocument();
  });

  it("vägrar en okänd ton", () => {
    forvantaKrasch(() => render(<OpsStat label="x" value="1" tone="lila" />), /okänd tone/);
  });
});

describe("formatering", () => {
  it("skriver belopp med svensk avgränsare och valuta", () => {
    const ut = formatCurrency(1234567);
    expect(ut).toContain("kr");
    // ⛔ Vi jämför INTE mot ett specifikt mellanslagstecken. Vilket Intl väljer
    // beror på ICU-versionen, alltså på vilken Node som kör, och ett test som
    // låser tecknet går sönder vid nästa runtime-uppgradering och ser då ut som
    // att formateringen är trasig.
    expect(ut).not.toBe("1234567 kr");
    expect(ut.replace(NUMBER_SPACE, "")).toBe("1234567kr");
  });

  it("visar tomhet som streck i stället för NaN eller noll", () => {
    // Bindestreck, inte tankstreck: Intl sätter U+2212 framför negativa tal, så
    // platshållaren kan inte forvaxlas med ett minustecken.
    expect(MISSING).toBe("-");
    // ⛔ En saknad siffra som visas som 0 kr är en LÖGN om datan, och den
    // lögnen syns inte. Ett streck syns.
    expect(formatCurrency(null)).toBe(MISSING);
    expect(formatNumber(undefined)).toBe(MISSING);
    expect(formatPercent(Number.NaN)).toBe(MISSING);
    expect(formatDate("")).toBe(MISSING);
    expect(formatDate("inte-ett-datum")).toBe(MISSING);
  });

  it("tar andel och inte procenttal", () => {
    expect(formatPercent(0.42)).toContain("42");
    expect(formatPercent(0.42)).toContain("%");
  });

  // ⛔ new Date("2026-09-15") tolkas som UTC. Utan tidszonshanteringen visas
  // datumet som dagen innan i svensk sommartid.
  it("visar ett rent datum som samma dag, inte dagen innan", () => {
    expect(formatDate("2026-07-01")).toContain("01");
    expect(formatDate("2026-07-01", { style: "long" })).toContain("1 juli");
  });

  it("formaterar datum och tid tillsammans", () => {
    const ut = formatDateTime(new Date(2026, 8, 15, 14, 5));
    expect(ut).toContain("2026");
    expect(ut).toContain("14");
    expect(ut).toContain("05");
  });

  it("avrundar decimaler i stället för att klippa", () => {
    expect(formatNumber(2.5, { decimals: 0 })).toBe("3");
    expect(formatCurrency(-1500).replace(NUMBER_SPACE, "")).toContain("1500");
  });
});
