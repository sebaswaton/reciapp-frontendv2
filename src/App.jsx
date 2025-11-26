import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Solicitudes from "./pages/Solicitudes";
import Perfil from "./pages/Perfil";
import Navbar from "./components/Navbar";
import SolicitarRecoleccion from "./components/SolicitarRecoleccion";
import RecicladorDashboard from "./components/RecicladorDashboard";
import CiudadanoDashboard from "./components/CiudadanoDashboard";
import { me } from "./api/auth";

function PrivateRoute({ children, allowedRoles = [] }) {
  const token = localStorage.getItem("token");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      if (token) {
        try {
          const userData = await me();
          setUser(userData);
        } catch (error) {
          console.error("Error obteniendo usuario:", error);
          localStorage.removeItem("token");
        }
      }
      setLoading(false);
    };
    getUser();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  // Verificar roles si se especificaron
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/perfil" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/" element={<Login />} />

        {/* Rutas para ADMIN */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <Navbar />
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* Rutas para RECICLADORES */}
        <Route
          path="/reciclador"
          element={
            <PrivateRoute allowedRoles={["reciclador"]}>
              <RecicladorDashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/solicitudes"
          element={
            <PrivateRoute allowedRoles={["admin", "reciclador"]}>
              <Navbar />
              <Solicitudes />
            </PrivateRoute>
          }
        />

        {/* Rutas para CIUDADANOS */}
        <Route
          path="/ciudadano"
          element={
            <PrivateRoute allowedRoles={["ciudadano"]}>
              <CiudadanoDashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/solicitar-recoleccion"
          element={
            <PrivateRoute allowedRoles={["ciudadano"]}>
              <SolicitarRecoleccion />
            </PrivateRoute>
          }
        />

        {/* Ruta para todos los usuarios autenticados */}
        <Route
          path="/perfil"
          element={
            <PrivateRoute>
              <Navbar />
              <Perfil />
            </PrivateRoute>
          }
        />

        {/* Ruta 404 - Redireccionar al login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}