import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
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

// --- COMPONENTE DE RUTAS ---
function RoutingMachine({ start, end, onRouteFound }) {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!start || !end || !map) return;
    if (routingControlRef.current) map.removeControl(routingControlRef.current);

    routingControlRef.current = L.Routing.control({
      waypoints: [L.latLng(start[0], start[1]), L.latLng(end[0], end[1])],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      lineOptions: { styles: [{ color: '#10b981', weight: 6, opacity: 0.8 }] },
      createMarker: () => null,
    }).addTo(map);

    routingControlRef.current.on('routesfound', (e) => {
      const route = e.routes[0];
      if (onRouteFound) {
        onRouteFound({
          distance: (route.summary.totalDistance / 1000).toFixed(1),
          time: Math.round(route.summary.totalTime / 60),
        });
      }
    });

    return () => {
      if (routingControlRef.current && map) map.removeControl(routingControlRef.current);
    };
  }, [start, end, map, onRouteFound]);

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
      }
    };

    ws.onerror = (err) => console.error('Error WS:', err);
    ws.onclose = () => console.log('WebSocket cerrado ❌');

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [userId]);

  // --- 3. GEOLOCALIZACIÓN ---
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    // Posición inicial
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMiUbicacion(coords);
      },
      (err) => console.error(err)
    );

    // Watch Position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nuevaUbicacion = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMiUbicacion(nuevaUbicacion);

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && !disponible) {
          socketRef.current.send(JSON.stringify({
            type: 'ubicacion_reciclador',
            lat: nuevaUbicacion.lat,
            lng: nuevaUbicacion.lng,
            solicitud_id: solicitudActiva?.id,
          }));
        }
      },
      (error) => console.error('Error GPS:', error),
      { enableHighAccuracy: true }
    );

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [disponible, solicitudActiva]);

  // --- 4. CARGA INICIAL ---
  useEffect(() => {
    const cargarSolicitudes = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/solicitudes`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (response.ok) {
          const data = await response.json();
          setSolicitudesPendientes(data.filter((s) => s.estado === 'pendiente'));
        }
      } catch (error) {
        console.error('Error fetch:', error);
      }
    };
    cargarSolicitudes();
  }, []);

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

      alert('¡Excelente trabajo! +50 Puntos 🌟');
      setSolicitudActiva(null);
      setDisponible(true);
      setRouteInfo(null);
    } catch (error) {
      console.error(error);
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
          
          {/* ✅ CORREGIDO: Usamos MapRecenter sin guion */}
          {centrarMapaTrigger && <MapRecenter center={centrarMapaTrigger} />}

          {/* MI UBICACIÓN */}
          <Marker position={[miUbicacion.lat, miUbicacion.lng]} icon={recyclerIcon}>
            <Popup className="custom-popup">
              <div className="text-center">
                <p className="font-bold text-green-700 text-sm">👋 ¡Yo!</p>
              </div>
            </Popup>
          </Marker>

          {/* SOLICITUDES (MARKERS) */}
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

          {/* RUTA ACTIVA */}
          {solicitudActiva && (
            <>
              <Marker position={[solicitudActiva.latitud, solicitudActiva.longitud]} icon={userIcon} />
              <RoutingMachine
                start={[miUbicacion.lat, miUbicacion.lng]}
                end={[solicitudActiva.latitud, solicitudActiva.longitud]}
                onRouteFound={setRouteInfo}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* ================= UI FLOTANTE ================= */}
      
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
            
            {/* MODO MISIÓN */}
            {solicitudActiva ? (
              <div className="bg-white border-2 border-green-500 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                  EN CURSO
                </div>
                
                <h3 className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                  <Navigation size={14}/> Destino
                </h3>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">{solicitudActiva.tipo_material}</h2>
                <p className="text-gray-500 mb-4">{solicitudActiva.cantidad} kg aprox.</p>
                
                {routeInfo && (
                  <div className="flex items-center gap-4 mb-6 bg-green-50 p-3 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">Distancia</p>
                      <p className="font-bold text-green-700">{routeInfo.distance} km</p>
                    </div>
                    <div className="w-px h-8 bg-green-200"></div>
                    <div>
                      <p className="text-xs text-gray-500">Tiempo</p>
                      <p className="font-bold text-green-700">{routeInfo.time} min</p>
                    </div>
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
                {/* Filtros */}
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