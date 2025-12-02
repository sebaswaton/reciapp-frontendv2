import { useState, useEffect } from 'react';
import { me } from '../api/auth';
import Navbar from './Navbar';

export default function Rewards() {
  const [user, setUser] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPoints, setUserPoints] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await me();
        setUser(userData);

        // Obtener puntos del usuario
        setUserPoints(userData.puntos);

        // Obtener recompensas
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/rewards`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setRewards(data);
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRedeem = async (rewardId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/wallets/${user.id}/redeem/${rewardId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Error al canjear recompensa');

      const updatedReward = rewards.find((r) => r.id === rewardId);
      updatedReward.stock -= 1; // Reducir stock localmente
      setRewards([...rewards]);

      alert('Recompensa canjeada con éxito');
    } catch (error) {
      console.error(error);
      alert('Error al canjear recompensa');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-white">
          <h1 className="text-4xl font-bold mb-2">Recompensas Disponibles</h1>
          <p className="text-lg text-white/90">
            Canjea tus puntos por increíbles recompensas
          </p>
        </div>

        {/* Grid de recompensas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rewards.map((reward) => (
            <div key={reward.id} className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold">{reward.nombre}</h3>
              <p className="text-gray-600">{reward.descripcion}</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {reward.costo_puntos} puntos
              </p>
              
              {/* NUEVO: Mostrar stock */}
              <p className={`text-sm mt-2 ${reward.stock > 0 ? 'text-gray-500' : 'text-red-500'}`}>
                {reward.stock > 0 ? `${reward.stock} disponibles` : 'Agotado'}
              </p>
              
              <button
                onClick={() => handleRedeem(reward.id)}
                disabled={reward.stock <= 0 || userPoints < reward.costo_puntos}
                className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {reward.stock <= 0 ? 'Agotado' : 'Canjear'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}