from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MealPlannerUpdate(BaseModel):
    selected_recipe_ids: list[str] = Field(default_factory=list, max_length=500)
    schedule: dict[str, list[str]] = Field(default_factory=dict)

    @field_validator("selected_recipe_ids")
    @classmethod
    def remove_duplicate_recipe_ids(cls, recipe_ids: list[str]) -> list[str]:
        if any(not recipe_id.strip() for recipe_id in recipe_ids):
            raise ValueError("Recipe IDs cannot be empty")
        return list(dict.fromkeys(recipe_ids))

    @field_validator("schedule")
    @classmethod
    def validate_schedule(cls, schedule: dict[str, list[str]]) -> dict[str, list[str]]:
        if len(schedule) > 400:
            raise ValueError("Schedule cannot contain more than 400 dates")

        normalized: dict[str, list[str]] = {}
        for day, recipe_ids in schedule.items():
            try:
                parsed_day = date.fromisoformat(day)
            except ValueError as exc:
                raise ValueError(f"Invalid schedule date: {day}") from exc
            if parsed_day.isoformat() != day:
                raise ValueError(f"Schedule date must use YYYY-MM-DD format: {day}")
            if len(recipe_ids) > 100:
                raise ValueError("A date cannot contain more than 100 recipes")
            if any(not recipe_id.strip() for recipe_id in recipe_ids):
                raise ValueError("Recipe IDs cannot be empty")
            normalized[day] = list(dict.fromkeys(recipe_ids))
        return normalized


class MealPlannerRead(MealPlannerUpdate):
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)