import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
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

  // 🔹 Conectar WebSocket solo cuando tengamos userId
  useEffect(() => {
    if (!userId) return;

    const wsUrl = import.meta.env.VITE_API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws/${userId}`);
    socketRef.current = ws;

    ws.onopen = () => console.log('WebSocket conectado ✅');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Mensaje recibido:', data);
      
      if (data.type === 'solicitud_aceptada') {
        setSolicitudActiva((prev) => ({
          ...prev,
          estado: 'aceptada',
          reciclador_id: data.reciclador_id,
        }));
        alert('¡Un reciclador aceptó tu solicitud! Está en camino 🚗');
      } else if (data.type === 'ubicacion_reciclador') {
        setRecicladorUbicacion({ lat: data.lat, lng: data.lng });
      }
    };
    ws.onerror = (err) => console.error('Error WS:', err);
    ws.onclose = () => console.log('WebSocket desconectado ❌');

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
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

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'nueva_solicitud',
            solicitud,
          })
        );
      }

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
                    value={formulario.descripcion}
                    onChange={(e) =>
                      setFormulario({
                        ...formulario,
                        descripcion: e.target.value,
                      })
                    }
                    placeholder="Escribe aquí cualquier detalle adicional..."
                    rows="3"
                  ></textarea>
                </div>

                <button
                  onClick={handleSolicitar}
                  className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 transition-all duration-200 flex items-center justify-center"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h18M3 12h18M3 21h18"
                      />
                    </svg>
                  )}
                  Solicitar Recolección
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-t-3xl shadow-2xl p-6">
              <h2 className="text-2xl font-bold text-green-700 mb-4">
                Solicitud Activa
              </h2>
              <div className="mb-4">
                <span className="text-sm text-gray-500">
                  Estado de la solicitud:
                </span>
                <span className="block text-lg font-semibold text-green-800">
                  {solicitudActiva.estado === 'aceptada'
                    ? 'Aceptada'
                    : 'Pendiente'}
                </span>
              </div>

              {solicitudActiva.estado === 'aceptada' && (
                <div className="mb-4">
                  <span className="text-sm text-gray-500">
                    Reciclador asignado:
                  </span>
                  <span className="block text-lg font-semibold text-green-800">
                    {solicitudActiva.reciclador_id}
                  </span>
                </div>
              )}

              <div className="flex flex-col space-y-4">
                <button
                  onClick={() => {
                    if (confirm('¿Estás seguro de cancelar la solicitud?')) {
                      setSolicitudActiva(null);
                      alert('Solicitud cancelada');
                    }
                  }}
                  className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-700 transition-all duration-200 flex items-center justify-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Cancelar Solicitud
                </button>

                <button
                  onClick={() => {
                    if (solicitudActiva.estado === 'aceptada') {
                      alert('Ya tienes una solicitud aceptada');
                    } else {
                      handleSolicitar();
                    }
                  }}
                  className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 transition-all duration-200 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h18M3 12h18M3 21h18"
                      />
                    </svg>
                  )}
                  {solicitudActiva.estado === 'aceptada'
                    ? 'Solicitud Aceptada'
                    : 'Reenviar Solicitud'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
