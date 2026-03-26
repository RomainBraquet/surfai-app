#!/bin/bash

echo "🏄 Démarrage SurfAI..."

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Démarrer le backend
echo "▶ Lancement du backend sur http://localhost:3001"
cd "$ROOT/backend"
node server.js &
BACKEND_PID=$!

# Attendre que le backend soit prêt
sleep 2
if curl -s http://localhost:3001/health > /dev/null; then
  echo "✅ Backend opérationnel"
else
  echo "⚠️  Backend ne répond pas encore, patientez..."
  sleep 3
fi

# Démarrer un serveur HTTP pour le frontend (évite les problèmes CORS file://)
echo "▶ Lancement du frontend sur http://localhost:8080"
cd "$ROOT/apps/web"
npx --yes http-server -p 8080 -c-1 --cors -o &
FRONTEND_PID=$!

sleep 2

echo ""
echo "✅ SurfAI est lancé !"
echo "   Backend  : http://localhost:3001"
echo "   Frontend : http://localhost:8080"
echo ""
echo "Ferme ce terminal pour tout arrêter."

# Garder les deux processus en vie
wait $BACKEND_PID $FRONTEND_PID
