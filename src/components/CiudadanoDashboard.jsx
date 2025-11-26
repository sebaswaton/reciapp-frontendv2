import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { me } from '../api/auth';
import Navbar from './Navbar';

export default function CiudadanoDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await me();
        setUser(userData);

        // Cargar solicitudes del ciudadano GAAAAAAA :v
        const response = await fetch('http://localhost:8000/api/solicitudes', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (response.ok) {
          const data = await response.json();
          setSolicitudes(data.filter((s) => s.ciudadano_id === userData.id));
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const solicitudesActivas = solicitudes.filter(
    (s) => s.estado === 'pendiente' || s.estado === 'aceptada'
  );
  const solicitudesCompletadas = solicitudes.filter((s) => s.estado === 'completada');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header de bienvenida */}
        <div className="mb-8 text-white">
          <h1 className="text-4xl font-bold mb-2">
            ¡Hola, {user?.nombre}! 👋
          </h1>
          <p className="text-lg text-white/90">
            Bienvenido a tu panel de control de reciclaje
          </p>
        </div>

        {/* Grid de tarjetas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Tarjeta principal: Solicitar Recolección */}
          <div
            onClick={() => navigate('/solicitar-recoleccion')}
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-3xl group col-span-1 md:col-span-2 lg:col-span-1"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                Solicitar Recolección
              </h2>
              <p className="text-gray-600 mb-4">
                Programa una recolección de materiales reciclables en tu ubicación
              </p>
              <div className="flex items-center gap-2 text-green-600 font-semibold">
                Comenzar
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Tarjeta: Solicitudes Activas */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Solicitudes Activas
              </h3>
              <div className="bg-green-100 p-3 rounded-full">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-5xl font-bold text-green-600 mb-2">
                {solicitudesActivas.length}
              </p>
              <p className="text-gray-600 text-sm">
                {solicitudesActivas.length === 1
                  ? 'solicitud en proceso'
                  : 'solicitudes en proceso'}
              </p>
            </div>
          </div>

          {/* Tarjeta: Solicitudes Completadas */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Completadas
              </h3>
              <div className="bg-emerald-100 p-3 rounded-full">
                <svg
                  className="w-6 h-6 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-5xl font-bold text-emerald-600 mb-2">
                {solicitudesCompletadas.length}
              </p>
              <p className="text-gray-600 text-sm">
                {solicitudesCompletadas.length === 1
                  ? 'recolección realizada'
                  : 'recolecciones realizadas'}
              </p>
            </div>
          </div>
        </div>

        {/* Lista de solicitudes recientes */}
        {solicitudes.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Mis Solicitudes Recientes
            </h3>
            <div className="space-y-4">
              {solicitudes.slice(0, 5).map((solicitud) => (
                <div
                  key={solicitud.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-full ${
                        solicitud.estado === 'completada'
                          ? 'bg-green-100'
                          : solicitud.estado === 'aceptada'
                          ? 'bg-blue-100'
                          : 'bg-yellow-100'
                      }`}
                    >
                      <svg
                        className={`w-5 h-5 ${
                          solicitud.estado === 'completada'
                            ? 'text-green-600'
                            : solicitud.estado === 'aceptada'
                            ? 'text-blue-600'
                            : 'text-yellow-600'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 capitalize">
                        {solicitud.tipo_material}
                      </p>
                      <p className="text-sm text-gray-600">
                        {solicitud.cantidad} kg
                        {solicitud.descripcion &&
                          ` - ${solicitud.descripcion}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        solicitud.estado === 'completada'
                          ? 'bg-green-100 text-green-700'
                          : solicitud.estado === 'aceptada'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {solicitud.estado === 'completada'
                        ? 'Completada'
                        : solicitud.estado === 'aceptada'
                        ? 'En camino'
                        : 'Pendiente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mensaje si no hay solicitudes */}
        {solicitudes.length === 0 && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">
              ¡Comienza a reciclar hoy!
            </h3>
            <p className="text-gray-600 mb-6">
              Aún no tienes solicitudes. Crea tu primera solicitud de
              recolección.
            </p>
            <button
              onClick={() => navigate('/solicitar-recoleccion')}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-8 rounded-xl hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 transition-all duration-300 shadow-lg"
            >
              Solicitar Recolección
            </button>
          </div>
        )}
      </div>
    </div>
  );
}