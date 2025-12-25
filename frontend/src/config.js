export const API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:8080";

export const API_SINGLE = `${API_BASE}/api/predict/single`;
export const API_BATCH  = `${API_BASE}/api/predict/batch`;
export const API_STUDENTS = `${API_BASE}/api/students`;
