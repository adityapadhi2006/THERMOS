import pandas as pd

from app.data.temporal_features import add_temporal_features


def add_thermal_features():
    firms = add_temporal_features().copy()

    # Thermal severity: normalized FRP (0–100)
    max_frp = firms["frp"].max()

    firms["thermal_severity"] = (
        firms["frp"] / max_frp * 100
    )

    # Create a common temporal grid
    firms["lat_grid"] = firms["latitude"].round(2)
    firms["lon_grid"] = firms["longitude"].round(2)

    firms["frp_trend"] = 0.0
    firms["brightness_trend"] = 0.0
    firms["activity_trend"] = 0.0

    # Calculate temporal trends within each grid cell
    for idx, row in firms.iterrows():

        same_cell = (
            (firms["lat_grid"] == row["lat_grid"]) &
            (firms["lon_grid"] == row["lon_grid"])
        )

        previous_events = firms[
            same_cell &
            (firms["timestamp"] < row["timestamp"])
        ].sort_values("timestamp")

        if len(previous_events) > 0:
            previous = previous_events.iloc[-1]

            firms.loc[idx, "frp_trend"] = (
                row["frp"] - previous["frp"]
            )

            firms.loc[idx, "brightness_trend"] = (
                row["bright_ti4"] - previous["bright_ti4"]
            )

            firms.loc[idx, "activity_trend"] = (
                row["24h_event_count"] -
                previous["24h_event_count"]
            )

    return firms