import pandas as pd
import numpy as np
from typing import List, Dict, Any
from app.models.data_card import AnalysisRequest, DataCard, ChartData, Anomaly
from app.services.schema_inference import SchemaInferenceService
from app.services.statistical_analyzer import StatisticalAnalyzer
from app.services.categorical_analyzer import CategoricalAnalyzer
from app.services.temporal_analyzer import TemporalAnalyzer


class DataCardGenerator:
    """Main service for generating DataCards from datasets"""

    def __init__(self):
        self.schema_inferrer = SchemaInferenceService()
        self.stat_analyzer = StatisticalAnalyzer()
        self.cat_analyzer = CategoricalAnalyzer()
        self.temp_analyzer = TemporalAnalyzer()

    def generate(self, request: AnalysisRequest) -> DataCard:
        """
        Generate complete DataCard from dataset

        Args:
            request: Analysis request with data and options

        Returns:
            DataCard with all statistics
        """
        # Convert to DataFrame
        df = pd.DataFrame(request.data)

        if df.empty:
            return self._empty_data_card()

        # Infer or use provided schema
        if request.schema:
            schema = {
                "numeric": request.schema.numeric,
                "categorical": request.schema.categorical,
                "temporal": request.schema.temporal,
            }
        else:
            schema = self.schema_inferrer.infer_schema(df)

        # Generate summary
        summary = self._generate_summary(df, schema)

        # Analyze numeric fields
        numeric_stats = {}
        for field in schema["numeric"]:
            if field in df.columns:
                numeric_stats[field] = self.stat_analyzer.analyze_numeric_field(
                    df[field],
                    outlier_method=request.options.outlier_method,
                    outlier_threshold=request.options.outlier_threshold,
                )

        # Analyze categorical fields
        categorical_stats = {}
        for field in schema["categorical"]:
            if field in df.columns:
                categorical_stats[field] = self.cat_analyzer.analyze_categorical_field(
                    df[field], top_n=request.options.top_n
                )

        # Analyze temporal fields
        temporal_stats = {}
        for field in schema["temporal"]:
            if field in df.columns:
                temporal_stats[field] = self.temp_analyzer.analyze_temporal_field(
                    df[field]
                )

        # Compute correlations
        correlations = {}
        if request.options.compute_correlations and len(schema["numeric"]) >= 2:
            correlations = self.stat_analyzer.compute_correlations(
                df, schema["numeric"]
            )

        # Detect anomalies
        anomalies = self._detect_anomalies(df, numeric_stats, categorical_stats)

        # Generate chart data
        chart_data = []
        if request.options.include_distributions:
            chart_data = self._generate_chart_data(
                df, schema, numeric_stats, categorical_stats
            )

        return DataCard(
            summary=summary,
            numeric_stats=numeric_stats,
            categorical_stats=categorical_stats,
            temporal_stats=temporal_stats,
            correlations=correlations,
            anomalies=anomalies,
            chart_data=chart_data,
        )

    def _generate_summary(self, df: pd.DataFrame, schema: Dict) -> Dict[str, Any]:
        """Generate dataset summary"""
        summary = {
            "record_count": len(df),
            "field_count": len(df.columns),
            "numeric_fields": len(schema["numeric"]),
            "categorical_fields": len(schema["categorical"]),
            "temporal_fields": len(schema["temporal"]),
        }

        # Add total notional if 'amount' or 'notional' field exists
        for field in ["amount", "notional", "value"]:
            if field in df.columns and field in schema["numeric"]:
                summary["total_notional"] = float(df[field].sum())
                break

        # Add time range if temporal fields exist
        if schema["temporal"] and schema["temporal"][0] in df.columns:
            dates = pd.to_datetime(df[schema["temporal"][0]], errors="coerce").dropna()
            if len(dates) > 0:
                summary["time_range"] = {
                    "start": dates.min().isoformat(),
                    "end": dates.max().isoformat(),
                }

        return summary

    def _detect_anomalies(
        self, df: pd.DataFrame, numeric_stats: Dict, categorical_stats: Dict
    ) -> List[Anomaly]:
        """Detect anomalies in dataset"""
        anomalies = []

        # Statistical outliers from numeric fields
        for field, stats in numeric_stats.items():
            outlier_count = stats.outliers.get("count", 0)
            if outlier_count > 0:
                severity = "high" if outlier_count > len(df) * 0.1 else "medium"
                anomalies.append(
                    Anomaly(
                        type="statistical_outlier",
                        field=field,
                        severity=severity,
                        description=f"{outlier_count} outliers detected in {field} using {stats.outliers.get('method', 'unknown')} method",
                        affected_records=stats.outliers.get("indices", [])[:100],
                        details={
                            "method": stats.outliers.get("method"),
                            "threshold": stats.outliers.get("threshold"),
                            "percent_of_total": round(
                                (outlier_count / len(df)) * 100, 2
                            ),
                        },
                    )
                )

        # Concentration risk in categorical fields
        for field, stats in categorical_stats.items():
            # HHI > 0.25 indicates high concentration
            if stats.concentration_risk > 0.25:
                top_entity = stats.top_n[0] if stats.top_n else None
                anomalies.append(
                    Anomaly(
                        type="concentration_risk",
                        field=field,
                        severity="high" if stats.concentration_risk > 0.5 else "medium",
                        description=f"High concentration detected in {field} (HHI: {stats.concentration_risk:.3f})",
                        affected_records=[],
                        details={
                            "hhi": stats.concentration_risk,
                            "top_entity": top_entity["value"] if top_entity else None,
                            "top_entity_percent": top_entity["percent"]
                            if top_entity
                            else 0,
                        },
                    )
                )

        return anomalies

    def _generate_chart_data(
        self,
        df: pd.DataFrame,
        schema: Dict,
        numeric_stats: Dict,
        categorical_stats: Dict,
    ) -> List[ChartData]:
        """Generate data for visualizations"""
        charts = []

        # Histograms for ALL numeric fields (sorted by variance for consistency)
        numeric_fields_sorted = sorted(
            numeric_stats.items(), key=lambda x: x[1].std, reverse=True
        )

        for field, stats in numeric_fields_sorted:  # Generate for all numeric fields
            if field in df.columns:
                try:
                    # Create histogram bins
                    data = df[field].dropna()
                    if len(data) > 0:
                        hist, bin_edges = np.histogram(data, bins=20)
                        charts.append(
                            ChartData(
                                type="histogram",
                                field=field,
                                data={
                                    "bins": bin_edges.tolist(),
                                    "counts": hist.tolist(),
                                    "mean": stats.mean,
                                    "median": stats.median,
                                },
                            )
                        )
                except Exception:
                    # Skip fields that fail histogram generation
                    pass

        # Bar charts for ALL categorical fields (sorted by uniqueness for consistency)
        categorical_fields_sorted = sorted(
            categorical_stats.items(), key=lambda x: x[1].unique_count
        )

        for (
            field,
            stats,
        ) in categorical_fields_sorted:  # Generate for all categorical fields
            if stats.top_n:
                charts.append(
                    ChartData(
                        type="bar",
                        field=field,
                        data={
                            "labels": [item["value"] for item in stats.top_n],
                            "values": [item["count"] for item in stats.top_n],
                            "percentages": [item["percent"] for item in stats.top_n],
                        },
                    )
                )

        return charts

    def _empty_data_card(self) -> DataCard:
        """Return empty DataCard for empty dataset"""
        return DataCard(
            summary={"record_count": 0},
            numeric_stats={},
            categorical_stats={},
            temporal_stats={},
            correlations={},
            anomalies=[],
            chart_data=[],
        )
