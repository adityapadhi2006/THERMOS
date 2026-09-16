import os
import joblib
import pandas as pd
import xgboost as xgb


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(__file__)
    )
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "thermos_xgboost.json"
)

FEATURE_PATH = os.path.join(
    BASE_DIR,
    "models",
    "thermos_features.pkl"
)


# Load trained XGBoost model
model = xgb.XGBClassifier()
model.load_model(MODEL_PATH)


# Load exact feature order used during training
features = joblib.load(FEATURE_PATH)


class_names = {
    0: "Industrial Fire / Flare",
    1: "Wildfire",
    2: "Agricultural Burn",
    3: "Unclassified Anomaly"
}


def predict(event_features):
    X = pd.DataFrame([event_features])[features]

    predicted_class = int(model.predict(X)[0])

    probabilities = model.predict_proba(X)[0]

    confidence = float(
        probabilities[predicted_class] * 100
    )

    return {
        "predicted_class": predicted_class,
        "predicted_label": class_names[predicted_class],
        "confidence": round(confidence, 2),
        "probabilities": probabilities.tolist()
    }