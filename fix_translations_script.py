# One-off repair: fix corrupted translations.json (mojibake + broken merge + extra brace)
import json

def fix_mojibake(s: str) -> str:
    if not isinstance(s, str) or not s:
        return s
    try:
        return s.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return s

def fix_obj(o):
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            if k in ("ru", "kk") and isinstance(v, str):
                out[k] = fix_mojibake(v)
            else:
                out[k] = fix_obj(v)
        return out
    if isinstance(o, list):
        return [fix_obj(x) for x in o]
    return o

def main():
    text = open("translations.json", "r", encoding="latin-1").read()

    # Broken: ru string never closes before "l5_concept_5"
    needle = '  "l3_li_fix_text": { "ru": "'
    j = text.find(needle)
    if j == -1:
        raise SystemExit("pattern l3_li_fix_text not found")
    k = text.find('"l5_concept_5"', j)
    if k == -1:
        raise SystemExit("pattern l5_concept_5 not found after l3_li_fix_text")
    insert = (
        '  "l3_li_fix_text": { "ru": "В окне программы выделена строка с ошибкой. Отредактируй код, исправь ошибку и снова запусти программу.", '
        '"kk": "Бағдарлама терезесінде қате бар жол белгіленген. Қатені түзетіп, бағдарламаны қайта іске қос.", '
        '"en": "In the program window, the line with the error is highlighted. Edit the code to fix the error, then run the program again." },\n'
    )
    text = text[:j] + insert + text[k:]

    text = text.replace('\n_title":', '\n  "l4_game_title":')

    text = text.rstrip()
    if text.endswith("}\n}"):
        text = text[:-2] + "\n"

    data = json.loads(text)
    data = fix_obj(data)

    with open("translations.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("OK: translations.json repaired")

if __name__ == "__main__":
    main()
