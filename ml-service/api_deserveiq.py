# app.py — DeserveIQ Final ML API (robust, human-readable explanations)
# Uses latest artifacts in ./deserveiq_artifacts
# NOTE: training data (if needed) is expected at:
# /mnt/data/Sample_First_200_rows_final_v3.csv

import os, json, joblib, numpy as np, pandas as pd
from flask import Flask, request, jsonify

# ----------------------------
# LOAD MODEL + METADATA
# ----------------------------
ARTIFACT_ROOT = "deserveiq_artifacts"
if not os.path.exists(ARTIFACT_ROOT):
    raise RuntimeError("No artifacts found. Run training first.")

latest_run = sorted(os.listdir(ARTIFACT_ROOT))[-1]
RUN_DIR = os.path.join(ARTIFACT_ROOT, latest_run)

MODEL_PATH = os.path.join(RUN_DIR, "dropout_model.joblib")
META_PATH = os.path.join(RUN_DIR, "meta.json")

model = joblib.load(MODEL_PATH)
meta = json.load(open(META_PATH))

app = Flask(__name__)

# ----------------------------
# COLUMNS USED BY YOUR MODEL
# ----------------------------
NUM_COLS = [
    "cutoff", "marks_10", "marks_11", "marks_12",
    "motivational_score", "attendance_rate", "communication_freq",
    "interest_lvl", "family_support"
]

CAT_COLS = [
    "preferred_location", "preferred_course", "family_income_tier",
    "orphan", "single_parent", "first_graduate", "girlchild", "attitude"
]

DERIVED = ["delta_marks_12_11", "marks_mean_10_11_12",
           "income_per_member", "motivation_to_attendance_ratio"]

USE_NUM = NUM_COLS + DERIVED

# helper mappers (frontend uses varied labels)
def to_number(v, default=0):
    try:
        return float(v)
    except Exception:
        return default

def map_motivation_level(v):
    # frontend: 1-5 -> map to 0-100 scale (like earlier code)
    try:
        n = float(v)
        return max(0.0, min(100.0, n * 20.0))
    except Exception:
        return 0.0

def map_low_med_high_small(v):
    if v is None:
        return 0.0
    s = str(v).strip().lower()
    if "low" in s:
        return 1.0
    if "med" in s:
        return 3.0
    if "high" in s:
        return 5.0
    try:
        return float(s)
    except Exception:
        return 0.0

def map_support_to_10(v):
    if v is None:
        return 5.0
    s = str(v).strip().lower()
    if "low" in s:
        return 2.0
    if "med" in s:
        return 5.0
    if "high" in s:
        return 8.0
    try:
        n = float(s)
        return max(0.0, min(10.0, n))
    except Exception:
        return 5.0

