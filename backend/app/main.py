from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.predict import router as predict_router


app = FastAPI(
    title="THERMOS API",
    description="AI-Based Industrial Fire & Thermal Source Intelligence",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(predict_router)


@app.get("/")
def root():
    return {
        "status": "success",
        "message": "THERMOS Backend Running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }