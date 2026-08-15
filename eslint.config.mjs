import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...coreWebVitals,
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    rules: {
      // Legal and marketing copy uses plain quotes and apostrophes; escaping
      // them adds noise without changing the rendered output.
      "react/no-unescaped-entities": "off",
      // React Compiler-era strictness. The dashboard and funnel predate these
      // rules and work correctly; surface as warnings instead of forcing
      // risky refactors of live checkout code.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default config;
