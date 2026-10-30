import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * Versionsraden är inläst när den behövs (0.159.0): koden hämtas först när detaljen för ett HTML-dokument ritas, och medan den hämtas står en tom ruta med radens höjd.
 *
 * ⛔ RÖTT UTAN ÄNDRINGEN: med den statiska importen från 0.158.0 finns ingen väntruta (raden är där direkt), så första provet är rött, och ingen import kan fallera, så andra provet
 * (som får `import` att kasta) hittar aldrig sin mening. Grönt med den lata importen: båda ordningarna syns. Rutans höjd mäts i riktig CSS i `check:skalyta`, avsnitt 59 (g).
 *
 * Det här är ett eget provfil eftersom `htmldokument-versioner.test.jsx` importerar modulen statiskt (för ordlistan), och en redan laddad modul gör väntan omöjlig att se.
 */

const tid = 1_700_000_000_000;
const KIM = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const post = {
  ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Rapport", fil: { sokvag: "grupper/cps-ab/bibliotek/p1/rapport.html", namn: "rapport.html", mime: "text/html", byte: 20, klar: true }, skapadAv: KIM, skapad: tid, andrad: tid, version: { nr: 3, av: KIM, tid } }),
  id: "p1",
};

function rita() {
  return render(
    <OpsSprakProvider sprak="sv">
      <OpsBibliotek
        poster={[post]}
        jag={{ uid: "uid-1", roll: "medlem" }}
        vald={post}
        onOppna={() => {}}
        onStang={() => {}}
        onSpara={() => {}}
        hubHref="/hub"
        filUrl={() => "https://lagring.example/fil"}
        hamtaFil={async () => new Blob(["<h1>Nu</h1>"], { type: "text/html" })}
        htmlVersioner={async () => ({ nuvarande: 3, versioner: [] })}
      />
    </OpsSprakProvider>,
  );
}

describe("Versionsraden hämtas när den behövs", () => {
  it("⛔ först en tom ruta utan text och dold för skärmläsare, sedan raden på samma plats", async () => {
    rita();
    // Direkt efter första ritningen: väntrutan, inte raden.
    const ruta = document.querySelector("[data-html-versioner-vantar]");
    expect(ruta).not.toBeNull();
    expect(ruta?.getAttribute("aria-hidden")).toBe("true");
    expect((ruta?.textContent ?? "").replace(/ /g, "").trim()).toBe("");
    expect(document.querySelector("[data-html-versioner]")).toBeNull();
    // Sedan raden, och rutan är borta.
    expect(await screen.findByText("Versioner")).toBeTruthy();
    expect(document.querySelector("[data-html-versioner-vantar]")).toBeNull();
    expect(document.querySelectorAll("[data-html-versioner]")).toHaveLength(1);
    expect(screen.getByText("Version 3")).toBeTruthy();
  });
});
