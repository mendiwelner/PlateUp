import pandas as pd
import json
import ast
from deep_translator import GoogleTranslator
from app.data.ingredients_data import ingredients_library

# flatten של רשימת מצרכים חוקיים
VALID_INGREDIENTS = [
    ing for cat in ingredients_library.values() for ing in cat
]

translator = GoogleTranslator(source='en', target='iw')

# 🔥 CACHE קריטי לביצועים
cache = {}

def translate_safe(text):
    if not text or pd.isna(text):
        return ""

    text = str(text).strip()

    # אם כבר תורגם
    if text in cache:
        return cache[text]

    try:
        translated = translator.translate(text)
    except Exception:
        translated = text

    cache[text] = translated
    return translated


def match_ingredient(translated_ing):
    """
    התאמה למילון שלך כדי לשמור עקביות
    """
    for val in VALID_INGREDIENTS:
        if val in translated_ing or translated_ing in val:
            return val
    return translated_ing


def process_recipes(input_csv, output_json, limit=5):
    df = pd.read_csv(input_csv)

    recipes_he = []

    print(f"🚀 Translating first {limit} recipes only...")

    for index, row in df.iterrows():

        if index >= limit:
            break

        try:
            # כותרת ותיאור
            title_he = translate_safe(row['name'])
            description_he = translate_safe(row['description'])

            # מצרכים
            ingredients_en = ast.literal_eval(row['ingredients'])
            ingredients_he = [
                match_ingredient(translate_safe(ing))
                for ing in ingredients_en
            ]

            # שלבים
            steps_en = ast.literal_eval(row['steps'])
            steps_he = [translate_safe(step) for step in steps_en]

            # nutrition
            nutrition = ast.literal_eval(row['nutrition'])

            recipes_he.append({
                "id": int(row['id']),
                "title": title_he,
                "description": description_he,
                "minutes": int(row['minutes']),
                "ingredients": ingredients_he,
                "steps": steps_he,
                "nutrition": {
                    "calories": nutrition[0],
                    "fat": nutrition[1],
                    "sugar": nutrition[2]
                },
                "tags": ast.literal_eval(row['tags'])
            })

            print(f"✔ Processed {index + 1}/{limit}")

        except Exception as e:
            print(f"❌ Error row {index}: {e}")

    # שמירה
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(recipes_he, f, ensure_ascii=False, indent=4)

    print("🎉 Done! saved:", output_json)


# הרצה
process_recipes(
    "app/data/recipes_en.csv",
    "app/data/recipes_he_sample.json",
    limit=5
)