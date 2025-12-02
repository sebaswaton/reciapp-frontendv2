import { useState, useEffect } from "react";
import api from "../utils/fetchClient";

export default function Tienda() {
  // 🟢 Estados
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [modalItem, setModalItem] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // 🟢 Cargar usuario + wallet
  useEffect(() => {
    const loadUser = async () => {
      try {
        const resUser = await api.get("/usuarios/me");
        setUser(resUser.data);

        const resWallet = await api.get(`/wallets/${resUser.data.id}`);
        setWallet(resWallet.data);
      } catch (error) {
        console.error("Error cargando datos:", error);
      }
    };

    loadUser();
  }, []);

  // 🛍️ Lista de recompensas
  const recompensas = [
    { id: 1, nombre: "Bolsa ecológica", puntos: 20, imagen: "https://cdn-icons-png.flaticon.com/512/891/891407.png" },
    { id: 2, nombre: "Plantita en maceta", puntos: 50, imagen: "https://cdn-icons-png.flaticon.com/512/2906/2906263.png" },
    { id: 3, nombre: "Pack de reciclaje", puntos: 100, imagen: "https://cdn-icons-png.flaticon.com/512/993/993514.png" },
    { id: 4, nombre: "10% de descuento en gimnasio", puntos: 150, imagen: "https://cdn-icons-png.flaticon.com/512/2964/2964514.png" },
    { id: 5, nombre: "Gorra eco-friendly", puntos: 40, imagen: "https://cdn-icons-png.flaticon.com/512/892/892510.png" },
    { id: 6, nombre: "Termo reutilizable", puntos: 80, imagen: "https://cdn-icons-png.flaticon.com/512/1047/1047711.png" },
    { id: 7, nombre: "Pack de frutas saludables", puntos: 60, imagen: "https://cdn-icons-png.flaticon.com/512/415/415682.png" },
    { id: 8, nombre: "Insignia de reciclador destacado", puntos: 30, imagen: "https://cdn-icons-png.flaticon.com/512/1828/1828884.png" },
    { id: 9, nombre: "50% en sesión de yoga", puntos: 120, imagen: "https://cdn-icons-png.flaticon.com/512/3909/3909444.png" },
    { id: 10, nombre: "Bolsa premium multiuso", puntos: 35, imagen: "https://cdn-icons-png.flaticon.com/512/4783/4783036.png" },
  ];

  // 🟢 Confirmar canje
  const confirmarCanje = async () => {
    if (!modalItem || !user) return;

    if (wallet.puntos < modalItem.puntos) {
      alert("❌ No tienes suficientes puntos");
      return;
    }

    setProcesando(true);

    try {
      // 🔥 Llamada al backend
      const res = await api.post(`/wallets/${user.id}/redeem/${modalItem.id}`);

      const data = res.data;

      // 🟢 Actualizar puntos localmente
      setWallet(prev => ({
        ...prev,
        puntos: data.puntos_restantes
      }));

      alert(`🎉 ¡Canje exitoso: ${modalItem.nombre}!`);
      setModalItem(null);

    } catch (error) {
      console.error(error);
      alert(error.response?.data?.detail || "Error al procesar el canje.");
    }

    setProcesando(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 to-emerald-100 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Título */}
        <h1 className="text-4xl font-bold text-green-700 mb-2 flex items-center gap-2">
          🎁 Tienda
        </h1>
        <p className="text-gray-600 mb-10">
          ¡Canjea tus puntos por recompensas exclusivas!
        </p>

        {/* Puntos actuales */}
        {wallet && (
          <div className="mt-2 mb-10 p-5 bg-white rounded-xl shadow flex items-center justify-between">
            <span className="text-gray-700 font-semibold text-lg">
              💵 Tus puntos actuales:
            </span>
            <span className="text-3xl font-bold text-green-600">
              {wallet.puntos} PV
            </span>
          </div>
        )}

        {/* Grid de recompensas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {recompensas.map((item) => (
            <div
              key={item.id}
              className="bg-white shadow-lg rounded-2xl p-6 hover:shadow-xl transition"
            >
              <div className="w-24 h-24 mx-auto rounded-xl bg-green-50 flex items-center justify-center mb-4 shadow-inner">
                <img src={item.imagen} alt={item.nombre} className="w-14 h-14 object-contain" />
              </div>

              <h2 className="text-lg font-bold text-gray-800 text-center">{item.nombre}</h2>

              <p className="text-center text-gray-600 mt-1">
                Canjea por{" "}
                <span className="font-bold text-green-600">{item.puntos} puntos verdes</span>
              </p>

              <button
                className="w-full mt-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition"
                onClick={() => setModalItem(item)}
              >
                Canjear
              </button>
            </div>
          ))}
        </div>

        {/* Modal */}
        {modalItem && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-80 text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmar canje</h3>

              <p className="text-gray-600 mb-4">
                ¿Deseas canjear <b>{modalItem.nombre}</b> por{" "}
                <span className="text-green-600 font-semibold">{modalItem.puntos} puntos</span>?
              </p>

              <div className="flex gap-3 mt-4">
                <button
                  className="flex-1 py-2 rounded-xl border border-gray-300 hover:bg-gray-100"
                  onClick={() => setModalItem(null)}
                >
                  Cancelar
                </button>

                <button
                  className="flex-1 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700"
                  onClick={confirmarCanje}
                  disabled={procesando}
                >
                  {procesando ? "Procesando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}