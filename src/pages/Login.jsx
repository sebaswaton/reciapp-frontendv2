import { useState, useEffect } from "react";
import { login, me } from "../api/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [loading, setLoading] = useState(false);

  const [showRegister, setShowRegister] = useState(false);
  const [registerData, setRegisterData] = useState({
    nombre: "",
    correo: "",
    contrasena: "",
    confirmarContrasena: "",
    rol: "ciudadano",
  });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // 🟢 Carrusel de Reciappcito
// 🟢 Carrusel de Reciappcito
const reciImages = [
  "/reciappcito/reciappcito.png",
];


  const [activeReciIndex, setActiveReciIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveReciIndex((prev) => (prev + 1) % reciImages.length);
    }, 3500); // cambia cada 3.5s
    return () => clearInterval(interval);
  }, [reciImages.length]);

  // 🟢 Chat n8n (restaurado)
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = `
      :root {
        --chat--color--primary: #10b981;
        --chat--color--primary-shade-50: #059669;
        --chat--color--primary--shade-100: #047857;
        --chat--color--secondary: #14b8a6;
        --chat--color-secondary-shade-50: #0d9488;
        --chat--color-white: #ffffff;
        --chat--color-light: #f0fdf4;
        --chat--color-light-shade-50: #dcfce7;
        --chat--color-light-shade-100: #bbf7d0;
        --chat--color-medium: #86efac;
        --chat--color-dark: #065f46;
        --chat--color-disabled: #6b7280;
        --chat--color-typing: #374151;
        --chat--spacing: 1rem;
        --chat--border-radius: 0.75rem;
        --chat--transition-duration: 0.3s;
        --chat--window--width: 320px;
        --chat--window--height: 480px;
        --chat--header-height: auto;
        --chat--header--padding: var(--chat--spacing);
        --chat--header--background: linear-gradient(135deg, #10b981 0%, #059669 50%, #0d9488 100%);
        --chat--header--color: var(--chat--color-white);
        --chat--header--border-top: none;
        --chat--header--border-bottom: none;
        --chat--heading--font-size: 1.3rem;
        --chat--subtitle--font-size: 0.85rem;
        --chat--message--bot--background: rgba(255,255,255,0.97);
        --chat--message--bot--color: #065f46;
        --chat--message--user--background: #d1fae5;
        --chat--message--user--color: #064e3b;
        --chat--toggle--background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
      }
    `;
    document.head.appendChild(style);

    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `
      import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';
      createChat({
        webhookUrl: 'https://n8n.rubro.pe/webhook/c749da76-4750-4f74-b84d-6249c0122e5b/chat'
      });
    `;
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
      document.body.removeChild(script);
    };
  }, []);

  // 🟢 Login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(correo, contrasena);
      const user = await me();
      const rol = (user?.rol || "").toLowerCase();

      if (rol === "admin") {
        navigate("/dashboard", { replace: true });
      } else if (rol === "reciclador") {
        navigate("/reciclador", { replace: true });
      } else if (rol === "ciudadano") {
        navigate("/ciudadano", { replace: true });
      } else {
        navigate("/perfil", { replace: true });
      }
    } catch (err) {
      alert("Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  // 🟢 Registro
  const handleRegister = async (e) => {
    e.preventDefault();

    if (registerData.contrasena !== registerData.confirmarContrasena) {
      alert("Las contraseñas no coinciden");
      return;
    }

    if (registerData.contrasena.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: registerData.nombre,
          correo: registerData.correo,
          contrasena: registerData.contrasena,
          rol: registerData.rol,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Error al registrar");
      }

      alert("¡Registro exitoso! Ahora puedes iniciar sesión");
      setShowRegister(false);
      setCorreo(registerData.correo);
      setRegisterData({
        nombre: "",
        correo: "",
        contrasena: "",
        confirmarContrasena: "",
        rol: "ciudadano",
      });
    } catch (err) {
      alert(err.message || "Error al registrar. Intenta de nuevo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 flex items-center justify-center px-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* PANEL IZQUIERDO: Reciappcito + mensaje */}
        <div className="hidden lg:flex flex-col items-center justify-center text-white relative">
          {/* Glow circular */}
          <div className="absolute -top-10 -left-16 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-10 w-64 h-64 bg-white/10 rounded-full blur-2xl" />

          <div className="relative flex flex-col items-center">
            <div className="w-72 h-72 rounded-3xl bg-white/15 backdrop-blur-xl border border-white/30 shadow-2xl flex items-center justify-center overflow-hidden">
              <img
                src={reciImages[activeReciIndex]}
                alt="Reciappcito"
                className="w-56 h-56 object-contain transition-transform duration-700 ease-out transform hover:scale-105"
              />
            </div>

            <h2 className="mt-8 text-3xl font-bold drop-shadow-lg text-center">
              Con Reciappcito, reciclar es más divertido 🌱
            </h2>
            <p className="mt-3 text-white/80 text-center max-w-md">
              Conecta con recicladores formales, gana recompensas y ayuda a tu comunidad
              a cuidar el planeta, un residuo a la vez.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-white/90">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                  ♻️
                </span>
                <span>Reciclaje responsable</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                  👨‍👩‍👧
                </span>
                <span>Apoyo a las familias</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                  🎁
                </span>
                <span>Beneficios y recompensas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                  🌍
                </span>
                <span>Impacto ambiental real</span>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: Card Login / Registro */}
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-md bg-white/15 backdrop-blur-2xl border border-white/25 rounded-3xl shadow-2xl px-8 py-10 text-white">
            {/* Logo/icono */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M4.582 9H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">ReciApp</h1>
              <p className="text-sm text-white/75 mt-1">
                Transformando reciclaje en futuro sostenible ✨
              </p>
            </div>

            {/* Título del formulario */}
            <h2 className="text-lg font-semibold mb-4 text-center">
              {showRegister ? "Crear nueva cuenta" : "Iniciar sesión"}
            </h2>

            {/* FORMULARIO */}
            {!showRegister ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/70"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/70"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-white/70 hover:text-white underline underline-offset-2"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-xl bg-white text-green-600 font-semibold text-sm shadow-lg hover:bg-green-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Ingresando..." : "Iniciar Sesión"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    placeholder="Juan Pérez"
                    className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/70"
                    value={registerData.nombre}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, nombre: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/70"
                    value={registerData.correo}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, correo: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Tipo de usuario
                  </label>
                  <select
                    className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/70"
                    value={registerData.rol}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, rol: e.target.value })
                    }
                  >
                    <option value="ciudadano" className="text-black">
                      Ciudadano
                    </option>
                    <option value="reciclador" className="text-black">
                      Reciclador
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/70"
                    value={registerData.contrasena}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, contrasena: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="Repite tu contraseña"
                    className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/30 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/70"
                    value={registerData.confirmarContrasena}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        confirmarContrasena: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 rounded-xl bg-white text-green-600 font-semibold text-sm shadow-lg hover:bg-green-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Registrando..." : "Crear Cuenta"}
                </button>
              </form>
            )}

            {/* Toggle Login/Registro */}
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowRegister(!showRegister)}
                className="text-sm text-white/80 hover:text-white underline underline-offset-4"
              >
                {showRegister
                  ? "¿Ya tienes cuenta? Inicia sesión"
                  : "¿No tienes cuenta? Regístrate"}
              </button>
            </div>

            <p className="mt-6 text-center text-[11px] text-white/60">
              ReciApp © 2025 — Unidos por el planeta 🌍
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}