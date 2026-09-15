import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";

/**
 * ⛔ Reglerna i `FORBJUDET` är inte stilpreferenser. Var och en motsvarar en
 * bugg vi faktiskt haft, och de finns här därför att ramverkets egna vakter
 * inte kan se in i appens kod.
 *
 * Konfigen körs med `--max-warnings=0`. En varning som får ligga kvar blir
 * hundra inom ett kvartal, och då läser ingen utskriften längre.
 */
const FORBJUDET = [
  {
    selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
    message:
      "Hårdkodad färg. Tailwinds namngivna palett är borttagen vid bygget, men en hex i en sträng överlever det (mätt i ramverkets check-css-build). Använd ett token, eller lägg till ett i ramverket.",
  },
  {
    selector: "JSXOpeningElement[name.name='select']",
    message: "Rå <select> är förbjuden: den renderas av operativsystemet, ser olika ut i varje webbläsare och går inte att tokenisera. Använd OpsSelect.",
  },
  {
    selector:
      "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value=/^(date|time|datetime-local|month|week|color)$/]",
    message: "Webbläsarens egen datum- eller färgväljare är förbjuden, av samma skäl som rå select. Använd ramverkets väljare.",
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: "Inline style går förbi både tokenkontraktet och mörkt läge, och syns inte i någon granskning av CSS. Använd en primitiv eller en utility.",
  },
];

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks, react },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // ⛔ Utan de här två raderna flaggar no-unused-vars varje komponent som
      // BARA används i JSX, alltså i princip varje import i en React-app. Det
      // ger 44 falska fel i en nyskapad app, och den som möter det stänger av
      // regeln i stället för att laga konfigen. Vakten check-scaffold.mjs
      // hittade precis det felet i den här mallen.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-syntax": ["error", ...FORBJUDET],
    },
  },
  {
    // Testerna får logga och får skriva hex i förväntansvärden. Att tvinga in
    // dem i produktionsreglerna ger bara avstängda regler.
    files: ["**/*.test.{js,jsx}", "src/setupTests.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off", "no-restricted-syntax": "off" },
  },
];
