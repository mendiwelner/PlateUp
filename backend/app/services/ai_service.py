"""
Module providing AI-powered recipe generation services using Google Gemini.
Optimized for Free Tier stability and rate-limit handling.
"""

import json
import time
import google.generativeai as genai
from fastapi import HTTPException, status
from app.core.config import settings

class AIService:
    """
    Service class to interact with Google Gemini AI.
    Prioritizes stable models (1.5 Flash) to ensure continuous operation on Free Tier.
    """

    def __init__(self) -> None:
        """
        Initializes the client and selects the most stable available model.
        """
        if not settings.GEMINI_API_KEY:
            print("❌ DEBUG: GEMINI_API_KEY is missing!")
            self.api_key = None
            self.client = None
            self.model_id = "gemini-1.5-flash"
        else:
            self.api_key = settings.GEMINI_API_KEY.strip()
            # שימוש בגרסה החדישה של Google Generative AI
            genai.configure(api_key=self.api_key)
            
            self.model_id = self._discover_model()
            print(f"✅ AI Service ready! Using: {self.model_id}")

    def _discover_model(self) -> str:
        """
        מחפש את המודל היציב ביותר. אם הסריקה נכשלת או מחזירה רק מודלים חסומים,
        חוזר ל-1.5-flash שנחשב להכי אמין.
        """
        try:
            print("🔍 Scanning for models...")
            models = genai.list_models()
            model_names = [m.name.replace("models/", "") for m in models]
            
            # בדיקה אם 1.5 פלאש קיים - הוא המטרה העיקרית שלנו לאמינות
            if "gemini-1.5-flash" in model_names:
                print("🎯 Found stable 1.5-flash. Using it for reliability.")
                return "gemini-1.5-flash"
            
            if "gemini-1.5-flash-8b" in model_names:
                print("⚡ Using 1.5-flash-8b for maximum speed.")
                return "gemini-1.5-flash-8b"

            # אם הגענו לכאן ואין 1.5, כנראה שהמפתח מוגבל. 
            # נבחר את מה שיש, אבל נתכונן ל-Retries.
            print(f"⚠️ Stable models not found in list. Available: {model_names[:3]}")
            return model_names[0] if model_names else "gemini-1.5-flash"
            
        except Exception as e:
            print(f"⚠️ Scan failed, defaulting to 1.5-flash: {e}")
            return "gemini-1.5-flash"

    def generate_recipes(self, favorite_foods: list[str]) -> dict:
        """
        Generates recipes with a robust retry mechanism for 429/503 errors.
        """
        if not self.api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="AI Service not initialized. Please check API Key."
            )

        foods_str = ", ".join(favorite_foods)
        prompt = (
            f"צור 3 מתכונים יצירתיים בעברית המבוססים על המצרכים הבאים: {foods_str}. "
            f"החזר אך ורק אובייקט JSON במבנה הבא: "
            f"{{\"recipes\": [{{ \"title\": \"\", \"ingredients\": [], \"instructions\": [] }}]}}"
        )

        for attempt in range(3):
            try:
                print(f"🚀 Calling Gemini ({self.model_id}) - Attempt {attempt + 1}...")
                model = genai.GenerativeModel(self.model_id)
                response = model.generate_content(prompt)
                
                if not response or not response.text:
                    raise ValueError("AI returned an empty response")

                return self._parse_json(response.text)

            except Exception as e:
                error_msg = str(e).lower()
                
                # בדיקה אם חרגנו מהמכסה (429) או שהשרת עמוס (503)
                if ("429" in error_msg or "resource_exhausted" in error_msg or "503" in error_msg) and attempt < 2:
                    # המתנה ארוכה יותר כדי לאפשר למכסה להתאפס (גוגל מבקשת כ-30-60 שניות)
                    wait_time = (attempt + 1) * 25 
                    print(f"⚠️ Rate limit hit. Waiting {wait_time}s before next attempt...")
                    time.sleep(wait_time)
                    continue
                
                print(f"❌ AI Service Error: {error_msg}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"AI Service Failure: {error_msg}"
                ) from e
        
        return {"recipes": []}

    def _parse_json(self, text: str) -> dict:
        """
        Extracts and parses JSON from the AI response.
        """
        try:
            # ניקוי תגיות Markdown במידה וקיימות
            clean_text = text.replace("```json", "").replace("```", "").strip()
            
            # מציאת תחילת וסוף ה-JSON למקרה שיש טקסט מסביב
            start = clean_text.find("{")
            end = clean_text.rfind("}") + 1
            if start != -1 and end != 0:
                return json.loads(clean_text[start:end])
            
            return json.loads(clean_text)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"❌ JSON Parse Error: {e}")
            raise ValueError("Failed to parse AI response as JSON") from e