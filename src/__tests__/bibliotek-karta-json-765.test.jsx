import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsPlatsfiler } from "../components/OpsPlatsfiler.jsx";
import { createMemorySource } from "../data/adapters.js";
import { createBibliotekskalla } from "../data/bibliotekkalla.js";
import { arKartfil, byggPost, handelseBibliotek, mimeForFil } from "../lib/bibliotek.js";

/*
 * CP 2026-11-14 i cllp/lifehub.app#765: "Jag kan inte se att jag får upp en karta. Bara json från firebase storage." (0.228.0)
 *
 * Fram till 0.226.0 ritades kartan bara för exakt `application/geo+json`, filnamnet i detaljen var en länk till lagringen med sin token, och `OpsPlatsfiler` vidarebefordrade inte `hamtaFil`.
 * Varje prov här har setts falla (regel 4): rött mot origin/main (0.226.0), grönt med grenen. Utfallen står i rapporten och i PR-texten.
 */
vi.mock("../components/OpsKarta.jsx", () => ({
  OpsKarta: ({ data }) => <div data-karta-stub="">{typeof data === "string" ? data : "fel typ"}</div>,
}));

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const ADRESS = "https://firebasestorage.googleapis.com/v0/b/x/o/g%2Fa%2Ffil?alt=media&token=hemlig";
const GEO = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Dahab" }, geometry: { type: "Point", coordinates: [34.5, 28.5] } }] });
const ANNAN_JSON = JSON.stringify({ namn: "Resan", dagar: 4 });

const filpost = (/** @type {string} */ namn, /** @type {string} */ mime, /** @type {string} */ innehall) =>
  ({ ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Resan", fil: { sokvag: `g/a/${namn}`, namn, mime, byte: innehall.length, klar: true }, skapadAv: skapare, skapad: tid, andrad: tid }), id: "k1" });

const visa = (/** @type {any} */ post, /** @type {string} */ innehall) => {
  const hamtaFil = vi.fn(async () => new Blob([innehall]));
  const utfall = render(<OpsBibliotek poster={[post]} vald={post} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => ADRESS} hamtaFil={hamtaFil} />);
  return { ...utfall, hamtaFil };
};

/** Ingen tryckbar länk i sidan bär lagringens adress. */
const ingenLagringslank = (/** @type {HTMLElement} */ container) => {
  for (const el of container.querySelectorAll("[href]")) expect(el.getAttribute("href")).not.toContain("token=");
};

describe("en karta också när filen inte sades vara application/geo+json (#765)", () => {
  it("⛔ x.geojson med application/json ger en karta", async () => {
    const { container } = visa(filpost("x.geojson", "application/json", GEO), GEO);
    await waitFor(() => expect(container.querySelector("[data-bibliotek-karta=klar]")).not.toBeNull());
    expect(container.querySelector("[data-karta-stub]")?.textContent).toBe(GEO);
  });

  it("⛔ en .json med GeoJSON i ger en karta", async () => {
    const { container, hamtaFil } = visa(filpost("rutt.json", "application/json", GEO), GEO);
    await waitFor(() => expect(container.querySelector("[data-bibliotek-karta=klar]")).not.toBeNull());
    expect(hamtaFil).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-karta-stub]")?.textContent).toBe(GEO);
  });

  it("⛔ en .json som inte är GeoJSON visas som text, aldrig som en länk", async () => {
    const { container, hamtaFil } = visa(filpost("resa.json", "application/json", ANNAN_JSON), ANNAN_JSON);
    await waitFor(() => expect(container.querySelector("[data-bibliotek-text=klar]")).not.toBeNull());
    expect(container.querySelector("[data-bibliotek-text=klar]")?.textContent).toBe(ANNAN_JSON);
    expect(container.querySelector("[data-karta-stub]")).toBeNull();
    // Byten hämtades en gång: textrutan får dem som redan lästs.
    expect(hamtaFil).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: /resa\.json/ })).toBeNull();
    ingenLagringslank(container);
  });

  it("⛔ ingen [data-bibliotek-filnamnslank] med lagringsadress när kartan visas, och Ladda ned är en knapp", async () => {
    const { container } = visa(filpost("resan.geojson", "application/geo+json", GEO), GEO);
    await waitFor(() => expect(container.querySelector("[data-bibliotek-karta=klar]")).not.toBeNull());
    expect(container.querySelector("[data-bibliotek-filnamnslank]")).toBeNull();
    expect(container.querySelector("[data-bibliotek-filnamn]")?.textContent).toContain("resan.geojson");
    expect(screen.getByRole("button", { name: "Ladda ned" })).toBeInTheDocument();
    ingenLagringslank(container);
  });
});

