export const formatDuration = (
  /** Duration in milliseconds */
  milliseconds: number,
  includeMilliseconds = false,
): string => {
  // Convert to seconds and use Math.floor to avoid rounding issues
  const totalSeconds = Math.floor(milliseconds / 1000);
  const ms = milliseconds % 1000;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let result = "";

  // Add hours if present
  if (hours > 0) {
    result += hours.toString() + ":";
    // Minutes need padding when hours are present
    result += minutes.toString().padStart(2, "0") + ":";
  } else {
    // No hours, just show minutes (no padding needed)
    result += minutes.toString() + ":";
  }

  // Seconds always need 2-digit padding
  result += seconds.toString().padStart(2, "0");

  if (includeMilliseconds) result += "." + ms.toString().padStart(3, "0");

  return result;
};
