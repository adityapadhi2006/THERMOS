def calculate_risk(
    thermal_severity,
    persistence_days,
    distance_to_industry_km,
    model_confidence
):
    persistence_score = min(
        persistence_days / 7 * 100,
        100
    )

    industry_score = max(
        0,
        100 - (distance_to_industry_km / 5 * 100)
    )

    risk_score = (
        0.35 * thermal_severity +
        0.30 * persistence_score +
        0.20 * industry_score +
        0.15 * model_confidence
    )

    risk_score = round(
        min(max(risk_score, 0), 100),
        2
    )

    if risk_score < 25:
        risk_level = "Low"
    elif risk_score < 50:
        risk_level = "Medium"
    elif risk_score < 75:
        risk_level = "High"
    else:
        risk_level = "Critical"

    return {
        "risk_score": risk_score,
        "risk_level": risk_level
    }