import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { me } from '../api/auth';
import { 
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

// ✅ DEFINIR LIBRARIES FUERA DEL COMPONENTE (fix warning)
const GOOGLE_MAPS_LIBRARIES = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

export default function RecicladorDashboard() {
  // --- ESTADOS ---
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [miUbicacion, setMiUbicacion] = useState(null);
  
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [solicitudActiva, setSolicitudActiva] = useState(null);
  
  const [disponible, setDisponible] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);
  const [navigationInstructions, setNavigationInstructions] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  
  // UI States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtroMaterial, setFiltroMaterial] = useState('Todos');

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const mapRef = useRef(null);

  // ✅ CARGAR GOOGLE MAPS CON API KEY CORRECTA (hardcoded temporalmente)
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDGapeAc3BXu8S6OVuqBu1RiqeVhT1HgxA',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // ✅ VALIDAR API KEY AL CARGAR
  useEffect(() => {
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      console.error('❌ VITE_GOOGLE_MAPS_API_KEY no está configurada en .env');
    } else {
      console.log('✅ Google Maps API Key configurada');
    }
  }, []);

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

  // --- 3. GEOLOCALIZACIÓN ---
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

        // Enviar ubicación via WebSocket
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && solicitudActiva) {
          socketRef.current.send(JSON.stringify({
            type: 'ubicacion_reciclador',
            lat: nuevaUbicacion.lat,
            lng: nuevaUbicacion.lng,
            solicitud_id: solicitudActiva.id,
            reciclador_id: userId,
          }));
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
  }, [solicitudActiva, userId]);

  // ✅ FUNCIÓN PARA CALCULAR RUTA CON GOOGLE DIRECTIONS API (con mejor manejo de errores)
  const calcularRutaGoogle = async (origen, destino) => {
    if (!window.google) {
      console.error('❌ Google Maps no está cargado');
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();

    try {
      const resultado = await directionsService.route({
        origin: new window.google.maps.LatLng(origen.lat, origen.lng),
        destination: new window.google.maps.LatLng(destino.latitud, destino.longitud),
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
      });

      console.log('🗺️ Ruta de Google Maps encontrada');
      
      setDirectionsResponse(resultado);

      const route = resultado.routes[0];
      const leg = route.legs[0];

      setRouteInfo({
        distance: (leg.distance.value / 1000).toFixed(1),
        time: Math.round(leg.duration.value / 60),
      });

      if (leg.steps && leg.steps.length > 0) {
        const primerPaso = leg.steps[0];
        setNavigationInstructions({
          text: primerPaso.instructions.replace(/<[^>]*>/g, ''),
          distance: (primerPaso.distance.value / 1000).toFixed(2),
          type: primerPaso.maneuver || 'straight',
          allInstructions: leg.steps.slice(0, 3).map(step => ({
            text: step.instructions.replace(/<[^>]*>/g, ''),
            distance: step.distance.value,
            type: step.maneuver || 'straight'
          }))
        });
      }
    } catch (error) {
      console.error('❌ Error calculando ruta:', error);
      
      // ✅ MENSAJES DE ERROR ESPECÍFICOS
      if (error.message.includes('REQUEST_DENIED')) {
        alert(
          '⚠️ Error de permisos de Google Maps\n\n' +
          'Pasos para solucionar:\n' +
          '1. Habilita "Directions API" en Google Cloud\n' +
          '2. Configura restricciones de dominio\n' +
          '3. Verifica que la facturación esté activa'
        );
      } else if (error.message.includes('OVER_QUERY_LIMIT')) {
        alert('⚠️ Se superó el límite de consultas diarias. Intenta más tarde.');
      } else if (error.message.includes('ZERO_RESULTS')) {
        alert('⚠️ No se encontró una ruta entre estos puntos.');
      } else {
        alert('Error al calcular la ruta. Revisa tu conexión.');
      }
    }
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
    if (miUbicacion && mapRef.current) {
      mapRef.current.panTo(miUbicacion);
      mapRef.current.setZoom(15);
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
      
      // ✅ CALCULAR RUTA CON GOOGLE MAPS
      if (miUbicacion) {
        await calcularRutaGoogle(miUbicacion, solicitud);
      }
      
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

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({ 
            type: 'completar_solicitud', 
            solicitud_id: solicitudActiva.id 
          })
        );
      }

      alert('¡Excelente trabajo! +50 Puntos 🌟');
      
      // ✅ LIMPIAR ESTADO
      setDirectionsResponse(null);
      setNavigationInstructions(null);
      setRouteInfo(null);
      setSolicitudActiva(null);
      setDisponible(true);
      
      console.log('✅ Servicio completado');
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

  // --- RENDER DE ERROR ---
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error cargando Google Maps</h2>
          <p className="text-gray-600 mb-4">
            No se pudo cargar el script de Google Maps. Verifica:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
            <li>Que tengas un API Key válido en <code className="bg-gray-100 px-2 py-1 rounded">.env</code></li>
            <li>Que hayas habilitado Maps JavaScript API en Google Cloud</li>
            <li>Que no tengas restricciones de dominio activas</li>
          </ul>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER DE CARGA ---
  if (!isLoaded || !userId || !miUbicacion) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Cargando ReciApp...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative overflow-hidden bg-gray-100 font-sans">
      
      {/* ================= GOOGLE MAPS ================= */}
      <div className="absolute inset-0 z-0">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={miUbicacion}
          zoom={15}
          options={mapOptions}
          onLoad={(map) => { mapRef.current = map; }}
        >
          {/* Marker de mi ubicación */}
          <Marker
            position={miUbicacion}
            icon={{
              url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              scaledSize: new window.google.maps.Size(25, 41),
            }}
          />

          {/* Markers de solicitudes pendientes */}
          {!solicitudActiva && solicitudesFiltradas.map((solicitud) => (
            <Marker
              key={solicitud.id}
              position={{ lat: solicitud.latitud, lng: solicitud.longitud }}
              icon={{
                url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                scaledSize: new window.google.maps.Size(25, 41),
              }}
              onClick={() => {
                // Mostrar info
                const infoWindow = new window.google.maps.InfoWindow({
                  content: `
                    <div style="padding: 8px;">
                      <h3 style="font-weight: bold; margin-bottom: 8px;">${solicitud.tipo_material}</h3>
                      <p style="margin-bottom: 8px;">${solicitud.cantidad} kg</p>
                      <button 
                        onclick="window.aceptarSolicitud(${solicitud.id})"
                        style="background: #10b981; color: white; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; width: 100%;"
                      >
                        Aceptar
                      </button>
                    </div>
                  `
                });
                infoWindow.open(mapRef.current, this);
              }}
            />
          ))}

          {/* Marker de destino */}
          {solicitudActiva && (
            <Marker
              position={{ lat: solicitudActiva.latitud, lng: solicitudActiva.longitud }}
              icon={{
                url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                scaledSize: new window.google.maps.Size(25, 41),
              }}
            />
          )}

          {/* ✅ RUTA CON GOOGLE DIRECTIONS */}
          {directionsResponse && (
            <DirectionsRenderer
              directions={directionsResponse}
              options={{
                polylineOptions: {
                  strokeColor: '#10b981',
                  strokeWeight: 6,
                  strokeOpacity: 0.8,
                },
                suppressMarkers: true,
              }}
            />
          )}
        </GoogleMap>
      </div>

      {/* ✅ PANEL DE NAVEGACIÓN GPS */}
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

      {/* ================= UI (SIDEBAR) ================= */}
      
      {/* Botón Menu Móvil */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-4 z-[1000] bg-white p-3 rounded-xl shadow-lg md:hidden text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {sidebarOpen ? <X size={24}/> : <Menu size={24}/>}
      </button>

      {/* Botón "Centrar en Mí" */}
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

// ✅ Exponer función para InfoWindow
window.aceptarSolicitud = (id) => {
  const solicitud = solicitudesPendientes.find(s => s.id === id);
  if (solicitud) aceptarSolicitud(solicitud);
};

// ✅ DEBUG: Ver todas las variables de entorno
useEffect(() => {
  console.log('🔍 Todas las variables de entorno:');
  console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('VITE_GOOGLE_MAPS_API_KEY:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  console.log('Todas las env:', import.meta.env);
}, []);