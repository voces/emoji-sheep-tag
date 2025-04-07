const parseColorMarkdown = (text: string) => {
  // This regex matches:
  // |c      => literal "|c"
  // ([^|]+) => one or more characters (the color), up to the next pipe
  // \|      => literal "|"
  // ([^|]+) => one or more characters (the text), up to the next pipe
  // \|      => literal "|"
  const regex = /\|c([^|]+)\|([^|]+)\|/g;
  let lastIndex = 0;
  const parts = [];
  let match;
  let key = 0;

  // Loop through each match
  while ((match = regex.exec(text)) !== null) {
    // Push any text before the match as a plain string
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    const color = match[1].trim();
    const coloredText = match[2];

    // Push a <span> with the appropriate style for the colored text
    parts.push(
      <span style={{ color }} key={key++}>
        {coloredText}
      </span>,
    );

    lastIndex = regex.lastIndex;
  }

  // Add any remaining text after the last match
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
};

export const ColorMarkdown = ({ text }: { text: string }) => (
  <>{parseColorMarkdown(text)}</>
);
