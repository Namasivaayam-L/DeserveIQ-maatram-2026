// src/pages/Students.jsx
// -----------------------------------------------------------------------------
// STUDENTS PAGE — ML-ENRICHED REGISTRY WITH SUMMARY, FILTERS, SORTING, ACTIONS
// Combines:
// 1) Working prediction logic (predictSingle) + spinner from FIRST version
// 2) Rich UI, summary pills, filters, sorting, delete + explanation modal from SECOND version
// -----------------------------------------------------------------------------

import React, { useEffect, useMemo, useState } from "react";
import TopNav from "../components/TopNav";
import {
  Container,
  Card,
  Table,
  Row,
  Col,
  Form,
  Badge,
  InputGroup,
  Button,
  Modal,
  Spinner,
} from "react-bootstrap";
import { getStudents, deleteStudent, predictSingle } from "../services/api";
import { useNavigate } from "react-router-dom";

// -----------------------------------------------------------------------------
// SMALL DISPLAY COMPONENTS
// -----------------------------------------------------------------------------

const SummaryPill = ({ label, value, variant }) => (
  <Badge
    bg={variant}
    pill
    className="me-2 mb-2"
    style={{ fontSize: "0.70rem", fontWeight: 600 }}
  >
    {label}: {value}
  </Badge>
);

const RiskTierBadge = ({ tier }) => {
  if (!tier) return <span className="text-muted small">—</span>;
  const t = String(tier).toUpperCase();
  let variant = "secondary";
  if (t === "HIGH") variant = "danger";
  else if (t === "MEDIUM") variant = "warning";
  else if (t === "LOW") variant = "success";

  return (
    <Badge
      bg={variant}
      pill
      className="small"
      style={{ fontSize: "0.70rem", minWidth: 55, textAlign: "center" }}
    >
      {t}
    </Badge>
  );
};

const headerBackground =
  "linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(239,246,255,1) 35%, rgba(221,239,253,1) 100%)";

const pageBackground =
  "linear-gradient(180deg, #eff6ff 0%, #ffffff 40%, #f9fafb 100%)";

// -----------------------------------------------------------------------------
// EXPLANATION PARSER (for "Reasons" modal)
// -----------------------------------------------------------------------------

const parseExplanation = (raw) => {
  if (!raw) return null;

  let obj = null;

  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      // not JSON — just show raw
      return { raw };
    }
  } else if (typeof raw === "object") {
    obj = raw;
  }

  if (!obj) return null;

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const listify = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    const s = String(v).replace(/^\[|\]$/g, "");
    return s
      .split(",")
      .map((x) => x.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  };

  return {
    final_probability_used: toNum(obj.final_probability_used),
    model_probability: toNum(obj.model_probability),
    rule_probability: toNum(obj.rule_probability),
    global_top_model_features: listify(
      obj.global_top_model_features || obj.top_features
    ),
    human_readable_reasons: listify(
      obj.human_readable_reasons || obj.reasons
    ),
  };
};

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

// For safe access to unified risk tier (handles risk_tier vs riskTier)
const getRiskTierText = (s) =>
  String((s.risk_tier ?? s.riskTier) ?? "").toUpperCase();

// For dropout probability (handles snakeCase vs camelCase)
const getDropoutProbability = (s) => {
  const v =
    s.dropout_probability ??
    s.dropoutProbability ??
    s.predicted_dropout_probability ??
    null;
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
};

// For deservingness score (handles snakeCase vs camelCase)
const getDeservingnessScore = (s) => {
  const v =
    s.deservingness_score ??
    s.deservingnessScore ??
    s.predicted_deservingness_score ??
    null;
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
};

// -----------------------------------------------------------------------------
// MAIN COMPONENT — Students Registry
// -----------------------------------------------------------------------------

