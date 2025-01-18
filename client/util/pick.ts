export const pick = <T>(...choices: T[]): T =>
  choices[Math.floor(Math.random() * choices.length)];
