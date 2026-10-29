import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OpsToastProvider, useOpsToast } from "../components/OpsToast.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { ANGRA_MS } from "../components/OpsSvepRad.jsx";

/*
 * Toast med åtgärd (0.153.0, cllp/ops-framework#460 punkt 1). Appen byggde en egen yta för "Händelsen är borttagen" med Ångra eftersom `OpsToast` bekräftade men inte kunde erbjuda något.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: `show` tog inte emot `atgard`, så ingen knapp ritades.
 */

/** @param {Record<string, any>} visning */
function Visa({ visning }) {
  const { show } = useOpsToast();
  return (
    <button type="button" onClick={() => show(visning)}>
      Visa
    </button>
  );
}

/** @param {Record<string, any>} visning @param {import("react").ReactNode} [utanfor] */
function rendera(visning, sprak = "sv") {
  return render(
    <OpsSprakProvider sprak={/** @type {"sv" | "en"} */ (sprak)}>
      <OpsToastProvider>
        <Visa visning={visning} />
      </OpsToastProvider>
    </OpsSprakProvider>,
  );
}
const visa = () => act(async () => screen.getByRole("button", { name: "Visa" }).click());

afterEach(() => {
  vi.useRealTimers();
});

describe("OpsToast med åtgärd", () => {
  it("⛔ ritar en knapp med åtgärdens ord, och ett tryck kör den och stänger toasten", async () => {
    const onKlick = vi.fn();
    rendera({ title: "Händelsen är borttagen", atgard: { etikett: "Ångra", onKlick } });
    await visa();
    const angra = await screen.findByRole("button", { name: "Ångra" });
    fireEvent.click(angra);
    expect(onKlick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Händelsen är borttagen")).toBeNull());
  });

  it("⛔ toasten står kvar och knappen är upptagen medan åtgärden väntar, och stängs när den är klar", async () => {
    /** @type {() => void} */
    let los = () => {};
    const onKlick = vi.fn(() => new Promise((r) => { los = () => r(undefined); }));
    rendera({ title: "Borttagen", atgard: { etikett: "Ångra", onKlick } });
    await visa();
    const knapp = await screen.findByRole("button", { name: /Ångra/ });
    fireEvent.click(knapp);
    fireEvent.click(knapp);
    expect(onKlick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Borttagen")).toBeTruthy();
    expect(knapp.getAttribute("aria-busy")).toBe("true");
    await act(async () => los());
    await waitFor(() => expect(screen.queryByText("Borttagen")).toBeNull());
  });

  /*
   * ⛔ GRANSKNINGEN AV PR 464: åtgärden hade ingen beskrivning för skärmläsare. Radix läser upp toasten som text, och knappen i den nås inte med Tab från där man står;
   * `Toast.Action altText` är Radix väg att säga hur. Mätt som det Radix läser upp (`data-radix-toast-announce-alt` på åtgärden), inte som en klass.
   */
  it("⛔ åtgärden har en beskrivning för skärmläsare, med förval på båda språken och en egen när appen ger den", async () => {
    const alt = () => document.querySelector("[data-toast-atgard-ram]")?.getAttribute("data-radix-toast-announce-alt");
    const forsta = rendera({ title: "Borttagen", atgard: { etikett: "Ångra", onKlick: () => {} } });
    await visa();
    await screen.findByRole("button", { name: "Ångra" });
    expect(alt()).toBe("Ångra: tryck F8 för att nå knappen i aviseringen.");
    forsta.unmount();
    const andra = rendera({ title: "Removed", atgard: { etikett: "Undo", onKlick: () => {} } }, "en");
    await visa();
    await screen.findByRole("button", { name: "Undo" });
    expect(alt()).toBe("Undo: press F8 to reach the button in the notification.");
    andra.unmount();
    rendera({ title: "Borttagen", atgard: { etikett: "Ångra", onKlick: () => {}, beskrivning: "Ångra finns också under Händelser." } });
    await visa();
    await screen.findByRole("button", { name: "Ångra" });
    expect(alt()).toBe("Ångra finns också under Händelser.");
  });

  it("⛔ knappen är 44 px hög under md (samma klasser som OpsButton sm)", async () => {
    rendera({ title: "Borttagen", atgard: { etikett: "Ångra", onKlick: () => {} } });
    await visa();
    const klass = (await screen.findByRole("button", { name: "Ångra" })).className;
    expect(klass).toContain("min-h-11");
    expect(klass).toContain("md:min-h-8");
  });

  it("en toast utan åtgärd har ingen åtgärdsknapp, som förut", async () => {
    rendera({ title: "Sparat" });
    await visa();
    await screen.findByText("Sparat");
    expect(document.querySelector("[data-toast-atgard]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ångra" })).toBeNull();
  });

  it("⛔ tidsfönstret är ANGRA_MS och inte toastens sex sekunder, medan en toast utan åtgärd försvinner efter sex", async () => {
    vi.useFakeTimers();
    const { unmount } = rendera({ title: "Med åtgärd", atgard: { etikett: "Ångra", onKlick: () => {} } });
    await visa();
    expect(screen.getByText("Med åtgärd")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(6500); });
    expect(screen.queryByText("Med åtgärd")).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(ANGRA_MS - 6500 + 600); });
    expect(screen.queryByText("Med åtgärd")).toBeNull();
    unmount();
    rendera({ title: "Utan åtgärd" });
    await visa();
    expect(screen.getByText("Utan åtgärd")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(6600); });
    expect(screen.queryByText("Utan åtgärd")).toBeNull();
  });

  it("⛔ en åtgärd som kastar eller avvisas blir en röd toast med felets text, aldrig tyst", async () => {
    const onKlick = vi.fn(async () => {
      throw new Error("Händelsen gick inte att ta fram igen.");
    });
    rendera({ title: "Borttagen", atgard: { etikett: "Ångra", onKlick } });
    await visa();
    fireEvent.click(await screen.findByRole("button", { name: "Ångra" }));
    expect(await screen.findByText("Det gick inte")).toBeTruthy();
    expect(screen.getByText("Händelsen gick inte att ta fram igen.")).toBeTruthy();
  });

  it("⛔ ett synkront kast i åtgärden blir också en röd toast", async () => {
    rendera({ title: "Borttagen", atgard: { etikett: "Ångra", onKlick: () => { throw new Error("Synkront fel."); } } });
    await visa();
    fireEvent.click(await screen.findByRole("button", { name: "Ångra" }));
    expect(await screen.findByText("Synkront fel.")).toBeTruthy();
  });

  it("felrubriken följer språket", async () => {
    rendera({ title: "Deleted", atgard: { etikett: "Undo", onKlick: () => { throw new Error("Nope."); } } }, "en");
    await visa();
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText("That did not work")).toBeTruthy();
  });

  it("⛔ en åtgärd utan ord eller utan funktion kastar: en knapp som inte gör något är värre än ingen", () => {
    /** @type {((t: Record<string, any>) => void) | null} */
    let show = null;
    function Fang() {
      show = /** @type {any} */ (useOpsToast().show);
      return null;
    }
    render(
      <OpsToastProvider>
        <Fang />
      </OpsToastProvider>,
    );
    for (const atgard of [{ etikett: "", onKlick: () => {} }, { etikett: "Ångra" }, { onKlick: () => {} }, "Ångra"]) {
      expect(() => /** @type {any} */ (show)({ title: "x", atgard }), JSON.stringify(atgard)).toThrow(/atgard kräver/);
    }
    // En tom beskrivning kastar: den är skärmläsarens enda väg till åtgärden (granskningen av PR 464).
    for (const beskrivning of ["", "  ", 7]) {
      expect(() => /** @type {any} */ (show)({ title: "x", atgard: { etikett: "Ångra", onKlick: () => {}, beskrivning } })).toThrow(/beskrivning/);
    }
  });
});
