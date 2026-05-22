#!/usr/bin/env python3
"""
worker-agent.py — Agente de nodo para el cluster de comparación de ADN
Corre en cada VM Ubuntu. Se encarga de:
  1. Enviar heartbeats periódicos a Redis
  2. Leer comandos del stream Redis y ejecutarlos (pause/resume/drain/disable)
  3. Publicar eventos al stream de eventos

Uso:
  python3 worker-agent.py

Variables de entorno requeridas:
  REDIS_URL      URL de conexión a Redis  (ej: redis://10.0.0.5:6379)
  NODE_ID        Identificador único del nodo (ej: aws-node-1)
  RUN_ID         ID del run activo         (ej: run-001)
  PROVIDER       Proveedor cloud           (AWS | GCP | ORACLE | LOCAL)
  PRIORITY       Prioridad del nodo        (default: 50)
  CAN_BE_LEADER  Si puede ser líder        (true | false, default: true)
  CONCURRENCY    Jobs concurrentes max     (default: 4)
"""

import os
import json
import time
import signal
import logging
import platform
import threading
import subprocess
from datetime import datetime, timezone

import redis as redis_lib

# ─── Configuración ────────────────────────────────────────────────────────────

REDIS_URL      = os.environ.get("REDIS_URL",      "redis://localhost:6379")
NODE_ID        = os.environ.get("NODE_ID",        f"node-{platform.node()}")
RUN_ID         = os.environ.get("RUN_ID",         "run-001")
PROVIDER       = os.environ.get("PROVIDER",       "LOCAL").upper()
PRIORITY       = int(os.environ.get("PRIORITY",   "50"))
CAN_BE_LEADER  = os.environ.get("CAN_BE_LEADER",  "true").lower() == "true"
CONCURRENCY    = int(os.environ.get("CONCURRENCY","4"))

# Nombre del proceso de comparación de ADN a controlar (como aparece en `ps aux`)
# Ejemplos: "dna_worker.py", "java -jar dna-worker", "dna-compare"
WORKER_PROCESS = os.environ.get("WORKER_PROCESS", "")

HEARTBEAT_INTERVAL = 10   # segundos entre heartbeats
HEARTBEAT_TTL      = 30   # segundos antes de que Redis expire el heartbeat
COMMAND_POLL_MS    = 1000 # milisegundos entre polls al stream de comandos

# ─── Keys Redis (deben coincidir con lib/redis-keys.ts del frontend) ──────────

def key_node(node_id):        return f"nodes:{node_id}"
def key_nodes_active():       return "nodes:active"
def key_leader_lock():        return "leader:lock"
def key_run_stats(run_id):    return f"runs:{run_id}:stats"
def key_commands(run_id):     return f"stream:commands:{run_id}"
def key_events(run_id):       return f"stream:events:{run_id}"

# ─── Estado del nodo ──────────────────────────────────────────────────────────

class NodeState:
    def __init__(self):
        self.status       = "ACTIVE"   # ACTIVE | PAUSED | DRAINING | DISABLED
        self.active_jobs  = 0
        self.completed_jobs = 0
        self.failed_jobs  = 0
        self.current_chunk_id = None
        self.lock = threading.Lock()

    def set_status(self, new_status: str):
        with self.lock:
            old = self.status
            self.status = new_status
            logger.info(f"[estado] {old} → {new_status}")

    def get_snapshot(self) -> dict:
        with self.lock:
            return {
                "nodeId":         NODE_ID,
                "status":         self.status,
                "priority":       PRIORITY,
                "canBeLeader":    CAN_BE_LEADER,
                "cpuUsage":       get_cpu_usage(),
                "memoryUsage":    get_memory_usage(),
                "concurrency":    CONCURRENCY,
                "activeJobs":     self.active_jobs,
                "completedJobs":  self.completed_jobs,
                "failedJobs":     self.failed_jobs,
                "currentChunkId": self.current_chunk_id,
                "provider":       PROVIDER,
                "timestamp":      int(time.time() * 1000),
            }

# ─── Métricas del sistema ─────────────────────────────────────────────────────

def get_cpu_usage() -> int:
    """Lee CPU% de /proc/stat (solo Linux)."""
    try:
        with open("/proc/stat") as f:
            line = f.readline().split()
        idle1 = int(line[4])
        total1 = sum(int(x) for x in line[1:])
        time.sleep(0.1)
        with open("/proc/stat") as f:
            line = f.readline().split()
        idle2 = int(line[4])
        total2 = sum(int(x) for x in line[1:])
        usage = 100 * (1 - (idle2 - idle1) / (total2 - total1))
        return round(usage)
    except Exception:
        return 0

