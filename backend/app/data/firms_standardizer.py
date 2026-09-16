from app.data.thermos_filter import load_thermos_events


def standardize_firms():
    firms = load_thermos_events()

    firms = firms.rename(
        columns={
            "brightness": "bright_ti4",
            "bright_t31": "bright_ti5"
        }
    )

    return firms