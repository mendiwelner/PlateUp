import random
from typing import List, Dict, Set, Any
from fastapi import HTTPException, status
from app.data.recipes_data import recipes
from app.data.ingredients_data import ingredients_library


class RecipeEngineService:
    """
    מנוע התאמה חכם מבוסס tokens (לא רק מחרוזות שלמות).
    פותר בעיות כמו: "דג" מול "דג נסיכת הנילוס".
    """

    def __init__(self) -> None:
        self.recipes: List[Dict] = recipes

        # Create a flat list of all valid ingredients for validation
        self.valid_ingredients = set()
        for category_ingredients in ingredients_library.values():
            self.valid_ingredients.update(category_ingredients)

        # 🔥 מילים רועשות שלא רלוונטיות לאוכל
        self.stop_words = {
            "של", "עם", "בתוך", "מבושל", "מטוגן", "בתנור", "קצוץ"
        }

        # 🔁 קטגוריות בסיס - simplified since we now have exact matching
        self.synonyms = {
            "עגבנייה": "עגבניות",
            "עגבניות": "עגבניות",
            "עוף": "חזה עוף",
            "שמן": "שמן זית"
        }

    # -----------------------------
    # פירוק מרכיב למילים (קריטי)
    # -----------------------------
    def _tokenize(self, text: str) -> Set[str]:
        tokens = set()

        for part in text.lower().split():
            if part in self.stop_words:
                continue

            # נרמול + synonyms
            part = self.synonyms.get(part, part)
            tokens.add(part)

        return tokens

    # -----------------------------
    # בדיקת תקינות מצרכים
    # -----------------------------
    def validate_ingredients(self, ingredients: List[str]) -> None:
        """Validate that all ingredients exist in our predefined library."""
        if not ingredients:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No ingredients provided"
            )

        invalid_ingredients = [ing for ing in ingredients if ing not in self.valid_ingredients]
        if invalid_ingredients:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid ingredients: {', '.join(invalid_ingredients)}. All ingredients must be from the predefined list."
            )

    # -----------------------------
    # נרמול מתכון - simplified for exact matching
    # -----------------------------
    def _normalize(self, items: List[str]) -> Set[str]:
        result = set()

        for item in items:
            if not isinstance(item, str):
                continue

            # Since ingredients come from predefined list, we can do exact matching
            # Only apply minimal normalization for known synonyms
            normalized_item = self.synonyms.get(item, item)
            result.add(normalized_item)

        return result

    # -----------------------------
    # similarity אמיתי
    # -----------------------------
    def _score(self, user_set: Set[str], recipe: Dict) -> float:

        recipe_set = self._normalize(recipe.get("ingredients", []))

        if not recipe_set:
            return 0.0

        intersection = user_set & recipe_set

        # ❌ אין התאמה בכלל = פסילה מוחלטת
        if len(intersection) == 0:
            return 0.0

        # 📊 Jaccard בסיסי
        union = user_set | recipe_set
        base = len(intersection) / len(union)

        # 🎯 בונוסים קטנים להתאמה חזקה
        if len(intersection) >= 3:
            base += 0.15
        elif len(intersection) == 2:
            base += 0.08
        elif len(intersection) == 1:
            base += 0.03

        return base

    # -----------------------------
    # fallback
    # -----------------------------
    def _fallback(self, limit: int):
        sample = random.sample(self.recipes, min(limit, len(self.recipes)))

        return {
            "count": len(sample),
            "recipes": sample,
            "message": "fallback - no strong matches"
        }

    # -----------------------------
    # API ראשי
    # -----------------------------
    def generate_recipes(self, favorite_foods: List[str], limit: int = 3) -> Dict[str, Any]:

        if not favorite_foods:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="לא סופקו מצרכים"
            )

        user_set = self._normalize(favorite_foods)

        scored: List[tuple[float, Dict]] = []

        for recipe in self.recipes:

            if not isinstance(recipe, dict):
                continue

            score = self._score(user_set, recipe)

            # 🔒 סינון רעש אמיתי
            if score > 0.10:
                scored.append((score, recipe))

        # אם אין התאמות בכלל
        if not scored:
            return self._fallback(limit)

        scored.sort(key=lambda x: x[0], reverse=True)

        top_pool = scored[:min(10, len(scored))]

        selected = random.sample(top_pool, min(limit, len(top_pool)))

        results = []

        for score, recipe in selected:

            recipe_set = self._normalize(recipe.get("ingredients", []))
            missing = list(recipe_set - user_set)

            results.append({
                "title": recipe["title"],
                "ingredients": recipe["ingredients"],
                "instructions": recipe["instructions"],
                "match_score": round(score, 2),
                "missing_count": len(missing),
                "is_strong_match": score > 0.5
            })

        results.sort(key=lambda x: x["match_score"], reverse=True)

        return {
            "count": len(results),
            "recipes": results
        }

    # -----------------------------
    # API ראשי עם בדיקת תקינות
    # -----------------------------
    def generate_recipes_from_ingredients(self, ingredients: List[str], limit: int = 3) -> Dict[str, Any]:
        """Generate recipes from ingredients with validation."""
        self.validate_ingredients(ingredients)
        return self.generate_recipes(ingredients, limit)