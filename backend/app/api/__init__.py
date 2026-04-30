from fastapi import APIRouter

from app.api.routes_auth import router as auth_router
from app.api.routes_foods import router as foods_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(foods_router)

