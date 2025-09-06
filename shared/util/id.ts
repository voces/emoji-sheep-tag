// Alphanumeric, minus 0, O, l, and I
const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const toBase58 = (num: number): string => {
  let result = "";
  while (num > 0) {
    result = chars[num % 58] + result;
    num = Math.floor(num / 58);
  }
  return result || "1";
};

let counter = 0;
let counterSecond = 0;
export const id = (type?: string) => {
  const second = Math.floor(Date.now() / 1000);
  if (counterSecond !== second) {
    counter = 0;
    counterSecond = second;
  }
  try {
    return type
      ? `${type}-1${toBase58(second)}${toBase58(counter)}`
      : `1${toBase58(second)}${toBase58(counter)}`;
  } finally {
    counter++;
  }
};
