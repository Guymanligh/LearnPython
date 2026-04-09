"""Convert quizzes.json strings to {ru, kk, en} using GoogleTranslator (sequential, resumable)."""
import json
import time
import sys
from deep_translator import GoogleTranslator

CACHE_FILE = "_quiz_tr_cache.json"
SLEEP = 0.08


def load_cache():
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def save_cache(c):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(c, f, ensure_ascii=False, indent=0)


def _ru_text(x):
    if isinstance(x, str):
        return x
    if isinstance(x, dict) and "ru" in x:
        return x["ru"]
    return str(x)


def collect_strings(quizzes):
    seen = []
    for block in quizzes.values():
        seen.append(_ru_text(block.get("title")))
        for q in block.get("questions", []):
            seen.append(_ru_text(q["question"]))
            seen.append(_ru_text(q["explanation"]))
            for opt in q.get("options", []):
                seen.append(_ru_text(opt))
    unique = []
    u = set()
    for s in seen:
        if s not in u:
            u.add(s)
            unique.append(s)
    return unique


def fill_translations(unique, cache):
    ten = GoogleTranslator(source="ru", target="en")
    tkk = GoogleTranslator(source="ru", target="kk")
    n = 0
    for i, s in enumerate(unique):
        if s in cache and "en" in cache[s] and "kk" in cache[s]:
            continue
        try:
            en = ten.translate(s)
            time.sleep(SLEEP)
            kk = tkk.translate(s)
            time.sleep(SLEEP)
            cache[s] = {"ru": s, "en": en, "kk": kk}
        except Exception as e:
            print(f"[{i}] ERR: {e!r}", flush=True)
            cache[s] = {"ru": s, "en": s, "kk": s}
        n += 1
        if n % 25 == 0:
            save_cache(cache)
            print(f"  ... {i+1}/{len(unique)}", flush=True)
    save_cache(cache)
    return cache


def lookup(cache, s):
    return cache.get(s, {"ru": s, "en": s, "kk": s})


def transform(quizzes, cache):
    out = {}
    for lid, block in quizzes.items():
        title = block["title"]
        nb = {"title": lookup(cache, title if isinstance(title, str) else title["ru"]), "questions": []}
        for q in block["questions"]:
            nq = {
                "id": q["id"],
                "question": lookup(cache, q["question"]),
                "options": [lookup(cache, o) for o in q["options"]],
                "correct": q["correct"],
                "explanation": lookup(cache, q["explanation"]),
            }
            nb["questions"].append(nq)
        out[lid] = nb
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    max_items = int(__import__("os").environ.get("QUIZ_I18N_MAX", "0"))

    with open("quizzes.json", "r", encoding="utf-8") as f:
        quizzes = json.load(f)

    unique = collect_strings(quizzes)
    if max_items > 0:
        unique = unique[:max_items]
    print(f"Unique strings: {len(unique)}", flush=True)
    cache = load_cache()
    fill_translations(unique, cache)

    # rebuild full map from cache by exact string
    full = {}
    for s in unique:
        full[s] = lookup(cache, s)

    def L(s):
        return full.get(s, {"ru": s, "en": s, "kk": s})

    out = {}
    for lid, block in quizzes.items():
        nb = {"title": L(_ru_text(block["title"])), "questions": []}
        for q in block["questions"]:
            nb["questions"].append(
                {
                    "id": q["id"],
                    "question": L(_ru_text(q["question"])),
                    "options": [L(_ru_text(o)) for o in q["options"]],
                    "correct": q["correct"],
                    "explanation": L(_ru_text(q["explanation"])),
                }
            )
        out[lid] = nb

    with open("quizzes.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("Done.", flush=True)


if __name__ == "__main__":
    main()
