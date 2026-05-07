"""Load the 6 CSV datasets (synthetic fallback or Kaggle-processed) into DataFrames."""
import os
import pandas as pd

from app.utils.helpers import DATA_DIR


def _path(filename: str) -> str:
    return os.path.join(DATA_DIR, filename)


def load_grocery_purchases() -> pd.DataFrame:
    df = pd.read_csv(_path("grocery_purchases.csv"), parse_dates=["purchase_date"])
    return df


def load_food_waste() -> pd.DataFrame:
    return pd.read_csv(_path("food_waste.csv"))


def load_retail_transactions() -> pd.DataFrame:
    return pd.read_csv(_path("retail_transactions.csv"))


def load_product_metadata() -> pd.DataFrame:
    return pd.read_csv(_path("product_metadata.csv"))


def load_household_consumption() -> pd.DataFrame:
    return pd.read_csv(_path("household_consumption.csv"))


def load_seasonal_data() -> pd.DataFrame:
    return pd.read_csv(_path("seasonal_data.csv"))


def load_all() -> dict:
    return {
        "purchases":    load_grocery_purchases(),
        "waste":        load_food_waste(),
        "transactions": load_retail_transactions(),
        "metadata":     load_product_metadata(),
        "household":    load_household_consumption(),
        "seasonal":     load_seasonal_data(),
    }
