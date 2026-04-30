from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.favorite_food import FavoriteFood
from app.models.user import User
from app.schemas.favorite_food import FoodCreate, FoodOut, FoodUpdate

router = APIRouter(tags=["foods"])


@router.post("/foods", response_model=FoodOut, status_code=status.HTTP_201_CREATED)
def create_favorite_food(
    payload: FoodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    food = FavoriteFood(
        user_id=current_user.id,
        name=payload.name,
        category=payload.category,
    )
    db.add(food)
    db.commit()
    db.refresh(food)
    return food


@router.get("/foods", response_model=list[FoodOut])
def list_favorite_foods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(FavoriteFood)
        .filter(FavoriteFood.user_id == current_user.id)
        .order_by(FavoriteFood.created_at.desc(), FavoriteFood.id.desc())
        .all()
    )


@router.put("/foods/{food_id}", response_model=FoodOut)
def update_favorite_food(
    food_id: int,
    payload: FoodUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    food = (
        db.query(FavoriteFood)
        .filter(FavoriteFood.id == food_id, FavoriteFood.user_id == current_user.id)
        .first()
    )
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    food.name = payload.name
    food.category = payload.category
    db.commit()
    db.refresh(food)
    return food


@router.delete("/foods/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_favorite_food(
    food_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    food = (
        db.query(FavoriteFood)
        .filter(FavoriteFood.id == food_id, FavoriteFood.user_id == current_user.id)
        .first()
    )
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    db.delete(food)
    db.commit()
