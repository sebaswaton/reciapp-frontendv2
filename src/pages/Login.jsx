import { useState, useEffect } from "react";
import { login, me } from "../api/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // URL de la API desde variable de entorno
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // Estados del registro
  const [showRegister, setShowRegister] = useState(false);
  const [registerData, setRegisterData] = useState({
    nombre: "",
    correo: "",
    contrasena: "",
    confirmarContrasena: "",
    rol: "ciudadano"
  });

  // Inicializar el chat de n8n
  useEffect(() => {
    // Cargar el CSS del chat
    const link = document.createElement('link');
    link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Agregar estilos personalizados para el chat (colores del tema verde)
    const style = document.createElement('style');
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
        --chat--heading--font-size: 1.5em;
        --chat--subtitle--font-size: 0.875rem;
        --chat--subtitle--line-height: 1.5;
        --chat--textarea--height: 50px;
        --chat--message--font-size: 0.95rem;
        --chat--message--padding: 0.75rem 1rem;
        --chat--message--border-radius: 1rem;
        --chat--message-line-height: 1.6;
        --chat--message--bot--background: rgba(255, 255, 255, 0.95);
        --chat--message--bot--color: #065f46;
        --chat--message--bot--border: 1px solid rgba(16, 185, 129, 0.2);
        --chat--message--user--background: #d1fae5;
        --chat--message--user--color: #064e3b;
        --chat--message--user--border: 1px solid #10b981;
        --chat--message--pre--background: rgba(16, 185, 129, 0.1);
        --chat--toggle--background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
        --chat--toggle--hover--background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
        --chat--toggle--active--background: linear-gradient(135deg, #047857 0%, #0f766e 100%);
        --chat--toggle--color: var(--chat--color-white);
        --chat--toggle--size: 64px;
        --chat--input--background: #ffffff;
        --chat--input--color: #065f46;
        --chat--input--border-color: rgba(16, 185, 129, 0.3);
      
      }
      
      .chat-window {
        box-shadow: 0 20px 25px -5px rgba(16, 185, 129, 0.1), 0 10px 10px -5px rgba(16, 185, 129, 0.04);
        backdrop-filter: blur(10px);
      }
      
      .chat-toggle {
        box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3), 0 4px 6px -2px rgba(16, 185, 129, 0.2);
        transition: all 0.3s ease;
      }
      
      .chat-toggle:hover {
        transform: scale(1.1);
      }
    `;
    document.head.appendChild(style);

    // Cargar e inicializar el script del chat
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';
      createChat({
        webhookUrl: 'https://n8n.rubro.pe/webhook/c749da76-4750-4f74-b84d-6249c0122e5b/chat'
      });
    `;
    document.body.appendChild(script);

    // Limpieza al desmontar el componente
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
      document.body.removeChild(script);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(correo, contrasena);
      const user = await me();
      const rol = (user?.rol || "").toLowerCase();
      
      // Redirecciones según el rol
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

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Validaciones
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
      // ✅ CAMBIO AQUÍ: Usa API_URL en lugar de localhost
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: registerData.nombre,
          correo: registerData.correo,
          contrasena: registerData.contrasena,
          rol: registerData.rol
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al registrar');
      }

      alert("¡Registro exitoso! Ahora puedes iniciar sesión");
      setShowRegister(false);
      setCorreo(registerData.correo);
      setRegisterData({
        nombre: "",
        correo: "",
        contrasena: "",
        confirmarContrasena: "",
        rol: "ciudadano"
      });
    } catch (err) {
      alert(err.message || "Error al registrar. Intenta de nuevo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 p-4 relative overflow-hidden">
      {/* Círculos animados de fondo */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white/5 rounded-full blur-2xl animate-bounce"></div>

      {/* Formulario */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Icono animado */}
        <div className="flex justify-center mb-8 animate-float">
          <div className="bg-white/20 backdrop-blur-lg p-6 rounded-full shadow-2xl border border-white/30">
            <svg 
              className="w-16 h-16 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </div>
        </div>

        {/* Card del formulario */}
        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 transform transition-all duration-500 hover:scale-105 animate-slideUp">
          <h1 className="text-4xl font-bold mb-2 text-center text-white drop-shadow-lg">
            ReciApp
          </h1>
          <p className="text-center text-white/80 mb-8 text-sm">
            {showRegister ? "Crear nueva cuenta" : "Bienvenido de vuelta"}
          </p>

          {!showRegister ? (
            // FORMULARIO DE LOGIN
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Campo Email */}
              <div className="group">
                <label className="block text-white/90 text-sm font-medium mb-2 transition-all duration-300 group-focus-within:text-white">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    required
                  />
                  <svg 
                    className="absolute right-4 top-3.5 w-5 h-5 text-white/50" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" 
                    />
                  </svg>
                </div>
              </div>

              {/* Campo Contraseña */}
              <div className="group">
                <label className="block text-white/90 text-sm font-medium mb-2 transition-all duration-300 group-focus-within:text-white">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                    value={contrasena}
                    onChange={(e) => setContrasena(e.target.value)}
                    required
                  />
                  <svg 
                    className="absolute right-4 top-3.5 w-5 h-5 text-white/50" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                    />
                  </svg>
                </div>
              </div>

              {/* Botón Login */}
              <button 
                disabled={loading} 
                className="w-full bg-white text-green-600 font-bold py-3 px-6 rounded-xl hover:bg-green-50 transform hover:scale-105 transition-all duration-300 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="none"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Ingresando...
                  </>
                ) : (
                  <>
                    Iniciar Sesión
                    <svg 
                      className="w-5 h-5" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M13 7l5 5m0 0l-5 5m5-5H6" 
                      />
                    </svg>
                  </>
                )}
              </button>
            </form>
          ) : (
            // FORMULARIO DE REGISTRO
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Nombre */}
              <div className="group">
                <label className="block text-white/90 text-sm font-medium mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all backdrop-blur-sm"
                  value={registerData.nombre}
                  onChange={(e) => setRegisterData({...registerData, nombre: e.target.value})}
                  required
                />
              </div>

              {/* Email */}
              <div className="group">
                <label className="block text-white/90 text-sm font-medium mb-2">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all backdrop-blur-sm"
                  value={registerData.correo}
                  onChange={(e) => setRegisterData({...registerData, correo: e.target.value})}
                  required
                />
              </div>

              {/* Rol */}
              <div className="group">
                <label className="block text-white/90 text-sm font-medium mb-2">
                  Tipo de Usuario
                </label>
                <select
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all backdrop-blur-sm"
                  value={registerData.rol}
                  onChange={(e) => setRegisterData({...registerData, rol: e.target.value})}
                  required
                >
                  <option value="ciudadano" className="bg-green-700">Ciudadano</option>
                  <option value="reciclador" className="bg-green-700">Reciclador</option>
                </select>
              </div>

              {/* Contraseña */}
              <div className="group">
                <label className="block text-white/90 text-sm font-medium mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all backdrop-blur-sm"
                  value={registerData.contrasena}
                  onChange={(e) => setRegisterData({...registerData, contrasena: e.target.value})}
                  required
                />
              </div>

              {/* Confirmar Contraseña */}
              <div className="group">
                <label className="block text-white/90 text-sm font-medium mb-2">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  placeholder="Repite tu contraseña"
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all backdrop-blur-sm"
                  value={registerData.confirmarContrasena}
                  onChange={(e) => setRegisterData({...registerData, confirmarContrasena: e.target.value})}
                  required
                />
              </div>

              {/* Botón Registrar */}
              <button 
                disabled={loading} 
                className="w-full bg-white text-green-600 font-bold py-3 px-6 rounded-xl hover:bg-green-50 transform hover:scale-105 transition-all duration-300 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="none"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Registrando...
                  </>
                ) : (
                  <>
                    Crear Cuenta
                    <svg 
                      className="w-5 h-5" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" 
                      />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Toggle entre Login y Registro */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setShowRegister(!showRegister)}
              className="text-white/80 text-sm hover:text-white transition-colors duration-300 underline-offset-4 hover:underline"
            >
              {showRegister ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </div>

        {/* Mensaje inferior */}
        <p className="text-center text-white/60 text-sm mt-6 animate-fadeIn">
          Reciclaje inteligente para un futuro sostenible 🌱
        </p>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }

        .animate-fadeIn {
          animation: fadeIn 1s ease-out 0.3s both;
        }

        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
}