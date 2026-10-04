from fastapi import APIRouter
from app.api.v1.endpoints import chat, evaluate, admin

api_router = APIRouter()

api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(evaluate.router, prefix="/evaluate", tags=["evaluate"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
