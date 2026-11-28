import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";

/*
 * Ett sparat mejl i Biblioteket visas tolkat (0.270.0, cllp/lifehub.app#884 punkt 4). Röda före 0.270.0: en .eml hade ingen förhandsvisning.
 * ⛔ SYNTETISKT MEJL.
 */
const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-1", roll: "medlem" };
const post = { ...byggPost({ groupId: "cps-ab", typ: "fil", rubrik: "Brevet", fil: { sokvag: "g/a/brev.eml", namn: "brev.eml", mime: "message/rfc822", byte: 100, klar: true }, skapadAv: skapare, skapad: tid, andrad: tid }), id: "m1" };
const visa = (/** @type {string} */ innehall) =>
  render(<OpsBibliotek poster={[post]} vald={post} jag={JAG} onOppna={() => {}} onStang={() => {}} onSkapa={() => {}} onSpara={() => {}} hubHref="/hub" filUrl={() => "https://lagring.example/x"} hamtaFil={vi.fn(async () => new Blob([innehall]))} />);

describe("mejl i Biblioteket (#884)", () => {
  it("⛔ rubrikerna, texten och bilagan, ingen bild från mejlet, och Ladda ned under", async () => {
    const eml = [
      "From: Bo <bo@example.com>",
      "To: Kim <kim@example.com>",
      "Subject: Lokalen",
      'Content-Type: multipart/mixed; boundary="g"',
      "",
      "--g",
      "Content-Type: text/html; charset=utf-8",
      "",
      '<p>Lokalen är bokad.</p><img src="https://spar.example/pixel.gif">',
      "--g",
      'Content-Type: image/png; name="karta.png"',
      "Content-Transfer-Encoding: base64",
      "",
      "iVBORw0KGgo=",
      "--g--",
    ].join("\r\n");
    const { container } = visa(eml);
    await waitFor(() => expect(container.querySelector("[data-bibliotek-mejl=klar]")).not.toBeNull());
    const region = screen.getByRole("region", { name: "Mejlet i Brevet" });
    expect(within(region).getByText("Bo <bo@example.com>")).toBeInTheDocument();
    expect(within(region).getByText("Lokalen")).toBeInTheDocument();
    expect(container.querySelector("[data-mejl-text]")?.textContent).toBe("Lokalen är bokad.");
    expect(screen.getByText("Mejlet var formaterat. Här visas bara texten, utan bilder.")).toBeInTheDocument();
    expect(container.querySelector("[data-mejl-bilagor]")?.textContent).toContain("karta.png");
    expect(container.querySelector('img[src^="https://spar.example"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Ladda ned" })).toBeInTheDocument();
  });

  it("en fil som inte är ett mejl visas som text, med en rad som säger det", async () => {
    const { container } = visa("Bara text.");
    await waitFor(() => expect(container.querySelector("[data-bibliotek-mejl=text]")).not.toBeNull());
    expect(screen.getByText("Filen går inte att läsa som ett mejl, så den visas som text.")).toBeInTheDocument();
  });
});
