import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Skrivfalt, texterPa } from "../components/OpsMeddelanden.jsx";

/**
 * Klistra in en bild i chatten (CP 2026-11-09 i Dev: "jag kan inte klippa in en bild i chatten. Det behöver vi kunna"). En inklistring med filer går samma väg som
 * plusmenyn (`onBifoga`); en inklistring med bara text lämnas till fältet. ⛔ RÖTT UTAN ÄNDRINGEN (regel 4): onBifoga anropades aldrig.
 */

const t = texterPa("sv", {});
/** @param {any} [props] */
const rita = (props = {}) => render(<Skrivfalt text="" setText={() => {}} skickar={false} onSkicka={() => {}} texter={/** @type {any} */ (t)} sprak="sv" {...props} />);
const klistra = (/** @type {File[]} */ files, text = "") => {
  const falt = screen.getByRole("textbox");
  const e = fireEvent.paste(falt, { clipboardData: { files, getData: () => text, types: files.length ? ["Files"] : ["text/plain"] } });
  return e;
};

describe("klistra in i chattens skrivfält", () => {
  it("⛔ en inklistrad bild går till onBifoga som bild, och standardbeteendet stoppas", () => {
    const onBifoga = vi.fn();
    rita({ onBifoga });
    const bild = new File(["x"], "skarmbild.png", { type: "image/png" });
    const ejStoppad = klistra([bild]);
    expect(onBifoga).toHaveBeenCalledWith([bild], "bild");
    expect(ejStoppad).toBe(false);
  });
  it("⛔ bild och annan fil i samma inklistring: ETT anrop med båda, så att utkastet säger att bara en bilaga går i stället för att den ena försvinner", () => {
    const onBifoga = vi.fn();
    rita({ onBifoga });
    const bild = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const pdf = new File(["x"], "b.pdf", { type: "application/pdf" });
    klistra([bild, pdf]);
    expect(onBifoga.mock.calls).toEqual([[[bild, pdf], "fil"]]);
  });
  it("⛔ text och en bild av texten (Excel, Numbers, Word): texten vinner och ingen bilaga skapas", () => {
    const onBifoga = vi.fn();
    rita({ onBifoga });
    const ejStoppad = klistra([new File(["x"], "image.png", { type: "image/png" })], "Rad 1\tRad 2");
    expect(onBifoga).not.toHaveBeenCalled();
    expect(ejStoppad).toBe(true);
  });
  it("text lämnas orörd till fältet", () => {
    const onBifoga = vi.fn();
    rita({ onBifoga });
    const ejStoppad = klistra([], "hej");
    expect(onBifoga).not.toHaveBeenCalled();
    expect(ejStoppad).toBe(true);
  });
  it("utan onBifoga händer ingenting extra", () => {
    rita();
    const ejStoppad = klistra([new File(["x"], "a.png", { type: "image/png" })]);
    expect(ejStoppad).toBe(true);
  });
});
