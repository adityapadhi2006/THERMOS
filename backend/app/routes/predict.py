from threading import Lock

from fastapi import APIRouter
from pydantic import BaseModel

from app.data.thermos_filter import load_thermos_events
from app.data.feature_builder import build_features

from app.services.model_service import predict as model_predict
from app.services.risk_service import calculate_risk
from app.services.incident_service import generate_incident_explanation


router = APIRouter()


class PredictionRequest(BaseModel):
    index: int = 0


# ============================================================
# CACHE
# ============================================================

_cache_lock = Lock()

_events_cache = None

_results_cache = None

_regional_cache = None


# ============================================================
# SAFE NUMBER HELPERS
# ============================================================

def safe_float(value, default=0.0):
    try:
        number = float(value)

        if number != number:  # NaN
            return default

        return number

    except (TypeError, ValueError):
        return default


def safe_int(value, default=0):
    try:
        return int(float(value))

    except (TypeError, ValueError):
        return default

def build_feature_response(feature_data):
    return {
        "thermal_severity": safe_float(
            feature_data["thermal_severity"]
        ),
        "persistence_days": safe_float(
            feature_data["persistence_days"]
        ),
        "distance_to_industry_km": safe_float(
            feature_data["distance_to_industry_km"]
        ),
        "distance_to_road_km": safe_float(
            feature_data["distance_to_road_km"]
        ),
        "distance_to_settlement_km": safe_float(
            feature_data["distance_to_settlement_km"]
        ),
        "24h_event_count": safe_int(
            feature_data["24h_event_count"]
        ),
        "7d_event_count": safe_int(
            feature_data["7d_event_count"]
        ),
        "frp_trend": safe_float(
            feature_data["frp_trend"]
        ),
        "brightness_trend": safe_float(
            feature_data["brightness_trend"]
        ),
        "activity_trend": safe_float(
            feature_data["activity_trend"]
        ),
    }
def build_event_response(event):
    return {
        "latitude": safe_float(event["latitude"]),
        "longitude": safe_float(event["longitude"]),
        "acq_date": str(event["acq_date"]),
        "acq_time": safe_int(event["acq_time"]),
        "frp": safe_float(event["frp"]),
        "confidence": str(event["confidence"]),
        "daynight": str(event["daynight"]),
    }
def build_analysis_response(
    index,
    event,
    prediction,
    risk,
    feature_data,
    incident,
):
    return {
        "event_index": index,

        "event": build_event_response(event),

        "prediction": prediction,

        "risk": risk,

        "features": build_feature_response(feature_data),

        "incident_intelligence": incident,
    }
def build_risk_factor_response(feature_data):
    persistence_days = safe_float(
        feature_data["persistence_days"]
    )

    distance_to_industry = safe_float(
        feature_data["distance_to_industry_km"]
    )

    return {
        "persistence_score": min(
            persistence_days / 7 * 100,
            100,
        ),
        "industrial_proximity_score": max(
            0,
            100 - (distance_to_industry / 5 * 100),
        ),
    }
# ============================================================
# BUILD COMPLETE THERMOS ANALYSIS
# ============================================================