describe("mimeForFil: typen när filen läggs in (#765)", () => {
  it("⛔ .geojson blir application/geo+json med application/json, med octet-stream och utan typ", () => {
    expect(mimeForFil("x.geojson", "application/json")).toBe("application/geo+json");
    expect(mimeForFil("x.geojson", "application/octet-stream")).toBe("application/geo+json");
    expect(mimeForFil("x.geojson", "")).toBe("application/geo+json");
    expect(mimeForFil("x.geojson", undefined)).toBe("application/geo+json");
    expect(mimeForFil("X.GEOJSON", "Application/JSON; charset=utf-8")).toBe("application/geo+json");
  });
  it("en .json är JSON, och en typ webbläsaren säger gäller annars", () => {
    expect(mimeForFil("rutt.json", "application/json")).toBe("application/json");
    expect(mimeForFil("rutt.json", "application/octet-stream")).toBe("application/json");
    expect(mimeForFil("bild.png", "image/png")).toBe("image/png");
    expect(mimeForFil("okand.xyz", "application/octet-stream")).toBe("application/octet-stream");
    expect(mimeForFil("okand.xyz", "")).toBe("");
  });
  it("⛔ källans laddaUppFil sparar en .geojson som application/geo+json när telefonen säger octet-stream", async () => {
    const kalla = createBibliotekskalla({
      source: createMemorySource({ bibliotek: [] }),
      collection: "bibliotek",
      groupId: "cps-ab",
      skapare: () => skapare,
      jag: () => JAG,
      anteckna: () => {},
      lagring: { laddaUpp: vi.fn(async () => {}) },
      sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
    });
    const post = await kalla.laddaUppFil({ fil: { name: "rutt.geojson", type: "application/octet-stream", size: GEO.length, arrayBuffer: async () => new TextEncoder().encode(GEO).buffer } });
    expect(post.fil?.mime).toBe("application/geo+json");
  });
});

describe("arKartfil: ett hem för vad som är en karta (#765)", () => {
  const p = (/** @type {string} */ namn, /** @type {string} */ mime) => ({ fil: { namn, mime } });
  it("ja för geo+json och för ändelsen, innehållet avgör för application/json", () => {
    expect(arKartfil(p("a.bin", "application/geo+json"))).toBe(true);
    expect(arKartfil(p("a.geojson", "application/json"))).toBe(true);
    expect(arKartfil(p("a.json", "application/json"))).toBeNull();
    expect(arKartfil(p("a.json", "application/json"), GEO)).toBe(true);
    expect(arKartfil(p("a.json", "application/json"), ANNAN_JSON)).toBe(false);
    expect(arKartfil(p("a.json", "application/json"), "{trasig")).toBe(false);
    expect(arKartfil(p("a.txt", "text/plain"), GEO)).toBe(false);
  });
});

describe("OpsPlatsfiler med hamtaFil (#765)", () => {
  it("⛔ en händelses GeoJSON-fil ritas som karta", async () => {
    const PLATS = handelseBibliotek("travel", "h1");
    const KIM = { uid: "uid-kim", roll: "medlem", groupId: "travel", status: "aktiv" };
    const post = {
      id: "p1",
      groupId: PLATS,
      typ: "fil",
      rubrik: "Rutten",
      fil: { sokvag: `grupper/${PLATS}/bibliotek/p1/rutt.geojson`, namn: "rutt.geojson", mime: "application/geo+json", byte: GEO.length, klar: true },
      skapadAv: { uid: KIM.uid, namn: "Kim", typ: "manniska", kalla: "bibliotek" },
      skapad: tid,
      andrad: tid,
    };
    const kalla = createBibliotekskalla({
      source: createMemorySource({ bibliotek: [post] }),
      collection: "bibliotek",
      groupId: PLATS,
      skapare: () => post.skapadAv,
      jag: () => KIM,
      anteckna: () => {},
      lagring: { laddaUpp: vi.fn(async () => {}) },
      sokvag: ({ groupId: g, postId, namn }) => `grupper/${g}/bibliotek/${postId}/${namn}`,
    });
    const hamtaFil = vi.fn(async () => new Blob([GEO]));
    const { container } = render(<OpsPlatsfiler kalla={kalla} jag={KIM} kanLaggaTill filUrl={() => ADRESS} hamtaFil={hamtaFil} />);
    (await screen.findByRole("button", { name: "Rutten" })).click();
    await waitFor(() => expect(container.querySelector("[data-bibliotek-karta=klar]")).not.toBeNull());
    expect(hamtaFil).toHaveBeenCalledWith(post.fil.sokvag);
    ingenLagringslank(container);
  });
});
