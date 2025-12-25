import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PredictSingle from './pages/PredictSingle'
import BatchUpload from './pages/BatchUpload'
import Students from './pages/Students'
import StudentProfile from './pages/StudentProfile'
import { ToastContainer } from 'react-toastify'

const RequireAuth = ({ children }) => {
  const token = localStorage.getItem('deserveiq_token');
  return token ? children : <Navigate to="/login" replace />;
};


export default function App(){
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login/>}/>
        <Route path="/" element={<RequireAuth><Dashboard/></RequireAuth>}/>
        <Route path="/predict" element={<RequireAuth><PredictSingle/></RequireAuth>}/>
        <Route path="/batch" element={<RequireAuth><BatchUpload/></RequireAuth>}/>
        <Route path="/students" element={<RequireAuth><Students/></RequireAuth>}/>
        <Route path="/students/:id" element={<RequireAuth><StudentProfile/></RequireAuth>}/>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer position="top-right" />
    </>
  )
}
