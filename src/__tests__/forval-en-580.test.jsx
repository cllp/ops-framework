import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { OpsGruppanel } from "../components/OpsGruppanel.jsx";
import { OpsThemeToggle } from "../components/OpsThemeToggle.jsx";
import { OpsSprakProvider } from "../components/OpsSprak.jsx";

/** cllp/lifehub.app#580: ramverkets förval följer appens språk. */
describe("#580 förval på engelska", () => {
  const grupper = [{ id: "g1", namn: "Familjen", roll: "agare", medlemsantal: 3 }];
  it("gruppanelen ritar engelska förval med språket en", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsGruppanel grupper={grupper} aktiv="g1" onValj={() => {}} onInfo={() => {}} onRedigera={() => {}} onSkapa={() => {}} />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("navigation", { name: "My groups" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse the group list" })).toBeTruthy();
    expect(screen.queryByText(/Fäll ihop|Mina grupper/)).toBeNull();
  });
  it("gruppanelen är svensk utan språk, och appens etikett vinner", () => {
    render(<OpsGruppanel grupper={grupper} aktiv="g1" onValj={() => {}} kollapsaEtikett="Egen" />);
    expect(screen.getByRole("navigation", { name: "Mina grupper" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Egen" })).toBeTruthy();
  });
  it("utseendet heter Appearance på engelska", () => {
    render(
      <OpsSprakProvider sprak="en">
        <OpsThemeToggle />
      </OpsSprakProvider>,
    );
    expect(screen.getByRole("button", { name: /^Appearance: / })).toBeTruthy();
  });
  it("hubbväxlarens aria säger current på engelska", () => {
    const kalla = readFileSync("src/components/OpsAppShell.jsx", "utf8");
    expect(kalla).toMatch(/hubbNu: \{ sv: "nu", en: "current" \}/);
    expect(kalla).not.toMatch(/, nu: \$\{aktivHubbNamn/);
  });
});
