# Presentation Speech — First Review
## Smart Grocery Management System
### ~12–14 Minutes | ~1,700 words

---

> **Delivery notes:** Speak at a natural pace — roughly 130 words per minute. Pause after each key statistic for impact. The questions in [brackets] are things reviewers typically ask — your answer is embedded in the script at that point. Speak to the panel, not the screen.

---

### OPENING (Slide 1 — Title) — ~45 seconds

Good [morning/afternoon], everyone. My name is [Your Name], and today I'm presenting my project — the Smart Grocery Management System for Indian Households — a machine learning application designed to solve three interconnected problems that cost Indian families hundreds of rupees every month and contribute to one of the largest food waste crises in the world.

Let me start with a number.

---

### THE PROBLEM (Slides 2–3) — ~2 minutes

Ninety-two thousand crore rupees. That is India's annual post-harvest food loss, according to the Ministry of Food Processing Industries' 2023 Annual Report. And a significant portion of that begins right at home — not in warehouses or supply chains — but in our kitchens.

The United Nations Environment Programme's Food Waste Index 2021 tells us that India generates 68.7 million tonnes of food waste every year. Meanwhile, the NSSO 68th Round data shows that Indian families spend 45 to 52 percent of their monthly income on food.

We buy more than we need. We watch it spoil. And then we go back to the store.

Now, you might ask — aren't there apps for this? BigBasket, Blinkit, Zepto — these are excellent delivery platforms. But none of them tell you *what* to buy or *how much*. They just fulfil orders faster. OurGroceries and AnyList are manual shopping list apps — completely dependent on the user to fill in every item, every time. Expense tracking apps like Mint or Walnut tell you what you already spent — they are post-hoc, not predictive.

The gap I found in the literature — specifically documented by Bouakkaz, Adjoudj, and Bouakkaz in their 2022 Scopus survey of food demand forecasting systems — is that no consumer-facing application combines demand prediction, waste risk classification, budget anomaly detection, and sustainability scoring in a single personalised tool, calibrated to Indian seasons, festivals, and market conditions.

That is the gap this project fills.

---

### THE SOLUTION (Slide 4) — ~1 minute

SmartGrocery is a full-stack web application built on FastAPI and Next.js 14, powered by seven machine learning models. It gives users five types of intelligence:

A personalised shopping list — what to buy, when, and how much — based on their purchase history and India's seasonal context. A waste risk alert — which items in your home are likely to spoil before you use them. A budget anomaly detector — is this month's spend abnormal compared to your own baseline? An eco score — what is your household's carbon footprint from food choices, and what easy swaps can you make? And basket recommendations — what items do people with your buying pattern typically pair together?

---

### LITERATURE REVIEW — DEMAND (Slides 5–6) — ~2.5 minutes

Let me walk through the literature that shaped each of these modules, starting with demand prediction.

Retail forecasting research, reviewed comprehensively by Fildes, Ma, and Kolassa in the 2022 issue of the International Journal of Forecasting — an ABDC A-star journal — establishes that machine learning models outperform classical statistical methods by 18 to 34 percent when they incorporate household-level signals: purchase frequency, household size, and consumption rate. This directly motivated our 10-feature demand model.

A complementary insight from Kaipia and colleagues in the Journal of Operations Management — also ABDC A-star — shows that sharing household-level purchase data reduces forecast error by 31 percent. SmartGrocery operationalises this at the individual level: every purchase you log makes your next prediction more accurate.

**[Anticipated question: Why XGBoost and not LSTM or Transformer?]**

For the demand model, I chose XGBoost as the primary model and Ridge Regression as a principled baseline. Let me justify both choices.

Ridge Regression — regularised linear regression — is the right baseline because grocery purchasing has strong auto-regressive structure. If someone bought 2 kilograms of tomatoes for the last three trips, they will likely buy about 2 kilograms next time. Hyndman and Athanasopoulos, in their widely-cited forecasting textbook, establish this as the canonical baseline for demand problems. Our Ridge model achieves an R-squared of 0.864 — 86 percent of demand variance explained by a linear combination of 10 features. That's a strong baseline.

