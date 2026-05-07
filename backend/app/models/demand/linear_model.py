"""Legacy demand prediction: Linear Regression with Moving Average baseline."""
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


class DemandLinearModel:
    def __init__(self):
        self.model = Ridge(alpha=1.0)
        self.is_trained = False

    def train(self, X: np.ndarray, y: np.ndarray) -> dict:
        self.model.fit(X, y)
        self.is_trained = True
        preds = self.model.predict(X)
        return self._metrics(y, preds, split="train")

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.clip(self.model.predict(X), 0.1, 50)

    def evaluate(self, X: np.ndarray, y: np.ndarray) -> dict:
        preds = self.predict(X)
        return self._metrics(y, preds, split="test")

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
