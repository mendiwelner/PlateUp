from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FoodCreate(BaseModel):
    name: str
    category: str


class FoodUpdate(BaseModel):
    name: str
    category: str


class FoodOut(BaseModel):
    id: int
    user_id: int
    name: str
    category: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