XGBoost, introduced by Chen and Guestrin at KDD 2016, is the primary model because it captures non-linear interactions that Ridge cannot. For example: during Diwali month in October, sugar demand doesn't just add a festival premium on top of the seasonal factor — it compounds. The interaction of festival flag and seasonal multiplier produces a 2.1 times baseline demand, not the 1.4 times that a linear model would predict. XGBoost's gradient-boosted tree structure learns these compound effects naturally.

I explicitly ruled out LSTM and Transformer architectures for two reasons. First, they require substantially more training data — typically tens of thousands of household-item sequences — than our 6,000-row training set provides. Second, as documented by Grinsztajn, Oyallon, and Varoquaux at NeurIPS 2022, tree-based models still outperform deep learning on structured tabular data in the majority of benchmarks. This is not about capability — it's about matching the right architecture to the data structure.

---

### LITERATURE REVIEW — WASTE & OTHER MODELS (Slides 7–9) — ~2.5 minutes

For waste prediction, the theoretical foundation comes from Parfitt, Barthel, and Macnaughton's 2010 paper in Philosophical Transactions of the Royal Society B — a Scopus Q1 journal. Their core finding is that 30 to 50 percent of household food waste is attributable to *predictable* behavioural patterns. Not accidents. Predictable patterns. That's the justification for building a classifier.

What makes our waste model uniquely India-appropriate is the inclusion of climate-aware features. FSSAI's 2021 storage guidelines establish that monsoon humidity — June through September — reduces perishable shelf life by 40 to 60 percent. Our feature set includes a `seasonal_waste_factor` that elevates waste probability during monsoon and summer months for perishable items.

**[Anticipated question: Why TabNet and not a standard neural network?]**

For the waste classifier, I chose TabNet — introduced by Arik and Pfister at AAAI 2021 — as the modern model, with Logistic Regression as the baseline.

Logistic Regression is appropriate as a baseline because waste prediction is binary classification, and we need calibrated probabilities — not just binary labels — to generate a meaningful risk score on a scale from 0 to 100 percent. It gives us AUC-ROC of 0.78.

TabNet improves this to 0.82 — a 5.1 percentage point gain. The reason TabNet outperforms standard neural networks is that its sequential attention mechanism selects a sparse subset of the most relevant features at each decision step. This gives us instance-level interpretability: for a given item, we can see that it was flagged high-risk because it is perishable, bought in high quantity, during a monsoon month, by a small household. That kind of explainability is essential when presenting predictions to non-technical household users.

For overspending detection, I used Isolation Forest — introduced by Liu, Ting, and Zhou at IEEE ICDM 2008 — because it adapts to each household's individual baseline rather than requiring a manual threshold. And for basket recommendations, I used FP-Growth over Apriori — the original association rule paper by Agrawal and Srikant, 1994 — because FP-Growth compresses the database into a prefix tree and requires only two scans instead of one scan per itemset size.

---

### RESEARCH DESIGN (Slides 10–12) — ~2 minutes

On the research design: the system uses a Kaggle-first, India-specific synthetic fallback architecture.

The primary data sources are seven Kaggle datasets: the BigBasket product catalog of 27,000 products, Blinkit transaction records, a 120,000-row food waste tracker, an Indian grocery store transaction dataset, the Mandi Price Index — which is uniquely valuable because mandi price volatility is a key demand signal in Indian markets — a household consumption survey, and a seasonal calendar with item-level factors per month.

When these are unavailable, a synthetic fallback generates 250 households across a size distribution calibrated to NSSO 68th Round data: 25 percent of size 3 and 25 percent of size 4, which matches the modal Indian household. All synthetic prices are in rupees and all seasonal factors are calibrated to Indian agricultural cycles.

