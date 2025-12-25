"""
Train DeserveIQ model (updated for new dataset).
Usage: python train_deserveiq.py
"""

import os, json, joblib, warnings
from datetime import datetime
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score, confusion_matrix
from sklearn.inspection import permutation_importance

warnings.filterwarnings("ignore")
RANDOM_STATE = 42

# --- change this to your dataset path (local file you already have) ---
DATA_PATH = r"C:\Users\hari2\Downloads\Sample_First_200_rows_final_v3.csv"
OUT_DIR = "deserveiq_artifacts"
os.makedirs(OUT_DIR, exist_ok=True)
TS = datetime.now().strftime("%Y%m%d_%H%M%S")
RUN_DIR = os.path.join(OUT_DIR, f"run_{TS}")
os.makedirs(RUN_DIR, exist_ok=True)

TARGET = "dropout"

# NUM and CAT columns updated for the new dataset (priority columns first)
NUM_COLS = [
    "cutoff", "marks_10", "marks_11", "marks_12",
    "motivational_score", "attendance_rate", "communication_freq",
    "interest_lvl", "family_support"
]
CAT_COLS = [
    "preferred_location", "preferred_course", "family_income_tier",
    "orphan", "single_parent", "first_graduate", "girlchild", "attitude"
]

DERIVED = ["delta_marks_12_11", "marks_mean_10_11_12", "income_per_member", "motivation_to_attendance_ratio"]
USE_NUM = NUM_COLS + DERIVED

def load_data(path):
    df = pd.read_csv(path)
    print("Loaded", path, "rows:", len(df))
    return df

def add_features(df):
    # safe numeric conversion
    for c in ["marks_10","marks_11","marks_12","motivational_score","attendance_rate","communication_freq","interest_lvl","cutoff","family_support"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
        else:
            df[c] = np.nan

    df["delta_marks_12_11"] = df["marks_12"].fillna(0) - df["marks_11"].fillna(0)
    df["marks_mean_10_11_12"] = df[["marks_10","marks_11","marks_12"]].mean(axis=1)
    # if family_members exists in dataset use it, else assume 1
    df["family_members"] = pd.to_numeric(df.get("family_members", 1), errors="coerce").fillna(1)
    df["family_income_numeric"] = pd.to_numeric(df.get("family_income_numeric", np.nan), errors="coerce")
    # try to interpret family_income if string -> map common tiers
    if "family_income_tier" in df.columns and df["family_income_tier"].dtype == object:
        df["family_income_numeric"] = df["family_income_tier"].map({"low":1000,"medium":5000,"high":15000}).fillna(df["family_income_numeric"])
    df["income_per_member"] = df["family_income_numeric"].fillna(0) / df["family_members"].clip(lower=1)
    df["motivation_to_attendance_ratio"] = df["motivational_score"].replace(0, np.nan) / df["attendance_rate"].replace(0, np.nan)
    df.fillna(0, inplace=True)
    return df

# Rule-based function used for explanations (mirrors dataset generation rules)
def rule_based_contributions(row):
    # returns list of (reason, contribution_value)
    contributions = []
    p = 0.10
    # cutoff
    c = float(row.get("cutoff", 150))
    if c > 193:
        contributions.append(("cutoff>193", 0.50)); p += 0.50
    elif 150 < c <= 193:
        contributions.append(("150<cutoff<=193", 0.25)); p += 0.25
    # location
    if str(row.get("preferred_location","any")).strip().lower() != "any":
        contributions.append(("preferred_location_specific", 0.25)); p += 0.25
    # course
    if str(row.get("preferred_course","any")).strip().lower() != "any":
        contributions.append(("preferred_course_specific", 0.25)); p += 0.25
    # family income
    if str(row.get("family_income_tier","medium")).lower() == "high":
        contributions.append(("family_income_high", 0.12)); p += 0.12
    elif str(row.get("family_income_tier","medium")).lower() == "medium":
        contributions.append(("family_income_medium", 0.05)); p += 0.05
    # behavior
    if float(row.get("attendance_rate",100)) < 60:
        contributions.append(("low_attendance", 0.20)); p += 0.20
    if float(row.get("motivational_score",100)) < 40:
        contributions.append(("low_motivation", 0.15)); p += 0.15
    if float(row.get("interest_lvl",10)) < 4:
        contributions.append(("low_interest", 0.15)); p += 0.15
    if float(row.get("communication_freq",10)) < 3:
        contributions.append(("low_communication", 0.05)); p += 0.05
    if str(row.get("attitude","positive")).lower() == "negative":
        contributions.append(("negative_attitude", 0.18)); p += 0.18
    # family_support: low reduces dropout
    fs = float(row.get("family_support",5))
    if fs <= 3:
        contributions.append(("low_family_support_reduce", -0.20)); p -= 0.20
    elif fs >= 8:
        contributions.append(("high_family_support", 0.12)); p += 0.12
    # protective household flags -> strong protect
    if str(row.get("orphan","no")).lower()=="yes" or str(row.get("single_parent","no")).lower()=="yes" or str(row.get("first_graduate","no")).lower()=="yes":
        contributions = [("protective_household_flag", -0.99)]
        return contributions, 0.01
    # girlchild reduces slightly
    if str(row.get("girlchild","no")).lower()=="yes":
        contributions.append(("girlchild_protective", -0.05)); p -= 0.05
    p = max(0.01, min(0.95, p))
    return contributions, p

# ----------------- MAIN -----------------
print("STEP 1: Load and prepare data")
df = load_data(DATA_PATH)
df = add_features(df)

# drop old dropout-like duplicates if present & ensure target exists
if TARGET not in df.columns:
    raise ValueError(f"{TARGET} column not found in {DATA_PATH}")
df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce").fillna(0).astype(int)

# drop id-like columns to avoid leakage
drop_cols = [c for c in ["name","home_address","school_name_10","school_name_11","school_name_12"] if c in df.columns]
df.drop(columns=drop_cols, inplace=True, errors="ignore")

# prepare X,y
X = df[USE_NUM + CAT_COLS].copy()
y = df[TARGET].astype(int)

print("STEP 2: Train/Test split")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE)