def build_analysis_cache():
    global _events_cache
    
    global _results_cache
    global _regional_cache
    
    # --------------------------------------------------------
    # LOAD DATA ONLY ONCE
    # --------------------------------------------------------

    events = load_thermos_events().reset_index(drop=True)
    features = build_features().reset_index(drop=True)

    results = []
    
    regional_data = {}

    # --------------------------------------------------------
    # PROCESS EVENTS
    # --------------------------------------------------------

    for index in range(len(events)):

        event = events.iloc[index]

        feature_data = features.iloc[index].to_dict()

        # ----------------------------------------------------
        # AI PREDICTION
        # ----------------------------------------------------

        prediction = model_predict(feature_data)

        # ----------------------------------------------------
        # RISK
        # ----------------------------------------------------

        risk = calculate_risk(
            thermal_severity=feature_data["thermal_severity"],
            persistence_days=feature_data["persistence_days"],
            distance_to_industry_km=feature_data[
                "distance_to_industry_km"
            ],
            model_confidence=prediction["confidence"],
        )
        
        # ----------------------------------------------------
        # RISK FACTORS
        # ----------------------------------------------------

        persistence_days = safe_float(
            feature_data["persistence_days"]
        )

        distance_to_industry = safe_float(
            feature_data["distance_to_industry_km"]
        )

        risk_factors = build_risk_factor_response(
            feature_data
        )

        persistence_score = risk_factors[
            "persistence_score"
        ]

        industrial_proximity_score = risk_factors[
            "industrial_proximity_score"
        ]
        # ----------------------------------------------------
        # EVENT RESULT
        # ----------------------------------------------------

        event_result = {
            "event_index": index,

            **build_event_response(event),

            "classification": prediction[
                "predicted_label"
            ],

            "ai_confidence": safe_float(
                prediction["confidence"]
            ),

            "risk_score": safe_float(
                risk["risk_score"]
            ),

            "risk_level": risk[
                "risk_level"
            ],
            "prediction": prediction,
            "risk": risk,
            # ------------------------------------------------
            # RISK FACTORS
            # ------------------------------------------------

            "thermal_severity": safe_float(
                feature_data[
                    "thermal_severity"
                ]
            ),

            "persistence_score": safe_float(
                persistence_score
            ),

            "industrial_proximity_score": safe_float(
                industrial_proximity_score
            ),

            # ------------------------------------------------
            # TEMPORAL INTELLIGENCE
            # ------------------------------------------------

            "event_24h_count": safe_int(
                feature_data[
                    "24h_event_count"
                ]
            ),

            "event_7d_count": safe_int(
                feature_data[
                    "7d_event_count"
                ]
            ),

            "persistence_days": persistence_days,

            "frp_trend": safe_float(
                feature_data[
                    "frp_trend"
                ]
            ),

            "brightness_trend": safe_float(
                feature_data[
                    "brightness_trend"
                ]
            ),

            "activity_trend": safe_float(
                feature_data[
                    "activity_trend"
                ]
            ),

            # ------------------------------------------------
            # SPATIAL INTELLIGENCE
            # ------------------------------------------------

            "distance_to_industry_km": distance_to_industry,

            "distance_to_road_km": safe_float(
                feature_data[
                    "distance_to_road_km"
                ]
            ),

            "distance_to_settlement_km": safe_float(
                feature_data[
                    "distance_to_settlement_km"
                ]
            ),
        }

        results.append(event_result)

        # ====================================================
        # REGIONAL AGGREGATION
        # ====================================================

        latitude = event_result["latitude"]
        longitude = event_result["longitude"]

        grid_lat = round(
            round(latitude / 0.02) * 0.02,
            2,
        )

        grid_lon = round(
            round(longitude / 0.02) * 0.02,
            2,
        )

        key = f"{grid_lat}_{grid_lon}"

        
        if key not in regional_data:

            regional_data[key] = {
                "latitude": grid_lat,
                "longitude": grid_lon,
                "event_count": 0,
                "max_risk": 0,
                "risk_sum": 0,
                "critical_events": 0,
                "high_events": 0,
                "total_frp": 0,
                "max_persistence": 0,

                # Regional intelligence indicators
                "high_thermal_events": 0,
                "persistent_events": 0,
                "industrial_proximity_events": 0,
            }

        region = regional_data[key]

        region["event_count"] += 1

        current_risk = safe_float(
            risk["risk_score"]
        )

        region["max_risk"] = max(
            region["max_risk"],
            current_risk,
        )

        region["risk_sum"] += current_risk

        if risk["risk_level"] == "Critical":
            region["critical_events"] += 1

        if risk["risk_level"] == "High":
            region["high_events"] += 1

        region["total_frp"] += safe_float(
            event["frp"]
        )
        region["max_persistence"] = max(
            region["max_persistence"],
            persistence_days,
        )

        # ----------------------------------------------------
        # REGIONAL INTELLIGENCE INDICATORS
        # ----------------------------------------------------

        thermal_severity = safe_float(
            feature_data["thermal_severity"]
        )

        if thermal_severity >= 70:
            region["high_thermal_events"] += 1

        if persistence_days >= 2:
            region["persistent_events"] += 1

        if distance_to_industry <= 1:
            region["industrial_proximity_events"] += 1
    # ========================================================
    # REGIONAL RESULTS
    # ========================================================

    regional_results = []

    for region in regional_data.values():

        event_count = region[
            "event_count"
        ]

        average_risk = (
            region["risk_sum"] /
            event_count
            if event_count
            else 0
        )

        max_risk = region[
            "max_risk"
        ]

        if max_risk >= 75:
            risk_level = "Critical"

        elif max_risk >= 50:
            risk_level = "High"

        elif max_risk >= 25:
            risk_level = "Medium"

        else:
            risk_level = "Low"

        regional_results.append({
    "latitude": region["latitude"],
    "longitude": region["longitude"],

    "event_count": event_count,

    "max_risk": round(max_risk, 2),
    "average_risk": round(average_risk, 2),

    "critical_events": region["critical_events"],
    "high_events": region["high_events"],

    "total_frp": round(region["total_frp"], 2),
    "max_persistence": region["max_persistence"],

    # Regional intelligence indicators
    "high_thermal_events": region["high_thermal_events"],
    "persistent_events": region["persistent_events"],
    "industrial_proximity_events": region[
        "industrial_proximity_events"
    ],

    "risk_level": risk_level,
})
    # ========================================================
    # STORE CACHE
    # ========================================================

    _events_cache = events
    
    _results_cache = results
    
    _regional_cache = regional_results

    print(
        f"[THERMOS] Analysis cache ready: "
        f"{len(results)} events, "
        f"{len(regional_results)} regions"
    )


