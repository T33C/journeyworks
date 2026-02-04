from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import math
from app.models.data_card import AnalysisRequest, DataCard
from app.services.datacard_generator import DataCardGenerator

app = FastAPI(
    title="Analysis Service",
    description="Statistical analysis service for dataset insights",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
datacard_generator = DataCardGenerator()


def clean_nan_values(obj):
    """
    Recursively replace NaN and Infinity values with None for JSON serialization
    """
    if isinstance(obj, dict):
        return {k: clean_nan_values(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan_values(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    return obj


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "analysis-service"}


@app.post("/api/v1/analyze/dataset", response_model=DataCard)
async def analyze_dataset(request: AnalysisRequest) -> DataCard:
    """
    Analyze dataset and return comprehensive statistics

    Args:
        request: AnalysisRequest with data and options

    Returns:
        DataCard with statistical analysis
    """
    try:
        if not request.data:
            raise HTTPException(status_code=400, detail="Empty dataset provided")

        data_card = datacard_generator.generate(request)

        # Clean NaN/Infinity values before returning
        cleaned_data = clean_nan_values(data_card.model_dump())
        return cleaned_data

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "analysis-service",
        "version": "1.0.0",
        "endpoints": {"health": "/health", "analyze": "/api/v1/analyze/dataset"},
    }
