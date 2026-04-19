import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en.ts";
import { generatePseudo } from "./pseudo.ts";

export const defaultNS = "translation";

export const resources = {
  en: { translation: en },
  pseudo: { translation: generatePseudo(en) },
} as const;

await i18next
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    defaultNS,
    interpolation: { escapeValue: false },
  });

export { i18next };
