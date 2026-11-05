import { Component } from "react";

/**
 * En gräns runt en lat modul: visar `fel` i stället för innehållet när modulen inte gick att hämta (nätet föll, eller en ny version har lagts ut och den gamla
 * biten finns inte längre). Ett kast tar då inte med sig hela vyn (arbetsreglernas punkt 5). Ett nytt försök kräver att sidan laddas om, eftersom `lazy` minns ett misslyckande.
 *
 * Utbruten ur `BibliotekHtmlVersionerLat` (0.159.0) i 0.186.0, när läsläget för GitHub-filer behövde samma gräns (regel 2: en gräns, inte två kopior).
 */
export class LatGrans extends Component {
  /** @param {{ children: import("react").ReactNode, fel: import("react").ReactNode }} props */
  constructor(props) {
    super(props);
    this.state = { fallit: false };
  }

  static getDerivedStateFromError() {
    return { fallit: true };
  }

  render() {
    return this.state.fallit ? this.props.fel : this.props.children;
  }
}
