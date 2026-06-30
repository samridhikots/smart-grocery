"""Dataset transparency endpoint — static metadata about all training datasets."""
from fastapi import APIRouter

router = APIRouter()

_DATASETS = [
    {
        "name":         "BigBasket Products",
        "rows":         38340,
        "columns":      10,
        "source":       "Kaggle / BigBasket",
        "purpose":      "Product search catalog & price reference",
        "last_updated": "2024-01",
        "coverage":     "11 categories across Indian grocery market",
        "missing_pct":  2.1,
    },
    {
        "name":         "Grocery Purchases (Synthetic)",
        "rows":         10000,
        "columns":      7,
        "source":       "India-specific synthetic generation",
        "purpose":      "Demand prediction model training (Ridge + XGBoost)",
        "last_updated": "2024-06",
        "coverage":     "30 core items, 6 categories, seasonal + festival patterns",
        "missing_pct":  0.0,
    },
    {
        "name":         "Food Waste Records (Synthetic)",
        "rows":         5000,
        "columns":      12,
        "source":       "Synthetic + perishable_goods.csv enrichment",
        "purpose":      "Waste prediction model training (Logistic + TabNet)",
        "last_updated": "2024-06",
        "coverage":     "Perishable and non-perishable items, Indian seasons",
        "missing_pct":  1.3,
    },
    {
        "name":         "Perishable Goods (Kaggle)",
        "rows":         10000,
        "columns":      43,
        "source":       "Kaggle — perishable_goods.csv",
        "purpose":      "Waste probability enrichment & shelf-life data",
        "last_updated": "2024-01",
        "coverage":     "Spoilage risk, shelf life, temperature deviation",
        "missing_pct":  4.7,
    },
    {
        "name":         "Grocery Inventory & Sales (Kaggle)",
        "rows":         5000,
        "columns":      13,
        "source":       "Kaggle — grocery_inventory_sales.csv",
        "purpose":      "Price & stock features for demand model",
        "last_updated": "2024-02",
        "coverage":     "Product IDs, categories, expiry dates, pricing",
        "missing_pct":  2.8,
    },
    {
        "name":         "Seasonal Calendar (Synthetic)",
        "rows":         12,
        "columns":      6,
        "source":       "India agricultural calendar + domain knowledge",
        "purpose":      "Monthly demand multipliers, festival & monsoon flags",
        "last_updated": "2024-06",
        "coverage":     "12 months, 5 festival months, 4 monsoon months",
        "missing_pct":  0.0,
    },
]


@router.get("/datasets/stats")
def get_dataset_stats():
    """Return metadata for all training and catalog datasets."""
    return _DATASETS
