import { Component } from "react";
import { OpsButton, OpsCard, OpsView, OpsViewHeader } from "@staiger/ops-framework";

/**
 * Felgräns.
 *
 * ⛔ Den fångar och VISAR. Den sväljer inte.
 *
 * En felgräns som bara renderar "något gick fel" och slutar där är samma sak
 * som en try/catch utan logg: problemet finns kvar, bara utan spår. Den som
 * felsöker har då ingenting att gå på, och den som drabbas har ingen väg vidare.
 *
 * Därför tre saker: felet skrivs till konsolen (och till er loggkanal när den
 * finns), texten säger vad som gick fel, och användaren får en väg tillbaka.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // ⛔ Byt den här mot er riktiga loggkanal när observability-skiktet finns.
    // Lämna den ALDRIG tom: en felgräns utan utgående signal gör fel osynliga
    // i produktion, vilket är värre än ingen felgräns alls eftersom appen då
    // ser ut att fungera.
    console.error("Ohanterat fel i vyn:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <OpsView width="narrow">
        <OpsViewHeader title="Något gick fel i den här vyn" description="Resten av appen fungerar. Du kan gå tillbaka och försöka igen." />
        <OpsCard tone="raised">
          <p className="m-0 text-base text-ink-secondary">
            {this.state.error?.message || "Okänt fel."}
          </p>
          <div className="mt-4 flex gap-2">
            <OpsButton variant="primary" onClick={() => this.setState({ error: null })}>
              Försök igen
            </OpsButton>
            <OpsButton href="/">Till översikten</OpsButton>
          </div>
        </OpsCard>
      </OpsView>
    );
  }
}