def get_memory_usage() -> int:
    """Lee memoria de /proc/meminfo (solo Linux)."""
    try:
        info = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                info[parts[0].rstrip(":")] = int(parts[1])
        total = info.get("MemTotal", 1)
        free  = info.get("MemAvailable", total)
        return round(100 * (1 - free / total))
    except Exception:
        return 0

# ─── Control del proceso real de comparación de ADN ──────────────────────────

def find_worker_pids() -> list[int]:
    """Busca los PIDs del proceso de comparación de ADN usando pgrep."""
    if not WORKER_PROCESS:
        return []
    try:
        result = subprocess.run(
            ["pgrep", "-f", WORKER_PROCESS],
            capture_output=True, text=True
        )
        return [int(p) for p in result.stdout.strip().splitlines() if p.strip().isdigit()]
    except Exception as e:
        logger.warning(f"[proceso] No se pudo buscar PIDs: {e}")
        return []

def signal_worker_process(sig: int, action_name: str):
    """Envía una señal a todos los PIDs del proceso worker."""
    if not WORKER_PROCESS:
        logger.info(f"[proceso] WORKER_PROCESS no configurado — solo se actualizó el estado en Redis")
        return

    pids = find_worker_pids()
    if not pids:
        logger.warning(f"[proceso] No se encontraron procesos que coincidan con '{WORKER_PROCESS}'")
        return

    for pid in pids:
        try:
            os.kill(pid, sig)
            logger.info(f"[proceso] {action_name} enviado al PID {pid} ({WORKER_PROCESS})")
        except ProcessLookupError:
            logger.warning(f"[proceso] PID {pid} ya no existe")
        except PermissionError:
            logger.error(f"[proceso] Sin permisos para señalizar PID {pid} — ¿corres como root o el mismo usuario?")



def publish_event(r, severity: str, event_type: str, message: str, chunk_id: str = ""):
    try:
        fields = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity":  severity,
            "eventType": event_type,
            "nodeId":    NODE_ID,
            "chunkId":   chunk_id,
            "message":   message,
        }
        r.xadd(key_events(RUN_ID), fields)
        r.xtrim(key_events(RUN_ID), maxlen=200, approximate=True)
    except Exception as e:
        logger.warning(f"No se pudo publicar evento: {e}")

# ─── Ejecutar comando ─────────────────────────────────────────────────────────

def execute_command(r, command: str, state: NodeState, fields: dict):
    logger.info(f"[comando] Recibido: {command}")

    if command == "pause":
        state.set_status("PAUSED")
        signal_worker_process(signal.SIGSTOP, "SIGSTOP (pausa)")
        publish_event(r, "warning", "node_paused",
                      f"Nodo {NODE_ID} pausado por el dashboard")

    elif command == "resume":
        if state.status in ("PAUSED", "DRAINING"):
            state.set_status("ACTIVE")
            signal_worker_process(signal.SIGCONT, "SIGCONT (reanuda)")
            publish_event(r, "success", "node_resumed",
                          f"Nodo {NODE_ID} reanudado por el dashboard")
        else:
            logger.info(f"[comando] resume ignorado — estado actual: {state.status}")

    elif command == "drain":
        state.set_status("DRAINING")
        # SIGTERM suave: el proceso termina el job actual y no toma nuevos
        # El proceso de ADN debe manejar SIGTERM para completar el chunk actual
        signal_worker_process(signal.SIGTERM, "SIGTERM (drenar)")
        publish_event(r, "warning", "node_draining",
                      f"Nodo {NODE_ID} iniciando drenaje de carga")

    elif command == "disable":
        state.set_status("DISABLED")
        signal_worker_process(signal.SIGKILL, "SIGKILL (deshabilitar)")
        r.srem(key_nodes_active(), NODE_ID)
        publish_event(r, "error", "node_disabled",
                      f"Nodo {NODE_ID} deshabilitado por el dashboard")
        logger.warning("[comando] Nodo deshabilitado. Proceso terminado.")

    elif command == "pause_run":
        if state.status == "ACTIVE":
            state.set_status("PAUSED")
            signal_worker_process(signal.SIGSTOP, "SIGSTOP (pausa por run)")
        publish_event(r, "warning", "run_paused", f"Run {RUN_ID} pausado")

    elif command == "resume_run":
        if state.status == "PAUSED":
            state.set_status("ACTIVE")
            signal_worker_process(signal.SIGCONT, "SIGCONT (reanuda por run)")
        publish_event(r, "success", "run_resumed", f"Run {RUN_ID} reanudado")

    elif command == "cancel_run":
        state.set_status("DISABLED")
        signal_worker_process(signal.SIGKILL, "SIGKILL (cancelar run)")
        r.srem(key_nodes_active(), NODE_ID)
        publish_event(r, "error", "run_cancelled", f"Run {RUN_ID} cancelado")

    elif command in ("retry_failed", "rebuild_output"):
        publish_event(r, "info", f"command_{command}",
                      f"Comando {command} recibido en {NODE_ID}")

    else:
        logger.warning(f"[comando] Desconocido: {command}")

