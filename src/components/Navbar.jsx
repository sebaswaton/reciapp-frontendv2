import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { me } from "../api/auth";

export default function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        const userData = await me();
        setUser(userData);
      } catch (error) {
        console.error(error);
      }
    };
    getUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <nav className="bg-green-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold">ReciApp</h1>
            
            <div className="flex gap-4">
              {user?.rol === "admin" && (
                <>
                  <Link to="/dashboard" className="hover:text-green-200 transition-colors">
                    Dashboard
                  </Link>
                  <Link to="/solicitudes" className="hover:text-green-200 transition-colors">
                    Solicitudes
                  </Link>
                </>
              )}
              
              {user?.rol === "reciclador" && (
                <>
                  <Link to="/reciclador" className="hover:text-green-200 transition-colors">
                    Mis Servicios
                  </Link>
                  <Link to="/solicitudes" className="hover:text-green-200 transition-colors">
                    Ver Todas
                  </Link>
                </>
              )}
              
              {user?.rol === "ciudadano" && (
                <>
                  <Link to="/ciudadano" className="hover:text-green-200 transition-colors">
                    Dashboard
                  </Link>
                  <Link to="/solicitar-recoleccion" className="hover:text-green-200 transition-colors">
                    Solicitar Recolección
                  </Link>
                </>
              )}
              
              <Link to="/perfil" className="hover:text-green-200 transition-colors">
                Perfil
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm">
              {user?.nombre} ({user?.rol})
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}