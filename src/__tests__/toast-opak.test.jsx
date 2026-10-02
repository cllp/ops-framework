import { describe, it, expect } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { OpsToastProvider, useOpsToast } from "../components/OpsToast.jsx";

/**
 * bolag-ops#535: bekräftelsetoasten läste in sidans text genom rutan.
 *
 * RÖTT UTAN FIXEN: sätt tillbaka `bg-success-bg` (eller danger/info-bg) i
 * `OpsToast.jsx`s TONER. Då finns den genomskinliga tinten kvar och proven
 * faller på `bg-elevated` / frånvaron av `*-bg`.
 */

function Visa({ tone = "success" }) {
  const { show } = useOpsToast();
  return (
    <button
      type="button"
      onClick={() => show({ title: "Det ligger i inkorgen", description: "En agent plockar upp det.", tone })}
    >
      Visa
    </button>
  );
}

async function visaOchHittaYta(tone) {
  const { unmount } = render(
    <OpsToastProvider>
      <Visa tone={tone} />
    </OpsToastProvider>,
  );
  await act(async () => {
    screen.getByRole("button", { name: "Visa" }).click();
  });
  const titel = await waitFor(() => screen.getByText("Det ligger i inkorgen"));
  // Toast.Root → div (text) → Title. Ytan med border/bg är Toast.Root.
  const yta = titel.parentElement?.parentElement;
  return { yta, unmount };
}

describe("OpsToast: opak yta (bolag-ops#535)", () => {
  it("success ligger på bg-elevated, inte på genomskinlig bg-success-bg", async () => {
    const { yta, unmount } = await visaOchHittaYta("success");
    expect(yta?.className).toContain("bg-elevated");
    expect(yta?.className).not.toContain("bg-success-bg");
    unmount();
  });

  it("gäller danger och info, samma skäl", async () => {
    for (const tone of /** @type {const} */ (["danger", "info"])) {
      const { yta, unmount } = await visaOchHittaYta(tone);
      expect(yta?.className).toContain("bg-elevated");
      expect(yta?.className).not.toMatch(/bg-(danger|info)-bg/);
      unmount();
    }
  });
});
