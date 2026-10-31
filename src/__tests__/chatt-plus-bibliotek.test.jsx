import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Plusmeny } from "../components/OpsMeddelanden.jsx";

/**
 * "Lägg till från Biblioteket" i chattens plus (0.164.0, lifehub.app#226). Raden ritas bara med `franBiblioteket`, väljaren söker,
 * och en vald post blir en fil som går till `onBifoga` som "fil", samma väg som "Välj fil".
 */
const texter = /** @type {any} */ ({
  bifoga: "Bifoga", bifogaBild: "Bifoga bild", taFoto: "Ta foto", valjFil: "Välj fil",
  franBiblioteket: "Lägg till från Biblioteket", sokBiblioteket: "Sök i Biblioteket", bibliotekTomt: "Inget i Biblioteket matchar.", bibliotekLaddar: "Hämtar Biblioteket …",
});
const POSTER = [{ id: "a", namn: "Låten.m4a" }, { id: "b", namn: "Noter.pdf" }];

describe("plus: Lägg till från Biblioteket", () => {
  it("⛔ raden ritas inte utan franBiblioteket", () => {
    render(<Plusmeny onBifoga={() => {}} texter={texter} kamera={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Bifoga" }));
    expect(screen.queryByRole("menuitem", { name: "Lägg till från Biblioteket" })).toBeNull();
  });

  it("⛔ söker, och en vald post går till onBifoga som en fil", async () => {
    const onBifoga = vi.fn();
    const fil = vi.fn(async (/** @type {string} */ id) => new File(["x"], POSTER.find((p) => p.id === id)?.namn ?? id));
    render(<Plusmeny onBifoga={onBifoga} franBiblioteket={{ poster: async () => POSTER, fil }} texter={texter} kamera={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Bifoga" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Lägg till från Biblioteket" }));
    expect(await screen.findByText("Låten.m4a")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Sök i Biblioteket" }), { target: { value: "not" } });
    expect(screen.queryByText("Låten.m4a")).toBeNull();
    fireEvent.click(screen.getByText("Noter.pdf"));
    await waitFor(() => expect(onBifoga).toHaveBeenCalledTimes(1));
    expect(fil).toHaveBeenCalledWith("b");
    expect(onBifoga.mock.calls[0][0][0].name).toBe("Noter.pdf");
    expect(onBifoga.mock.calls[0][1]).toBe("fil");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("⛔ ett fel skrivs ut i väljaren, aldrig tyst", async () => {
    const onBifoga = vi.fn();
    render(<Plusmeny onBifoga={onBifoga} franBiblioteket={{ poster: async () => POSTER, fil: async () => { throw new Error("Filen gick inte att hämta."); } }} texter={texter} kamera={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Bifoga" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Lägg till från Biblioteket" }));
    fireEvent.click(await screen.findByText("Låten.m4a"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Filen gick inte att hämta.");
    expect(onBifoga).not.toHaveBeenCalled();
  });
});
