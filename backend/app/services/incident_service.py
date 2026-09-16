def generate_incident_explanation(
    classification,
    ai_confidence,
    risk_score,
    risk_level,
    thermal_severity,
    persistence_days,
    distance_to_industry_km,
    event_count_7d,
):
    reasons = []

    # Thermal intensity
    if thermal_severity >= 70:
        reasons.append("High thermal intensity detected")
    elif thermal_severity >= 40:
        reasons.append("Moderate thermal intensity detected")

    # Persistence
    if persistence_days >= 5:
        reasons.append(
            f"Persistent thermal activity for {persistence_days} days"
        )
    elif persistence_days >= 2:
        reasons.append(
            f"Repeated thermal activity over {persistence_days} days"
        )

    # Industrial proximity
    if distance_to_industry_km <= 1:
        reasons.append(
            "Very close to mapped industrial infrastructure"
        )
    elif distance_to_industry_km <= 3:
        reasons.append(
            "Located near mapped industrial infrastructure"
        )

    # Nearby activity
    if event_count_7d >= 10:
        reasons.append(
            f"High nearby thermal activity ({event_count_7d} events in 7 days)"
        )
    elif event_count_7d >= 5:
        reasons.append(
            f"Multiple nearby thermal events ({event_count_7d} in 7 days)"
        )

    # Fallback
    if not reasons:
        reasons.append(
            "Thermal and spatial indicators require further verification"
        )

    # Recommended action
    if risk_level == "Critical":
        action = "Immediate inspection and verification recommended"
    elif risk_level == "High":
        action = "Priority inspection recommended"
    elif risk_level == "Medium":
        action = "Monitor and verify the thermal activity"
    else:
        action = "Continue monitoring"

    return {
        "summary": (
            f"THERMOS classified this event as "
            f"{classification} with {ai_confidence:.1f}% AI confidence."
        ),
        "reasons": reasons,
        "recommended_action": action,
        "risk_explanation": (
            f"Risk score is {risk_score:.1f}/100 "
            f"({risk_level})."
        ),
    }