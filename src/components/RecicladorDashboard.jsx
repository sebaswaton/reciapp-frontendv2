import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { me } from '../api/auth';
import { 
  MapPin, 
  Navigation, 
  Trash2, 
  User, 
  CheckCircle, 
  Power,
  Menu,
  X,
  LogOut,
  Locate,
  Leaf
} from 'lucide-react';

// --- CONFIGURACIÓN DE ICONOS MAPA ---
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const recyclerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// ✅ COMPONENTE CON MAPBOX DIRECTIONS API (con limpieza mejorada)
function RoutingMachine({ start, end, onRouteFound, onInstructionsUpdate }) {
  const map = useMap();
  const polylineRef = useRef(null);

  useEffect(() => {
    if (!start || !end || !map) {
      // ✅ LIMPIAR SI NO HAY COORDENADAS
      if (polylineRef.current && map) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      return;
    }
    
    // Limpiar ruta anterior
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const fetchRoute = async () => {
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      
      if (!mapboxToken || mapboxToken === 'pk.tu_token_aqui') {
        console.error('❌ Token de Mapbox no configurado');
        alert('Por favor configura tu token de Mapbox en el archivo .env\n\nVITE_MAPBOX_TOKEN=pk.tu_token_real');
        return;
      }

      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[1]},${start[0]};${end[1]},${end[0]}?steps=true&banner_instructions=true&geometries=geojson&access_token=${mapboxToken}`;
      
      console.log('📍 Calculando ruta...');
      
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ Error de Mapbox:', errorData);
          throw new Error(`Error ${response.status}: ${errorData.message || 'Error al calcular ruta'}`);
        }
        
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          
          console.log('🗺️ Ruta de Mapbox encontrada');
          
          const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
          
          const polylineLayers = [
            L.polyline(coordinates, {
              color: '#000000',
              weight: 12,
              opacity: 0.15,
              lineCap: 'round',
              lineJoin: 'round'
            }),
            L.polyline(coordinates, {
              color: '#047857',
              weight: 10,
              opacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round'
            }),
            L.polyline(coordinates, {
              color: '#10b981',
              weight: 7,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round'
            }),
            L.polyline(coordinates, {
              color: '#34d399',
              weight: 4,
              opacity: 0.7,
              lineCap: 'round',
              lineJoin: 'round'
            })
          ];

          const layerGroup = L.layerGroup(polylineLayers).addTo(map);
          polylineRef.current = layerGroup;
          
          const bounds = L.latLngBounds(coordinates);
          map.fitBounds(bounds, { padding: [50, 50] });
          
          if (onRouteFound) {
            onRouteFound({
              distance: (route.distance / 1000).toFixed(1),
              time: Math.round(route.duration / 60),
            });
          }
          
          if (onInstructionsUpdate && route.legs && route.legs[0].steps) {
            const steps = route.legs[0].steps;
            console.log('📋 Total instrucciones:', steps.length);
            
            const proximoPaso = steps[0];
            onInstructionsUpdate({
              text: proximoPaso.maneuver.instruction || 'Continúa recto',
              distance: (proximoPaso.distance / 1000).toFixed(2),
              type: proximoPaso.maneuver.type,
              allInstructions: steps.slice(0, 3).map(step => ({
                text: step.maneuver.instruction,
                distance: step.distance,
                type: step.maneuver.type
              }))
            });
            
            console.log('✅ Instrucciones de Mapbox cargadas');
          }
        } else {
          throw new Error('No se encontró ninguna ruta');
        }
      } catch (error) {
        console.error('❌ Error obteniendo ruta de Mapbox:', error);
        alert(`Error al calcular la ruta:\n${error.message}\n\nVerifica:\n1. Tu token de Mapbox en .env\n2. Tu conexión a internet\n3. Que las coordenadas sean válidas`);
      }
    };
    
    fetchRoute();

    // ✅ CLEANUP: Limpiar cuando se desmonta el componente
    return () => {
      if (polylineRef.current && map) {
        console.log('🧹 Limpiando ruta del mapa');
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
    };
  }, [start, end, map, onRouteFound, onInstructionsUpdate]);

  return null;
}

// --- COMPONENTE PARA CENTRAR MAPA (CORREGIDO ✅) ---
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function RecicladorDashboard() {
  // --- ESTADOS ---
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [miUbicacion, setMiUbicacion] = useState(null);
  const [centrarMapaTrigger, setCentrarMapaTrigger] = useState(null);
  
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [solicitudActiva, setSolicitudActiva] = useState(null);
  
  const [disponible, setDisponible] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);
  const [navigationInstructions, setNavigationInstructions] = useState(null); // ✅ NUEVO
  
  // UI States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtroMaterial, setFiltroMaterial] = useState('Todos');

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  // --- 1. AUTENTICACIÓN Y CARGA USUARIO ---
  useEffect(() => {
    const getUser = async () => {
      try {
        const user = await me();
        setUserId(user.id);
        setUserData(user);
      } catch (error) {
        console.error('Error user:', error);
      }
    };
    getUser();
  }, []);

  // --- 2. WEBSOCKET ---
  useEffect(() => {
    if (!userId) return;
    const wsUrl = import.meta.env.VITE_API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws/${userId}`);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket conectado ✅');
      console.log('User ID:', userId);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Mensaje recibido:', data);
      
      if (data.type === 'nueva_solicitud') {
        console.log('Nueva solicitud recibida:', data.solicitud);
        setSolicitudesPendientes((prev) => {
          if (prev.some(s => s.id === data.solicitud.id)) return prev;
          return [...prev, data.solicitud];
        });
        if (Notification.permission === 'granted') {
          new Notification('♻️ ¡Nueva oportunidad!', { body: 'Hay material reciclable cerca.' });
        }
      } else if (data.type === 'solicitud_cancelada') {
        console.log('Solicitud cancelada:', data.solicitud_id);
        // Remover de pendientes
        setSolicitudesPendientes((prev) => prev.filter(s => s.id !== data.solicitud_id));
        // Si es la activa, resetear
        if (solicitudActiva?.id === data.solicitud_id) {
          alert('El ciudadano ha cancelado la solicitud');
          setSolicitudActiva(null);
          setDisponible(true);
          setRouteInfo(null);
        }
      }
    };

    ws.onerror = (err) => console.error('Error WS:', err);
    ws.onclose = () => console.log('WebSocket cerrado ❌');

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [userId, solicitudActiva]);

  // --- 3. GEOLOCALIZACIÓN CON ACTUALIZACIÓN DE RUTA EN TIEMPO REAL ---
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMiUbicacion(coords);
      },
      (err) => console.error(err)
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nuevaUbicacion = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMiUbicacion(nuevaUbicacion);

        // ✅ ACTUALIZAR DISTANCIA Y TIEMPO en tiempo real
        if (solicitudActiva && routeInfo) {
          const distanciaRestante = calcularDistancia(
            nuevaUbicacion.lat, 
            nuevaUbicacion.lng,
            solicitudActiva.latitud,
            solicitudActiva.longitud
          );
          
          setRouteInfo(prev => ({
            ...prev,
            distance: distanciaRestante,
            time: Math.ceil(parseFloat(distanciaRestante) * 3)
          }));
        }

        // Enviar ubicación via WebSocket
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && solicitudActiva) {
          socketRef.current.send(JSON.stringify({
            type: 'ubicacion_reciclador',
            lat: nuevaUbicacion.lat,
            lng: nuevaUbicacion.lng,
            solicitud_id: solicitudActiva.id,
            reciclador_id: userId,
          }));
          console.log('📍 Ubicación enviada:', nuevaUbicacion);
        }
      },
      (error) => console.error('Error GPS:', error),
      { 
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [solicitudActiva, userId, routeInfo]);

  // ✅ FUNCIÓN para calcular distancia
  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(2);
  };

  // --- 4. CARGA INICIAL ---
  useEffect(() => {
    const cargarSolicitudes = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/solicitudes`, {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Solicitudes cargadas:', data);
          setSolicitudesPendientes(data.filter((s) => s.estado === 'pendiente'));
        } else {
          console.error('❌ Error al cargar solicitudes:', response.status);
        }
      } catch (error) {
        console.error('❌ Error fetch solicitudes:', error);
      }
    };
    
    if (userId) {
      cargarSolicitudes();
    }
  }, [userId]);

  // --- FUNCIONES DE ACCIÓN ---
  const cerrarSesion = () => {
    localStorage.removeItem('token');
    window.location.href = '/'; 
  };

  const centrarEnMi = () => {
    if (miUbicacion) {
      setCentrarMapaTrigger([miUbicacion.lat, miUbicacion.lng]);
    }
  };

  const ignorarSolicitud = (id) => {
    setSolicitudesPendientes((prev) => prev.filter((s) => s.id !== id));
  };

  const aceptarSolicitud = async (solicitud) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/solicitudes/${solicitud.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ estado: 'aceptada', reciclador_id: userId }),
      });

      if (!response.ok) throw new Error('Error al aceptar');

      setSolicitudActiva(solicitud);
      setSolicitudesPendientes((prev) => prev.filter((s) => s.id !== solicitud.id));
      setDisponible(false);
      
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({ type: 'aceptar_solicitud', solicitud_id: solicitud.id })
        );
      }
    } catch (error) {
      alert('No se pudo aceptar la solicitud.');
    }
  };

  const completarServicio = async () => {
    if (!solicitudActiva) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/solicitudes/${solicitudActiva.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ estado: 'completada' }),
      });

      if (!response.ok) throw new Error('Error al completar');

      // ✅ NOTIFICAR VIA WEBSOCKET
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({ 
            type: 'completar_solicitud', 
            solicitud_id: solicitudActiva.id 
          })
        );
      }

      alert('¡Excelente trabajo! +50 Puntos 🌟');
      
      // ✅ LIMPIAR EN EL ORDEN CORRECTO
      setSolicitudActiva(null); // Esto hará que RoutingMachine se desmonte
      setNavigationInstructions(null);
      setRouteInfo(null);
      setDisponible(true);
      
      console.log('✅ Servicio completado, estado limpiado');
    } catch (error) {
      console.error(error);
      alert('Error al completar el servicio');
    }
  };

  // --- LOGICA DE FILTRO ---
  const solicitudesFiltradas = solicitudesPendientes.filter(s => {
    if (filtroMaterial === 'Todos') return true;
    return s.tipo_material.toLowerCase().includes(filtroMaterial.toLowerCase());
  });

  // --- RENDER DE CARGA ---
  if (!userId || !miUbicacion) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Cargando ReciApp...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative overflow-hidden bg-gray-100 font-sans">
      
      {/* ================= MAPA ================= */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={[miUbicacion.lat, miUbicacion.lng]} zoom={15} className="h-full w-full" zoomControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; CARTO'
          />
          
          {centrarMapaTrigger && <MapRecenter center={centrarMapaTrigger} />}

          <Marker position={[miUbicacion.lat, miUbicacion.lng]} icon={recyclerIcon}>
            <Popup className="custom-popup">
              <div className="text-center">
                <p className="font-bold text-green-700 text-sm">👋 ¡Yo!</p>
              </div>
            </Popup>
          </Marker>

          {!solicitudActiva && solicitudesFiltradas.map((solicitud) => (
            <Marker key={solicitud.id} position={[solicitud.latitud, solicitud.longitud]} icon={userIcon}>
              <Popup>
                <div className="p-1 max-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full border border-green-200">
                      {solicitud.tipo_material}
                    </span>
                    <span className="text-xs text-gray-500">{solicitud.cantidad}kg</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => ignorarSolicitud(solicitud.id)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2 rounded-lg transition-colors"
                    >
                      Ignorar
                    </button>
                    <button 
                      onClick={() => aceptarSolicitud(solicitud)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-sm"
                    >
                      Aceptar
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ✅ RUTA ACTIVA CON NAVEGACIÓN */}
          {solicitudActiva && miUbicacion && (
            <>
              <Marker position={[solicitudActiva.latitud, solicitudActiva.longitud]} icon={userIcon}>
                <Popup>
                  <div className="text-center">
                    <p className="font-bold text-blue-700">🎯 Destino</p>
                    <p className="text-xs text-gray-600">{solicitudActiva.tipo_material}</p>
                  </div>
                </Popup>
              </Marker>
              <RoutingMachine
                key={`route-${solicitudActiva.id}`}
                start={[miUbicacion.lat, miUbicacion.lng]}
                end={[solicitudActiva.latitud, solicitudActiva.longitud]}
                onRouteFound={setRouteInfo}
                onInstructionsUpdate={setNavigationInstructions}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* ✅ PANEL DE NAVEGACIÓN GPS EN VIVO (FLOTANTE) */}
      {solicitudActiva && navigationInstructions && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[999] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 max-w-md w-11/12 border-2 border-green-500">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full">
              <Navigation size={28} className="text-green-600" />
            </div>
            
            <div className="flex-1">
              <p className="text-2xl font-bold text-gray-800">{navigationInstructions.distance} km</p>
              <p className="text-sm text-gray-600">{navigationInstructions.text}</p>
            </div>
            
            <div className="text-right">
              <p className="text-3xl font-bold text-green-600">{routeInfo?.time}</p>
              <p className="text-xs text-gray-500">min</p>
            </div>
          </div>
          
          {navigationInstructions.allInstructions && navigationInstructions.allInstructions.length > 1 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 font-semibold mb-2">Próximos pasos:</p>
              {navigationInstructions.allInstructions.slice(1, 3).map((instr, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <span>{instr.text} ({(instr.distance / 1000).toFixed(1)} km)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* 3. Panel Lateral (Sidebar) */}
      <div className={`absolute top-0 left-0 h-full w-full md:w-96 bg-white/95 backdrop-blur-md shadow-2xl z-[1001] transition-transform duration-300 ease-in-out transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          
          {/* Header del Sidebar */}
          <div className="p-6 bg-gradient-to-r from-green-600 to-green-500 text-white shadow-md relative">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 md:hidden opacity-80 hover:opacity-100">
               <X size={24}/>
            </button>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-white text-green-600 flex items-center justify-center font-bold text-2xl shadow-inner border-2 border-green-200">
                {userData?.nombre ? userData.nombre[0].toUpperCase() : <User />}
              </div>
              <div>
                <h2 className="font-bold text-xl">{userData?.nombre || 'Reciclador'}</h2>
                <div className="flex items-center gap-1 text-green-100 text-sm">
                  {/* <Award size={14} />  <-- Icono removido si no está importado, o cámbialo por otro */}
                  <span className="font-medium">Nivel: Experto</span>
                </div>
              </div>
            </div>
            
            {/* Stats Rápidas */}
            <div className="flex mt-6 gap-2">
              <div className="flex-1 bg-white/20 rounded-lg p-2 text-center backdrop-blur-sm">
                <p className="text-2xl font-bold">120</p>
                <p className="text-[10px] uppercase tracking-wider opacity-80">Puntos</p>
              </div>
              <div className="flex-1 bg-white/20 rounded-lg p-2 text-center backdrop-blur-sm">
                <p className="text-2xl font-bold">15kg</p>
                <p className="text-[10px] uppercase tracking-wider opacity-80">Hoy</p>
              </div>
            </div>
          </div>

          {/* Cuerpo del Sidebar */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            
            {/* MODO MISIÓN CON NAVEGACIÓN GPS */}
            {solicitudActiva ? (
              <div className="bg-white border-2 border-green-500 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl animate-pulse">
                  🚗 NAVEGANDO
                </div>
                
                <h3 className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                  <Navigation size={14}/> En camino a destino
                </h3>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">{solicitudActiva.tipo_material}</h2>
                <p className="text-gray-500 mb-4">{solicitudActiva.cantidad} kg aprox.</p>
                
                {/* ✅ INFO DE RUTA EN TIEMPO REAL */}
                {routeInfo && (
                  <div className="mb-6">
                    <div className="flex items-center gap-4 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-200">
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-green-700">{routeInfo.distance}</p>
                        <p className="text-xs text-gray-500 uppercase">km restantes</p>
                      </div>
                      <div className="w-px h-12 bg-green-300"></div>
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-green-700">{routeInfo.time}</p>
                        <p className="text-xs text-gray-500 uppercase">minutos</p>
                      </div>
                    </div>
                    
                    {navigationInstructions && (
                      <div className="mt-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-600 font-semibold mb-1">Próxima acción:</p>
                        <p className="text-sm text-gray-800 font-medium">{navigationInstructions.text}</p>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  onClick={completarServicio}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]"
                >
                  <CheckCircle size={20}/> Completar Recolección
                </button>
              </div>
            ) : (
              // MODO LISTA
              <>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                   {['Todos', 'Plastico', 'Carton', 'Vidrio', 'Metal'].map(filtro => (
                     <button
                        key={filtro}
                        onClick={() => setFiltroMaterial(filtro)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
                          filtroMaterial === filtro 
                          ? 'bg-green-600 text-white border-green-600' 
                          : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'
                        }`}
                     >
                       {filtro}
                     </button>
                   ))}
                </div>

                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Leaf size={14}/> Disponibles ({solicitudesFiltradas.length})
                  </h3>
                </div>

                <div className="space-y-3 pb-20">
                  {solicitudesFiltradas.length === 0 ? (
                    <div className="text-center py-12 opacity-40">
                      <Trash2 size={48} className="mx-auto mb-3 text-gray-400"/>
                      <p className="text-sm font-medium">No hay solicitudes de {filtroMaterial === 'Todos' ? 'reciclaje' : filtroMaterial} cerca.</p>
                    </div>
                  ) : (
                    solicitudesFiltradas.map((sol) => (
                      <div key={sol.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                        <button 
                           onClick={() => ignorarSolicitud(sol.id)}
                           className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-full transition-colors"
                           title="Ignorar"
                        >
                           <X size={16}/>
                        </button>

                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                             <Trash2 size={20}/>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-700">{sol.tipo_material}</h4>
                            <p className="text-xs text-gray-400 mb-3">{sol.cantidad} kg • Recolección inmediata</p>
                            
                            <button 
                              onClick={() => aceptarSolicitud(sol)}
                              className="w-full bg-gray-50 hover:bg-green-600 hover:text-white text-gray-600 text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                              <Navigation size={14}/> Ir a Recoger
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer del Sidebar (Logout) */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <button 
              onClick={cerrarSesion}
              className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 py-3 rounded-xl transition-colors font-medium text-sm"
            >
              <LogOut size={18} /> Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* 4. Switch de Estado (Top Right) */}
      <div className="absolute top-4 right-4 z-[1000] hidden md:block">
        <div className={`flex items-center gap-3 px-4 py-2 rounded-full shadow-lg backdrop-blur-md transition-all ${disponible ? 'bg-white/90 border-green-500 border-2' : 'bg-gray-800/90 border-gray-600 border'}`}>
          <div className="flex flex-col items-end">
            <span className={`text-xs font-bold uppercase ${disponible ? 'text-green-600' : 'text-gray-400'}`}>
              {disponible ? 'En Línea' : 'Offline'}
            </span>
          </div>
          <button 
            onClick={() => setDisponible(!disponible)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${disponible ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-gray-600 text-gray-300'}`}
          >
            <Power size={16} />
          </button>
        </div>
      </div>

    </div>
  );
}