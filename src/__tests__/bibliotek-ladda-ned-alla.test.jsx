import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";

/** QA på lifehub.app 2026-11-01: txt-filen ux-upload-test hade bara en länk i detaljen, ingen Ladda ned. */
const post = (id, rubrik, fil) => ({ id, typ: "fil", rubrik, skapad: 1, skapadAv: { uid: "uid-1" }, fil: { byte: 10, sokvag: `grupper/g/bibliotek/${id}/${fil.namn}`, ...fil } });

function Harness({ start }) {
  const [vald, setVald] = useState(null);
  return (
    <OpsBibliotek poster={start} jag={{ uid: "uid-1", roll: "medlem" }} vald={vald} skapar={null}
      onOppna={setVald} onStang={() => setVald(null)} onSkapa={() => {}} onSpara={() => {}}
      filUrl={(p) => `https://exempel.se/${p.fil.sokvag}`} hamtaFil={async () => new Blob(["hej"], { type: "text/plain" })} hubHref="/hub" />
  );
}

describe("Ladda ned i detaljen för varje filtyp", () => {
  for (const [id, namn, mime] of [["txt", "ux-upload-test.txt", "text/plain"], ["pdf", "avtal.pdf", "application/pdf"], ["film", "rep.mp4", "video/mp4"], ["zip", "arkiv.zip", "application/zip"]]) {
    it(`⛔ ${namn} får Ladda ned med download`, () => {
      render(<Harness start={[post(id, `Post ${id}`, { namn, mime })]} />);
      fireEvent.click(screen.getByRole("button", { name: `Post ${id}` }));
      const knapp = screen.getByRole("link", { name: "Ladda ned" });
      expect(knapp).toHaveAttribute("download", namn);
      expect(knapp).toHaveAttribute("href", `https://exempel.se/grupper/g/bibliotek/${id}/${namn}`);
    });
  }
});