The train-test split is 80-20 across all models, with stratified sampling for the waste classifier to preserve the 55-45 class balance. Leakage is prevented by applying a shift of one to all rolling features — the current purchase is never included in its own prediction window.

The project has completed nine of eleven milestones: everything from literature review through feature engineering, model training, API development, full frontend implementation, and a complete UI/UX redesign. The remaining two milestones — Docker deployment and live API integration — are planned for the next review cycle.

---

### SOCIAL IMPACT (Slide 14) — ~1 minute

Finally, on impact. This system targets 300 million Indian households who actively manage grocery budgets. If adopted at one million households, extrapolating from UNEP 2021 data, it could prevent approximately 12,000 tonnes of avoidable food waste annually. The financial saving per household is estimated at 400 to 800 rupees per month — based on NSSO discretionary food spend figures — through better demand planning and overspending alerts.

The sustainability module, grounded in Springmann and colleagues' landmark 2018 Nature paper, computes item-level CO₂ estimates and surfaces practical swap suggestions — for example, replacing chicken at 6,900 grams of CO₂ per kilogram with paneer at 2,800 grams saves 59 percent of emissions for an equivalent quantity. These are nudges in the Thaler-Sunstein sense: the right information, at the right time, without mandating any change.

The design is deliberately accessible: plain language instead of model jargon, a progressive disclosure UX where new users see a simple onboarding flow before any charts or predictions appear, and a one-tap "log as bought" modal that pre-fills from ML predictions so the data logging friction is minimal.

---

### CLOSING (Slide 15) — ~30 seconds

To summarise: SmartGrocery addresses three real, India-specific, financially significant problems — demand uncertainty, food waste, and budget inefficiency — using a full-stack ML application backed by literature from ABDC A-star and Scopus journals and calibrated to real Indian market data. The core technical contribution is the integration of seven distinct models into a single coherent prediction pipeline, surfaced through an accessible interface designed for households, not data scientists.

I am happy to take any questions.

---

## ANTICIPATED QUESTIONS & ANSWERS

**Q: Why not use a pre-trained model like GPT or a large language model?**
LLMs are powerful for natural language tasks, but this is a structured tabular prediction problem. There is no text to generate — we are predicting a continuous quantity or a binary waste label from a 10 or 20-column feature matrix. Tree-based models and TabNet are architecturally appropriate; LLMs are not. Using an LLM here would be like using a hammer to do surgery.

**Q: How does this compare to collaborative filtering recommendations?**
Collaborative filtering (Schafer et al., 2007) recommends items based on similarity to other users. Our system is fundamentally different: it forecasts quantity for items the user already buys, using their own purchase history and contextual signals. We do use FP-Growth for basket association, which is conceptually related — but our primary value proposition is demand forecasting, not item discovery.

**Q: What happens if a user has only logged 2–3 purchases?**
The system uses `min_periods=1` in rolling windows, so it gracefully degrades to whatever history is available. It also has a progressive disclosure UX: the shopping list only becomes "personalised" after 10 logged items, and this is communicated explicitly to the user through a milestone progress bar. Users know what they're getting.

**Q: Why SQLite and not PostgreSQL?**
For the current demo scale — single-user, local deployment — SQLite is appropriate and zero-configuration. The architecture cleanly separates the database URL into an environment variable, so migrating to PostgreSQL for production is a one-line config change with no application code modification.

**Q: How do you handle class imbalance in waste prediction?**
The 55/45 class distribution is not severe, but both waste models use `class_weight="balanced"` which internally adjusts sample weights to equalise class importance. This ensures the model doesn't simply predict "consumed" for everything to achieve 55% accuracy.

**Q: Is the data privacy-compliant?**
Currently the app stores email, purchase history, and household size — all voluntarily provided. No financial account data, no biometrics. For production deployment, the data handling would align with India's Digital Personal Data Protection Act 2023 and would require explicit consent and a privacy policy.