# ─── Thread: Heartbeat ────────────────────────────────────────────────────────

def heartbeat_loop(r, state: NodeState, stop_event: threading.Event):
    logger.info("[heartbeat] Iniciado")
    while not stop_event.is_set():
        try:
            snapshot = state.get_snapshot()
            r.setex(key_node(NODE_ID), HEARTBEAT_TTL, json.dumps(snapshot))
            r.sadd(key_nodes_active(), NODE_ID)
            logger.debug(f"[heartbeat] CPU={snapshot['cpuUsage']}% MEM={snapshot['memoryUsage']}% STATUS={snapshot['status']}")
        except Exception as e:
            logger.error(f"[heartbeat] Error: {e}")
        stop_event.wait(HEARTBEAT_INTERVAL)
    logger.info("[heartbeat] Detenido")

# ─── Thread: Leer comandos ────────────────────────────────────────────────────

def command_loop(r, state: NodeState, stop_event: threading.Event):
    """
    Lee el stream stream:commands:{runId} con XREAD bloqueante.
    Solo procesa comandos dirigidos a este nodo o comandos de run globales.
    """
    logger.info("[comandos] Escuchando stream: " + key_commands(RUN_ID))
    last_id = "$"  # Solo mensajes nuevos desde que arranca el agente

    while not stop_event.is_set():
        try:
            results = r.xread(
                {key_commands(RUN_ID): last_id},
                count=10,
                block=COMMAND_POLL_MS
            )
            if not results:
                continue

            for stream_name, messages in results:
                for msg_id, fields in messages:
                    last_id = msg_id

                    # fields es dict en redis-py v4+
                    cmd_type   = fields.get("type",    "")
                    command    = fields.get("command", "")
                    target_node = fields.get("nodeId", "")

                    # Filtrar: procesar si es para este nodo O si es comando de run global
                    if cmd_type == "worker" and target_node != NODE_ID:
                        logger.debug(f"[comandos] Ignorando comando para {target_node}")
                        continue

                    execute_command(r, command, state, fields)

        except redis_lib.exceptions.ConnectionError as e:
            logger.error(f"[comandos] Conexión perdida: {e}. Reintentando en 5s...")
            stop_event.wait(5)
        except Exception as e:
            logger.error(f"[comandos] Error inesperado: {e}")
            stop_event.wait(1)

    logger.info("[comandos] Detenido")

# ─── Main ─────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker-agent")


def main():
    logger.info(f"Iniciando worker-agent | NODE_ID={NODE_ID} | RUN_ID={RUN_ID} | PROVIDER={PROVIDER}")

    r = redis_lib.from_url(REDIS_URL, decode_responses=True)
    try:
        r.ping()
        logger.info(f"Conectado a Redis: {REDIS_URL}")
    except Exception as e:
        logger.error(f"No se pudo conectar a Redis: {e}")
        raise SystemExit(1)

    state = NodeState()
    stop_event = threading.Event()

    # Manejar Ctrl+C / SIGTERM limpiamente
    def shutdown(signum, frame):
        logger.info("Señal de apagado recibida. Cerrando...")
        state.set_status("DEAD")
        try:
            r.srem(key_nodes_active(), NODE_ID)
            publish_event(r, "warning", "node_shutdown",
                          f"Nodo {NODE_ID} apagado normalmente")
        except Exception:
            pass
        stop_event.set()

    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Publicar evento de inicio
    publish_event(r, "info", "node_started",
                  f"Nodo {NODE_ID} ({PROVIDER}) conectado al cluster")

    # Lanzar threads
    hb_thread  = threading.Thread(target=heartbeat_loop,  args=(r, state, stop_event), daemon=True)
    cmd_thread = threading.Thread(target=command_loop,    args=(r, state, stop_event), daemon=True)

    hb_thread.start()
    cmd_thread.start()

    logger.info("Agente corriendo. Presiona Ctrl+C para detener.")
    stop_event.wait()

    hb_thread.join(timeout=5)
    cmd_thread.join(timeout=5)
    logger.info("Agente detenido.")


if __name__ == "__main__":
    main()
