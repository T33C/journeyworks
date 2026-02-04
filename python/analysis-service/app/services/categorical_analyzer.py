import pandas as pd
from typing import Dict, Any, List
from app.models.data_card import CategoricalStats


class CategoricalAnalyzer:
    """Service for analyzing categorical fields"""

    def analyze_categorical_field(
        self, series: pd.Series, top_n: int = 10
    ) -> CategoricalStats:
        """
        Compute statistics for categorical field

        Args:
            series: Categorical data series
            top_n: Number of top categories to return

        Returns:
            CategoricalStats object
        """
        # Remove NaN values
        clean_data = series.dropna()

        if len(clean_data) == 0:
            return self._empty_categorical_stats()

        # Value counts
        value_counts = clean_data.value_counts()
        total_count = len(clean_data)
        unique_count = len(value_counts)

        # Top N categories
        top_categories = []
        for value, count in value_counts.head(top_n).items():
            percent = (count / total_count) * 100
            top_categories.append(
                {"value": str(value), "count": int(count), "percent": round(percent, 2)}
            )

        # Concentration risk (Herfindahl-Hirschman Index)
        proportions = value_counts / total_count
        hhi = (proportions**2).sum()

        # Rare categories (< 1% of total)
        rare_threshold = total_count * 0.01
        rare_categories = [
            str(value)
            for value, count in value_counts.items()
            if count < rare_threshold
        ]

        return CategoricalStats(
            unique_count=unique_count,
            top_n=top_categories,
            concentration_risk=float(hhi),
            rare_categories=rare_categories[:50],  # Limit to 50
        )

    def _empty_categorical_stats(self) -> CategoricalStats:
        """Return empty CategoricalStats"""
        return CategoricalStats(
            unique_count=0, top_n=[], concentration_risk=0.0, rare_categories=[]
        )
