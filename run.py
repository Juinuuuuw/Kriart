"""Ponto de entrada do Kriart."""
import uvicorn
from backend.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
