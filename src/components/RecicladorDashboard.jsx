import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { me } from '../api/auth';
import Navbar from './Navbar';

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

// Componente para dibujar ruta en el mapa
function RoutingMachine({ start, end, onRouteFound }) {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!start || !end || !map) return;

    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }

    routingControlRef.current = L.Routing.control({
      waypoints: [L.latLng(start[0], start[1]), L.latLng(end[0], end[1])],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      lineOptions: { styles: [{ color: '#10b981', weight: 4 }] },
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
      if (routingControlRef.current && map) {
        map.removeControl(routingControlRef.current);
      }
    };
  }, [start, end, map, onRouteFound]);

  return null;
}

export default function RecicladorDashboard() {
  const [userId, setUserId] = useState(null);
  const [miUbicacion, setMiUbicacion] = useState(null);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [solicitudActiva, setSolicitudActiva] = useState(null);
  const [disponible, setDisponible] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  // 🔹 Obtener el usuario actual
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

  // 🔹 Conexión WebSocket NATIVO solo cuando tengamos userId
  useEffect(() => {
    if (!userId) return;

    const wsUrl = import.meta.env.VITE_API_URL
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');

    // 🔹 IMPORTANTE: Agregar ?type=reciclador para identificarse
    const ws = new WebSocket(`${wsUrl}/realtime/ws/${userId}?type=reciclador`);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket reciclador conectado ✅');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Mensaje recibido:', data);

        if (data.type === 'nueva_solicitud') {
          console.log('Nueva solicitud:', data.solicitud);
          setSolicitudesPendientes((prev) => {
            // Evitar duplicados
            const existe = prev.some((s) => s.id === data.solicitud.id);
            if (existe) return prev;
            return [...prev, data.solicitud];
          });

          // Notificación del navegador
          if (Notification.permission === 'granted') {
            new Notification('Nueva solicitud de reciclaje', {
              body: `${data.solicitud.tipo_material} - ${data.solicitud.cantidad}kg`,
              icon: '/logo.png',
            });
          }
        }
      } catch (error) {
        console.error('Error procesando mensaje:', error);
      }
    };

    ws.onerror = (err) => console.error('Error WS:', err);
    ws.onclose = () => console.log('WebSocket cerrado ❌');

    // Solicitar permiso para notificaciones
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [userId]);

  // 🔹 Obtener ubicación y rastrear en tiempo real
  useEffect(() => {
    if (!navigator.geolocation) return;

    // Obtener ubicación inicial
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMiUbicacion({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error);
        setMiUbicacion({ lat: -12.0464, lng: -77.0428 }); // fallback Lima
      }
    );

    // Rastrear ubicación en tiempo real
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nuevaUbicacion = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMiUbicacion(nuevaUbicacion);

        // 🔹 Enviar ubicación al ciudadano si hay una solicitud activa
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && solicitudActiva) {
          socketRef.current.send(
            JSON.stringify({
              type: 'ubicacion_reciclador',
              lat: nuevaUbicacion.lat,
              lng: nuevaUbicacion.lng,
              solicitud_id: solicitudActiva.id,
              ciudadano_id: solicitudActiva.ciudadano_id,
            })
          );
        }
      },
      (error) => console.error('Error tracking ubicación:', error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [solicitudActiva]);

  // 🔹 Cargar solicitudes pendientes al iniciar
  useEffect(() => {
    const cargarSolicitudesPendientes = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/solicitudes`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        if (response.ok) {
          const solicitudes = await response.json();
          setSolicitudesPendientes(
            solicitudes.filter((s) => s.estado === 'pendiente')
          );
        }
      } catch (error) {
        console.error('Error cargando solicitudes:', error);
      }
    };
    cargarSolicitudesPendientes();
  }, []);

  // 🔹 Aceptar solicitud
  const aceptarSolicitud = async (solicitud) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/solicitudes/${solicitud.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ estado: 'aceptada', reciclador_id: userId }),
        }
      );

      if (!response.ok) throw new Error('Error al aceptar solicitud');

      setSolicitudActiva(solicitud);
      setSolicitudesPendientes((prev) =>
        prev.filter((s) => s.id !== solicitud.id)
      );
      setDisponible(false);

      // 🔹 Notificar al ciudadano vía WebSocket
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'aceptar_solicitud',
            solicitud_id: solicitud.id,
            ciudadano_id: solicitud.ciudadano_id,
          })
        );
      }

      alert('¡Solicitud aceptada! Dirígete a la ubicación del cliente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al aceptar solicitud');
    }
  };

  // 🔹 Rechazar solicitud
  const rechazarSolicitud = (solicitudId) => {
    setSolicitudesPendientes((prev) => prev.filter((s) => s.id !== solicitudId));

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: 'rechazar_solicitud', solicitud_id: solicitudId })
      );
    }
  };

  // 🔹 Completar servicio
  const completarServicio = async () => {
    if (!solicitudActiva) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/solicitudes/${solicitudActiva.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ estado: 'completada' }),
        }
      );

      if (!response.ok) throw new Error('Error al completar servicio');

      // 🔹 Notificar al ciudadano
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'completar_solicitud',
            solicitud_id: solicitudActiva.id,
            ciudadano_id: solicitudActiva.ciudadano_id,
          })
        );
      }

      alert('¡Servicio completado! 🎉');
      setSolicitudActiva(null);
      setDisponible(true);
      setRouteInfo(null);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al completar servicio');
    }
  };

  // 🔹 Mostrar spinner mientras se carga
  if (!userId || !miUbicacion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-green-700 font-semibold">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Navbar />

      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel Reciclador</h1>
            <p className="text-sm text-green-100">
              {disponible ? '🟢 Disponible' : '🔴 En servicio'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm">Solicitudes pendientes</p>
            <p className="text-3xl font-bold">{solicitudesPendientes.length}</p>
          </div>
        </div>
      </div>

      {/* Mapa + Panel */}
      <div className="flex-1 relative">
        {/* Mapa de fondo */}
        <div className="absolute inset-0 z-0">
          <MapContainer
            center={[miUbicacion.lat, miUbicacion.lng]}
            zoom={15}
            className="h-full w-full"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            
            {/* Mi ubicación */}
            <Marker
              position={[miUbicacion.lat, miUbicacion.lng]}
              icon={recyclerIcon}
            >
              <Popup>Tu ubicación 🚗</Popup>
            </Marker>

            {/* Solicitudes pendientes */}
            {solicitudesPendientes.map((solicitud) => (
              <Marker
                key={solicitud.id}
                position={[solicitud.latitud, solicitud.longitud]}
                icon={userIcon}
              >
                <Popup>
                  <div className="p-2">
                    <p className="font-bold capitalize">{solicitud.tipo_material}</p>
                    <p className="text-sm">{solicitud.cantidad}kg</p>
                    {solicitud.descripcion && (
                      <p className="text-xs text-gray-600">{solicitud.descripcion}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Ruta a solicitud activa */}
            {solicitudActiva && (
              <>
                <Marker
                  position={[solicitudActiva.latitud, solicitudActiva.longitud]}
                  icon={userIcon}
                >
                  <Popup>Destino 📍</Popup>
                </Marker>
                <RoutingMachine
                  start={[miUbicacion.lat, miUbicacion.lng]}
                  end={[solicitudActiva.latitud, solicitudActiva.longitud]}
                  onRouteFound={setRouteInfo}
                />
              </>
            )}
          </MapContainer>
        </div>

        {/* Panel flotante */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {disponible ? (
            // Panel de solicitudes pendientes
            <div className="bg-white rounded-t-3xl shadow-2xl p-6 max-h-96 overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Solicitudes Disponibles
              </h2>

              {solicitudesPendientes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-gray-100 w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600">No hay solicitudes pendientes</p>
                  <p className="text-sm text-gray-400">
                    Espera a que los ciudadanos soliciten recolecciones
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {solicitudesPendientes.map((solicitud) => (
                    <div
                      key={solicitud.id}
                      className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-800 capitalize">
                            {solicitud.tipo_material}
                          </h3>
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold">{solicitud.cantidad}kg</span>
                            {solicitud.descripcion &&
                              ` • ${solicitud.descripcion}`}
                          </p>
                          {solicitud.direccion && (
                            <p className="text-xs text-gray-500 mt-1">
                              📍 {solicitud.direccion}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => aceptarSolicitud(solicitud)}
                          className="flex-1 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition-all"
                        >
                          ✓ Aceptar
                        </button>
                        <button
                          onClick={() => rechazarSolicitud(solicitud.id)}
                          className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Panel de servicio activo
            <div className="bg-white rounded-t-3xl shadow-2xl p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Servicio en Curso
              </h2>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border-2 border-blue-200 mb-4">
                <h3 className="font-bold text-lg text-gray-800 capitalize">
                  {solicitudActiva.tipo_material}
                </h3>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">{solicitudActiva.cantidad}kg</span>
                  {solicitudActiva.descripcion &&
                    ` • ${solicitudActiva.descripcion}`}
                </p>
                {solicitudActiva.direccion && (
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {solicitudActiva.direccion}
                  </p>
                )}
              </div>

              {routeInfo && (
                <div className="bg-green-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-600">Distancia</p>
                      <p className="font-bold text-green-700">
                        {routeInfo.distance} km
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Tiempo estimado</p>
                      <p className="font-bold text-green-700">
                        {routeInfo.time} min
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={completarServicio}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-all"
              >
                ✓ Completar Servicio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}