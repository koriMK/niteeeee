from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from database import async_session, create_tables
from config import settings
from routers import auth_router, orders_router, payments_router, products_router
from routers.payments_router import limiter
from seed import seed_products


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables and seed products. Shutdown: nothing special."""
    await create_tables()
    async with async_session() as db:
        await seed_products(db)
    print(f"🚀 Backend ready at http://localhost:{settings.PORT}")
    yield


app = FastAPI(
    title="Nate Poultry Meat API",
    description="Backend API for the Nate Poultry Meat e-commerce platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow the Vite dev server and common origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router.router)
app.include_router(products_router.router)
app.include_router(orders_router.router)
app.include_router(payments_router.router)


@app.get("/")
async def root():
    return {"message": "Nate Poultry Meat API", "status": "running"}


@app.get("/api/config")
async def get_config():
    return {
        "whatsapp_number": settings.WHATSAPP_NUMBER,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
