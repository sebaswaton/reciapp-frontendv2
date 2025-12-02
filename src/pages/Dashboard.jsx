import { useEffect, useState } from "react";
import api from "../utils/fetchClient";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/analytics/resumen")
      .then((res) => setData(res.data))
      .catch(() => setError("No se pudo cargar el dashboard"));
  }, []);

  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="px-6">
      <h1 className="text-3xl font-bold text-green-700 mb-4">Dashboard ReciApp</h1>
      {data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-100 p-4 rounded-lg">Total solicitudes: {data.total_solicitudes}</div>
          <div className="bg-yellow-100 p-4 rounded-lg">Completadas: {data.completadas}</div>
          <div className="bg-blue-100 p-4 rounded-lg">Pendientes: {data.pendientes}</div>
          <div className="bg-purple-100 p-4 rounded-lg">Puntos totales: {data.total_puntos}</div>
        </div>
      ) : (
        <p className="text-gray-600">Cargando...</p>
      )}
    </div>
  );
}