# ----------------------------
# FEATURE ENGINEERING
# ----------------------------
def add_features(df):
    # support alternate keys by copying them to canonical names
    # motivation: 'motivational_score' or 'motivation_level'
    if 'motivation_level' in df.columns and 'motivational_score' not in df.columns:
        df['motivational_score'] = df['motivation_level']
    # communication: 'communication_freq' or 'communication_frequency'
    if 'communication_frequency' in df.columns and 'communication_freq' not in df.columns:
        df['communication_freq'] = df['communication_frequency']
    # interest: 'interest_lvl' or 'interest_level'
    if 'interest_level' in df.columns and 'interest_lvl' not in df.columns:
        df['interest_lvl'] = df['interest_level']
    # girl child variants
    if 'girl_child' in df.columns and 'girlchild' not in df.columns:
        df['girlchild'] = df['girl_child']
    if 'girlchild' not in df.columns:
        df['girlchild'] = df.get('girlchild', 'No')

    # cutoff numeric
    for c in ["marks_10","marks_11","marks_12",
              "motivational_score","attendance_rate",
              "communication_freq","interest_lvl",
              "cutoff","family_support"]:
        # many frontend fields may be strings; coerce safely
        df[c] = pd.to_numeric(df.get(c, np.nan), errors="coerce").fillna(0)

    # ensure family_members exists
    df["family_members"] = pd.to_numeric(df.get("family_members", 1), errors="coerce").fillna(1)

    # family_income_numeric: prefer explicit numeric, else try family_income_tier or family_income
    if "family_income_numeric" not in df.columns or df["family_income_numeric"].isna().all():
        # from family_income_tier mapping
        if "family_income_tier" in df.columns:
            df["family_income_numeric"] = df["family_income_tier"].map({"low":1000,"medium":5000,"high":15000}).fillna(np.nan)
        else:
            df["family_income_numeric"] = np.nan
    # if still NaN and family_income exists, use it
    if "family_income" in df.columns:
        cand = pd.to_numeric(df.get("family_income"), errors="coerce")
        df["family_income_numeric"] = df["family_income_numeric"].fillna(cand)

    df["family_income_numeric"] = df["family_income_numeric"].fillna(0)

    # derived features
    df["delta_marks_12_11"] = df["marks_12"].fillna(0) - df["marks_11"].fillna(0)
    df["marks_mean_10_11_12"] = df[["marks_10","marks_11","marks_12"]].mean(axis=1)
    df["income_per_member"] = df["family_income_numeric"] / df["family_members"].clip(lower=1)

    # convert motivation -> numeric scale used by model
    df["motivational_score"] = df.apply(
        lambda r: map_motivation_level(r.get("motivational_score", 0)), axis=1
    )
    # communication_freq/interest_lvl/family_support might be Low/Med/High strings; map
    df["communication_freq"] = df["communication_freq"].apply(lambda v: map_low_med_high_small(v))
    df["interest_lvl"] = df["interest_lvl"].apply(lambda v: map_support_to_10(v))
    df["family_support"] = df["family_support"].apply(lambda v: map_support_to_10(v))

    # motivation_to_attendance_ratio
    df["motivation_to_attendance_ratio"] = df["motivational_score"].replace(0, np.nan) / df["attendance_rate"].replace(0, np.nan)

    # ensure categorical columns exist — fill defaults
    for c in CAT_COLS:
        if c not in df.columns:
            df[c] = "any"
        df[c] = df[c].fillna("any")

    df.fillna(0, inplace=True)
    return df

# ----------------------------
# HUMAN-UNDERSTANDABLE RULES
# ----------------------------
def rule_based_contributions(row):
    reasons = []
    score = 0.0

    def get(k, default=None):
        return row.get(k, row.get(k.replace("_",""), default))

    # -------------------------------------
    # PROTECTIVE FLAGS (checked early)
    # -------------------------------------
    orphan = str(get("orphan", "no")).strip().lower()
    sp = str(get("single_parent", "no")).strip().lower()
    fg = str(get("first_graduate", "no")).strip().lower()

    protective_flag = (orphan == "yes" or sp == "yes")

    # -------------------------------------
    # CUTOFF RULE
    # -------------------------------------
    c = to_number(get("cutoff", get("cutoff_value", 0)), 0)

    if c < 150:
        score += 0.75
        reasons.append("Cutoff is less than 150 — very high dropout tendency.")
    elif 150 <= c < 193:
        score -= 0.20
        reasons.append("Cutoff between 150 and 193 — safe range (low dropout tendency).")
    else:  # cutoff >= 193
        if protective_flag:
            reasons.append("Cutoff is above 193, but protected due to orphan/single-parent status.")
        else:
            score += 0.70
            reasons.append("Cutoff above 193 — extremely high dropout tendency.")

    # -------------------------------------
    # FAMILY INCOME > 30000
    # -------------------------------------
    income = to_number(get("family_income_numeric", 0), 0)

    if income > 30000:
        score += 5.90
        reasons.append(f"Family income {income} > 30000 — may choose alternate options, increasing dropout risk.")
    else:
        reasons.append("Family income within normal/stable range.")

    # -------------------------------------
    # LOCATION + COURSE
    # -------------------------------------
    loc = str(get("preferred_location", "any")).strip().lower()
    if loc not in ["", "any"]:
        score += 0.30
        reasons.append(f"Preferred location '{loc}' may restrict options.")
    else:
        reasons.append("Preferred location flexible ('any').")

    course = str(get("preferred_course", "any")).strip().lower()
    if course not in ["", "any"]:
        score += 0.25
        reasons.append(f"Preferred course '{course}' may create mismatch risk.")
    else:
        reasons.append("Preferred course flexible ('any').")

    # -------------------------------------
    # FAMILY INCOME TIER
    # -------------------------------------
    # inc_tier = str(get("family_income_tier", "")).lower()
    # if inc_tier == "high":
    #     score += 0.90
    #     reasons.append("High income tier linked to voluntary dropout shifts.")
    # elif inc_tier == "medium":
    #     score += 0.05
    #     reasons.append("Medium income tier — mild influence.")
    # else:
    #     reasons.append("Low income tier — lower voluntary dropout likelihood.")

    # -------------------------------------
    # ATTENDANCE (FIXED: handle 0-1 or 0-100 inputs)
    # -------------------------------------
    attendance = to_number(get("attendance_rate", 100), 100)

    # normalize: if attendance given as fraction (<=1), convert to percent
    if attendance <= 1.0:
        attendance = attendance * 100.0

    # clamp sensible bounds
    attendance = max(0.0, min(100.0, attendance))

    if attendance < 60:
        score += 1.90
        reasons.append(f"Low Government Scholar Available ({attendance:.1f}%) ")
    elif attendance >= 85:
        score -= 0.20
        reasons.append(f"High Level Government Scholar Available ({attendance:.1f}%) ")
    else:
        reasons.append(f"Moderate Level Government Scholar Available ({attendance:.1f}%) — neutral effect.")

    # -------------------------------------
    # MOTIVATION, INTEREST, ATTITUDE
    # -------------------------------------
    if to_number(get("motivational_score", 100), 100) < 40:
        score += 0.15
        reasons.append("Low motivational score.")

    if to_number(get("interest_lvl", 10), 10) < 4:
        score += 0.15
        reasons.append("Low interest level.")

    if str(get("attitude", "positive")).strip().lower() == "negative":
        score += 0.20
        reasons.append("Negative attitude observed.")

    # -------------------------------------
    # PROTECTIVE FLAGS (bonuses)
    # -------------------------------------
    if orphan == "yes":
        score -= 0.10
        reasons.append("Orphan — institutional support reduces dropout risk.")

    if sp == "yes":
        score -= 0.10
        reasons.append("Single parent — additional support reduces dropout risk.")

    if fg == "yes":
        score -= 0.05
        reasons.append("First graduate — strong motivation observed.")

    girl_flag = str(get("girlchild", get("girl_child", "no"))).lower()
    if girl_flag == "yes":
        score -= 0.10
        reasons.append("Girl child — statistically lower dropout rate.")

    # -------------------------------------
    # FINAL SCORE
    # -------------------------------------
    final_rule_prob = max(0.01, min(0.95, 0.10 + score))
    return reasons, final_rule_prob

