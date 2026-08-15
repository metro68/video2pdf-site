// Palette derived from the site's brand tokens, validated for dark-background contrast.
export const CHART_COLORS = {
  primary: "#0d9488",
  primaryLight: "#34d399",
  pro: "#7c3aed",
  grid: "#334155",
  axis: "#94a3b8",
  series: ["#34d399", "#0d9488", "#7c3aed", "#f59e0b", "#38bdf8"],
  // Categorical palette for multi-series charts, validated (dataviz six checks)
  // against the dark surface #0f172a: lightness band, chroma, CVD separation,
  // normal-vision separation, contrast. Assign slots in fixed order per
  // entity; never cycle or reassign when series counts change.
  categorical: ["#059669", "#7c3aed", "#d97706", "#0284c7", "#e11d48"],
};
