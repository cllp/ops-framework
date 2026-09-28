import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { rapporteraFel } from "../lib/felrapport.js";
import { OpsAppShell } from "../components/OpsAppShell.jsx";

/**
 * #159: felgräns, loggpunkt och kontrakt.
 *
 * ⛔ SENTRY-MOTTAGAREN PROVAS INTE HÄR. `src/sentry.js` importerar
 * `@sentry/browser`, en SDK ramverket avsiktligt inte installerar åt sig
 * självt (se tsconfig.json:s exclude-kommentar och sentry.js filhuvud).
 * Ett prov som importerar filen skulle kräva paketet installerat, vilket är
 * exakt det motsatta av "laddas bara av den app som väljer det". Kontraktet
 * (`fanga`/`satt`) provas i stället mot en ATTRAPP, precis som ärendets
 * klarkriterium säger: "Prov mot en attrapp, inte mot Sentry."
 */

const NAV = [{ href: "/", label: "Hem" }];

describe("rapporteraFel", () => {
  let spion;
  beforeEach(() => {
    spion = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    spion.mockRestore();
  });

  it("⛔ utan mottagare skriver den ALLTID till konsolen", () => {
    rapporteraFel(new Error("kaboom"));
    expect(spion).toHaveBeenCalled();
  });

  it("med mottagare kallas BÅDE konsolen och mottagaren", () => {
    const fanga = vi.fn();
    rapporteraFel(new Error("kaboom"), { var: "här" }, { fanga, satt: vi.fn() });
    expect(spion).toHaveBeenCalled();
    expect(fanga).toHaveBeenCalledWith(expect.any(Error), { var: "här" });
  });

  it("⛔ kastar aldrig, även om mottagaren själv kastar", () => {
    const trasig = { fanga: () => { throw new Error("mottagaren är trasig"); }, satt: vi.fn() };
    expect(() => rapporteraFel(new Error("kaboom"), undefined, trasig)).not.toThrow();
    // Både det ursprungliga felet OCH mottagarens eget fel hamnar i konsolen.
    expect(spion).toHaveBeenCalledTimes(2);
  });

  it("en mottagare utan fanga-metod ignoreras tyst men kraschar inte", () => {
    expect(() => rapporteraFel(new Error("x"), undefined, /** @type {any} */ ({}))).not.toThrow();
  });
});

/** En vy som kastar så fort den monteras. */
function Trasig() {
  throw new Error("vyn gick sönder");
}

describe("OpsAppShell: felgränsen (#159)", () => {
  let konsolFel;
  beforeEach(() => {
    // React loggar felet en gång till via sin egen `console.error` i utveckling.
    // Det stör inte provet, men släcks för att inte dränka testutskriften.
    konsolFel = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    konsolFel.mockRestore();
  });

  it("⛔ ETT KASTAT FEL GER EN FELYTA, ALDRIG EN VIT SIDA", () => {
    render(
      <OpsAppShell nav={NAV} activeHref="/">
        <Trasig />
      </OpsAppShell>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Något gick fel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ladda om" })).toBeInTheDocument();
  });

  it("felytan bär ett id, för den som ska höra av sig om det", () => {
    render(
      <OpsAppShell nav={NAV} activeHref="/">
        <Trasig />
      </OpsAppShell>,
    );
    // Sex tecken, versaler och siffror (se OpsFelgrans.getDerivedStateFromError).
    const alla = screen.getByRole("alert").textContent ?? "";
    expect(alla).toMatch(/[A-Z0-9]{6}/);
  });

  it("utan fel ritas barnen som vanligt, ingen felyta", () => {
    render(
      <OpsAppShell nav={NAV} activeHref="/">
        <p>Allt är bra</p>
      </OpsAppShell>,
    );
    expect(screen.getByText("Allt är bra")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("⛔ UTAN felmottagare hamnar felet ändå i konsolen (rapporteraFel kastar aldrig en tom funktion)", () => {
    render(
      <OpsAppShell nav={NAV} activeHref="/">
        <Trasig />
      </OpsAppShell>,
    );
    expect(konsolFel).toHaveBeenCalled();
  });

  it("MED felmottagare kallas fanga med felet och ett sammanhang som bär id", () => {
    const fanga = vi.fn();
    render(
      <OpsAppShell nav={NAV} activeHref="/" felmottagare={{ fanga, satt: vi.fn() }}>
        <Trasig />
      </OpsAppShell>,
    );
    expect(fanga).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ id: expect.any(String) }));
  });

  it("etiketterna går att översätta", () => {
    render(
      <OpsAppShell nav={NAV} activeHref="/" felRubrik="Something broke" felBeskrivning="Reload to try again." laddaOmEtikett="Reload">
        <Trasig />
      </OpsAppShell>,
    );
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("Ladda om-knappen laddar om sidan", () => {
    const reload = vi.fn();
    const original = globalThis.location;
    // @ts-expect-error -- jsdom's location kan inte anropas riktigt, ersätts för provet.
    delete globalThis.location;
    globalThis.location = /** @type {any} */ ({ reload });

    render(
      <OpsAppShell nav={NAV} activeHref="/">
        <Trasig />
      </OpsAppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ladda om" }));
    expect(reload).toHaveBeenCalled();

    globalThis.location = original;
  });
});
