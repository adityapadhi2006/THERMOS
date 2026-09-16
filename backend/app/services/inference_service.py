from app.data.feature_builder import build_features
from app.services.model_service import predict
from app.services.risk_service import calculate_risk


def predict_event(index=0):
    df = build_features()

    event = df.iloc[index].to_dict()

    model_result = predict(event)

    risk_result = calculate_risk(
        thermal_severity=event["thermal_severity"],
        persistence_days=event["persistence_days"],
        distance_to_industry_km=event["distance_to_industry_km"],
        model_confidence=model_result["confidence"]
    )

    return {
        "event_index": index,
        "prediction": model_result,
        "risk": risk_result
    }