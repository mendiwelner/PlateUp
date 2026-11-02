from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class MealPlanner(Base):
    __tablename__ = "meal_planners"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    selected_recipe_ids = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=False, default=list)
    schedule = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=False, default=dict)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )