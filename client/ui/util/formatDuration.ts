export const formatDuration = (
  /** Duration in milliseconds */
  r: number,
  includeMilliseconds = false,
): string => {
  r /= 1000;

  let s = "";

  if (r >= 3600) {
    s = Math.floor(r / 3600).toString();
    r = r % 3600;
  }
  if (s !== "") s += ":";

  if (r >= 600) {
    s += Math.floor(r / 60).toString();
    r = r % 60;
  } else if (r >= 60) {
    s += (s.length > 0 ? "0" : "") + Math.floor(r / 60).toString();
    r = r % 60;
  } else s += s.length === 0 ? "0" : "00";
  s += ":";

  if (r >= 10) s += r.toFixed(includeMilliseconds ? 3 : 0);
  else s += (s.length > 0 ? "0" : "") + r.toFixed(includeMilliseconds ? 3 : 0);

  return s;
};
