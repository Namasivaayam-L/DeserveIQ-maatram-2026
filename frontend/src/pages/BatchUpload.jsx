// src/pages/BatchUpload.jsx
import React, { useState, useMemo } from "react";
import TopNav from "../components/TopNav";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Badge,
} from "react-bootstrap";
import { predictBatch } from "../services/api";
import Papa from "papaparse";
import { toast } from "react-toastify";

const pageBackground =
  "linear-gradient(180deg, #eff6ff 0%, #ffffff 40%, #f9fafb 100%)";
const headerGradient =
  "linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(239,246,255,1) 40%, rgba(219,234,254,1) 100%)";

// CSV help panel — updated to reflect FINAL required fields
const CsvHint = () => (
  <Card
    className="border-0 shadow-sm mt-3"
    style={{ borderRadius: 14, backgroundColor: "#f9fafb" }}
  >
    <Card.Body className="py-3">
      <h6 className="mb-2">Correct CSV Format</h6>
      <p className="small text-muted mb-2">
        Your CSV must contain ONLY the required model columns:
      </p>

      <ul className="small mb-2">
        <li><code>name</code></li>
        <li><code>district</code></li>
        <li><code>cutoff</code></li>
        <li><code>preferred_location</code></li>
        <li><code>preferred_course</code></li>
        <li><code>family_income_tier</code></li>
        <li><code>family_income</code></li>
        <li><code>family_members</code></li>
        <li><code>marks_10</code>, <code>marks_11</code>, <code>marks_12</code></li>
        <li><code>motivational_score</code>, <code>attendance_rate</code></li>
        <li><code>communication_freq</code>, <code>interest_lvl</code>, <code>family_support</code></li>
        <li><code>academic_score</code></li>
        <li><code>orphan</code>, <code>single_parent</code>, <code>first_graduate</code>, <code>girlchild</code></li>
        <li><code>attitude</code></li>
      </ul>

      <p className="small text-muted mb-0">
        After upload, a <strong>predictions.csv</strong> will be downloaded
        containing all original columns + ML output fields:
        <code> dropout_probability</code>,
        <code> deservingness_score</code>,
        <code> risk_tier</code>.
      </p>
    </Card.Body>
  </Card>
);

export default function BatchUpload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [uploading, setUploading] = useState(false);

  const loadFile = (f) => {
    if (!f) return;
    setFile(f);
    Papa.parse(f, {
      header: true,
      preview: 20,
      skipEmptyLines: true,
      complete: (res) => {
        setHeaders(res.meta.fields || []);
        setPreview(res.data.slice(0, 20));
      },
      error: () => {
        toast.error("Unable to read CSV. Please check format.");
        setHeaders([]);
        setPreview([]);
      },
    });
  };

  const upload = async () => {
    if (!file) return toast.warn("Choose CSV first");

    try {
      setUploading(true);
      const res = await predictBatch(file);

      const blob =
        res && res.data instanceof Blob
          ? res.data
          : new Blob([res.data || res], { type: "text/csv" });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "predictions.csv";
      a.click();

      toast.success("Batch scored successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Batch prediction failed");
    } finally {
      setUploading(false);
    }
  };

  const stats = useMemo(
    () => ({
      rows: preview.length || 0,
      cols: headers.length || 0,
    }),
    [preview, headers]
  );

  return (
    <>
      <TopNav />
      <div
        style={{
          minHeight: "100vh",
          background: pageBackground,
          fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont',
        }}
      >
        <Container className="py-4">
          {/* HEADER */}
          <Row className="mb-3">
            <Col>
              <Card
                className="border-0 shadow-sm"
                style={{ borderRadius: 18, background: headerGradient }}
              >
                <Card.Body className="d-flex justify-content-between flex-wrap align-items-center">
                  <div className="mb-2 mb-md-0">
                    <h3 className="mb-1" style={{ fontWeight: 700 }}>
                      Batch Upload & Prediction
                    </h3>
                    <small className="text-muted">
                      Upload a CSV file and score multiple students together.
                    </small>
                  </div>
                  <div className="text-end">
                    <Badge bg={preview.length ? "primary" : "secondary"} pill className="me-2">
                      Rows: {stats.rows}
                    </Badge>
                    <Badge bg={preview.length ? "info" : "secondary"} pill>
                      Columns: {stats.cols}
                    </Badge>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* MAIN */}
          <Row className="g-4">
            {/* LEFT PANEL */}
            <Col md={4}>
              <Card className="p-3 shadow-sm border-0" style={{ borderRadius: 18 }}>
                <h5 className="mb-1">Upload CSV</h5>
                <small className="text-muted">
                  Supported format: <strong>.csv</strong>
                </small>

                <Form.Group className="mt-3 mb-3">
                  <Form.Label className="small text-muted">Select file</Form.Label>
                  <Form.Control
                    type="file"
                    accept=".csv"
                    onChange={(e) => loadFile(e.target.files[0])}
                  />
                  {file && (
                    <div className="small text-muted mt-1">
                      Selected: <strong>{file.name}</strong>
                    </div>
                  )}
                </Form.Group>

                <Button
                  onClick={upload}
                  disabled={uploading || !file}
                  className="w-100 mb-2"
                >
                  {uploading ? "Scoring…" : "Upload & Score"}
                </Button>

                <CsvHint />
              </Card>
            </Col>

            {/* RIGHT PREVIEW */}
            <Col md={8}>
              <Card className="p-3 shadow-sm border-0" style={{ borderRadius: 18 }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <h5 className="mb-0">CSV Preview</h5>
                    <small className="text-muted">
                      Showing first 20 rows for verification.
                    </small>
                  </div>
                  {preview.length > 0 && (
                    <Badge bg="light" text="secondary" pill>
                      {preview.length} row(s)
                    </Badge>
                  )}
                </div>

                {preview.length === 0 ? (
                  <p className="text-muted mt-3 mb-0">
                    No preview available — upload a CSV to continue.
                  </p>
                ) : (
                  <div className="table-responsive mt-2">
                    <Table size="sm" responsive hover className="align-middle">
                      <thead>
                        <tr>
                          {headers.map((h) => (
                            <th key={h} className="text-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i}>
                            {headers.map((h) => (
                              <td key={h} className="text-nowrap">{row[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
}
