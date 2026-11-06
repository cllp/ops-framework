import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpsGastGrupp } from "../components/OpsGastGrupp.jsx";
import { OpsGastSida } from "../components/OpsGastSida.jsx";
import { GastHemskarm } from "../components/GastHemskarm.jsx";
import { GASTGRUPPATGARDER } from "../lib/gast.js";
import { gastBehorighetsrader } from "../lib/gastBehorighet.js";
import { gastHemskarmTips } from "../lib/gastHemskarm.js";
import { gastFlikNyckel } from "../lib/gastminne.js";

/**
 * Översikt för en gruppgäst (0.192.0). Chatten är bara chatten. jsdom mäter vad som står var.
 * Hur höjden ser ut mäts i check-skalyta, avsnitt 56.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("sv-SE");
});

const ID = "a".repeat(64);
const SESSION = "S".repeat(43);
const GRUPP = { namn: "Skarv", beskrivning: "Vi repar på tisdagar.", funktioner: ["chatt", "kalender", "bibliotek"], nedladdning: false, kommentera: false };

function apiMed() {
  return Object.fromEntries(GASTGRUPPATGARDER.map((a) => [a, vi.fn(async () => (a === "chatt" ? { ok: true, meddelanden: [{ id: "m1", av: { namn: "Bo" }, text: "Hej bror", tid: 1 }], fler: false } : { ok: true, poster: [], handelser: [], kalendrar: [], avkortad: false, ejVisade: 0 }))]));
}

describe("behörighetsraderna uppfinner inget", () => {
  it("⛔ bara det gruppen faktiskt gett, och nedladdning av när fältet är false", () => {
    const rader = gastBehorighetsrader(GRUPP, "sv");
    expect(rader).toEqual([
      "Du kan läsa och skriva i chatten, från början.",
      "Du kan se vad som är på gång och svara på händelser.",
      "Du kan läsa och spela i biblioteket. Gruppen har stängt av nedladdning.",
    ]);
    expect(rader.join(" ")).not.toMatch(/kommentera|ärenden/);
  });

  it("tomt är en tom lista, inte en påhittad mening", () => {
    expect(gastBehorighetsrader({ funktioner: [] }, "sv")).toEqual([]);
    expect(gastBehorighetsrader(null, "en")).toEqual([]);
  });
});

describe("hemskärmstips", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

  it("⛔ redan installerad, okänd webbläsare och oläst manifest på Android säger ingenting", () => {
    expect(gastHemskarmTips({ userAgent: IPHONE, standalone: true, sokvag: "/gast" })).toBeNull();
    expect(gastHemskarmTips({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0", sokvag: "/gast" })).toBeNull();
    expect(gastHemskarmTips({ userAgent: ANDROID, sokvag: "/gast", manifest: null })).toBeNull();
  });

  it("⛔ iPhone kräver användarens steg och lovar inte app-läge förrän manifestet säger det", () => {
    const utan = gastHemskarmTips({ userAgent: IPHONE, sokvag: "/gast", iosWebbapp: true, sprak: "sv" });
    expect(utan?.text).toMatch(/Dela/);
    expect(utan?.text).toMatch(/Lägg till på hemskärmen/);
    expect(utan?.text).toMatch(/inte till automatiskt/);
    expect(utan?.lovarApplage).toBe(false);
    expect(utan?.text).not.toMatch(/adressfältet|Skarv/);
    const med = gastHemskarmTips({ userAgent: IPHONE, sokvag: "/gast", iosWebbapp: true, manifest: { display: "standalone", start_url: "/" }, sprak: "sv" });
    expect(med?.lovarApplage).toBe(true);
    expect(med?.text).toMatch(/utan adressfältet/);
    expect(med?.text).not.toMatch(/Skarv|life-hub-/);
    const chrome = gastHemskarmTips({ userAgent: CHROME_IOS, sokvag: "/gast", sprak: "en" });
    expect(chrome?.plattform).toBe("ios-chrome");
    expect(chrome?.text).toMatch(/Add to Home Screen/);
    expect(chrome?.lovarApplage).toBe(false);
  });

  it("⛔ Android med startadress / öppnar startsidan, inte gruppen, och en gäststart är ändå inte en ikon per grupp", () => {
    const annan = gastHemskarmTips({ userAgent: ANDROID, sokvag: "/gast", manifest: { display: "standalone", start_url: "/" }, sprak: "sv" });
    expect(annan?.lovarApplage).toBe(false);
    expect(annan?.text).toMatch(/startsidan, inte den här gruppen/);
    expect(annan?.text).not.toMatch(/Skarv|Lägg till på hemskärmen/);
    const samma = gastHemskarmTips({ userAgent: ANDROID, sokvag: "/guest", manifest: { display: "standalone", start_url: "/guest" }, sprak: "sv" });
    expect(samma?.text).toMatch(/inte en ikon per grupp/);
    expect(samma?.lovarApplage).toBe(false);
  });
});

describe("OpsGastGrupp översikt", () => {
  it("⛔ beskrivningen visas bara när den finns, och chatten har varken den, rollen eller namnrutan", async () => {
    const { unmount } = render(<OpsGastGrupp grupp={GRUPP} api={apiMed()} intervallMs={0} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Skarv");
    expect(document.querySelector("[data-gast-grupp-beskrivning]")?.textContent).toBe("Vi repar på tisdagar.");
    expect(screen.getAllByRole("tab").map((f) => f.textContent)).toEqual(["Översikt", "Chatt", "Kalender", "Bibliotek"]);
    unmount();
    render(<OpsGastGrupp grupp={{ namn: "Skarv", funktioner: ["chatt"] }} api={apiMed()} intervallMs={0} />);
    expect(document.querySelector("[data-gast-grupp-beskrivning]")).toBeNull();
    await act(async () => { fireEvent.mouseDown(screen.getByRole("tab", { name: "Chatt" }), { button: 0 }); });
    expect(await screen.findByText("Hej bror")).toBeInTheDocument();
    expect(document.querySelector("[data-gast-roll]")).toBeNull();
    expect(document.querySelector("[data-gast-grupp-beskrivning]")).toBeNull();
    expect(document.querySelector("[data-gast-namn]")).toBeNull();
    expect(document.querySelector("[data-gast-hemskarm]")).toBeNull();
    expect(document.querySelector("[data-gast-oversikt]")).toBeNull();
  });
});

describe("namn på översikten", () => {
  const lagringMed = (start = {}) => {
    const d = { ...start };
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; }, d };
  };
  const rita = (/** @type {Record<string, any>} */ extra = {}) => {
    const onNamn = vi.fn(async () => {});
    const lagring = extra.lagring ?? lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID });
    render(
      <OpsGastSida
        lank={null}
        onLos={vi.fn()}
        onHamta={vi.fn(async () => ({ ok: true, namn: extra.namn ?? "", funktion: "grupp", grupp: { namn: "Skarv", funktioner: ["chatt"], beskrivning: "" } }))}
        onNyLank={vi.fn()}
        onNamn={onNamn}
        renderGrupp={({ grupp }) => <OpsGastGrupp grupp={grupp} api={apiMed()} intervallMs={0} />}
        intervallMs={0}
        lagring={lagring}
      />,
    );
    return { onNamn, lagring };
  };

  it("⛔ efter sparat namn visas namnet och Ändra, inte ett tomt formulär", async () => {
    const { onNamn } = rita();
    await screen.findByRole("heading", { name: "Skarv" });
    const rad = /** @type {HTMLElement} */ (document.querySelector("[data-gast-oversikt] [data-gast-namn-rad]"));
    expect(rad.querySelector("input")).toBeTruthy();
    expect(rad.querySelector("button")?.textContent).toMatch(/Spara/);
    expect(document.querySelector("[data-gast-chatt] [data-gast-namn]")).toBeNull();
    fireEvent.change(screen.getByLabelText("Vad ska gruppen kalla dig? (valfritt)"), { target: { value: " Anna " } });
    fireEvent.click(screen.getByRole("button", { name: "Spara" }));
    await waitFor(() => expect(onNamn).toHaveBeenCalledWith({ sessionsnyckel: SESSION, namn: "Anna" }));
    expect(await screen.findByText("Gruppen kallar dig Anna.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ändra" })).toBeInTheDocument();
    expect(document.querySelector("[data-gast-namn]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ändra" }));
    expect(screen.getByLabelText("Vad ska gruppen kalla dig? (valfritt)")).toHaveValue("Anna");
  });

  it("ett namn som redan finns visas med Ändra, och en sparad chattflik öppnas i stället för översikten", async () => {
    const lagring = lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID, [gastFlikNyckel(ID)]: "chatt" });
    rita({ namn: "Collan", lagring });
    expect(await screen.findByText("Hej bror")).toBeInTheDocument();
    expect(document.querySelector("[data-gast-oversikt]")).toBeNull();
    await act(async () => { fireEvent.mouseDown(screen.getByRole("tab", { name: "Översikt" }), { button: 0 }); });
    expect(await screen.findByText("Gruppen kallar dig Collan.")).toBeInTheDocument();
    expect(lagring.d[gastFlikNyckel(ID)]).toBe("oversikt");
  });

  it("en saklänk öppnar saken, inte översikten", async () => {
    render(
      <OpsGastSida
        lank={null}
        onLos={vi.fn()}
        onHamta={vi.fn(async () => ({ ok: true, namn: "", funktion: "rosta", sak: { titel: "Rep" } }))}
        onNyLank={vi.fn()}
        renderSak={({ sak }) => <div data-sak="">{sak.titel}</div>}
        renderGrupp={() => <div>Grupp</div>}
        intervallMs={0}
        lagring={lagringMed({ [`ops-gast:${ID}`]: SESSION, "ops-gast:senaste": ID })}
      />,
    );
    expect(await screen.findByText("Rep")).toBeInTheDocument();
    expect(document.querySelector("[data-gast-oversikt]")).toBeNull();
    expect(screen.queryByRole("tab", { name: "Översikt" })).toBeNull();
  });
});

describe("GastHemskarm i jsdom", () => {
  it("ritar inget tips när webbläsaren inte är en telefon vi känner", () => {
    render(<GastHemskarm sprak="sv" miljo={{ userAgent: "jsdom", sokvag: "/gast", standalone: false }} />);
    expect(document.querySelector("[data-gast-hemskarm]")).toBeNull();
  });
});
