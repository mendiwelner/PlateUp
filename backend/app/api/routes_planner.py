from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.dialects.postgresql import insert
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
    statement = insert(MealPlanner).values(
        user_id=current_user.id,
        selected_recipe_ids=planner_data.selected_recipe_ids,
        schedule=planner_data.schedule,
        updated_at=updated_at,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[MealPlanner.user_id],
        set_={
            "selected_recipe_ids": planner_data.selected_recipe_ids,
            "schedule": planner_data.schedule,
            "updated_at": updated_at,
        },
    )
    db.execute(statement)
    db.commit()
    return db.get(MealPlanner, current_user.id)