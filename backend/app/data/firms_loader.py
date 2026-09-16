import os
import pandas as pd


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(
            os.path.dirname(__file__)
        )
    )
)

FIRMS_PATH = os.path.join(
    BASE_DIR,
    "data",
    "fire_nrt_SV-C2_805782.csv"
)


def load_firms():
    """
    Load raw NASA FIRMS thermal-event data.
    """

    firms = pd.read_csv(FIRMS_PATH)

    return firms