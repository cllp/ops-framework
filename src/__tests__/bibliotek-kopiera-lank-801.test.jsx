import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsBibliotek } from "../components/OpsBibliotek.jsx";
import { byggPost } from "../lib/bibliotek.js";
import { bibliotekslank } from "../lib/postkommentar.js";

/**
 * ⛔ KOPIERA LÄNK LÄMNAR ALDRIG UT FILENS NEDLADDNINGSADRESS (lifehub.app#801, QA A01, 2026-11-12).
 *
 * QA i SessionStudio 1.0.1171: Kopiera länk på en fil i biblioteket gav en rå firebasestorage-adress med token. Den öppnades utan
 * inloggning, gick inte ut och kunde inte dras tillbaka, så den gick förbi Dela länk (utgång, kod). Orsaken: för en medlem kopierade
 * raden adressen visningen redan hade (`filUrl`, i appen `getDownloadURL`). Rött på 0.219.0, grönt med 0.220.0:
 *
 *   medlemmens fil kopierar `filUrl`                RÖTT: urklippet får tokenadressen
 *   Kopiera länk utan `postlank`                    RÖTT: raden finns och kopierar tokenadressen
 *
 * Golv: urklippet har fått exakt ett värde, så att "inte tokenadressen" inte blir grönt av att ingenting kopierades.
 */

const tid = 1_700_000_000_000;
const skapare = { uid: "uid-1", namn: "Kim", typ: "manniska", kalla: "bibliotek" };
const JAG = { uid: "uid-2", roll: "medlem" };
const BAS = "https://app.exempel.se/bibliotek";
const TOKENADRESS = "https://firebasestorage.googleapis.com/v0/b/x/o/grupper%2Fcps-ab%2Fa.pdf?alt=media&token=hemlig";

const med = (extra) => ({ groupId: "cps-ab", skapadAv: skapare, skapad: tid, andrad: tid, ...extra });
const FIL = { ...byggPost(med({ typ: "fil", rubrik: "Avtal", fil: { sokvag: "grupper/cps-ab/bibliotek/f1/a.pdf", namn: "a.pdf", mime: "application/pdf", byte: 2048 } })), id: "f1" };
const LANK = { ...byggPost(med({ typ: "lank", rubrik: "Kartan", url: "https://exempel.se/karta" })), id: "k1" };

/** @param {{ postlankBas?: string, poster?: any[] }} p */
function Vy({ postlankBas, poster = [FIL, LANK] }) {
  return (
    <OpsBibliotek
      poster={poster}
      jag={JAG}
      onOppna={() => {}}
      onStang={() => {}}
      onSkapa={() => {}}
      onSpara={() => {}}
      onRadera={() => {}}
      filUrl={() => TOKENADRESS}
      hubHref="/hub"
      {...(postlankBas === undefined ? {} : { postlank: (/** @type {{ id: string, groupId: string }} */ p) => bibliotekslank(postlankBas, { plats: p.groupId, postId: p.id }) })}
    />
  );
}

const writeText = vi.fn();
let tidigare;
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  tidigare = navigator.clipboard;
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});
afterEach(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: tidigare });
});

describe("⛔ Kopiera länk på en medlems fil (lifehub.app#801)", () => {
  it("kopierar postens adress i appen, aldrig filens nedladdningsadress", async () => {
    render(<Vy postlankBas={BAS} />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Avtal" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(`${BAS}?plats=cps-ab&post=f1`);
    expect(writeText.mock.calls.flat().join(" ")).not.toContain("token=");
    expect(await screen.findByText("Länken är kopierad.")).toBeInTheDocument();
  });

  it("utan appens adress har filen ingen Kopiera länk, och en länkpost kopierar sin egen adress som förut", async () => {
    render(<Vy />);
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Avtal" }));
    expect(screen.queryByRole("menuitem", { name: "Kopiera länk" })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Kartan" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Kopiera länk" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith("https://exempel.se/karta");
  });

  it("⛔ en post med ett id som inte är ett postid tar inte ned listan: den saknar bara Kopiera länk, och de andra raderna står kvar (granskningen, A1)", () => {
    const konstig = { ...FIL, id: "konstigt.id", rubrik: "Konstig" };
    render(<Vy postlankBas={BAS} poster={[konstig, FIL]} />);
    expect(screen.getByText("Konstig")).toBeInTheDocument();
    expect(screen.getByText("Avtal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Åtgärder för Konstig" }));
    expect(screen.queryByRole("menuitem", { name: "Kopiera länk" })).toBeNull();
  });
});
