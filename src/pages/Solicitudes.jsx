import { useEffect, useState } from "react";
import api from "../utils/fetchClient";

export default function Solicitudes() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/solicitudes")
      .then((res) => setItems(res.data))
      .catch(() => setError("No se pudieron cargar las solicitudes"));
  }, []);

  return (
    <div className="px-6">
      <h1 className="text-2xl font-semibold mb-4">Solicitudes</h1>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Usuario</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Cantidad</th>
              <th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{s.id}</td>
                <td className="p-3">{s.usuario_id}</td>
                <td className="p-3">{s.tipo_residuo}</td>
                <td className="p-3">{s.cantidad}</td>
                <td className="p-3">{s.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}