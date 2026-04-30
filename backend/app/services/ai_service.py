"""
Module providing AI-powered recipe generation services.
This module integrates with Google Gemini to generate creative recipes based on user input.
"""

import json
import time
from google import genai
from fastapi import HTTPException, status
from app.core.config import settings


class AIService:
    def __init__(self) -> None:
        """אתחול הלקוח של גוגל עם המודל העדכני ביותר"""
        if not settings.GEMINI_API_KEY:
            print("❌ DEBUG: GEMINI_API_KEY is missing!")
            self.api_key = None
        else:
            self.api_key = settings.GEMINI_API_KEY.strip()
            # יצירת הלקוח של גוגל
            self.client = genai.Client(api_key=self.api_key)
            self.model_id = "gemini-2.5-flash"
            print(f"✅ AI Service initialized with {self.model_id}")

    def generate_recipes(self, favorite_foods: list[str]) -> dict:
        """מייצר 3 מתכונים עם מנגנון הגנה מפני עומס שרת (503)"""
        if not self.api_key:
            raise HTTPException(status_code=500, detail="API Key not configured")

        foods_str = ", ".join(favorite_foods)
        prompt = (
            f"צור 3 מתכונים יצירתיים בעברית המבוססים על המצרכים הבאים: {foods_str}. "
            f"החזר אך ורק אובייקט JSON במבנה הבא: "
            f"{{\"recipes\": [{{ \"title\": \"\", \"ingredients\": [], \"instructions\": [] }}]}}"
        )

        for attempt in range(3):
            try:
                print(f"🚀 Calling Gemini (Attempt {attempt + 1})...")
                response = self.client.models.generate_content(
                    model=self.model_id,
                    contents=prompt
                )
                
                if not response or not response.text:
                    raise ValueError("Empty response from AI")

                return self._parse_json(response.text)

            except Exception as e:
                # טיפול בשגיאת עומס 503
                if "503" in str(e) and attempt < 2:
                    wait_time = (attempt + 1) * 2
                    print(f"⚠️ Server busy (503), retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                print(f"❌ AI Error: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"AI Service Failure: {str(e)}"
                )

    def _parse_json(self, text: str) -> dict:
        """חילוץ וניקוי JSON מהתגובה"""
        try:
            # ניקוי סימני Markdown בצורה בטוחה
            # מחליפים את ה-Regex בשני replace פשוטים כדי למנוע SyntaxError בהעתקה
            clean_text = text.replace("```json", "").replace("```", "").strip()
            
            # חיפוש האובייקט בעזרת סוגריים מסולסלים
            start = clean_text.find("{")
            end = clean_text.rfind("}") + 1
            if start != -1 and end != 0:
                json_str = clean_text[start:end]
                return json.loads(json_str)
            
            return json.loads(clean_text)
        except Exception as e:
            print(f"❌ JSON Parse Error: {e} | Raw text: {text[:200]}")
            raise ValueError("התשובה מהבינה המלאכותית לא הייתה בפורמט JSON תקין")