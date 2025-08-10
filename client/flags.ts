export const flags = {
  debug: localStorage.getItem("debug") === "true",
  debugPathing: localStorage.getItem("debug-pathing") === "true",
  debugStats: localStorage.getItem("debug-stats") === "true",
};
