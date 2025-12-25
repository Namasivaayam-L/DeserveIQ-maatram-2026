// src/pages/Login.jsx
import React, { useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const pageBackground =
  "linear-gradient(180deg, #eff6ff 0%, #ffffff 40%, #f9fafb 100%)";
const headerGradient =
  "linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(239,246,255,1) 40%, rgba(219,234,254,1) 100%)";

export default function Login() {
  const [email, setEmail] = useState("admin@maatram.org");
  const [pw, setPw] = useState("password");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  
const submit = async (e) => {
  e.preventDefault();

  if (!email || !pw) {
    toast.error("Enter credentials");
    return;
  }

  try {
    setLoading(true);

    // call backend
    const res = await fetch("http://localhost:8080/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pw }),
    });

    if (!res.ok) {
      toast.error("Invalid email or password");
      return;
    }

    const token = await res.text();

    // store JWT token
    localStorage.setItem("deserveiq_token", token);
    localStorage.setItem("deserveiq_user", email);

    toast.success("Logged in");
    nav("/");
  } catch (err) {
    toast.error("Login failed");
  } finally {
    setLoading(false);
  }
};

  return (
    <div
      style={{
        minHeight: "100vh",
        background: pageBackground,
        fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont',
        display: "flex",
        alignItems: "center",
      }}
    >
      <Container>
        <Row className="justify-content-center">
          <Col md={10} lg={8}>
            <Row className="g-4 align-items-stretch">
              {/* Left side info / branding */}
              <Col md={6}>
                <Card
                  className="h-100 border-0 shadow-sm"
                  style={{ borderRadius: 20, background: headerGradient }}
                >
                  <Card.Body className="d-flex flex-column justify-content-between">
                    <div>
                      <h2
                        className="mb-2"
                        style={{ color: "#111827", fontWeight: 800 }}
                      >
                        DeserveIQ
                      </h2>
                      <p className="text-muted mb-3">
                        Sign in to manage student dropout risk analytics,
                        deservingness scores and batch uploads.
                      </p>
                      <ul className="small text-muted mb-3">
                        <li>
                          Upload CSV files and get{" "}
                          <strong>dropout probability</strong> for each student.
                        </li>
                        <li>
                          View a rich dashboard with risk distribution and{" "}
                          <strong>top at-risk students</strong>.
                        </li>
                        <li>
                          Drill into individual profiles to understand{" "}
                          <strong>why</strong> a student is at risk.
                        </li>
                      </ul>
                    </div>
                    <div className="mt-3">
                      <Badge bg="primary" pill className="me-2">
                        ML-powered
                      </Badge>
                      <Badge bg="success" pill className="me-2">
                        NGO-ready
                      </Badge>
                      <Badge bg="info" pill>
                        Internal demo
                      </Badge>
                      <p className="small text-muted mt-3 mb-0">
                        Use the default credentials (pre-filled) to explore the
                        app locally.
                      </p>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              {/* Right side login form */}
              <Col md={6}>
                <Card
                  className="border-0 shadow-lg"
                  style={{ borderRadius: 20 }}
                >
                  <Card.Body className="p-4">
                    <h3 className="mb-1">Sign in</h3>
                    <p className="text-muted mb-4">
                      Enter the admin email and password to continue.
                    </p>

                    <Form onSubmit={submit}>
                      <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.org"
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Password</Form.Label>
                        <Form.Control
                          type="password"
                          value={pw}
                          onChange={(e) => setPw(e.target.value)}
                          placeholder="Enter password"
                        />
                      </Form.Group>

                      <Button
                        type="submit"
                        className="w-100 mt-2"
                        disabled={loading}
                      >
                        {loading ? "Signing in…" : "Login"}
                      </Button>
                    </Form>

                    <div className="mt-3 small text-muted">
                      This is a simple demo login based on{" "}
                      <code>localStorage</code>. In a production deployment,
                      it’d be replaced by proper authentication (JWT or OAuth).
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