# ============================================================
# ENSURE CACHE EXISTS
# ============================================================

def ensure_cache():

    global _results_cache

    if _results_cache is not None:
        return

    with _cache_lock:

        if _results_cache is None:

            print(
                "[THERMOS] Building analysis cache..."
            )

            build_analysis_cache()


# ============================================================
# STARTUP CACHE WARMING
#
# This means the expensive calculation happens when FastAPI
# starts, NOT when the browser opens the dashboard.
# ============================================================

@router.on_event("startup")
def warm_thermos_cache():

    print(
        "[THERMOS] Warming AI intelligence cache..."
    )

    ensure_cache()

    print(
        "[THERMOS] Startup cache complete."
    )


# ============================================================
# SINGLE EVENT PREDICTION
# ============================================================

@router.post("/predict")
def predict_event(
    request: PredictionRequest
):

    ensure_cache()

    index = request.index

    if (
        index < 0
        or index >= len(_results_cache)
    ):

        return {
            "error": "Event index out of range",
            "available_events": len(
                _results_cache
            ),
        }
    event_result = _results_cache[index]
    event = _events_cache.iloc[index]

    feature_data = {
    "thermal_severity": event_result["thermal_severity"],
    "persistence_days": event_result["persistence_days"],
    "distance_to_industry_km": event_result[
        "distance_to_industry_km"
    ],
    "distance_to_road_km": event_result[
        "distance_to_road_km"
    ],
    "distance_to_settlement_km": event_result[
        "distance_to_settlement_km"
    ],
    "24h_event_count": event_result[
        "event_24h_count"
    ],
    "7d_event_count": event_result[
        "event_7d_count"
    ],
    "frp_trend": event_result["frp_trend"],
    "brightness_trend": event_result[
        "brightness_trend"
    ],
    "activity_trend": event_result[
        "activity_trend"
    ],
}

    prediction = event_result["prediction"]
    risk = event_result["risk"]

    incident = generate_incident_explanation(

        classification=prediction[
            "predicted_label"
        ],

        ai_confidence=prediction[
            "confidence"
        ],

        risk_score=risk[
            "risk_score"
        ],

        risk_level=risk[
            "risk_level"
        ],

        thermal_severity=feature_data[
            "thermal_severity"
        ],

        persistence_days=feature_data[
            "persistence_days"
        ],

        distance_to_industry_km=feature_data[
            "distance_to_industry_km"
        ],

        event_count_7d=feature_data[
            "7d_event_count"
        ],
    )

    return build_analysis_response(
    index,
    event,
    prediction,
    risk,
    feature_data,
    incident,
)


# ============================================================
# ALL EVENTS
# ============================================================

@router.get("/events")
def get_events():

    ensure_cache()

    return {
        "count": len(_results_cache),
        "events": _results_cache,
    }


# ============================================================
# REGIONAL INTELLIGENCE
# ============================================================

@router.get("/regional-intelligence")
def regional_intelligence():

    ensure_cache()

    return {
        "count": len(_regional_cache),
        "regions": _regional_cache,
    }