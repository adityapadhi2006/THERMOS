from app.data.firms_loader import load_firms


WEST = 84.80
EAST = 85.35
SOUTH = 20.70
NORTH = 21.10


def load_thermos_events():
    firms = load_firms()

    filtered = firms[
        (firms["longitude"] >= WEST) &
        (firms["longitude"] <= EAST) &
        (firms["latitude"] >= SOUTH) &
        (firms["latitude"] <= NORTH)
    ].copy()

    return filtered