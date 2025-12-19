import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Circle } from '@react-google-maps/api';
import { me } from '../api/auth';
import { 
  Menu, 
  X, 
  User, 
  MapPin, 
  Clock, 
  Package, 
  Leaf,
  ArrowLeft,
  AlertCircle,
  Locate
} from 'lucide-react'; // ✅ AGREGAR IMPORTACIÓN DE ICONOS

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const mapOptions = {
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
};

export default function SolicitarRecoleccion() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState(null); // ✅ AGREGAR
  const [ubicacion, setUbicacion] = useState(null);
  const [recicladorUbicacion, setRecicladorUbicacion] = useState(null);
  const [directions, setDirections] = useState(null);
  const [distanciaEstimada, setDistanciaEstimada] = useState(null);
  const [tiempoEstimado, setTiempoEstimado] = useState(null);
  const [solicitudActiva, setSolicitudActiva] = useState(null);
  const [formulario, setFormulario] = useState({
    tipo_material: 'plastico',
    cantidad: '',
    descripcion: '',
  });
  const [loading, setLoading] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // ✅ AGREGAR
  
  const socketRef = useRef(null);
  const mapRef = useRef(null);
  const directionsService = useRef(null);
  const routeUpdateTimerRef = useRef(null);

  // 🔹 Obtener usuario actual
  useEffect(() => {
    const getUser = async () => {
      try {
        const user = await me();
        setUserId(user.id);
        setUserData(user); // ✅ AGREGAR
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

  // 🔹 Conectar WebSocket
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
        const nuevaUbicacion = { lat: data.lat, lng: data.lng };
        setRecicladorUbicacion(nuevaUbicacion);
      } else if (data.type === 'solicitud_completada') {
        alert('¡Recolección completada! Gracias por reciclar 🌱');
        setSolicitudActiva(null);
        setRecicladorUbicacion(null);
        setDirections(null);
        setDistanciaEstimada(null);
        setTiempoEstimado(null);
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

  // ✅ CALCULAR RUTA CON GOOGLE DIRECTIONS API (mejorado)
  const calcularRutaGoogle = useCallback(() => {
    if (!recicladorUbicacion || !ubicacion || !directionsService.current) return;

    console.log('🗺️ Actualizando ruta del reciclador...');

    const origin = new window.google.maps.LatLng(recicladorUbicacion.lat, recicladorUbicacion.lng);
    const destination = new window.google.maps.LatLng(ubicacion.lat, ubicacion.lng);

    directionsService.current.route(
      {
        origin: origin,
        destination: destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);

          const leg = result.routes[0].legs[0];
          setDistanciaEstimada((leg.distance.value / 1000).toFixed(2));
          setTiempoEstimado(Math.ceil(leg.duration.value / 60));

          console.log(`✅ ETA actualizado: ${(leg.distance.value / 1000).toFixed(2)} km, ${Math.ceil(leg.duration.value / 60)} min`);
        } else {
          console.error('❌ Error calculando ruta:', status);
        }
      }
    );
  }, [recicladorUbicacion, ubicacion]);

  // ✅ ACTUALIZAR RUTA CADA 30 SEGUNDOS
  useEffect(() => {
    if (!recicladorUbicacion || !ubicacion || !isMapLoaded) return;

    // Calcular inmediatamente
    calcularRutaGoogle();

    // Configurar actualización periódica
    routeUpdateTimerRef.current = setInterval(() => {
      calcularRutaGoogle();
    }, 30000); // 30 segundos

    return () => {
      if (routeUpdateTimerRef.current) {
        clearInterval(routeUpdateTimerRef.current);
      }
    };
  }, [recicladorUbicacion, ubicacion, isMapLoaded, calcularRutaGoogle]);

  // ✅ MANTENER MAPA CENTRADO EN LA RUTA COMPLETA
  useEffect(() => {
    if (directions && mapRef.current && recicladorUbicacion && ubicacion) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(recicladorUbicacion);
      bounds.extend(ubicacion);

      mapRef.current.fitBounds(bounds, {
        top: 150,
        right: 50,
        bottom: 200,
        left: 50,
      });
    }
  }, [directions, recicladorUbicacion, ubicacion]);

  // ✅ AGREGAR FUNCIÓN onMapLoad (FALTABA)
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    directionsService.current = new window.google.maps.DirectionsService();
    setIsMapLoaded(true);
  }, []);

  // ✅ AGREGAR FUNCIÓN centrarEnMi (FALTABA)
  const centrarEnMi = () => {
    if (ubicacion && mapRef.current) {
      mapRef.current.panTo(ubicacion);
      mapRef.current.setZoom(15);
    }
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
          setTimeout(enviarSolicitud, 500);
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

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'cancelar_solicitud',
            solicitud_id: solicitudActiva.id,
          })
        );
      }

      alert('Solicitud cancelada correctamente');
      
      setSolicitudActiva(null);
      setRecicladorUbicacion(null);
      setDirections(null);
      setDistanciaEstimada(null);
      setTiempoEstimado(null);
    } catch (err) {
      console.error(err);
      alert('Error al cancelar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Cargar Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Error cargando Google Maps</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!userId || !ubicacion || !isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-green-700 font-semibold">
            {!isLoaded ? 'Cargando mapa...' : 'Obteniendo tu información...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative overflow-hidden bg-gray-100 font-sans">
      
      {/* ================= GOOGLE MAPS ================= */}
      <div className="absolute inset-0 z-0">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={ubicacion}
          zoom={15}
          options={{
            ...mapOptions,
            gestureHandling: 'greedy',
            disableDefaultUI: false,
            zoomControl: true,
          }}
          onLoad={onMapLoad}
        >
          {recicladorUbicacion && (
            <Circle
              center={ubicacion}
              radius={100}
              options={{
                fillColor: '#10b981', // ✅ CAMBIO: Verde en lugar de azul
                fillOpacity: 0.2,
                strokeColor: '#10b981',
                strokeOpacity: 0.5,
                strokeWeight: 2,
              }}
            />
          )}

          <Marker
            position={ubicacion}
            icon={{
              url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
              scaledSize: new window.google.maps.Size(25, 41),
            }}
            title="Tu ubicación"
          />

          {recicladorUbicacion && (
            <Marker
              position={recicladorUbicacion}
              icon={{
                url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                scaledSize: new window.google.maps.Size(35, 55),
                anchor: new window.google.maps.Point(17, 55),
              }}
              title="Reciclador en camino"
              animation={window.google.maps.Animation.DROP}
            />
          )}

          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#10b981',
                  strokeWeight: 7,
                  strokeOpacity: 0.9,
                  geodesic: true,
                },
                preserveViewport: true,
              }}
            />
          )}
        </GoogleMap>
      </div>

      {/* ================= UI FLOTANTE (SIDEBAR) ================= */}
      
      {/* 1. Botón Menu Móvil */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-4 z-[1000] bg-white p-3 rounded-xl shadow-lg md:hidden text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {sidebarOpen ? <X size={24}/> : <Menu size={24}/>}
      </button>

      {/* 2. Botón "Centrar en Mí" (Flotante) */}
      <button 
        onClick={centrarEnMi}
        className="absolute bottom-6 right-6 z-[1000] bg-white p-3 rounded-full shadow-xl hover:bg-green-50 text-gray-700 hover:text-green-600 transition-all transform hover:scale-110"
        title="Mi Ubicación"
      >
        <Locate size={24} />
      </button>

      {/* 3. Panel Lateral (Sidebar) - VERDE COMO RECICLADOR */}
      <div className={`absolute top-0 left-0 h-full w-full md:w-96 bg-white/95 backdrop-blur-md shadow-2xl z-[1001] transition-transform duration-300 ease-in-out transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          
          {/* Header del Sidebar - VERDE */}
          <div className="p-6 bg-gradient-to-r from-green-600 to-green-500 text-white shadow-md relative">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 md:hidden opacity-80 hover:opacity-100">
               <X size={24}/>
            </button>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-white text-green-600 flex items-center justify-center font-bold text-2xl shadow-inner border-2 border-green-200">
                {userData?.nombre ? userData.nombre[0].toUpperCase() : <User />}
              </div>
              <div>
                <h2 className="font-bold text-xl">{userData?.nombre || 'Ciudadano'}</h2>
                <div className="flex items-center gap-1 text-green-100 text-sm">
                  <Leaf size={14}/>
                  <span className="font-medium">Contribuyente Activo</span>
                </div>
              </div>
            </div>
            
            {/* Stats Rápidas */}
            <div className="flex mt-6 gap-2">
              <div className="flex-1 bg-white/20 rounded-lg p-2 text-center backdrop-blur-sm">
                <p className="text-2xl font-bold">50</p>
                <p className="text-[10px] uppercase tracking-wider opacity-80">Puntos</p>
              </div>
              <div className="flex-1 bg-white/20 rounded-lg p-2 text-center backdrop-blur-sm">
                <p className="text-2xl font-bold">8kg</p>
                <p className="text-[10px] uppercase tracking-wider opacity-80">Total</p>
              </div>
            </div>
          </div>

          {/* Cuerpo del Sidebar */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            
            {!solicitudActiva ? (
              // ✅ FORMULARIO DE SOLICITUD - VERDE
              <div className="bg-white border-2 border-green-500 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                  📍 NUEVA SOLICITUD
                </div>
                
                <h3 className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2 mt-6">
                  <Package size={14}/> Datos de Recolección
                </h3>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Solicitar Recolección</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tipo de Material
                    </label>
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      value={formulario.tipo_material}
                      onChange={(e) =>
                        setFormulario({
                          ...formulario,
                          tipo_material: e.target.value,
                        })
                      }
                    >
                      <option value="plastico">🔵 Plástico</option>
                      <option value="papel">📄 Papel / Cartón</option>
                      <option value="vidrio">💎 Vidrio</option>
                      <option value="metal">⚙️ Metal</option>
                      <option value="electronico">🔌 Electrónico</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cantidad (kg aproximados)
                    </label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      value={formulario.cantidad}
                      onChange={(e) =>
                        setFormulario({
                          ...formulario,
                          cantidad: e.target.value,
                        })
                      }
                      placeholder="Ej: 5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Descripción (opcional)
                    </label>
                    <textarea
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all resize-none"
                      rows="3"
                      value={formulario.descripcion}
                      onChange={(e) =>
                        setFormulario({
                          ...formulario,
                          descripcion: e.target.value,
                        })
                      }
                      placeholder="Ej: Bolsas de plástico limpias"
                    />
                  </div>

                  <button
                    onClick={handleSolicitar}
                    disabled={loading || !formulario.cantidad}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <MapPin size={20}/>
                    {loading ? 'Solicitando...' : 'Solicitar Recolección'}
                  </button>
                </div>
              </div>
            ) : (
              // ✅ ESTADO DE TRACKING - VERDE
              <div className="bg-white border-2 border-green-500 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl animate-pulse">
                  {solicitudActiva.estado === 'pendiente' ? '🔍 BUSCANDO' : '🚗 EN CAMINO'}
                </div>
                
                <h3 className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                  <Clock size={14}/> Estado de Solicitud
                </h3>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {solicitudActiva.estado === 'pendiente'
                    ? 'Buscando reciclador...'
                    : '¡Reciclador en camino!'}
                </h2>
                <p className="text-gray-500 mb-4 capitalize">
                  {solicitudActiva.tipo_material} - {solicitudActiva.cantidad} kg
                </p>
                
                {/* ✅ INFO DE RUTA EN TIEMPO REAL */}
                {recicladorUbicacion && distanciaEstimada && (
                  <div className="mb-6">
                    <div className="flex items-center gap-4 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-200">
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-green-700">{tiempoEstimado}</p>
                        <p className="text-xs text-gray-500 uppercase">minutos</p>
                      </div>
                      <div className="w-px h-12 bg-green-300"></div>
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-green-700">{distanciaEstimada}</p>
                        <p className="text-xs text-gray-500 uppercase">kilómetros</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-center gap-2 text-green-700 bg-green-50 p-2 rounded-lg">
                      <div className="animate-ping h-2 w-2 bg-green-500 rounded-full"></div>
                      <p className="text-xs font-semibold">Ubicación GPS actualizada en vivo</p>
                    </div>

                    {/* Alerta cuando el reciclador está muy cerca */}
                    {parseFloat(distanciaEstimada) < 1.0 && (
                      <div className="mt-3 bg-yellow-400 text-yellow-900 rounded-lg p-3 flex items-center gap-2 animate-pulse">
                        <AlertCircle size={20} className="flex-shrink-0"/>
                        <p className="text-xs font-bold">¡El reciclador está muy cerca! Prepara tus materiales</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Botones */}
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/ciudadano')}
                    className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={18}/>
                    Volver al Dashboard
                  </button>

                  {solicitudActiva.estado === 'pendiente' && (
                    <button
                      onClick={handleCancelar}
                      disabled={loading}
                      className="w-full bg-red-500 text-white font-semibold py-3 rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      <X size={18}/>
                      {loading ? 'Cancelando...' : 'Cancelar Solicitud'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer del Sidebar */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <button 
              onClick={() => navigate('/ciudadano')}
              className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 py-3 rounded-xl transition-colors font-medium text-sm"
            >
              <ArrowLeft size={18} /> Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}