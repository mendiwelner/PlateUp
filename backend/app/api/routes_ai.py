from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

from app.services.ai_service import AIService
from app.services.recipe_engine_service import RecipeEngineService
from app.data.ingredients_data import ingredients_library

router = APIRouter(prefix="/ai", tags=["ai"])


# ✅ נוצר פעם אחת בלבד (כשקובץ נטען)
ai_service = AIService()


class GenerateRecipesRequest(BaseModel):
    ingredients: List[str]


@router.get("/ingredients")
def get_ingredients():
    """Return the complete ingredients library organized by categories."""
    return ingredients_library


@router.post("/generate-recipes-from-ingredients")
def generate_recipes_from_ingredients(request: GenerateRecipesRequest):
    """Generate recipes based on selected ingredients."""
    recipe_engine_service = RecipeEngineService()
    ai_service = AIService()  # Ensure AIService is initialized
    return ai_service.generate_recipes(request.ingredients)
    return recipe_engine_service.generate_recipes(request.ingredients)