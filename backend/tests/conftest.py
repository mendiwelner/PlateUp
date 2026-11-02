import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_current_user
from app.database import Base, get_db
from app.main import app
from app.models.user import User


@pytest.fixture
def api_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with testing_session() as db:
        db.add_all(
            [
                User(id=1, email="one@example.com", hashed_password="unused", is_active=True),
                User(id=2, email="two@example.com", hashed_password="unused", is_active=True),
            ]
        )
        db.commit()

    active_user_id = {"value": 1}

    def override_get_db():
        with testing_session() as db:
            yield db

    def override_current_user(db=Depends(override_get_db)):
        return db.get(User, active_user_id["value"])

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user

    with TestClient(app) as client:
        yield client, active_user_id

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
