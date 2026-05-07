"""Data preprocessing utilities."""
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from typing import Tuple


def scale_features(X_train: pd.DataFrame, X_test: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, StandardScaler]:
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    return X_train_scaled, X_test_scaled, scaler


def encode_labels(y: pd.Series) -> Tuple[np.ndarray, LabelEncoder]:
    le = LabelEncoder()
    return le.fit_transform(y), le


def handle_missing(df: pd.DataFrame) -> pd.DataFrame:
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].median())
    cat_cols = df.select_dtypes(include=["object"]).columns
    for col in cat_cols:
        df[col] = df[col].fillna(df[col].mode()[0])
    return df


def clip_outliers(df: pd.DataFrame, cols: list, lower: float = 0.01, upper: float = 0.99) -> pd.DataFrame:
    for col in cols:
        lo = df[col].quantile(lower)
        hi = df[col].quantile(upper)
        df[col] = df[col].clip(lo, hi)
    return df
