from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.meal_planner import MealPlanner
from app.models.user import User
from app.schemas.meal_planner import MealPlannerRead, MealPlannerUpdate

router = APIRouter(prefix="/planner", tags=["planner"])


@router.get("/me", response_model=MealPlannerRead)
def get_my_planner(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    planner = db.get(MealPlanner, current_user.id)
    if planner is None:
        return MealPlannerRead()
    return planner


@router.put("/me", response_model=MealPlannerRead)
def save_my_planner(
    planner_data: MealPlannerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated_at = datetime.now(timezone.utc)
    planner = db.get(MealPlanner, current_user.id)
    if planner is None:
        planner = MealPlanner(user_id=current_user.id)
        db.add(planner)

    planner.selected_recipe_ids = planner_data.selected_recipe_ids
    planner.schedule = planner_data.schedule
    planner.updated_at = updated_at

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        planner = db.get(MealPlanner, current_user.id)
        if planner is None:
            raise
        planner.selected_recipe_ids = planner_data.selected_recipe_ids
        planner.schedule = planner_data.schedule
        planner.updated_at = updated_at
        db.commit()

    db.refresh(planner)
    return planner