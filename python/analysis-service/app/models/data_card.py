from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AnalysisOptions(BaseModel):
    """Options for dataset analysis"""

    compute_correlations: bool = Field(
        default=True, description="Compute correlation matrix"
    )
    outlier_method: str = Field(
        default="zscore", description="Method for outlier detection: zscore or iqr"
    )
    outlier_threshold: float = Field(
        default=3.0, description="Threshold for outlier detection"
    )
    top_n: int = Field(default=10, description="Number of top entities to include")
    include_distributions: bool = Field(
        default=True, description="Include distribution data for charts"
    )


class SchemaInfo(BaseModel):
    """Field type information for analysis"""

    numeric: List[str] = Field(default_factory=list)
    categorical: List[str] = Field(default_factory=list)
    temporal: List[str] = Field(default_factory=list)


class AnalysisRequest(BaseModel):
    """Request model for dataset analysis"""

    data: List[Dict[str, Any]] = Field(
        ..., description="Array of records from Elasticsearch"
    )
    schema: Optional[SchemaInfo] = Field(
        default=None, description="Field type hints (auto-detected if not provided)"
    )
    options: AnalysisOptions = Field(default_factory=AnalysisOptions)


class NumericStats(BaseModel):
    """Statistics for numeric fields"""

    count: int
    mean: float
    median: float
    std: float
    min: float
    max: float
    q25: float
    q50: float
    q75: float
    skewness: Optional[float] = None
    kurtosis: Optional[float] = None
    outliers: Dict[str, Any] = Field(default_factory=dict)


class CategoricalStats(BaseModel):
    """Statistics for categorical fields"""

    unique_count: int
    top_n: List[Dict[str, Any]]
    concentration_risk: float
    rare_categories: List[str]


class TemporalStats(BaseModel):
    """Statistics for temporal fields"""

    range: Dict[str, Any]
    gaps: Optional[Dict[str, Any]] = None
    distribution: Optional[Dict[str, Any]] = None


class Anomaly(BaseModel):
    """Detected anomaly"""

    type: str
    field: str
    severity: str
    description: str
    affected_records: List[int]
    details: Dict[str, Any] = Field(default_factory=dict)


class ChartData(BaseModel):
    """Chart data for visualizations"""

    type: str
    field: str
    data: Dict[str, Any]


class DataCard(BaseModel):
    """Complete statistical analysis result"""

    summary: Dict[str, Any]
    numeric_stats: Dict[str, NumericStats] = Field(default_factory=dict)
    categorical_stats: Dict[str, CategoricalStats] = Field(default_factory=dict)
    temporal_stats: Dict[str, TemporalStats] = Field(default_factory=dict)
    correlations: Dict[str, Any] = Field(default_factory=dict)
    anomalies: List[Anomaly] = Field(default_factory=list)
    chart_data: List[ChartData] = Field(default_factory=list)
