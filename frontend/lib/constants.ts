export const CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Dairy",
  "Grains",
  "Protein",
  "Beverages",
];

// Backend accepts any item whose category is one of the 6 above.
// ML predictions are most accurate for the original 30 core items;
// all others are tracked for budget/history and get generic predictions.
export const ITEMS_BY_CATEGORY: Record<string, string[]> = {
  Vegetables: [
    // Everyday staples
    "Tomato", "Potato", "Onion", "Garlic", "Ginger",
    // Leafy greens
    "Spinach", "Methi Leaves", "Coriander Leaves", "Mint Leaves",
    "Curry Leaves", "Amaranth Leaves", "Drumstick Leaves",
    // Gourds & climbers
    "Bottle Gourd", "Ridge Gourd", "Bitter Gourd", "Snake Gourd",
    "Ash Gourd", "Ivy Gourd", "Tinda", "Cucumber", "Zucchini", "Pumpkin",
    // Brassicas & cauliflower family
    "Cauliflower", "Cabbage", "Broccoli", "Kohlrabi",
    // Other common veggies
    "Brinjal", "Capsicum", "Green Chili", "Lady Finger", "Carrot",
    "Beetroot", "Radish", "Turnip", "Corn", "Mushroom",
    "French Beans", "Cluster Beans", "Broad Beans", "Drumstick",
    // Root & starchy
    "Sweet Potato", "Yam", "Taro", "Raw Banana", "Plantain",
    // Seasonal & aromatic
    "Spring Onion", "Leek", "Celery", "Asparagus", "Baby Corn",
    "Cherry Tomato", "Raw Papaya", "Raw Mango", "Jackfruit (Raw)",
    "Green Peas",
  ],

  Fruits: [
    // Year-round
    "Banana", "Apple", "Orange", "Grapes", "Guava", "Papaya",
    "Coconut", "Pear", "Dates", "Lemon", "Lime",
    // Seasonal
    "Mango", "Watermelon", "Pineapple", "Lychee", "Chiku (Sapota)",
    "Pomegranate", "Custard Apple", "Jackfruit", "Fig", "Jamun",
    "Mulberry", "Star Fruit", "Amla (Indian Gooseberry)",
    // Imported / premium
    "Strawberry", "Kiwi", "Plum", "Peach", "Apricot",
    "Cherry", "Avocado", "Dragon Fruit", "Blueberry", "Raspberry",
    "Cranberry", "Passion Fruit", "Persimmon",
    // Dry fruits (used as fruits)
    "Dry Coconut",
  ],

  Dairy: [
    // Core dairy
    "Milk", "Curd", "Paneer", "Butter", "Ghee",
    // Processed dairy
    "Cheese", "Slice Cheese", "Cream Cheese", "Cooking Cream",
    "Whipped Cream", "Sour Cream",
    // Dairy beverages
    "Buttermilk", "Lassi", "Flavoured Milk", "Chocolate Milk",
    // Dairy powders & concentrates
    "Milk Powder", "Condensed Milk", "Khoya", "Skimmed Milk Powder",
    // Alternatives
    "Soy Milk", "Almond Milk", "Oat Milk", "Coconut Cream",
    // Eggs (often bought alongside dairy)
    "Eggs",
  ],

  Grains: [
    // Wheat & flour
    "Atta", "Maida", "Sooji (Rava)", "Besan", "Rice Flour",
    "Cornflour", "Ragi Flour", "Bajra Flour", "Jowar Flour",
    "Whole Wheat Flour", "Multi-grain Flour",
    // Rice varieties
    "Rice", "Basmati Rice", "Brown Rice", "Red Rice",
    "Sona Masoori Rice", "Idli Rice", "Poha",
    // Pulses & lentils
    "Toor Dal", "Chana Dal", "Moong Dal", "Urad Dal",
    "Masoor Dal", "Rajma", "Chickpeas", "Kabuli Chana",
    "Black Eyed Peas", "Dry Green Peas", "Moth Beans",
    "Horse Gram", "Black Gram",
    // Sweeteners & dry staples
    "Sugar", "Jaggery", "Brown Sugar", "Powdered Sugar",
    "Rock Salt", "Salt", "Sabudana", "Daliya",
    // Breakfast cereals
    "Oats", "Cornflakes", "Muesli", "Quinoa", "Barley",
    // Bakery & ready goods
    "Bread", "Brown Bread", "Pav", "Rusk", "Bun",
    "Biscuits", "Crackers", "Khakhra", "Mathri", "Papad",
    // Pasta & noodles
    "Pasta", "Noodles", "Vermicelli", "Spaghetti", "Macaroni",
    // Ready mixes
    "Idli Batter", "Dosa Batter", "Upma Mix", "Halwa Mix",
    "Dosa Mix", "Khaman Mix", "Cake Mix",
    // Dry condiments & spices (pantry staples)
    "Turmeric Powder", "Red Chili Powder", "Coriander Powder",
    "Cumin Powder", "Garam Masala", "Chicken Masala", "Sambar Powder",
    "Rasam Powder", "Chaat Masala", "Biryani Masala", "Pav Bhaji Masala",
    "Kitchen King Masala", "Curry Powder",
    "Cumin Seeds", "Mustard Seeds", "Fenugreek Seeds",
    "Cardamom", "Cloves", "Cinnamon", "Bay Leaves", "Black Pepper",
    "Carom Seeds", "Star Anise", "Asafoetida", "Saffron",
    "Dried Mango Powder", "Tamarind", "Kokum", "Dry Mango Slice",
    "Makhana", "Roasted Chana",
  ],

  Protein: [
    // Poultry
    "Chicken", "Chicken Breast", "Chicken Legs", "Chicken Wings",
    "Chicken Mince", "Turkey",
    // Seafood
    "Fish", "Pomfret", "Rohu", "Katla", "Hilsa", "Surmai",
    "Bangda (Mackerel)", "Salmon", "Tuna", "Prawn", "Shrimp",
    "Crab", "Squid", "Lobster",
    // Red meat
    "Mutton", "Mutton Mince", "Pork", "Beef",
    // Plant protein
    "Tofu", "Soya Chunks", "Tempeh",
    // Pulses (protein-first framing)
    "Moong Dal", "Urad Dal (Black)", "Kabuli Chana (Cooked)",
    // Nuts & seeds
    "Peanuts", "Cashews", "Almonds", "Walnuts", "Pistachios",
    "Raisins", "Sunflower Seeds", "Pumpkin Seeds",
    "Flaxseeds", "Chia Seeds", "Mixed Dry Fruits",
  ],

  Beverages: [
    // Hot beverages
    "Tea", "Coffee", "Green Tea", "Herbal Tea",
    "Masala Tea Premix", "Hot Chocolate",
    // Cold beverages & juices
    "Fruit Juice", "Mango Juice", "Orange Juice",
    "Mixed Fruit Juice", "Coconut Water", "Cold Drink",
    "Soda Water", "Mineral Water", "Energy Drink", "Iced Tea",
    "Lemon Squash", "Lime Cordial", "Rose Syrup (Roohafza)",
    // Cooking oils
    "Mustard Oil", "Coconut Oil", "Refined Oil", "Sunflower Oil",
    "Groundnut Oil", "Sesame Oil", "Olive Oil", "Rice Bran Oil",
    "Flaxseed Oil", "Palm Oil",
    // Liquid condiments & sauces
    "Tomato Ketchup", "Soy Sauce", "Vinegar", "Worcestershire Sauce",
    "Hot Sauce", "Chili Sauce", "Sriracha", "Fish Sauce",
    "Mayonnaise", "Salad Dressing",
    // Spreads & sweeteners
    "Honey", "Jam", "Peanut Butter", "Almond Butter",
    "Chocolate Spread", "Fruit Preserve",
    // Coconut & canned
    "Coconut Milk", "Tomato Puree", "Tomato Paste",
    "Canned Tomatoes", "Canned Chickpeas",
    // Pickles & chutneys
    "Mango Pickle", "Mixed Pickle", "Lime Pickle",
    "Green Chutney", "Tamarind Chutney",
    // Miscellaneous pantry
    "Baking Soda", "Baking Powder", "Yeast", "Vanilla Essence",
    "Rose Water", "Kewra Water",
  ],
};

export const CATEGORY_COLORS: Record<string, string> = {
  Vegetables: "#16a34a",
  Fruits:     "#f97316",
  Dairy:      "#2563eb",
  Grains:     "#ca8a04",
  Protein:    "#dc2626",
  Beverages:  "#7c3aed",
};

export const RISK_COLORS = {
  High:   "badge-high",
  Medium: "badge-medium",
  Low:    "badge-low",
};
