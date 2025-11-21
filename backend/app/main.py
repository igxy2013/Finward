from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine, ensure_database_exists, ensure_schema_upgrade
from .routers import accounts, analytics, overview, auth, households, wealth, cashflows, tenants


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database exists before creating tables
    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrade()
    yield


settings = get_settings()

app = FastAPI(title="Finward Assets API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(overview.router)
app.include_router(analytics.router)
app.include_router(auth.router)
app.include_router(households.router)
app.include_router(wealth.router)
app.include_router(cashflows.router)
app.include_router(tenants.router)


@app.get("/ping")
def ping():
    return {"status": "ok"}

