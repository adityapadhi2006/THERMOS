import pandas as pd

from app.data.firms_standardizer import standardize_firms


def add_temporal_features():
    firms = standardize_firms().copy()

    firms["timestamp"] = pd.to_datetime(
        firms["acq_date"].astype(str).str[:10]
        + " "
        + firms["acq_time"].astype(int).astype(str).str.zfill(4),
        format="%Y-%m-%d %H%M"
    )

    firms["night_detection"] = (
        firms["daynight"].astype(str).str.upper() == "N"
    ).astype(int)

    firms["lat_grid"] = firms["latitude"].round(2)
    firms["lon_grid"] = firms["longitude"].round(2)

    firms["24h_event_count"] = 0
    firms["7d_event_count"] = 0
    firms["persistence_days"] = 0

    for idx, row in firms.iterrows():

        same_cell = (
            (firms["lat_grid"] == row["lat_grid"]) &
            (firms["lon_grid"] == row["lon_grid"])
        )

        time_diff = firms["timestamp"] - row["timestamp"]

        firms.loc[idx, "24h_event_count"] = (
            same_cell & (time_diff.abs() <= pd.Timedelta(hours=24))
        ).sum()

        firms.loc[idx, "7d_event_count"] = (
            same_cell & (time_diff.abs() <= pd.Timedelta(days=7))
        ).sum()

        active_dates = firms.loc[
            same_cell & (time_diff.abs() <= pd.Timedelta(days=7)),
            "timestamp"
        ].dt.date.nunique()

        firms.loc[idx, "persistence_days"] = active_dates

    return firms