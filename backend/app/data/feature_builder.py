from app.data.spatial_features import add_spatial_features


ML_FEATURES = [
    "bright_ti4",
    "bright_ti5",
    "frp",
    "confidence",
    "thermal_severity",
    "distance_to_industry_km",
    "distance_to_road_km",
    "distance_to_settlement_km",
    "night_detection",
    "24h_event_count",
    "7d_event_count",
    "persistence_days",
    "frp_trend",
    "brightness_trend",
    "activity_trend"
]


def build_features():
    df = add_spatial_features().copy()

    # Convert FIRMS confidence to numeric
    df["confidence"] = (
        df["confidence"]
        .replace({
            "n": 0,
            "l": 1,
            "h": 2
        })
        .astype(float)
    )

    # Keep exactly the features used by XGBoost
    features = df[ML_FEATURES].copy()

    return features