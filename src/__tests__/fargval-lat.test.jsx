import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/*
 * Färgväljaren läses in när den ritas (0.238.2, cllp/lifehub.app#883). 0.238.0 lät `OpsGruppmarkeValjare` importera `OpsFargval` statiskt, och väljaren
 * hamnade i appens startfil: 14 419 byte gzip över lifehub.app:s tak.
 *
 * ⛔ DET HÄR MÄTER BETEENDET, INTE KÄLLTEXTEN: `OpsFargval.jsx` ersätts av en modul som räknar när den utvärderas. Att importera kulörväljaren får inte utvärdera
 * färgväljaren. Det gör den först när väljaren ritas. Bytesmåttet i bundeln (`check:delbarhet`) är det andra benet.
 */
afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock("../components/OpsFargval.jsx");
});

const T = {
  farg: "Färg", initialer: "Initialer", ikonEllerLogotyp: "Ikon eller initialer", egnaInitialer: "Egna initialer", egnaInitialerHint: "", aterstallInitialer: "Återställ",
  kulorExakt: "", kulorGrader: "", kulorAterstall: "Kulör ur gruppen", kulorHint: "", sokIkon: "Sök ikon", sokIkonPlatshallare: "", forslagUrNamn: "Förslag", forslagInga: "Inga",
  forslagSkrivNamn: "Skriv", senastAnvanda: "Senast", senastInga: "Inga ännu", vanliga: "Vanliga", traffar: "Träffar", ingaTraffar: "Inga träffar", traffarStatus: "{n}", ingetMatchar: "Inget",
};

async function iBeredskap() {
  const utvarderad = vi.fn();
  vi.doMock("../components/OpsFargval.jsx", async () => {
    utvarderad();
    return vi.importActual("../components/OpsFargval.jsx");
  });
  const { OpsGruppmarkeValjare } = await import("../components/OpsGruppmarkeValjare.jsx");
  return { OpsGruppmarkeValjare, utvarderad };
}

describe("⛔ OpsFargvalLat", () => {
  it("att importera kulörväljaren utvärderar inte färgväljaren", async () => {
    const { utvarderad } = await iBeredskap();
    expect(utvarderad).not.toHaveBeenCalled();
  });

  it("när väljaren ritas syns väntan, och sedan färgväljaren", async () => {
    const { OpsGruppmarkeValjare, utvarderad } = await iBeredskap();
    const { container } = render(
      <OpsGruppmarkeValjare namn="Bandet" seed="g1" farg="" ikon="" onFarg={() => {}} onIkon={() => {}} sprak="sv" t={T} idPrefix="p" />,
    );
    const vantan = container.querySelector("[data-fargval-hamtar]");
    expect(vantan?.getAttribute("aria-busy")).toBe("true");
    expect(vantan?.textContent).toContain("Hämtar färgväljaren");
    expect(await screen.findByRole("button", { name: "Färg" })).toBeTruthy();
    expect(utvarderad).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-fargval-hamtar]")).toBeNull();
  });
});
