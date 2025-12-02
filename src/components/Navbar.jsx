import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { me } from "../api/auth";
import api from "../utils/fetchClient";

export default function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);

  // Cargar usuario y puntos
  useEffect(() => {
    const loadData = async () => {
      try {
        const userData = await me();
        setUser(userData);

        const resWallet = await api.get(`/wallets/${userData.id}`);
        setWallet(resWallet.data);
      } catch (error) {
        console.error("Error obteniendo datos:", error);
      }
    };
    loadData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <nav className="bg-green-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* IZQUIERDA */}
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold">ReciApp</h1>

            <div className="flex gap-4">
              {user?.rol === "admin" && (
                <>
                  <Link to="/dashboard" className="hover:text-green-200">Dashboard</Link>
                  <Link to="/solicitudes" className="hover:text-green-200">Solicitudes</Link>
                </>
              )}

              {user?.rol === "reciclador" && (
                <>
                  <Link to="/reciclador" className="hover:text-green-200">Mis Servicios</Link>
                  <Link to="/solicitudes" className="hover:text-green-200">Ver Todas</Link>
                </>
              )}

              {user?.rol === "ciudadano" && (
                <>
                  <Link to="/ciudadano" className="hover:text-green-200">Dashboard</Link>
                  <Link to="/solicitar-recoleccion" className="hover:text-green-200">Solicitar Recolección</Link>
                  <Link to="/tienda" className="hover:text-green-200">Tienda</Link>
                </>
              )}

              <Link to="/perfil" className="hover:text-green-200">Perfil</Link>
            </div>
          </div>

          {/* DERECHA */}
          <div className="flex items-center gap-6">

            {/* ⭐ PUNTOS DEL WALLET */}
            {wallet && (
              <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-lg">
                ⭐ {wallet.puntos} PV
              </span>
            )}

            {/* Usuario */}
            <span className="text-sm">
              {user?.nombre} ({user?.rol})
            </span>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg"
            >
              Cerrar Sesión
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}