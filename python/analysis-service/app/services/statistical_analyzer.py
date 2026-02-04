import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
from scipy import stats as scipy_stats
from app.models.data_card import NumericStats


class StatisticalAnalyzer:
    """Service for computing statistical metrics"""

    def analyze_numeric_field(
        self,
        series: pd.Series,
        outlier_method: str = "zscore",
        outlier_threshold: float = 3.0,
    ) -> NumericStats:
        """
        Compute comprehensive statistics for numeric field

        Args:
            series: Numeric data series
            outlier_method: Method for outlier detection (zscore or iqr)
            outlier_threshold: Threshold value for detection

        Returns:
            NumericStats object with all metrics
        """
        # Remove NaN values
        clean_data = series.dropna()

        if len(clean_data) == 0:
            return self._empty_numeric_stats()

        # Basic statistics
        count = len(clean_data)
        mean = float(clean_data.mean())
        median = float(clean_data.median())
        std = float(clean_data.std())
        min_val = float(clean_data.min())
        max_val = float(clean_data.max())

        # Quartiles
        q25 = float(clean_data.quantile(0.25))
        q50 = float(clean_data.quantile(0.50))
        q75 = float(clean_data.quantile(0.75))

        # Distribution shape
        skewness = float(scipy_stats.skew(clean_data))
        kurtosis = float(scipy_stats.kurtosis(clean_data))

        # Outlier detection
        outliers = self._detect_outliers(
            clean_data, method=outlier_method, threshold=outlier_threshold
        )

        return NumericStats(
            count=count,
            mean=mean,
            median=median,
            std=std,
            min=min_val,
            max=max_val,
            q25=q25,
            q50=q50,
            q75=q75,
            skewness=skewness,
            kurtosis=kurtosis,
            outliers=outliers,
        )

    def _detect_outliers(
        self, series: pd.Series, method: str = "zscore", threshold: float = 3.0
    ) -> Dict[str, Any]:
        """
        Detect outliers using specified method

        Args:
            series: Numeric data
            method: Detection method (zscore or iqr)
            threshold: Threshold value

        Returns:
            Dict with outlier information
        """
        if method == "zscore":
            z_scores = np.abs(scipy_stats.zscore(series))
            outlier_mask = z_scores > threshold
            outlier_indices = series.index[outlier_mask].tolist()
            outlier_values = series[outlier_mask].tolist()

            return {
                "method": "zscore",
                "threshold": threshold,
                "count": len(outlier_indices),
                "indices": outlier_indices[:100],  # Limit to 100
                "values": [float(v) for v in outlier_values[:100]],
                "max_zscore": float(z_scores.max()) if len(z_scores) > 0 else 0,
            }

        elif method == "iqr":
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - (threshold * iqr)
            upper_bound = q3 + (threshold * iqr)

            outlier_mask = (series < lower_bound) | (series > upper_bound)
            outlier_indices = series.index[outlier_mask].tolist()
            outlier_values = series[outlier_mask].tolist()

            return {
                "method": "iqr",
                "threshold": threshold,
                "count": len(outlier_indices),
                "indices": outlier_indices[:100],
                "values": [float(v) for v in outlier_values[:100]],
                "bounds": {"lower": float(lower_bound), "upper": float(upper_bound)},
            }

        return {"method": method, "count": 0}

    def compute_correlations(
        self, df: pd.DataFrame, numeric_fields: List[str]
    ) -> Dict[str, Any]:
        """
        Compute correlation matrix for numeric fields

        Args:
            df: DataFrame with numeric data
            numeric_fields: List of numeric field names

        Returns:
            Dict with correlation data
        """
        if len(numeric_fields) < 2:
            return {"pearson": {}, "significant": []}

        # Select numeric columns
        numeric_df = df[numeric_fields].select_dtypes(include=[np.number])

        if numeric_df.shape[1] < 2:
            return {"pearson": {}, "significant": []}

        # Compute Pearson correlation
        corr_matrix = numeric_df.corr(method="pearson")

        # Extract pairwise correlations
        pearson = {}
        significant = []

        for i, col1 in enumerate(corr_matrix.columns):
            for j, col2 in enumerate(corr_matrix.columns):
                if i < j:  # Upper triangle only
                    r_value = corr_matrix.loc[col1, col2]

                    # Skip NaN correlations
                    if pd.isna(r_value):
                        continue

                    key = f"{col1}_{col2}"
                    pearson[key] = float(r_value)

                    # Flag significant correlations (|r| > 0.7)
                    if abs(r_value) > 0.7:
                        significant.append(
                            {
                                "field1": col1,
                                "field2": col2,
                                "r": float(r_value),
                                "strength": "strong"
                                if abs(r_value) > 0.9
                                else "moderate",
                            }
                        )

        return {"pearson": pearson, "significant": significant}

    def _empty_numeric_stats(self) -> NumericStats:
        """Return empty NumericStats for empty series"""
        return NumericStats(
            count=0,
            mean=0.0,
            median=0.0,
            std=0.0,
            min=0.0,
            max=0.0,
            q25=0.0,
            q50=0.0,
            q75=0.0,
            outliers={"count": 0},
        )
