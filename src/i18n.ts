import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import tw from "./locales/tw.json";
import ee from "./locales/ee.json";
import ga from "./locales/ga.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tw: { translation: tw },
    ee: { translation: ee },
    ga: { translation: ga },
  },
  lng: "en", // default language
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // react already escapes values
  },
});

export default i18n;
