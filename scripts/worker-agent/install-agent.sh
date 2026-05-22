#!/bin/bash
# install-agent.sh — Instala el worker-agent en una VM Ubuntu
# Ejecutar como root: sudo bash install-agent.sh
#
# Antes de correr este script, edita las variables de la sección
# "CONFIGURAR AQUÍ" con los valores de ESTA VM.
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURAR AQUÍ — Cambiar en cada VM antes de ejecutar
# ═══════════════════════════════════════════════════════════════════════════════
REDIS_URL="redis://10.0.0.5:6379"   # IP del Control Plane con Redis
NODE_ID="aws-node-1"                # Único por VM: aws-node-1, gcp-node-1, oracle-node-1...
RUN_ID="run-001"
PROVIDER="AWS"                      # AWS | GCP | ORACLE | LOCAL
PRIORITY="100"
CAN_BE_LEADER="true"
CONCURRENCY="4"
# Nombre del proceso del worker de ADN (como aparece en `ps aux`)
# El agente enviará señales a este proceso cuando lleguen comandos del dashboard
WORKER_PROCESS="dna_worker.py"
# ═══════════════════════════════════════════════════════════════════════════════

INSTALL_DIR="/opt/worker-agent"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================================"
echo " Instalando worker-agent en $INSTALL_DIR"
echo " NODE_ID  = $NODE_ID"
echo " PROVIDER = $PROVIDER"
echo " REDIS    = $REDIS_URL"
echo "================================================"

# 1. Instalar dependencias del sistema
echo "[1/5] Instalando dependencias..."
apt-get update -qq
apt-get install -y -qq python3 python3-pip

# 2. Instalar redis-py
echo "[2/5] Instalando redis-py..."
pip3 install --quiet redis

# 3. Crear directorio e instalar archivos
echo "[3/5] Copiando archivos..."
mkdir -p "$INSTALL_DIR"
cp "$SCRIPT_DIR/worker-agent.py" "$INSTALL_DIR/worker-agent.py"
chmod +x "$INSTALL_DIR/worker-agent.py"

# 4. Crear archivo .env con los valores de esta VM
echo "[4/5] Creando archivo .env..."
cat > "$INSTALL_DIR/.env" <<EOF
REDIS_URL=$REDIS_URL
NODE_ID=$NODE_ID
RUN_ID=$RUN_ID
PROVIDER=$PROVIDER
PRIORITY=$PRIORITY
CAN_BE_LEADER=$CAN_BE_LEADER
CONCURRENCY=$CONCURRENCY
WORKER_PROCESS=$WORKER_PROCESS
EOF
chmod 600 "$INSTALL_DIR/.env"

# 5. Instalar y activar el servicio systemd
echo "[5/5] Instalando servicio systemd..."
cp "$SCRIPT_DIR/worker-agent.service" /etc/systemd/system/worker-agent.service

systemctl daemon-reload
systemctl enable worker-agent
systemctl restart worker-agent

# Verificar estado
sleep 2
systemctl status worker-agent --no-pager

echo ""
echo "✅ Instalación completada."
echo ""
echo "Comandos útiles:"
echo "  Ver logs en vivo:     journalctl -u worker-agent -f"
echo "  Ver estado:           systemctl status worker-agent"
echo "  Detener:              systemctl stop worker-agent"
echo "  Reiniciar:            systemctl restart worker-agent"
echo "  Cambiar config:       nano $INSTALL_DIR/.env && systemctl restart worker-agent"
