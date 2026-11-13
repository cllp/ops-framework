import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { KARTA_BYTE } from "../components/KartaForhandsvisning.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * En GeoJSON-fil i Biblioteket visas som karta i detaljen (0.224.0, cllp/lifehub.app#765 skiva 1). Kartvyn själv provas i karta-vy.test.jsx;
 * här provas vägen dit: att detaljen hämtar filen med `hamtaFil` och lämnar texten till `OpsKarta`, och vad som händer utan den och över taket.
 * Röda före 0.224.0: där var en .geojson en fil med länk, utan `[data-bibliotek-karta]`.
 */
vi.mock("../components/OpsKarta.jsx", () => ({
  OpsKarta: ({ data }) => <div data-karta-stub="">{typeof data === "string" ? data : "fel typ"}</div>,
}));

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const GEO = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Dahab" }, geometry: { type: "Point", coordinates: [34.5, 28.5] } }] });
const post = { ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Resan", fil: { sokvag: "g/a/resan.geojson", namn: "resan.geojson", mime: "application/geo+json", byte: GEO.length, klar: true }, skapadAv: skapare, skapad: tid, andrad: tid }), id: "k1" };
const visa = (/** @type {Record<string, unknown>} */ extra) =>
  render(<OpsBibliotek poster={[post]} vald={post} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/resan.geojson"} {...extra} />);

describe("GeoJSON i Biblioteket som karta (#765)", () => {
  it("hämtar filen med hamtaFil och lämnar texten till kartan, med länken kvar under", async () => {
    const hamtaFil = vi.fn(async () => new Blob([GEO]));
    const { container } = visa({ hamtaFil });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-karta=klar]")).not.toBeNull());
    expect(hamtaFil).toHaveBeenCalledWith("g/a/resan.geojson");
    expect(container.querySelector("[data-karta-stub]")?.textContent).toBe(GEO);
    expect(screen.getByRole("link", { name: /resan\.geojson/ })).toBeInTheDocument();
  });

  it("en fil över taket ritas inte, och beskedet säger att den laddas ned", async () => {
    const stor = new Blob([new Uint8Array(KARTA_BYTE + 1)]);
    const { container } = visa({ hamtaFil: vi.fn(async () => stor) });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-karta=stor]")).not.toBeNull());
    expect(container.querySelector("[data-karta-stub]")).toBeNull();
    expect(screen.getByText("Kartan är för stor att visa här. Ladda ned filen för att öppna den.")).toBeInTheDocument();
  });

  it("en fil som inte går att hämta säger det, och ritar ingen karta", async () => {
    const { container } = visa({ hamtaFil: vi.fn(async () => { throw new Error("storage/unauthorized"); }) });
    await waitFor(() => expect(container.querySelector("[data-bibliotek-karta=fel]")).not.toBeNull());
    expect(container.querySelector("[data-karta-stub]")).toBeNull();
  });

  it("utan hamtaFil är den en fil med länk, som förut", () => {
    const { container } = visa({});
    expect(container.querySelector("[data-bibliotek-karta]")).toBeNull();
    expect(screen.getByRole("link", { name: /resan\.geojson/ })).toBeInTheDocument();
  });
});
