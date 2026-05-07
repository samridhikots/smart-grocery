export const CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Dairy",
  "Grains",
  "Protein",
  "Beverages",
];

export const ITEMS_BY_CATEGORY: Record<string, string[]> = {
  Vegetables: ["Tomato", "Potato", "Onion", "Carrot", "Spinach", "Cauliflower", "Lady Finger", "Brinjal"],
  Fruits: ["Banana", "Apple", "Mango", "Orange", "Grapes"],
  Dairy: ["Milk", "Curd", "Paneer", "Butter", "Ghee"],
  Grains: ["Atta", "Rice", "Toor Dal", "Chana Dal", "Sugar"],
  Protein: ["Eggs", "Chicken", "Fish", "Moong Dal"],
  Beverages: ["Tea", "Coffee", "Mustard Oil"],
};

export const CATEGORY_COLORS: Record<string, string> = {
  Vegetables: "#22c55e",
  Fruits: "#f97316",
  Dairy: "#3b82f6",
  Grains: "#eab308",
  Protein: "#ef4444",
  Beverages: "#8b5cf6",
};

export const RISK_COLORS = {
  High: "badge-high",
  Medium: "badge-medium",
  Low: "badge-low",
};
