from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func

from app.database import Base


class FavoriteFood(Base):
    __tablename__ = "favorite_dishes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
