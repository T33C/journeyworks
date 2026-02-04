import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from scipy import stats


class SchemaInferenceService:
    """Service for inferring data types from dataset"""

    def infer_schema(self, df: pd.DataFrame) -> Dict[str, List[str]]:
        """
        Infer field types from DataFrame

        Returns:
            Dict with keys: numeric, categorical, temporal
        """
        numeric_fields = []
        categorical_fields = []
        temporal_fields = []

        for col in df.columns:
            if col.startswith("_"):  # Skip ES metadata fields
                continue

            dtype = df[col].dtype

            # Check if temporal
            if self._is_temporal(df[col]):
                temporal_fields.append(col)
            # Check if numeric
            elif pd.api.types.is_numeric_dtype(dtype):
                numeric_fields.append(col)
            # Everything else is categorical
            else:
                categorical_fields.append(col)

        return {
            "numeric": numeric_fields,
            "categorical": categorical_fields,
            "temporal": temporal_fields,
        }

    def _is_temporal(self, series: pd.Series) -> bool:
        """Check if series contains temporal data"""
        if pd.api.types.is_datetime64_any_dtype(series):
            return True

        # Try parsing as datetime
        if series.dtype == "object":
            sample = series.dropna().head(10)
            if len(sample) == 0:
                return False

            try:
                pd.to_datetime(sample)
                return True
            except (ValueError, TypeError):
                return False

        return False
