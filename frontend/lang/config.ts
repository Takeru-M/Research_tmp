import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpApi from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

// 言語jsonファイルのimport
import translation_en from "./en.json";
import translation_ja from "./ja.json";

export const supportedLngs = {
  ja: "日本語",
  en: "English",
};

const resources = {
    ja: {
      translation: translation_ja
    },
    en: {
      translation: translation_en
    }
  };

  i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: "ja",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

i18n
  .use(HttpApi) // 翻訳ファイルを非同期に読み込むため
  .use(LanguageDetector) // ユーザーの言語設定を検知するため
  .use(initReactI18next) // i18next インスタンスを初期化
  .init({
    fallbackLng: "ja", // フォールバック言語。指定された言語ファイルがない場合などにこの言語が使用される
    returnEmptyString: false, // 空文字での定義を許可に
    supportedLngs: Object.keys(supportedLngs),
    debug: false, // true にすると開発コンソールに i18next が正しく初期化されたことを示す出力が表示される

    // デフォルトは`escapeValue: true`
    // 18next が翻訳メッセージ内のコードをエスケープし、XSS 攻撃から保護するためのもの
    // React がこのエスケープを行ってくれるので、今回はこれをオフにする
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
