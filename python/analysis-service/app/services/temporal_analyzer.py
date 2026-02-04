import pandas as pd
from typing import Dict, Any
from datetime import timedelta
from app.models.data_card import TemporalStats


class TemporalAnalyzer:
    """Service for analyzing temporal/date fields"""

    def analyze_temporal_field(self, series: pd.Series) -> TemporalStats:
        """
        Compute statistics for temporal field

        Args:
            series: Temporal data series

        Returns:
            TemporalStats object
        """
        # Convert to datetime
        clean_data = pd.to_datetime(series, errors="coerce").dropna()

        if len(clean_data) == 0:
            return self._empty_temporal_stats()

        # Sort dates
        sorted_dates = clean_data.sort_values()

        # Range
        start_date = sorted_dates.iloc[0]
        end_date = sorted_dates.iloc[-1]
        time_range = {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": (end_date - start_date).days,
        }

        # Gaps analysis
        gaps = self._analyze_gaps(sorted_dates)

        # Distribution (hourly if datetime, daily if date)
        distribution = self._analyze_distribution(clean_data)

        return TemporalStats(range=time_range, gaps=gaps, distribution=distribution)

    def _analyze_gaps(self, sorted_dates: pd.Series) -> Dict[str, Any]:
        """Analyze gaps between consecutive dates"""
        if len(sorted_dates) < 2:
            return {"count": 0, "max_gap_days": 0}

        # Calculate differences
        diffs = sorted_dates.diff()[1:]  # Skip first NaT

        # Find gaps (> 1 day)
        gaps = diffs[diffs > timedelta(days=1)]

        if len(gaps) == 0:
            return {"count": 0, "max_gap_days": 0}

        max_gap = gaps.max()

        return {
            "count": len(gaps),
            "max_gap_days": max_gap.days,
            "avg_gap_days": round(gaps.mean().days, 2) if len(gaps) > 0 else 0,
        }

    def _analyze_distribution(self, dates: pd.Series) -> Dict[str, Any]:
        """Analyze temporal distribution patterns"""
        # Check if times are present (not just dates)
        has_time = any(dates.dt.hour != 0) or any(dates.dt.minute != 0)

        if has_time:
            # Hourly distribution
            hourly = dates.dt.hour.value_counts().sort_index()
            return {
                "type": "hourly",
                "data": {int(h): int(count) for h, count in hourly.items()},
            }
        else:
            # Daily distribution
            daily = dates.dt.date.value_counts().sort_index()
            return {
                "type": "daily",
                "data": {str(d): int(count) for d, count in daily.head(100).items()},
            }

    def _empty_temporal_stats(self) -> TemporalStats:
        """Return empty TemporalStats"""
        return TemporalStats(range={"start": None, "end": None, "days": 0})
