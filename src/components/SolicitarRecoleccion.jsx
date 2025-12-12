import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { me } from '../api/auth';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

export default function SolicitarRecoleccion() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [recicladorUbicacion, setRecicladorUbicacion] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [distanciaEstimada, setDistanciaEstimada] = useState(null);
  const [solicitudActiva, setSolicitudActiva] = useState(null);
  const [formulario, setFormulario] = useState({
    tipo_material: 'plastico',
    cantidad: '',
    descripcion: '',
  });
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  const mapRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places']
  });

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
      
      if (data.type === 'solicitud_aceptada') {
        setSolicitudActiva((prev) => ({
          ...prev,
          estado: 'aceptada',
          reciclador_id: data.reciclador_id,
        }));
        alert('¡Un reciclador aceptó tu solicitud! Está en camino 🚗');
      } else if (data.type === 'ubicacion_reciclador') {
        const nuevaUbicacion = { lat: data.lat, lng: data.lng };
        setRecicladorUbicacion(nuevaUbicacion);
        
        if (ubicacion) {
          fetchGoogleRoute(nuevaUbicacion, ubicacion);
        }
      } else if (data.type === 'solicitud_completada') {
        alert('¡Recolección completada! Gracias por reciclar 🌱');
        setSolicitudActiva(null);
        setRecicladorUbicacion(null);
        setDirectionsResponse(null);
        setDistanciaEstimada(null);
      }
    };
    ws.onerror = (err) => console.error('Error WS:', err);
    ws.onclose = () => console.log('WebSocket desconectado ❌');

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [userId, ubicacion]);

  // ✅ CALCULAR RUTA CON GOOGLE DIRECTIONS
  const fetchGoogleRoute = async (origen, destino) => {
    if (!window.google) return;

    const directionsService = new window.google.maps.DirectionsService();

    try {
      const resultado = await directionsService.route({
        origin: new window.google.maps.LatLng(origen.lat, origen.lng),
        destination: new window.google.maps.LatLng(destino.lat, destino.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      setDirectionsResponse(resultado);

      const route = resultado.routes[0];
      const leg = route.legs[0];
      const distancia = (leg.distance.value / 1000).toFixed(2);
      setDistanciaEstimada(distancia);

      console.log('🗺️ Ruta actualizada desde Google Maps');
    } catch (error) {
      console.error('❌ Error obteniendo ruta:', error);
    }
  };

  // ✅ FUNCIÓN para calcular distancia (Haversine)
  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distancia = R * c;
    return distancia.toFixed(2);
  };

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
      console.log('✅ Solicitud creada:', solicitud);
      setSolicitudActiva(solicitud);

      // ✅ ESPERAR A QUE EL WEBSOCKET ESTÉ CONECTADO
      const enviarSolicitud = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          const mensaje = {
            type: 'nueva_solicitud',
            solicitud,
          };
          console.log('📤 Enviando mensaje WebSocket:', mensaje);
          socketRef.current.send(JSON.stringify(mensaje));
        } else {
          console.warn('⏳ WebSocket no está listo, reintentando en 500ms...');
          setTimeout(enviarSolicitud, 500); // Reintentar después de 500ms
        }
      };
      
      enviarSolicitud();
      alert('¡Solicitud creada! Buscando recicladores cercanos...');
    } catch (err) {
      console.error(err);
      alert('Error al crear solicitud');
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Cancelar solicitud
  const handleCancelar = async () => {
    if (!solicitudActiva) return;
    
    const confirmar = window.confirm('¿Estás seguro de que quieres cancelar esta solicitud?');
    if (!confirmar) return;

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/solicitudes/${solicitudActiva.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ estado: 'cancelada' }),
      });

      if (!response.ok) throw new Error('Error al cancelar solicitud');

      // Notificar via WebSocket
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'cancelar_solicitud',
            solicitud_id: solicitudActiva.id,
          })
        );
      }

      alert('Solicitud cancelada correctamente');
      
      // ✅ LIMPIAR ESTADO COMPLETO
      setSolicitudActiva(null);
      setRecicladorUbicacion(null);
      setDirectionsResponse(null); // ✅ Limpiar ruta
      setDistanciaEstimada(null); // ✅ Limpiar distancia
    } catch (err) {
      console.error(err);
      alert('Error al cancelar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Loader mientras se carga usuario o ubicación
  if (!isLoaded || !userId || !ubicacion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-green-700 font-semibold">Obteniendo tu información...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 relative">
        <div className="absolute inset-0 z-0">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={ubicacion}
            zoom={15}
            onLoad={(map) => { mapRef.current = map; }}
          >
            <Marker position={ubicacion} />
            
            {recicladorUbicacion && (
              <Marker
                position={recicladorUbicacion}
                icon={{
                  url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                  scaledSize: new window.google.maps.Size(25, 41),
                }}
              />
            )}

            {directionsResponse && (
              <DirectionsRenderer
                directions={directionsResponse}
                options={{
                  polylineOptions: {
                    strokeColor: '#10b981',
                    strokeWeight: 6,
                  },
                  suppressMarkers: true,
                }}
              />
            )}
          </GoogleMap>
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
                
                {/* ✅ INFORMACIÓN DE TRACKING */}
                {recicladorUbicacion && distanciaEstimada && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-4 border-2 border-green-200">
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-green-600">{distanciaEstimada}</p>
                        <p className="text-xs text-gray-500 uppercase">km de distancia</p>
                      </div>
                      <div className="w-px h-12 bg-green-300"></div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-green-600">~{Math.ceil(parseFloat(distanciaEstimada) * 3)}</p>
                        <p className="text-xs text-gray-500 uppercase">min aprox</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2 text-green-700">
                      <div className="animate-ping h-2 w-2 bg-green-500 rounded-full"></div>
                      <p className="text-sm font-semibold">Ubicación actualizada en tiempo real</p>
                    </div>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/ciudadano')}
                    className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
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

                  {/* Botón Cancelar - solo si está pendiente */}
                  {solicitudActiva.estado === 'pendiente' && (
                    <button
                      onClick={handleCancelar}
                      disabled={loading}
                      className="w-full bg-red-500 text-white font-semibold py-3 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      {loading ? 'Cancelando...' : 'Cancelar Solicitud'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}