export default function Students() {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true); // full-page data + prediction loading
  const [scoring, setScoring] = useState(false); // internal flag while predictSingle runs

  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");

  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [deletingId, setDeletingId] = useState(null);

  const [showExplain, setShowExplain] = useState(false);
  const [explainStudent, setExplainStudent] = useState(null);
  const [explainParsed, setExplainParsed] = useState(null);

  const nav = useNavigate();

  // ---------------------------------------------------------------------------
  // BUILD PAYLOAD FOR PREDICTION (do not send primary key / predicted fields)
  // ---------------------------------------------------------------------------

  const buildPayload = (s) => {
    // strip ID and any prediction fields to avoid confusing backend
    // Keep only raw student features here
    const {
      id,
      dropout_probability,
      dropoutProbability,
      deservingness_score,
      deservingnessScore,
      risk_tier,
      riskTier,
      explanation,
      ...rest
    } = s;
    return rest;
  };

  // ---------------------------------------------------------------------------
  // LOAD STUDENTS + ENRICH WITH MODEL PREDICTIONS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // Base student rows from API
        const students = await getStudents();
        const arr = Array.isArray(students) ? students : [];

        if (!arr.length) {
          setList([]);
          return;
        }

        setScoring(true);

        // Enrich each student with ML scores (dropout_probability, deservingness_score, risk_tier, explanation)
        const enriched = await Promise.all(
          arr.map(async (s) => {
            try {
              const payload = buildPayload(s);
              const p = await predictSingle(payload);

              const dropoutProb = Number(
                p.dropout_probability ??
                  p.dropoutProbability ??
                  0
              );
              const deservingScore = Number(
                p.deservingness_score ??
                  p.deservingnessScore ??
                  0
              );
              const riskTier =
                p.risk_tier ??
                p.riskTier ??
                s.risk_tier ??
                s.riskTier ??
                "LOW";

              const explanation =
                p.explanation ??
                p.explanation_json ??
                p.explanationJson ??
                s.explanation ??
                null;

              return {
                ...s,
                dropout_probability: dropoutProb,
                deservingness_score: deservingScore,
                risk_tier: riskTier,
                explanation,
              };
            } catch {
              // fallback if prediction fails for a row
              return {
                ...s,
                dropout_probability:
                  getDropoutProbability(s) ?? 0,
                deservingness_score:
                  getDeservingnessScore(s) ?? 0,
                risk_tier:
                  s.risk_tier ??
                  s.riskTier ??
                  "LOW",
                explanation: s.explanation ?? null,
              };
            }
          })
        );

        setList(enriched);
      } catch (e) {
        console.error("Failed to load students:", e);
        setList([]);
      } finally {
        setScoring(false);
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------------------------------------------------------------------------
  // SUMMARY PILL AGGREGATIONS
  // ---------------------------------------------------------------------------

  const summary = useMemo(() => {
    if (!list.length) {
      return {
        govt: 0,
        private: 0,
        scholarship: 0,
        highAttendance: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
      };
    }

    const isGovt = (v) =>
      String(v || "")
        .toLowerCase()
        .includes("govt");
    const isPriv = (v) =>
      String(v || "")
        .toLowerCase()
        .includes("private");

    const govt = list.filter(
      (s) =>
        isGovt(s.private_or_govt_school) ||
        isGovt(s.privateOrGovtSchool)
    ).length;

    const priv = list.filter(
      (s) =>
        isPriv(s.private_or_govt_school) ||
        isPriv(s.privateOrGovtSchool)
    ).length;

    const scholarship = list.filter(
      (s) =>
        String(s.any_scholarship || "")
          .toLowerCase()
          .trim() === "yes"
    ).length;

    const highAttendance = list.filter(
      (s) => Number(s.attendance_rate ?? 0) >= 80
    ).length;

    const highRisk = list.filter(
      (s) => getRiskTierText(s) === "HIGH"
    ).length;

    const mediumRisk = list.filter(
      (s) => getRiskTierText(s) === "MEDIUM"
    ).length;

    const lowRisk = list.filter(
      (s) => getRiskTierText(s) === "LOW"
    ).length;

    return {
      govt,
      private: priv,
      scholarship,
      highAttendance,
      highRisk,
      mediumRisk,
      lowRisk,
    };
  }, [list]);

  // ---------------------------------------------------------------------------
  // FILTER + SORT
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    let rows = [...list];
    const q = search.trim().toLowerCase();

    // Free-text search
    if (q) {
      rows = rows.filter((s) => {
        const fields = [
          s.name,
          s.district,
          s.preferred_course,
          s.preferred_location,
          s.attitude,
          getRiskTierText(s),
        ]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        return fields.includes(q);
      });
    }

    // School type filter
    if (schoolFilter !== "ALL") {
      const sf = schoolFilter.toLowerCase();
      rows = rows.filter((s) =>
        String(
          s.private_or_govt_school ??
            s.privateOrGovtSchool ??
            ""
        )
          .toLowerCase()
          .includes(sf)
      );
    }

    // Risk tier filter
    if (riskFilter !== "ALL") {
      const rf = riskFilter.toUpperCase();
      rows = rows.filter(
        (s) => getRiskTierText(s) === rf
      );
    }

    // Sorting
    const getVal = (s) => {
      switch (sortKey) {
        case "district":
          return String(s.district || "").toLowerCase();

        case "cutoff":
          return Number(s.cutoff ?? 0);

        case "income":
          return Number(s.family_income ?? 0);

        case "academic":
          return Number(s.academic_score ?? 0);

        case "motivation":
          return Number(s.motivational_score ?? 0);

        case "attendance":
          return Number(s.attendance_rate ?? 0);

        case "dropout":
          return getDropoutProbability(s) ?? 0;

        case "deservingness":
          return getDeservingnessScore(s) ?? 0;

        case "name":
        default:
          return String(s.name || "").toLowerCase();
      }
    };

    rows.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);

      if (
        typeof va === "number" &&
        typeof vb === "number"
      ) {
        return sortDir === "asc" ? va - vb : vb - va;
      }

      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });

    return rows;
  }, [
    list,
    search,
    schoolFilter,
    riskFilter,
    sortKey,
    sortDir,
  ]);

  // ---------------------------------------------------------------------------
  // SORT UI HANDLERS
  // ---------------------------------------------------------------------------

  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDir((prev) =>
        prev === "asc" ? "desc" : "asc"
      );
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key) => {
    if (key !== sortKey) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  // ---------------------------------------------------------------------------
  // DELETE HANDLER
  // ---------------------------------------------------------------------------

  const handleDelete = async (id) => {
    if (!id) return;
    if (
      !window.confirm(
        "Delete this student permanently?"
      )
    )
      return;

    try {
      setDeletingId(id);
      await deleteStudent(id);
      setList((prev) =>
        prev.filter((s) => s.id !== id)
      );
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // EXPLANATION MODAL HANDLERS
  // ---------------------------------------------------------------------------

  const openExplanation = (s) => {
    setExplainStudent(s);
    setExplainParsed(parseExplanation(s.explanation));
    setShowExplain(true);
  };

  const closeExplanation = () => {
    setShowExplain(false);
    setExplainStudent(null);
    setExplainParsed(null);
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <>
      <TopNav />

      <div
        style={{
          minHeight: "100vh",
          background: pageBackground,
          fontFamily:
            '"Inter", system-ui, -apple-system, BlinkMacSystemFont',
        }}
      >
        <Container className="py-4">
          {/* --------------------------------------------------------------- */}
          {/* LOADING STATE — show full-width card with spinner               */}
          {/* --------------------------------------------------------------- */}
          {loading ? (
            <Card className="p-4 text-center shadow-sm border-0">
              <div className="d-flex flex-column align-items-center">
                <Spinner animation="border" className="mb-2" />
                <div
                  style={{
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Loading students & predictions…
                </div>
                {scoring && (
                  <small className="text-muted mt-1">
                    Running ML scoring for each student.
                  </small>
                )}
              </div>
            </Card>
          ) : (
            <>
              {/* ----------------------------------------------------------- */}
              {/* HEADER CARD — Title + Summary Pills + Filters               */}
              {/* ----------------------------------------------------------- */}
              <Row className="mb-3">
                <Col>
                  <Card
                    className="border-0 shadow-sm"
                    style={{
                      borderRadius: 18,
                      background: headerBackground,
                    }}
                  >
                    <Card.Body>
                      <Row className="align-items-center g-3">
                        <Col md={7}>
                          <h3
                            className="mb-1"
                            style={{
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            Students Registry
                          </h3>

                          <small className="text-muted">
                            {list.length} student record
                            {list.length === 1
                              ? ""
                              : "s"}{" "}
                            scored with dropout probability,
                            deservingness & risk tiers.
                          </small>

                          <div className="mt-3 d-flex flex-wrap">
                            <SummaryPill
                              label="Govt"
                              value={summary.govt}
                              variant="primary"
                            />
                            <SummaryPill
                              label="Private"
                              value={summary.private}
                              variant="info"
                            />
                            <SummaryPill
                              label="Scholarship"
                              value={
                                summary.scholarship
                              }
                              variant="success"
                            />
                            <SummaryPill
                              label="≥80% Attendance"
                              value={
                                summary.highAttendance
                              }
                              variant="warning"
                            />
                            <SummaryPill
                              label="High Risk"
                              value={summary.highRisk}
                              variant="danger"
                            />
                            <SummaryPill
                              label="Medium Risk"
                              value={
                                summary.mediumRisk
                              }
                              variant="warning"
                            />
                            <SummaryPill
                              label="Low Risk"
                              value={summary.lowRisk}
                              variant="success"
                            />
                          </div>
                        </Col>

                        <Col md={5}>
                          <Row className="g-2">
                            <Col xs={12} md={7}>
                              <InputGroup>
                                <Form.Control
                                  placeholder="Search name, district, course…"
                                  value={search}
                                  onChange={(e) =>
                                    setSearch(
                                      e.target.value
                                    )
                                  }
                                />
                              </InputGroup>
                            </Col>

                            <Col xs={6} md={5}>
                              <Form.Select
                                value={
                                  schoolFilter
                                }
                                onChange={(e) =>
                                  setSchoolFilter(
                                    e.target.value
                                  )
                                }
                              >
                                <option value="ALL">
                                  All school types
                                </option>
                                <option value="govt">
                                  Govt only
                                </option>
                                <option value="private">
                                  Private only
                                </option>
                              </Form.Select>
                            </Col>

                            <Col xs={6}>
                              <Form.Select
                                value={riskFilter}
                                onChange={(e) =>
                                  setRiskFilter(
                                    e.target.value
                                  )
                                }
                              >
                                <option value="ALL">
                                  All risk tiers
                                </option>
                                <option value="HIGH">
                                  High only
                                </option>
                                <option value="MEDIUM">
                                  Medium only
                                </option>
                                <option value="LOW">
                                  Low only
                                </option>
                              </Form.Select>
                            </Col>
                          </Row>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {/* ----------------------------------------------------------- */}
              {/* MAIN TABLE CARD — Sorting, Risk Tier, Deserving, Actions    */}
              {/* ----------------------------------------------------------- */}
              <Card
                className="shadow-sm border-0"
                style={{ borderRadius: 18 }}
              >
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
                    <div className="mb-2 mb-md-0">
                      <Card.Title className="mb-0">
                        All Students
                      </Card.Title>
                      <small className="text-muted">
                        Stored dropout %, deservingness
                        score & ML risk tier for each
                        profile.
                      </small>
                    </div>

                    <div className="d-flex align-items-center flex-wrap">
                      <span className="small text-muted me-2">
                        Sort by:{" "}
                        <strong
                          style={{
                            textTransform:
                              "capitalize",
                          }}
                        >
                          {sortKey}
                        </strong>{" "}
                        ({sortDir})
                      </span>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => {
                          setSortKey("name");
                          setSortDir("asc");
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <Table
                      hover
                      className="align-middle mb-0"
                    >
                      <thead>
                        <tr>
                          <th>#</th>

                          <th
                            style={{
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              toggleSort("name")
                            }
                          >
                            Name{" "}
                            <span className="small">
                              {sortIcon(
                                "name"
                              )}
                            </span>
                          </th>

                          <th
                            style={{
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              toggleSort(
                                "district"
                              )
                            }
                          >
                            District{" "}
                            <span className="small">
                              {sortIcon(
                                "district"
                              )}
                            </span>
                          </th>

                          <th>School</th>

                          <th
                            style={{
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              toggleSort("cutoff")
                            }
                          >
                            Cutoff{" "}
                            <span className="small">
                              {sortIcon(
                                "cutoff"
                              )}
                            </span>
                          </th>

                          <th
                            style={{
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              toggleSort("income")
                            }
                          >
                            Income{" "}
                            <span className="small">
                              {sortIcon(
                                "income"
                              )}
                            </span>
                          </th>

                          <th
                            style={{
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              toggleSort(
                                "academic"
                              )
                            }
                          >
                            Academic{" "}
                            <span className="small">
                              {sortIcon(
                                "academic"
                              )}
                            </span>
                          </th>

                          <th
                            style={{
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              toggleSort(
                                "motivation"
                              )
                            }
                          >
                            Motivation{" "}
                            <span className="small">
                              {sortIcon(
                                "motivation"
                              )}
                            </span>
                          </th>

                          <th
                            style={{
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              toggleSort(
                                "attendance"
                              )
                            }
                          >
                            Attendance{" "}
                            <span className="small">
                              {sortIcon(
                                "attendance"
                              )}
                            </span>
                          </th>

                          <th
                            style={{
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              toggleSort(
                                "dropout"
                              )
                            }
                          >
                            Dropout %{" "}
                            <span className="small">
                              {sortIcon(
                                "dropout"
                              )}
                            </span>
                          </th>

                          <th
                            style={{
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              toggleSort(
                                "deservingness"
                              )
                            }
                          >
                            Deserving{" "}
                            <span className="small">
                              {sortIcon(
                                "deservingness"
                              )}
                            </span>
                          </th>

                          <th>Risk</th>
                          <th style={{ width: 210 }}>
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filtered.length === 0 ? (
                          <tr>
                            <td
                              colSpan="13"
                              className="text-center text-muted py-4"
                            >
                              No students found — upload
                              batch CSV & ensure ML
                              scoring has run.
                            </td>
                          </tr>
                        ) : (
                          filtered.map((s, i) => {
                            const dropout =
                              getDropoutProbability(
                                s
                              );
                            const deserving =
                              getDeservingnessScore(
                                s
                              );

                            const dropoutDisplay =
                              dropout !== null
                                ? (
                                    dropout *
                                    100
                                  ).toFixed(1) +
                                  "%"
                                : "—";

                            const deservingDisplay =
                              deserving !== null
                                ? Number(
                                    deserving
                                  ).toFixed(2)
                                : "—";

                            const isDeleting =
                              deletingId ===
                              s.id;

                            const riskTierText =
                              getRiskTierText(
                                s
                              ) || "—";

                            return (
                              <tr
                                key={
                                  s.id ?? i
                                }
                              >
                                <td>
                                  {i + 1}
                                </td>

                                <td>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                    }}
                                  >
                                    {s.name ||
                                      "Unnamed"}
                                  </div>
                                  <div className="small text-muted">
                                    {s.girlchild ===
                                      "yes" ||
                                    s.girl_child ===
                                      "Yes"
                                      ? "Girl child"
                                      : ""}
                                    {s.orphan ===
                                    "Yes"
                                      ? " • Orphan"
                                      : s.single_parent ===
                                        "Yes"
                                      ? " • Single parent"
                                      : ""}
                                  </div>
                                </td>

                                <td>
                                  {s.district ||
                                    "-"}
                                </td>

                                <td>
                                  <span className="small">
                                    {s.private_or_govt_school ??
                                      s.privateOrGovtSchool ??
                                      "Not specified"}
                                  </span>
                                  {s.preferred_course && (
                                    <div className="small text-muted">
                                      Pref:{" "}
                                      {
                                        s.preferred_course
                                      }
                                    </div>
                                  )}
                                </td>

                                <td>
                                  {s.cutoff ??
                                    "-"}
                                </td>

                                <td>
                                  {s.family_income ??
                                    "-"}
                                </td>

                                <td>
                                  {s.academic_score ??
                                    "-"}
                                  {s.academic_score && (
                                    <span className="small text-muted">
                                      {" "}
                                      /100
                                    </span>
                                  )}
                                </td>

                                <td>
                                  {s.motivational_score ??
                                    "-"}
                                </td>

                                <td>
                                  {s.attendance_rate ??
                                    "-"}
                                  %
                                </td>

                                <td
                                  style={{
                                    fontWeight: 600,
                                    color:
                                      "#b91c1c",
                                    fontSize:
                                      "0.85rem",
                                  }}
                                >
                                  {
                                    dropoutDisplay
                                  }
                                </td>

                                <td
                                  style={{
                                    fontWeight: 600,
                                    color:
                                      "#15803d",
                                    fontSize:
                                      "0.85rem",
                                  }}
                                >
                                  {
                                    deservingDisplay
                                  }
                                </td>

                                <td>
                                  <RiskTierBadge
                                    tier={
                                      riskTierText
                                    }
                                  />
                                </td>

                                <td>
                                  <div className="d-flex flex-wrap gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline-primary"
                                      onClick={() =>
                                        nav(
                                          `/students/${s.id}`
                                        )
                                      }
                                    >
                                      View
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline-info"
                                      onClick={() =>
                                        openExplanation(
                                          s
                                        )
                                      }
                                    >
                                      Reasons
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline-danger"
                                      disabled={
                                        isDeleting
                                      }
                                      onClick={() =>
                                        handleDelete(
                                          s.id
                                        )
                                      }
                                    >
                                      {isDeleting
                                        ? "Deleting…"
                                        : "Delete"}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </>
          )}
        </Container>

        {/* --------------------------------------------------------------- */}
        {/* EXPLANATION MODAL                                               */}
        {/* --------------------------------------------------------------- */}
        <Modal
          show={showExplain}
          onHide={closeExplanation}
          size="lg"
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              Explanation —{" "}
              {explainStudent?.name || "Student"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {!explainParsed ? (
              <p className="text-muted small">
                No stored explanation.
              </p>
            ) : explainParsed.raw ? (
              <pre
                style={{
                  background: "#f3f4f6",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {explainParsed.raw}
              </pre>
            ) : (
              <>
                <Row className="mb-3">
                  <Col>
                    <div className="small text-muted">
                      Final Probability Used
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                      }}
                    >
                      {explainParsed.final_probability_used !=
                      null
                        ? (
                            explainParsed.final_probability_used *
                            100
                          ).toFixed(1) + "%"
                        : "N/A"}
                    </div>
                  </Col>
                  <Col>
                    <div className="small text-muted">
                      Model Probability
                    </div>
                    <div>
                      {explainParsed.model_probability !=
                      null
                        ? (
                            explainParsed.model_probability *
                            100
                          ).toFixed(1) + "%"
                        : "N/A"}
                    </div>
                  </Col>
                  <Col>
                    <div className="small text-muted">
                      Rule Probability
                    </div>
                    <div>
                      {explainParsed.rule_probability !=
                      null
                        ? (
                            explainParsed.rule_probability *
                            100
                          ).toFixed(1) + "%"
                        : "N/A"}
                    </div>
                  </Col>
                </Row>

                <h6>Top Influencing Features</h6>
                {explainParsed.global_top_model_features
                  .length > 0 ? (
                  <div className="mb-3">
                    {explainParsed.global_top_model_features.map(
                      (f, i) => (
                        <Badge
                          bg="light"
                          text="dark"
                          className="me-2 mb-2"
                          key={i}
                        >
                          {f}
                        </Badge>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-muted small">
                    Not provided.
                  </p>
                )}

                <h6>Human-Readable Reasons</h6>
                {explainParsed.human_readable_reasons
                  .length > 0 ? (
                  <ul className="small text-muted">
                    {explainParsed.human_readable_reasons.map(
                      (r, i) => (
                        <li key={i}>{r}</li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="text-muted small">
                    Not provided.
                  </p>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              size="sm"
              onClick={closeExplanation}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </>
  );
}
