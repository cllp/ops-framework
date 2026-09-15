import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTheme } from "@staiger/ops-framework";
import { App } from "./app/App.jsx";
import "./index.css";

// Temat skrivs redan i index.html för att undvika en ljus blinkning. Det här
// anropet är synkroniseringen åt andra hållet: det ser till att ramverkets
// lagrade val och attributet på <html> säger samma sak även om något av dem
// hunnit ändras.
initTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