# ----------------------------
# PREDICT ENDPOINT
# ----------------------------
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)
        if data is None:
            return jsonify({"error":"No JSON body provided"}), 400

        # build DataFrame and canonicalize fields
        df = pd.DataFrame([data])
        df = add_features(df)

        # ensure model columns exist before indexing
        missing_num = [c for c in USE_NUM if c not in df.columns]
        if missing_num:
            # create missing numeric columns as zeros
            for c in missing_num:
                df[c] = 0.0

        missing_cat = [c for c in CAT_COLS if c not in df.columns]
        if missing_cat:
            for c in missing_cat:
                df[c] = "any"

        # prepare X for model (order must match training)
        X = df[USE_NUM + CAT_COLS].copy()

        # model prediction (safe)
        try:
            model_prob = float(model.predict_proba(X)[0][1])
        except Exception as me:
            # return useful debug to caller (without full stack)
            return jsonify({"error":"Model prediction failed", "detail": str(me)}), 500

        # rule-based reasons
        rule_reasons, rule_prob = rule_based_contributions(df.iloc[0].to_dict())

        # combine model + rule (50/50 blend)
        final_prob = round((model_prob * 0.5) + (rule_prob * 0.5), 3)
        deservingness = round((1.0 - final_prob) * 100.0, 2)

        if final_prob >= 0.7:
            tier = "HIGH"
        elif final_prob >= 0.4:
            tier = "MEDIUM"
        else:
            tier = "LOW"

        # include top global features if available
        top_features = [f for f,_ in meta.get("global_feature_importances", [])[:6]]

        explanation = {
            "final_probability_used": final_prob,
            "rule_probability": round(rule_prob, 3),
            "model_probability": round(model_prob, 3),
            "human_readable_reasons": rule_reasons,
            "global_top_model_features": top_features
        }

        return jsonify({
            "dropout_probability": final_prob,
            "deservingness_score": deservingness,
            "risk_tier": tier,
            "explanation": explanation
        })

    except Exception as e:
        return jsonify({"error":"Unexpected server error", "detail": str(e)}), 500

@app.route("/")
def home():
    return "DeserveIQ API running ✔"

if __name__ == "__main__":
    app.run(debug=True, port=5000)
