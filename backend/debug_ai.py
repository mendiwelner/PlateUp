import google.genai as genai
from google.genai import types
from pydantic import BaseModel, ConfigDict # ייבוא ConfigDict
from fastapi import HTTPException, status
from app.core.config import settings

# הגדרת המודל עם חסימה של שדות נוספים
class Recipe(BaseModel):
    model_config = ConfigDict(extra='forbid') # פותר את שגיאת additionalProperties
    title: str
    ingredients: list[str]
    instructions: list[str]

class RecipeResponse(BaseModel):
    model_config = ConfigDict(extra='forbid') # פותר את שגיאת additionalProperties
    recipes: list[Recipe]

class AIService:
    def __init__(self) -> None:
        if not settings.GEMINI_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GEMINI_API_KEY is not configured",
            )
        
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model_id = "gemini-1.5-flash"

    def generate_recipes(self, favorite_foods: list[str]) -> dict:
        foods_list = ", ".join(favorite_foods)
        prompt = (
            f"Suggest 3 creative meal recipes based on: {foods_list}. "
            "Return the response in Hebrew."
        )

        try:
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=RecipeResponse,
                )
            )

            if not response.parsed:
                raise ValueError("AI failed to return a valid structured response")
            
            return response.parsed.model_dump()

        except Exception as e:
            print(f"AI Debug Error: {e}") # הדפסה ללוגים של השרת
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI Service Error: {str(e)}"
            )