# preprocessing
try:
    onehot = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
except TypeError:
    onehot = OneHotEncoder(handle_unknown="ignore", sparse=False)

num_pipe = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())])
cat_pipe = Pipeline([("imp", SimpleImputer(strategy="constant", fill_value="MISSING")), ("onehot", onehot)])
preprocessor = ColumnTransformer(transformers=[("num", num_pipe, USE_NUM), ("cat", cat_pipe, CAT_COLS)])

print("STEP 3: Grid search")
rf = RandomForestClassifier(class_weight="balanced_subsample", random_state=RANDOM_STATE, n_jobs=-1)
pipe = Pipeline([("prep", preprocessor), ("clf", rf)])
param_grid = {"clf__n_estimators":[150, 300], "clf__max_depth":[8, 12, None], "clf__min_samples_leaf":[1,2]}
cv = StratifiedKFold(4, shuffle=True, random_state=RANDOM_STATE)
gs = GridSearchCV(pipe, param_grid, cv=cv, scoring="roc_auc", n_jobs=-1, verbose=1)
gs.fit(X_train, y_train)
print("BEST PARAMS:", gs.best_params_, "BEST CV AUC:", gs.best_score_)
best_model = gs.best_estimator_

# optional calibration
try:
    calib = CalibratedClassifierCV(best_model, cv="prefit")
    calib.fit(X_train, y_train)
    model = calib
    print("Calibration applied")
except Exception:
    model = best_model
    print("Calibration skipped")

# Evaluate quickly
def evaluate(model, Xs, ys, name="TEST"):
    probs = model.predict_proba(Xs)[:,1]
    preds = (probs >= 0.5).astype(int)
    acc = accuracy_score(ys, preds)
    pre, rec, f1, _ = precision_recall_fscore_support(ys, preds, average="binary")
    auc = roc_auc_score(ys, probs)
    print(f"{name}: ACC={acc:.3f}, PRE={pre:.3f}, REC={rec:.3f}, F1={f1:.3f}, AUC={auc:.3f}")
    print("CONFUSION MATRIX:\n", confusion_matrix(ys, preds))
    return probs, preds

train_probs, train_preds = evaluate(model, X_train, y_train, "TRAIN")
test_probs, test_preds = evaluate(model, X_test, y_test, "TEST")

# Global permutation importances (post-preprocessing predictions)
print("STEP 4: Permutation importances (global)")
X_test_pre = X_test.copy()
# Note: permutation_importance needs raw model with preprocessor; use pipeline directly
perm = permutation_importance(model, X_test_pre, y_test, n_repeats=8, random_state=RANDOM_STATE, n_jobs=-1)
# map importances to feature names
# get transformed feature names from preprocessor (if possible)
try:
    # derive names: numeric then onehot feature names
    num_names = USE_NUM
    ohe = model.named_steps["prep"].named_transformers_["cat"].named_steps["onehot"]
    cat_cols = CAT_COLS
    ohe_names = []
    if hasattr(ohe, "get_feature_names_out"):
        ohe_names = list(ohe.get_feature_names_out(cat_cols))
    feature_names = list(num_names) + ohe_names
except Exception:
    feature_names = [f"f_{i}" for i in range(len(perm.importances_mean))]
feat_imp = sorted(zip(feature_names, perm.importances_mean), key=lambda x: -abs(x[1]))[:20]

# Save model and metadata
model_path = os.path.join(RUN_DIR, "dropout_model.joblib")
joblib.dump(model, model_path)

meta = {
    "timestamp": TS,
    "best_params": gs.best_params_,
    "global_feature_importances": feat_imp,
    "explanation_notes": "Rule-based contributions are returned per sample alongside model probability. Prioritises cutoff, preferred_location, preferred_course, family_income_tier."
}
json.dump(meta, open(os.path.join(RUN_DIR, "meta.json"), "w"), indent=2)
print("Saved model:", model_path)
print("Artifacts in:", RUN_DIR)
