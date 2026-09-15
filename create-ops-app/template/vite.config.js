import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.js"],
  },
  // ⛔ React måste finnas i exakt en kopia. Får appen och ramverket var sin
  // kastar varje hook "invalid hook call", och felmeddelandet pekar inte mot
  // orsaken. Det kostar en halv dag att felsöka och en rad att undvika.
  resolve: { dedupe: ["react", "react-dom"] },
});
