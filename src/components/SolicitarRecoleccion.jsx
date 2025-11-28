import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import { me } from '../api/auth';

// Fix iconos Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const userIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const recyclerIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function SolicitarRecoleccion() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [recicladorUbicacion, setRecicladorUbicacion] = useState(null);
  const [solicitudActiva, setSolicitudActiva] = useState(null);
  const [formulario, setFormulario] = useState({
    tipo_material: 'plastico',
    cantidad: '',
    descripcion: '',
  });
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);

  // 🔹 Obtener usuario actual
  useEffect(() => {
    const getUser = async () => {
      try {
        const user = await me();
        setUserId(user.id);
      } catch (error) {
        console.error('Error obteniendo usuario:', error);
      }
    };
    getUser();
  }, []);

  // 🔹 Obtener ubicación
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUbicacion({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error obteniendo ubicación:', error);
          setUbicacion({ lat: -12.0464, lng: -77.0428 }); // fallback Lima
        }
      );
    }
  }, []);

  // 🔹 Conectar Socket.IO solo cuando tengamos userId
  useEffect(() => {
    if (!userId) return;

    const socket = io(import.meta.env.VITE_API_URL, {
      path: '/ws/socket.io',
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => console.log('Socket.IO conectado ✅'));
    socket.on('solicitud_aceptada', (data) => {
      setSolicitudActiva((prev) => ({
        ...prev,
        estado: 'aceptada',
        reciclador_id: data.reciclador_id,
      }));
      alert('¡Un reciclador aceptó tu solicitud! Está en camino 🚗');
    });
    socket.on('ubicacion_reciclador', (data) => {
      setRecicladorUbicacion({ lat: data.lat, lng: data.lng });
    });
    socket.on('disconnect', () => console.log('Socket.IO desconectado ❌'));

    return () => socket.disconnect();
  }, [userId]);

  // 🔹 Crear solicitud
  const handleSolicitar = async () => {
    if (!ubicacion) return alert('Esperando tu ubicación...');
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/solicitudes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          tipo_material: formulario.tipo_material,
          cantidad: parseFloat(formulario.cantidad),
          descripcion: formulario.descripcion,
          latitud: ubicacion.lat,
          longitud: ubicacion.lng,
          direccion: 'Dirección obtenida automáticamente',
        }),
      });

      if (!response.ok) throw new Error('Error al crear solicitud');
      const solicitud = await response.json();
      setSolicitudActiva(solicitud);

      socketRef.current?.emit('nueva_solicitud', { solicitud });

      alert('¡Solicitud creada! Buscando recicladores cercanos...');
    } catch (err) {
      console.error(err);
      alert('Error al crear solicitud');
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Loader mientras se carga usuario o ubicación
  if (!userId || !ubicacion)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-green-700 font-semibold">
            Obteniendo tu información...
          </p>
        </div>
      </div>
    );

  return (
    <div className="h-screen flex flex-col">
      {/* Mapa con z-0 */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 z-0">
          <MapContainer
            center={[ubicacion.lat, ubicacion.lng]}
            zoom={15}
            className="h-full w-full"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <Marker position={[ubicacion.lat, ubicacion.lng]} icon={userIcon}>
              <Popup>Tu ubicación 📍</Popup>
            </Marker>
            {recicladorUbicacion && (
              <Marker
                position={[recicladorUbicacion.lat, recicladorUbicacion.lng]}
                icon={recyclerIcon}
              >
                <Popup>Reciclador en camino 🚗</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Panel superior al mapa */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {!solicitudActiva ? (
            <div className="bg-white rounded-t-3xl shadow-2xl p-6">
              <h2 className="text-2xl font-bold text-green-700 mb-4">
                Solicitar Recolección
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Material
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    value={formulario.tipo_material}
                    onChange={(e) =>
                      setFormulario({
                        ...formulario,
                        tipo_material: e.target.value,
                      })
                    }
                  >
                    <option value="plastico">Plástico</option>
                    <option value="papel">Papel / Cartón</option>
                    <option value="vidrio">Vidrio</option>
                    <option value="metal">Metal</option>
                    <option value="electronico">Electrónico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad (kg aproximados)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    value={formulario.cantidad}
                    onChange={(e) =>
                      setFormulario({
                        ...formulario,
                        cantidad: e.target.value,
                      })
                    }
                    placeholder="5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción (opcional)
                  </label>
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows="2"
                    value={formulario.descripcion}
                    onChange={(e) =>
                      setFormulario({
                        ...formulario,
                        descripcion: e.target.value,
                      })
                    }
                    placeholder="Bolsas de plástico limpias"
                  />
                </div>

                <button
                  onClick={handleSolicitar}
                  disabled={loading || !formulario.cantidad}
                  className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Solicitando...' : 'Solicitar Recolección 🚀'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-t-3xl shadow-2xl p-6">
              <div className="text-center">
                <div className="animate-pulse mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-green-700 mb-2">
                  {solicitudActiva.estado === 'pendiente'
                    ? 'Buscando reciclador...'
                    : '¡Reciclador en camino!'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {solicitudActiva.estado === 'pendiente'
                    ? 'Estamos notificando a los recicladores cercanos'
                    : 'El reciclador está llegando a tu ubicación'}
                </p>
                {recicladorUbicacion && (
                  <div className="bg-green-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-green-700">
                      📍 Ubicación del reciclador actualizada
                    </p>
                  </div>
                )}
                <button
                  onClick={() => navigate('/ciudadano')}
                  className="w-full mt-4 bg-gray-100 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Volver al Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}