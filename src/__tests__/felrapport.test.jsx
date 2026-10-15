import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FELMOTTAGARE_HALL_MS, rapporteraFel, registreraFelmottagare } from "../lib/felrapport.js";
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

describe("en mottagare som rapporterar sina egna fel (granskningen av PR 392, BÖR 1)", () => {
  let spion;
  beforeEach(() => {
    spion = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    spion.mockRestore();
    vi.useRealTimers();
  });

  it("⛔ synkront: en fanga som anropar rapporteraFel når inte sig själv igen", () => {
    const fanga = vi.fn(() => {
      rapporteraFel(new Error("inre"), { yta: "mottagaren" });
    });
    const av = registreraFelmottagare({ fanga, satt: vi.fn() });
    try {
      rapporteraFel(new Error("yttre"));
      // Röd utan skyddet: 3 809 anrop för ett fel, tills stacken tog slut (granskarens mätning).
      expect(fanga).toHaveBeenCalledTimes(1);
      // Det inre felet syns ändå i konsolen, med en rad som säger varför det inte gick vidare.
      const rader = spion.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
      expect(rader).toContain("inre");
      expect(rader).toContain("gick bara till konsolen");
      // Efteråt är mottagaren fri igen.
      rapporteraFel(new Error("nästa"));
      expect(fanga).toHaveBeenCalledTimes(2);
    } finally {
      av();
    }
  });

  it("⛔ asynkront: en nekad skrivning vars fel mottagaren rapporterar loopar inte", async () => {
    vi.useFakeTimers();
    // Som en Firestore-skrivning som nekas av reglerna: löftet avvisas en stund senare.
    const skriv = vi.fn(() => new Promise((_, nej) => setTimeout(() => nej(Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" })), 10)));
    const fanga = vi.fn((/** @type {unknown} */ _fel) => skriv().catch((e) => rapporteraFel(e, { yta: "felmottagaren" })));
    const av = registreraFelmottagare({ fanga, satt: vi.fn() });
    try {
      rapporteraFel(new Error("ursprunget"));
      await vi.advanceTimersByTimeAsync(200);
      // Röd utan skyddet: ett nytt fanga och en ny skrivning var tionde millisekund, utan slut.
      expect(fanga).toHaveBeenCalledTimes(1);
      expect(skriv).toHaveBeenCalledTimes(1);
      // När skrivningen avgjorts är mottagaren fri, och ett nytt fel når den.
      rapporteraFel(new Error("ett annat fel"));
      expect(fanga).toHaveBeenCalledTimes(2);
    } finally {
      av();
    }
  });
});

describe("hållet har ett tak (granskningen av PR 392 varv 2, MÅSTE 1)", () => {
  let spion;
  beforeEach(() => {
    spion = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
  });
  afterEach(() => {
    spion.mockRestore();
    vi.useRealTimers();
  });

  it("⛔ ett löfte som aldrig avgörs (en skrivning utan nät) låser inte mottagaren: efter taket når nästa fel den", async () => {
    const fanga = vi.fn(() => new Promise(() => {}));
    const av = registreraFelmottagare({ fanga, satt: vi.fn() });
    try {
      rapporteraFel(new Error("utan nät"));
      await vi.advanceTimersByTimeAsync(FELMOTTAGARE_HALL_MS - 10);
      rapporteraFel(new Error("medan skrivningen står"));
      expect(fanga).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(20);
      rapporteraFel(new Error("TALK: inspelningen gav inget ljud"), { steg: "tomt-ljud" });
      // Röd utan taket: mottagaren var låst för resten av sidans liv, och diagnosen gick bara till konsolen.
      expect(fanga).toHaveBeenCalledTimes(2);
    } finally {
      av();
    }
  });

  it("⛔ ett avvisat löfte släpper mottagaren direkt, inte först vid taket", async () => {
    const fanga = vi.fn(() => new Promise((_, nej) => setTimeout(() => nej(new Error("permission-denied")), 10)));
    const av = registreraFelmottagare({ fanga, satt: vi.fn() });
    try {
      rapporteraFel(new Error("första"));
      await vi.advanceTimersByTimeAsync(20);
      rapporteraFel(new Error("andra"));
      // Röd utan släppet i avvisningsgrenen: mottagaren hölls till taket, och det andra felet gick bara till konsolen.
      expect(fanga).toHaveBeenCalledTimes(2);
      expect(spion.mock.calls.map((c) => c.map(String).join(" ")).join("\n")).toContain("felmottagaren själv föll");
    } finally {
      av();
    }
  });

  it("⛔ ett thenable vars then kastar låser inte mottagaren", () => {
    const fanga = vi.fn(() => ({
      then() {
        throw new Error("trasigt then");
      },
    }));
    const av = registreraFelmottagare({ fanga, satt: vi.fn() });
    try {
      rapporteraFel(new Error("första"));
      rapporteraFel(new Error("andra"));
      // Röd före rättelsen: asynkront läge sattes innan then anropades, så finally släppte aldrig.
      expect(fanga).toHaveBeenCalledTimes(2);
    } finally {
      av();
    }
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
