import pandas as pd


FIRMS_PATH = r"C:\Projects\THERMOS\data\fire_nrt_SV-C2_805782.csv"


def load_firms():
    """
    Load raw NASA FIRMS thermal-event data.
    """

    firms = pd.read_csv(FIRMS_PATH)

    return firms