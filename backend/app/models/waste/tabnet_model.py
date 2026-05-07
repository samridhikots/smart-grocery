"""Modern waste prediction: TabNet (attention-based deep learning for tabular data)."""
import numpy as np
import torch
from pytorch_tabnet.tab_model import TabNetClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix,
)


class WasteTabNetModel:
    def __init__(self):
        self.model = TabNetClassifier(
            n_d=16,
            n_a=16,
            n_steps=5,
            gamma=1.5,
            optimizer_fn=torch.optim.Adam,
            optimizer_params={"lr": 0.02},
            mask_type="entmax",
            verbose=0,
        )
        self.is_trained = False

    def train(self, X: np.ndarray, y: np.ndarray) -> dict:
        X_tr, X_val, y_tr, y_val = train_test_split(
            X.astype(np.float32), y.astype(np.int64),
            test_size=0.15, random_state=42, stratify=y,
        )
        self.model.fit(
            X_tr, y_tr,
            eval_set=[(X_val, y_val)],
            eval_name=["val"],
            eval_metric=["auc"],
            max_epochs=50,
            patience=10,
            batch_size=256,
            virtual_batch_size=128,
            drop_last=False,
        )
        self.is_trained = True
        preds = self.model.predict(X.astype(np.float32))
        proba = self.model.predict_proba(X.astype(np.float32))[:, 1]
        return self._metrics(y, preds, proba, split="train")

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict(X.astype(np.float32))

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(X.astype(np.float32))[:, 1]

    def evaluate(self, X: np.ndarray, y: np.ndarray) -> dict:
        return self._metrics(y, self.predict(X), self.predict_proba(X), split="test")

    def feature_importance(self, feature_names: list) -> dict:
        if hasattr(self.model, "feature_importances_"):
            return dict(
                zip(feature_names, [round(float(s), 4) for s in self.model.feature_importances_])
            )
        return {}

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
