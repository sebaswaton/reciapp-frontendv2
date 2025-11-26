import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { me } from '../api/auth';

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

  // Obtener el usuario actual
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

  // Conexión WebSocket solo cuando tengamos userId
  useEffect(() => {
    if (!userId) return;

    const wsUrl = import.meta.env.VITE_API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/realtime/ws/${userId}`);
    socketRef.current = ws;

    ws.onopen = () => console.log('WebSocket conectado ✅');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'nueva_solicitud') {
        setSolicitudesPendientes((prev) => [...prev, data.solicitud]);
        if (Notification.permission === 'granted') {
          new Notification('Nueva solicitud de reciclaje', {
            body: `${data.solicitud.tipo_material} - ${data.solicitud.cantidad}kg`,
            icon: '/logo.png',
          });
        }
      }
    };
    ws.onerror = (err) => console.error('Error WS:', err);
    ws.onclose = () => console.log('WebSocket cerrado ❌');

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => ws.close();
  }, [userId]);

  // Ubicación y envío en tiempo real
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMiUbicacion({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error);
        setMiUbicacion({ lat: -12.0464, lng: -77.0428 });
      }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nuevaUbicacion = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMiUbicacion(nuevaUbicacion);

        if (socketRef.current && disponible) {
          socketRef.current.send(
            JSON.stringify({
              type: 'ubicacion_reciclador',
              lat: nuevaUbicacion.lat,
              lng: nuevaUbicacion.lng,
              solicitud_id: solicitudActiva?.id,
            })
          );
        }
      },
      (error) => console.error('Error tracking ubicación:', error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [disponible, solicitudActiva]);

  // Cargar solicitudes pendientes
  useEffect(() => {
    const cargarSolicitudesPendientes = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/solicitudes`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (response.ok) {
          const solicitudes = await response.json();
          setSolicitudesPendientes(solicitudes.filter((s) => s.estado === 'pendiente'));
        }
      } catch (error) {
        console.error('Error cargando solicitudes:', error);
      }
    };
    cargarSolicitudesPendientes();
  }, []);

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

      if (!response.ok) throw new Error('Error al aceptar solicitud');

      setSolicitudActiva(solicitud);
      setSolicitudesPendientes((prev) => prev.filter((s) => s.id !== solicitud.id));
      setDisponible(false);

      socketRef.current.send(
        JSON.stringify({ type: 'aceptar_solicitud', solicitud_id: solicitud.id })
      );

      alert('¡Solicitud aceptada! Dirígete a la ubicación del cliente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al aceptar solicitud');
    }
  };

  const rechazarSolicitud = (solicitudId) => {
    setSolicitudesPendientes((prev) => prev.filter((s) => s.id !== solicitudId));
    socketRef.current.send(
      JSON.stringify({ type: 'rechazar_solicitud', solicitud_id: solicitudId })
    );
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

      if (!response.ok) throw new Error('Error al completar servicio');

      alert('¡Servicio completado! 🎉');
      setSolicitudActiva(null);
      setDisponible(true);
      setRouteInfo(null);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al completar servicio');
    }
  };

  // Mostrar spinner mientras se carga userId o ubicación
  if (!userId || !miUbicacion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-green-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
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
              attribution='&copy; OpenStreetMap contributors'
            />
            <Marker position={[miUbicacion.lat, miUbicacion.lng]} icon={recyclerIcon}>
              <Popup>Tu ubicación 🚗</Popup>
            </Marker>
            {solicitudesPendientes.map((solicitud) => (
              <Marker
                key={solicitud.id}
                position={[solicitud.latitud, solicitud.longitud]}
                icon={userIcon}
              >
                <Popup>
                  <div className="p-2">
                    <p className="font-bold">{solicitud.tipo_material}</p>
                    <p className="text-sm">{solicitud.cantidad}kg</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {solicitudActiva && (
              <RoutingMachine
                start={[miUbicacion.lat, miUbicacion.lng]}
                end={[solicitudActiva.latitud, solicitudActiva.longitud]}
                onRouteFound={setRouteInfo}
              />
            )}
          </MapContainer>
        </div>

        {/* Panel flotante */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {/* ... tu panel inferior completo (idéntico al original) */}
        </div>
      </div>
    </div>
  );
}
