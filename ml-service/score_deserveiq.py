"""
Score file and produce explanation reasons.
Usage: python score_deserveiq.py input.csv output.csv
"""

import os, sys, json, joblib, numpy as np, pandas as pd
from pathlib import Path

# Use the latest run artifacts folder automatically
ARTIFACT_ROOT = "deserveiq_artifacts"
if not os.path.exists(ARTIFACT_ROOT):
    raise RuntimeError("No artifacts found. Run training first.")

latest_run = sorted(os.listdir(ARTIFACT_ROOT))[-1]
RUN_DIR = os.path.join(ARTIFACT_ROOT, latest_run)
MODEL_PATH = os.path.join(RUN_DIR, "dropout_model.joblib")
META_PATH = os.path.join(RUN_DIR, "meta.json")

model = joblib.load(MODEL_PATH)
meta = json.load(open(META_PATH))

# Columns used by the model (must match training)
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

def add_features(df):
    for c in ["marks_10","marks_11","marks_12","motivational_score","attendance_rate","communication_freq","interest_lvl","cutoff","family_support"]:
        df[c] = pd.to_numeric(df.get(c, np.nan), errors="coerce").fillna(0)
    df["delta_marks_12_11"] = df["marks_12"] - df["marks_11"]
    df["marks_mean_10_11_12"] = df[["marks_10","marks_11","marks_12"]].mean(axis=1)
    df["family_members"] = pd.to_numeric(df.get("family_members",1), errors="coerce").fillna(1)
    if "family_income_tier" in df.columns:
        df["family_income_numeric"] = df["family_income_tier"].map({"low":1000,"medium":5000,"high":15000}).fillna(0)
    else:
        df["family_income_numeric"] = pd.to_numeric(df.get("family_income_numeric",0), errors="coerce")
    df["income_per_member"] = df["family_income_numeric"] / df["family_members"].clip(lower=1)
    df["motivation_to_attendance_ratio"] = df["motivational_score"].replace(0,np.nan) / df["attendance_rate"].replace(0,np.nan)
    df.fillna(0, inplace=True)
    return df

# same rule-based function used in training for transparent reasons
def rule_based_contributions(row):
    contributions = []
    p = 0.10
    c = float(row.get("cutoff", 150))
    if c > 193:
        contributions.append(("cutoff>193", 0.50)); p += 0.50
    elif 150 < c <= 193:
        contributions.append(("150<cutoff<=193", 0.25)); p += 0.25
    if str(row.get("preferred_location","any")).strip().lower() != "any":
        contributions.append(("preferred_location_specific", 0.25)); p += 0.25
    if str(row.get("preferred_course","any")).strip().lower() != "any":
        contributions.append(("preferred_course_specific", 0.25)); p += 0.25
    if str(row.get("family_income_tier","medium")).lower() == "high":
        contributions.append(("family_income_high", 0.12)); p += 0.12
    elif str(row.get("family_income_tier","medium")).lower() == "medium":
        contributions.append(("family_income_medium", 0.05)); p += 0.05
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
    fs = float(row.get("family_support",5))
    if fs <= 3:
        contributions.append(("low_family_support_reduce", -0.20)); p -= 0.20
    elif fs >= 8:
        contributions.append(("high_family_support", 0.12)); p += 0.12
    if str(row.get("orphan","no")).lower()=="yes" or str(row.get("single_parent","no")).lower()=="yes" or str(row.get("first_graduate","no")).lower()=="yes":
        contributions = [("protective_household_flag",-0.99)]
        return contributions, 0.01
    if str(row.get("girlchild","no")).lower()=="yes":
        contributions.append(("girlchild_protective",-0.05)); p -= 0.05
    p = max(0.01, min(0.95, p))
    return contributions, p

def score_csv(input_csv, output_csv):
    df = pd.read_csv(input_csv)
    df = add_features(df)
    # prepare features for the trained pipeline
    X = df[USE_NUM + CAT_COLS].copy()

    probs = model.predict_proba(X)[:,1]
    df["dropout_probability"] = np.round(probs, 3)
    df["deservingness_score"] = np.round((1 - probs) * 100, 2)
    df["risk_tier"] = np.where(df["dropout_probability"] >= 0.7, "HIGH", np.where(df["dropout_probability"] >= 0.4, "MEDIUM", "LOW"))

    # produce rule-based breakdown for each row
    reasons = []
    for _, row in df.iterrows():
        contribs, p_rule = rule_based_contributions(row)
        # compress to readable reason string and show top positive contributors
        pos = [(k,v) for (k,v) in contribs if v>0]
        neg = [(k,v) for (k,v) in contribs if v<0]
        top_reasons = sorted(pos, key=lambda x:-x[1])[:3]
        protective = [k for (k,v) in contribs if v<0]
        # readable text
        text_reasons = [f"{k}: {v:+.2f}" for (k,v) in contribs]

        # include rule-prob and model-prob to show both perspectives
        reasons.append({
            "rule_prob": round(p_rule,3),
            "rule_reasons": text_reasons,
            "model_top_reason_features": [f for f,_ in meta.get("global_feature_importances",[])[:5]]
        })
    df["explanation"] = [json.dumps(r) for r in reasons]

    df.to_csv(output_csv, index=False)
    print("Saved scored file to:", output_csv)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python score_deserveiq.py input.csv output.csv")
        sys.exit(1)
    input_csv, output_csv = sys.argv[1], sys.argv[2]
    score_csv(input_csv, output_csv)
