import gettext
import os
from typing import Optional
from functools import lru_cache

LOCALE_DIR = os.path.join(os.path.dirname(__file__), "locales")
DEFAULT_LOCALE = "en"
SUPPORTED_LOCALES = ["en", "ja"]


@lru_cache(maxsize=len(SUPPORTED_LOCALES))
def get_translator(locale: str):
    """指定されたロケールの翻訳関数を取得（キャッシュ付き）"""
    try:
        translation = gettext.translation(
            "messages",
            localedir=LOCALE_DIR,
            languages=[locale],
            fallback=False
        )
        return translation.gettext
    except FileNotFoundError:
        # フォールバック: デフォルトロケール
        if locale != DEFAULT_LOCALE:
            try:
                translation = gettext.translation(
                    "messages",
                    localedir=LOCALE_DIR,
                    languages=[DEFAULT_LOCALE],
                    fallback=False
                )
                return translation.gettext
            except FileNotFoundError:
                pass
        # 翻訳ファイルが見つからない場合は元の文字列を返す
        return lambda x: x


def parse_accept_language(accept_language: Optional[str]) -> str:
    """
    Accept-Languageヘッダーからロケールを抽出
    例: "ja,en-US;q=0.9,en;q=0.8" -> "ja"
    """
    if not accept_language:
        return DEFAULT_LOCALE
    
    # パース処理
    languages = []
    for item in accept_language.split(","):
        parts = item.strip().split(";")
        lang = parts[0].strip()
        
        # 品質値（q値）の取得
        quality = 1.0
        if len(parts) > 1:
            for part in parts[1:]:
                if part.strip().startswith("q="):
                    try:
                        quality = float(part.strip()[2:])
                    except ValueError:
                        pass
        
        # 言語コードを正規化（例: ja-JP -> ja）
        lang_code = lang.split("-")[0].lower()
        languages.append((lang_code, quality))
    
    # q値でソート（降順）
    languages.sort(key=lambda x: x[1], reverse=True)
    
    # サポートされている言語を優先的に選択
    for lang_code, _ in languages:
        if lang_code in SUPPORTED_LOCALES:
            return lang_code
    
    return DEFAULT_LOCALE


def translate(message: str, locale: str) -> str:
    """メッセージを指定されたロケールに翻訳"""
    translator = get_translator(locale)
    return translator(message)