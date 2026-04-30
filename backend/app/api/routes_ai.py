from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.favorite_food import FavoriteFood
from app.models.user import User
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate-recipes")
def generate_recipes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    foods = (
        db.query(FavoriteFood)
        .filter(FavoriteFood.user_id == current_user.id)
        .order_by(FavoriteFood.created_at.desc(), FavoriteFood.id.desc())
        .all()
    )
    if not foods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No favorite foods found. Add foods first.",
        )

    food_names = [food.name for food in foods]
    ai_service = AIService()
    return ai_service.generate_recipes(food_names)
