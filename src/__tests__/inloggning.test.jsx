import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { OpsInloggning } from "../components/OpsInloggning.jsx";
import { createAuth, createGoogleAuth } from "../auth/auth.jsx";

/**
 * ⛔ #164, KORRIGERING B. Se filhuvudena i `OpsInloggning.jsx` och
 * `src/auth/auth.jsx` för hela bakgrunden.
 *
 * Fyra krav ur uppdraget, fyra beskrivande describe-block: "bara Google
 * ritar en rad", "allt ritar allt", "ingen rad utan förmåga", och
 * "e-postlänkflödet med fejkad sdk".
 */

const enkelAuth = () =>
  createAuth({
    subscribe: () => () => {},
    signOut: async () => {},
  });

describe("OpsInloggning: märket är text (0.31.0), inga bilder", () => {
  it("ritar OPS HUB som rad 1 och appens namn som rad 2, utan någon <img>", () => {
    const { container } = render(<OpsInloggning auth={enkelAuth()} etikett="Bolag Ops" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-marke="rad1"]')?.textContent).toBe("OPS HUB");
    expect(container.querySelector('[data-marke="rad2"]')?.textContent).toBe("Bolag Ops");
  });

  it("`namn` byter rad 1, med första ordet och resten som två spann", () => {
    const { container } = render(<OpsInloggning auth={enkelAuth()} namn="TAM STUDIO" />);
    const rad1 = container.querySelector('[data-marke="rad1"]');
    expect(rad1?.textContent).toBe("TAM STUDIO");
    expect(rad1?.querySelectorAll("span")).toHaveLength(2);
  });

  it("utan etikett ritas bara rad 1 (ALDRIG rubrikens text som rad 2)", () => {
    const { container } = render(<OpsInloggning auth={enkelAuth()} rubrik="Logga in" />);
    expect(container.querySelector('[data-marke="rad2"]')).toBeNull();
    expect(container.querySelector('[data-marke="rad1"]')?.textContent).toBe("OPS HUB");
  });
});

describe("OpsInloggning: bara Google ritar en rad", () => {
  it("en adapter med bara signInWithGoogle ritar EXAKT en leverantörsrad, inget annat", () => {
    const auth = createAuth({ ...enkelAuth(), signInWithGoogle: async () => {} });
    render(<OpsInloggning auth={auth} />);
    expect(screen.getByRole("button", { name: /Fortsätt med Google/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fortsätt med Apple/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /e-post och lösenord/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Skapa konto/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /e-postlänk/ })).toBeNull();
    // ⛔ ingen "ELLER"-avdelare när det bara finns EN väg in, den avdelar
    // ingenting.
    expect(screen.queryByText("ELLER")).toBeNull();
  });

  it("bakåtkompatibelt: en adapter med bara `signIn` (den gamla formen) ritar SAMMA Google-rad", () => {
    const auth = createAuth({ ...enkelAuth(), signIn: async () => {} });
    render(<OpsInloggning auth={auth} />);
    expect(screen.getByRole("button", { name: /Fortsätt med Google/ })).toBeInTheDocument();
  });
});

describe("OpsInloggning: allt ritar allt", () => {
  const allaFormagor = () =>
    createAuth({
      ...enkelAuth(),
      signInWithGoogle: async () => {},
      signInWithApple: async () => {},
      sendEmailLink: async () => {},
      completeEmailLink: async () => {},
      signInWithPassword: async () => {},
      createAccount: async () => {},
      resetPassword: async () => {},
    });

  it("varje förmåga har sin egen synliga väg in", () => {
    render(<OpsInloggning auth={allaFormagor()} />);
    expect(screen.getByRole("button", { name: /Fortsätt med Google/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fortsätt med Apple/ })).toBeInTheDocument();
    expect(screen.getByText("ELLER")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fortsätt med e-post och lösenord" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skapa konto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logga in med e-postlänk" })).toBeInTheDocument();
  });

  it("e-post-och-lösenord-vägen öppnar formuläret, med Glömt lösenordet eftersom resetPassword finns", () => {
    render(<OpsInloggning auth={allaFormagor()} />);
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt med e-post och lösenord" }));
    expect(screen.getByLabelText("E-post")).toBeInTheDocument();
    expect(screen.getByLabelText("Lösenord")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Glömt lösenordet?" })).toBeInTheDocument();
    // Skapa-konto-läget har INTE öppnats av misstag: inget namnfält, ingen bekräfta-lösenord.
    expect(screen.queryByLabelText("Namn")).toBeNull();
  });

  it("Skapa konto-vägen öppnar formuläret i signup-läge: namn och bekräfta lösenord", () => {
    render(<OpsInloggning auth={allaFormagor()} />);
    fireEvent.click(screen.getByRole("button", { name: "Skapa konto" }));
    expect(screen.getByLabelText("Namn")).toBeInTheDocument();
    expect(screen.getByLabelText("Bekräfta lösenord")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skapa konto" })).toBeInTheDocument();
  });
});

