"""Legacy waste prediction: Logistic Regression."""
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix,
)


class WasteLogisticModel:
    def __init__(self):
        self.model = LogisticRegression(max_iter=1000, C=1.0, random_state=42, class_weight="balanced")
        self.is_trained = False

    def train(self, X: np.ndarray, y: np.ndarray) -> dict:
        self.model.fit(X, y)
        self.is_trained = True
        preds = self.model.predict(X)
        proba = self.model.predict_proba(X)[:, 1]
        return self._metrics(y, preds, proba, split="train")

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict(X)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(X)[:, 1]

    def evaluate(self, X: np.ndarray, y: np.ndarray) -> dict:
        preds = self.predict(X)
        proba = self.predict_proba(X)
        return self._metrics(y, preds, proba, split="test")

    @staticmethod
    def _metrics(y_true, y_pred, y_proba, split: str) -> dict:
        auc = roc_auc_score(y_true, y_proba) if len(np.unique(y_true)) > 1 else 0.5
        cm = confusion_matrix(y_true, y_pred)
        tn, fp, fn, tp = (
            int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])
        ) if cm.shape == (2, 2) else (0, 0, 0, 0)
        return {
            "split": split,
            "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
            "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
            "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
            "roc_auc": round(float(auc), 4),
            "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        }
