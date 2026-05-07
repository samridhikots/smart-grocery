"""Modern demand prediction: XGBoost Regressor."""
import numpy as np
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


class DemandXGBoostModel:
    def __init__(self):
        self.model = XGBRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbosity=0,
        )
        self.is_trained = False

    def train(self, X: np.ndarray, y: np.ndarray) -> dict:
        self.model.fit(X, y, eval_set=[(X, y)], verbose=False)
        self.is_trained = True
        preds = self.model.predict(X)
        return self._metrics(y, preds, split="train")

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.clip(self.model.predict(X), 0.1, 50)

    def evaluate(self, X: np.ndarray, y: np.ndarray) -> dict:
        preds = self.predict(X)
        return self._metrics(y, preds, split="test")

    def feature_importance(self, feature_names: list) -> dict:
        scores = self.model.feature_importances_
        return dict(zip(feature_names, [round(float(s), 4) for s in scores]))

    @staticmethod
    def _metrics(y_true, y_pred, split: str) -> dict:
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        r2 = r2_score(y_true, y_pred)
        directional = np.mean(np.sign(np.diff(y_true)) == np.sign(np.diff(y_pred))) if len(y_true) > 1 else 0.0
        return {
            "split": split,
            "mae": round(float(mae), 4),
            "rmse": round(float(rmse), 4),
            "r2": round(float(r2), 4),
            "directional_accuracy": round(float(directional), 4),
        }