describe("OpsInloggning: ingen rad utan sin förmåga", () => {
  it("utan signInWithApple ritas ingen Apple-rad, trots att Google finns", () => {
    const auth = createAuth({ ...enkelAuth(), signInWithGoogle: async () => {}, signInWithPassword: async () => {} });
    render(<OpsInloggning auth={auth} />);
    expect(screen.queryByRole("button", { name: /Apple/ })).toBeNull();
  });

  it("utan resetPassword ritas ingen \"Glömt lösenordet\"-länk i formuläret", () => {
    const auth = createAuth({ ...enkelAuth(), signInWithPassword: async () => {} });
    render(<OpsInloggning auth={auth} />);
    fireEvent.click(screen.getByRole("button", { name: "Fortsätt med e-post och lösenord" }));
    expect(screen.queryByRole("button", { name: /Glömt/ })).toBeNull();
  });

  it("utan createAccount ritas ingen \"Skapa konto\"-pill alls", () => {
    const auth = createAuth({ ...enkelAuth(), signInWithPassword: async () => {} });
    render(<OpsInloggning auth={auth} />);
    expect(screen.queryByRole("button", { name: "Skapa konto" })).toBeNull();
  });

  it("utan NÅGON förmåga ritas inga leverantörsrader och ingen e-postväg, bara kortet", () => {
    render(<OpsInloggning auth={enkelAuth()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("OpsInloggning: e-postlänkflödet, fejkad sdk (skickar och bekräftar)", () => {
  /** Samma fejk-sdk-mönster som övriga adapters.test.jsx, fast med e-postlänk. */
  function fejkadSdk() {
    let sparadUrl = "";
    return {
      GoogleAuthProvider: class {},
      signInWithPopup: async () => {},
      signOut: async () => {},
      onAuthStateChanged: (_a, cb) => {
        cb(null);
        return () => {};
      },
      sendSignInLinkToEmail: vi.fn(async (_auth, _email, actionCodeSettings) => {
        sparadUrl = actionCodeSettings.url;
      }),
      isSignInWithEmailLink: vi.fn(() => true),
      signInWithEmailLink: vi.fn(async () => ({ user: { uid: "u1" } })),
      get sparadUrl() {
        return sparadUrl;
      },
    };
  }

  it("skickar länken, visar bekräftelse med RÄTT adress, och SKICKAR den (inte bara ritar en flik)", async () => {
    const sdk = fejkadSdk();
    const auth = createGoogleAuth({ auth: {}, sdk });
    render(<OpsInloggning auth={auth} sprak="sv" />);

    fireEvent.click(screen.getByRole("button", { name: "Logga in med e-postlänk" }));
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "cp@staiger.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Skicka inloggningslänk" }));

    await waitFor(() => expect(sdk.sendSignInLinkToEmail).toHaveBeenCalledWith(expect.anything(), "cp@staiger.se", expect.objectContaining({ handleCodeInApp: true })));
    expect(await screen.findByText("Länk skickad till cp@staiger.se.")).toBeInTheDocument();
  });

  it("bekräftar länken: completeEmailLink anropar signInWithEmailLink med adressen", async () => {
    const sdk = fejkadSdk();
    const auth = createGoogleAuth({ auth: {}, sdk });
    render(<OpsInloggning auth={auth} sprak="sv" />);

    fireEvent.click(screen.getByRole("button", { name: "Logga in med e-postlänk" }));
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "cp@staiger.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Skicka inloggningslänk" }));
    await screen.findByText("Länk skickad till cp@staiger.se.");

    const bekraftaFalt = screen.getByLabelText(/Öppnade du länken/);
    fireEvent.change(bekraftaFalt, { target: { value: "cp@staiger.se" } });
    fireEvent.click(screen.getByRole("button", { name: "Bekräfta" }));

    await waitFor(() => expect(sdk.signInWithEmailLink).toHaveBeenCalledWith(expect.anything(), "cp@staiger.se", expect.any(String)));
  });

  it("⛔ completeEmailLink kastar om länken inte är giltig, i stället för att tyst logga in fel", async () => {
    const sdk = fejkadSdk();
    sdk.isSignInWithEmailLink = vi.fn(() => false);
    const auth = createGoogleAuth({ auth: {}, sdk });
    await expect(/** @type {any} */ (auth.completeEmailLink)("x@y.se")).rejects.toThrow(/ingen giltig e-postlänk/);
    expect(sdk.signInWithEmailLink).not.toHaveBeenCalled();
  });
});
