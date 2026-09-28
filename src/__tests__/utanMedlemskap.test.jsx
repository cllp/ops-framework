import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpsUtanMedlemskap } from "../components/OpsUtanMedlemskap.jsx";

/**
 * OpsUtanMedlemskap: sidan för den som är inloggad men inte med i någon
 * grupp, och sedan #161 dess "Skapa din första grupp"-form för den vitlistade.
 *
 * ⛔ VAD SOM MÄTS: att formen bara finns när `onSkapaGrupp` ges (#161, samma
 * mönster som `props.lagring` på OpsProfil), att den anropar med ett trimmat
 * namn, och att en tom eller osparad ruta inte skickar iväg något.
 */

describe("⛔ utan onSkapaGrupp: sidan är oförändrad", () => {
  it("ritar ingen skapa-form", () => {
    render(<OpsUtanMedlemskap />);
    expect(screen.queryByText("Skapa din första grupp")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Gruppens namn")).not.toBeInTheDocument();
  });

  it("den vanliga texten och kontakten står kvar", () => {
    render(<OpsUtanMedlemskap kontakt="Fråga Claes-Philip." />);
    expect(screen.getByText("Fråga Claes-Philip.")).toBeInTheDocument();
  });
});

describe("⛔ med onSkapaGrupp: den vitlistade får en form", () => {
  it("ritar rubrik, fält och knapp", () => {
    render(<OpsUtanMedlemskap onSkapaGrupp={() => {}} />);
    expect(screen.getByText("Skapa din första grupp")).toBeInTheDocument();
    expect(screen.getByLabelText("Gruppens namn")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skapa grupp" })).toBeInTheDocument();
  });

  it("⛔ knappen är avstängd tills ett namn skrivits", async () => {
    render(<OpsUtanMedlemskap onSkapaGrupp={() => {}} />);
    expect(screen.getByRole("button", { name: "Skapa grupp" })).toBeDisabled();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Gruppens namn"), "Mitt bolag");
    expect(screen.getByRole("button", { name: "Skapa grupp" })).toBeEnabled();
  });

  it("skickar ett trimmat namn", async () => {
    const onSkapaGrupp = vi.fn();
    render(<OpsUtanMedlemskap onSkapaGrupp={onSkapaGrupp} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Gruppens namn"), "  Mitt bolag  ");
    await user.click(screen.getByRole("button", { name: "Skapa grupp" }));
    expect(onSkapaGrupp).toHaveBeenCalledWith({ namn: "Mitt bolag" });
  });

  it("⛔ ett enbart blankt namn skickar ingenting, trots att fältet inte är tomt", async () => {
    const onSkapaGrupp = vi.fn();
    render(<OpsUtanMedlemskap onSkapaGrupp={onSkapaGrupp} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Gruppens namn"), "   ");
    expect(screen.getByRole("button", { name: "Skapa grupp" })).toBeDisabled();
    expect(onSkapaGrupp).not.toHaveBeenCalled();
  });

  it("den vanliga inbjudningstexten står kvar bredvid, med ett Eller emellan", () => {
    render(<OpsUtanMedlemskap onSkapaGrupp={() => {}} text="Be om en inbjudan." />);
    expect(screen.getByText("Eller")).toBeInTheDocument();
    expect(screen.getByText("Be om en inbjudan.")).toBeInTheDocument();
  });
});
