import os
import sys
import time
import socket
import json
import threading
import redis

class ScrumConnector:
    def __init__(self, instance_id=None):
        self.host = os.getenv("REDIS_HOST", "localhost")
        if self.host == "redis_server":
            try:
                socket.gethostbyname("redis_server")
            except socket.gaierror:
                self.host = "localhost"
        self.port = int(os.getenv("REDIS_PORT", 6379))
        self.password = os.getenv("REDIS_PASSWORD", "Elian2020#")
        
        # Generar ID único de instancia si no se provee
        if not instance_id:
            hostname = socket.gethostname()
            pid = os.getpid()
            self.instance_id = f"scrum_{hostname}_{pid}_{int(time.time())}"
        else:
            self.instance_id = instance_id
            
        self.redis_client = None
        self.is_master = False
        self.heartbeat_active = True
        self.heartbeat_thread = None
        self.local_rate_limits = {}

    def connect(self):
        try:
            self.redis_client = redis.Redis(
                host=self.host,
                port=self.port,
                password=self.password,
                decode_responses=True,
                socket_timeout=5
            )
            self.redis_client.ping()
            print(f"[🔌 Redis]: Conectado a Redis en {self.host}:{self.port} con éxito.")
            return True
        except Exception as e:
            # If the configured host failed and is a Docker-only hostname, retry with localhost
            if self.host != "localhost" and self.host != "127.0.0.1":
                print(f"[🔌 Redis] WARN: No se pudo conectar a '{self.host}:{self.port}' ({e}). Reintentando con localhost...")
                try:
                    self.host = "localhost"
                    self.redis_client = redis.Redis(
                        host=self.host,
                        port=self.port,
                        password=self.password,
                        decode_responses=True,
                        socket_timeout=5
                    )
                    self.redis_client.ping()
                    print(f"[🔌 Redis]: Conectado a Redis en localhost:{self.port} con éxito (fallback).")
                    return True
                except Exception as e2:
                    print(f"[🔌 Redis] ERROR: Tampoco se pudo conectar a localhost:{self.port}: {e2}")
                    self.redis_client = None
                    return False
            print(f"[🔌 Redis] ERROR: No se pudo conectar a Redis en {self.host}:{self.port}: {e}")
            self.redis_client = None
            return False

    def elect_master(self):
        """
        Intenta elegir a esta instancia como MASTER.
        Retorna True si gana el rol, False si queda como WORKER.
        """
        try:
            # SET scrum:master instance_id EX 30 NX -> adquiere el rol con lease de 30s
            acquired = self.redis_client.set("scrum:master", self.instance_id, ex=30, nx=True)
            if acquired:
                self.is_master = True
                print(f"\n👑 [Scrum Master]: ¡Esta instancia ({self.instance_id}) ha sido elegida como MASTER!")
                # Remover de workers en caso de que estuviera registrado antes
                self.redis_client.srem("scrum:workers", self.instance_id)
            else:
                self.is_master = False
                current_master = self.redis_client.get("scrum:master")
                print(f"\n👷 [Worker]: Registrado como WORKER. El MASTER actual es: {current_master}")
                self.redis_client.sadd("scrum:workers", self.instance_id)
                self.publish_event("worker_connected", f"Worker {self.instance_id} se ha conectado.")
                
            # Iniciar hilo de latido (heartbeat) y renovación
            self.start_heartbeat()
            return self.is_master
        except Exception as e:
            print(f"[!] Error al elegir Master: {e}")
            return False

    def start_heartbeat(self):
        self.heartbeat_active = True
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()

    def _heartbeat_loop(self):
        """
        Bucle secundario que mantiene los leases vivos tanto para el Master como para los Workers.
        """
        while self.heartbeat_active:
            try:
                # 1. Registrar latido individual con TTL de 20 segundos
                self.redis_client.set(f"scrum:heartbeat:{self.instance_id}", "alive", ex=20)
                
                # 2. Si es Master, renovar el lock de liderazgo en Redis
                if self.is_master:
                    # Usar EVAL/Lua script para renovar el lock solo si aún somos el dueño legítimo
                    lua_renew = """
                    if redis.call('get', KEYS[1]) == ARGV[1] then
                        return redis.call('expire', KEYS[1], 30)
                    else
                        return 0
                    end
                    """
                    renewed = self.redis_client.eval(lua_renew, 1, "scrum:master", self.instance_id)
                    if not renewed:
                        print("\n⚠️ [Scrum Master]: ¡Se ha perdido el liderazgo Master!")
                        self.is_master = False
                        self.redis_client.sadd("scrum:workers", self.instance_id)
                else:
                    # Si es Worker, asegurarse de que sigue listado en el set
                    self.redis_client.sadd("scrum:workers", self.instance_id)
                    
            except Exception as e:
                # Silent failure recovery
                pass
                
            time.sleep(10)

    def shutdown(self):
        self.heartbeat_active = False
        try:
            if self.redis_client:
                # Quitarse de la lista de workers
                self.redis_client.srem("scrum:workers", self.instance_id)
                self.redis_client.delete(f"scrum:heartbeat:{self.instance_id}")
                if self.is_master:
                    # Liberar el Master si somos nosotros
                    current_master = self.redis_client.get("scrum:master")
                    if current_master == self.instance_id:
                        self.redis_client.delete("scrum:master")
                print(f"[🔌 Redis]: Instancia {self.instance_id} desconectada limpiamente.")
        except Exception as e:
            print(f"[!] Error al apagar conector: {e}")

    # ── Task Queueing ───────────────────────────────────────────────────────

    def send_task(self, worker_id: str, task_id: str, blockers: list = None) -> bool:
        """
        Coloca una tarea en la cola privada de un Worker específico.

        Si `blockers` es una lista no vacía de issue keys que aún no están
        cerrados, la tarea se aparca en Redis (scrum:blocked:<task_id>) y NO
        se encola. Cuando cada blocker termine, _unblock_dependents() la
        re-evaluará y la encolará automáticamente.

        :param worker_id: ID del worker destino.
        :param task_id:   Issue key de Jira (ej. "CLOUD-322").
        :param blockers:  Lista de issue keys que bloquean a task_id (opcional).
        :return: True si la tarea fue encolada, False si fue bloqueada o hubo error.
        """
        if blockers:
            self.redis_client.set(
                f"scrum:blocked:{task_id}",
                json.dumps(blockers),
                ex=86400  # Expira en 24 h para no acumular basura
            )
            print(
                f"⏸️  [Dependencias]: Tarea {task_id} BLOQUEADA por {blockers}. "
                f"Se encolará automáticamente cuando sus bloqueadores terminen."
            )
            return False

        try:
            # Lock de tarea → worker (12 h)
            self.redis_client.set(f"scrum:task:{task_id}", worker_id, ex=43200)
            self.redis_client.lpush(f"scrum:queue:{worker_id}", task_id)
            print(f"[👑 Master]: Tarea {task_id} asignada y encolada para {worker_id}.")
            return True
        except Exception as e:
            print(f"[!] Error al enviar tarea a {worker_id}: {e}")
            return False

    def _unblock_dependents(self, completed_task_id: str):
        """
        Debe llamarse cada vez que una tarea se completa (Done).
        Recorre todas las tareas actualmente bloqueadas y elimina
        `completed_task_id` de su lista de blockers.

        Cuando la lista de una tarea queda vacía significa que ya no tiene
        impedimentos: se elige el worker menos cargado y se encola.

        :param completed_task_id: Issue key que acaba de cerrarse (ej. "CLOUD-321").
        """
        if not self.redis_client:
            return
        try:
            for redis_key in self.redis_client.scan_iter("scrum:blocked:*"):
                task_id = redis_key.split(":")[-1]
                raw = self.redis_client.get(redis_key)
                if not raw:
                    continue

                blockers: list = json.loads(raw)
                if completed_task_id not in blockers:
                    continue

                # Eliminar el blocker recién completado
                blockers.remove(completed_task_id)

                if not blockers:
                    # ── Tarea completamente desbloqueada ─────────────────
                    self.redis_client.delete(redis_key)
                    target_worker = self._pick_least_busy_worker()
                    if target_worker:
                        self.send_task(target_worker, task_id)
                        print(
                            f"✅ [Dependencias]: Tarea {task_id} desbloqueada "
                            f"→ encolada en worker {target_worker}."
                        )
                    else:
                        # Sin workers disponibles: marcar como pendiente para el Master
                        self.redis_client.set(
                            f"scrum:unblocked_pending:{task_id}", "1", ex=86400
                        )
                        print(
                            f"✅ [Dependencias]: Tarea {task_id} desbloqueada "
                            f"pero no hay workers disponibles. Se procesará localmente."
                        )
                else:
                    # Aún quedan otros blockers → actualizar la lista
                    self.redis_client.set(redis_key, json.dumps(blockers), ex=86400)
                    print(
                        f"⏸️  [Dependencias]: Tarea {task_id} aún bloqueada por {blockers}."
                    )
        except Exception as e:
            print(f"[!] Error en _unblock_dependents para '{completed_task_id}': {e}")

    def _pick_least_busy_worker(self) -> str:
        """
        Devuelve el ID del worker activo con menos tareas en cola.
        Retorna None si no hay workers activos.
        """
        if not self.redis_client:
            return None
        try:
            workers = list(self.redis_client.smembers("scrum:workers"))
            active = [w for w in workers if self.redis_client.get(f"scrum:heartbeat:{w}")]
            if not active:
                return None
            return min(
                active,
                key=lambda w: self.redis_client.llen(f"scrum:queue:{w}")
            )
        except Exception:
            return None

    def get_task(self):
        """
        Polleo bloqueante de la cola privada del Worker.
        """
        try:
            # brpop devuelve una tupla (nombre_cola, valor)
            result = self.redis_client.brpop(f"scrum:queue:{self.instance_id}", timeout=5)
            if result:
                return result[1] # Devuelve el task_id
            return None
        except Exception as e:
            # Ignorar timeouts de red normales
            return None

    # ── Pub/Sub and Event Monitoring ────────────────────────────────────────

    def publish_event(self, event_type, message, task_id=None):
        """
        Publica un evento para ser escuchado por el Master y otras terminales en tiempo real.
        """
        try:
            payload = {
                "instance_id": self.instance_id,
                "event_type": event_type,
                "message": message,
                "task_id": task_id,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            self.redis_client.publish("scrum:events", json.dumps(payload))
        except Exception as e:
            print(f"[!] Error al publicar evento: {e}")

    def update_task_status(self, task_id, status, details=""):
        """
        Actualiza el estado síncrono de un ticket y lo publica en Pub/Sub.
        """
        try:
            key = f"scrum:status:{task_id}"
            self.redis_client.hset(key, mapping={
                "status": status,
                "worker": self.instance_id,
                "details": details,
                "last_update": time.strftime("%Y-%m-%d %H:%M:%S")
            })
            self.redis_client.expire(key, 86400) # Expira en 24 horas
            self.publish_event("task_progress", f"[{status}] {details}", task_id=task_id)

            # ── Auto-desbloqueo de dependientes al completar ──────────
            # Si la tarea pasó a Done/Finalizada, notificar a tareas dependientes
            DONE_STATUSES = {
                "done", "finalizada", "finalizado", "completada", "completado",
                "terminada", "terminado", "closed", "cerrada", "cerrado",
                "finalizada", "finalizado",
            }
            if status.lower() in DONE_STATUSES:
                self._unblock_dependents(task_id)

        except Exception as e:
            print(f"[!] Error al actualizar estado de tarea {task_id}: {e}")

    # ── Self-Healing and Cleaning ───────────────────────────────────────────

    def heal_workers_and_tasks(self):
        """
        Vigila los Workers registrados y re-encola las tareas de aquellos cuyos latidos expiraron.
        Sólo debe ser corrido periódicamente por el MASTER.
        """
        if not self.is_master:
            return
            
        try:
            # Asegurarse de que el Master no esté listado en workers
            if self.redis_client.sismember("scrum:workers", self.instance_id):
                self.redis_client.srem("scrum:workers", self.instance_id)
                
            # 1. Obtener todos los workers registrados y limpiar los caídos de la lista
            workers = self.redis_client.smembers("scrum:workers")
            for w_id in list(workers):
                alive = self.redis_client.get(f"scrum:heartbeat:{w_id}")
                if not alive:
                    print(f"\n🚨 [👑 Master]: Se ha detectado caída del Worker {w_id} (sin heartbeat). Limpiando de la lista de activos...")
                    self.redis_client.srem("scrum:workers", w_id)
            
            # 2. Buscar TODOS los locks de tareas y verificar si su poseedor está vivo (tiene heartbeat)
            for k in self.redis_client.scan_iter("scrum:task:*"):
                assigned_worker = self.redis_client.get(k)
                if assigned_worker:
                    alive = self.redis_client.get(f"scrum:heartbeat:{assigned_worker}")
                    if not alive:
                        task_id = k.split(":")[-1]
                        print(f"🚨 [👑 Master]: Tarea {task_id} estaba asignada al worker inactivo {assigned_worker}. Liberando lock y estado...")
                        self.redis_client.delete(k)
                        self.redis_client.delete(f"scrum:status:{task_id}")

            # 3. Recuperar tareas desbloqueadas pendientes de encolar
            for k in self.redis_client.scan_iter("scrum:unblocked_pending:*"):
                task_id = k.split(":")[-1]
                target_worker = self._pick_least_busy_worker()
                if target_worker:
                    self.redis_client.delete(k)
                    self.send_task(target_worker, task_id)
                    print(f"♻️  [Dependencias]: Tarea {task_id} (antes desbloqueada sin workers) encolada en {target_worker}.")

        except Exception as e:
            print(f"[!] Error en auto-curación de workers: {e}")

    def rebalance_tasks(self):
        """
        Realiza el balanceo dinámico de tareas (work-stealing) entre los Workers activos.
        Si un Worker tiene 0 tareas asignadas y otro tiene >= 2, se roba una tarea de la cola
        del sobrecargado y se asigna al inactivo.
        Garantiza que todos los workers activos tengan al menos una tarea si hay suficientes.
        """
        if not self.is_master:
            return

        try:
            # Obtener todos los workers del Set
            workers = list(self.redis_client.smembers("scrum:workers"))
            # Filtrar solo por workers activos con latido vigente
            active_workers = [w for w in workers if self.redis_client.get(f"scrum:heartbeat:{w}")]
            
            if not active_workers:
                return

            print(f"[👑 Master - Balanceador]: Analizando carga de {len(active_workers)} workers activos...")

            # Bucle de rebalanceo iterativo
            while True:
                worker_tasks = {}
                for w_id in active_workers:
                    queued_tasks = self.redis_client.lrange(f"scrum:queue:{w_id}", 0, -1) or []
                    active_t = self.redis_client.get(f"scrum:active_task:{w_id}")
                    worker_tasks[w_id] = {
                        "queued": queued_tasks,
                        "active": active_t,
                        "total_count": len(queued_tasks) + (1 if active_t else 0)
                    }

                # Buscar si hay algún worker con 0 tareas
                idle_worker = next((w for w, info in worker_tasks.items() if info["total_count"] == 0), None)
                if not idle_worker:
                    break

                # Buscar al worker con más tareas asignadas
                busy_worker = max(worker_tasks.keys(), key=lambda w: worker_tasks[w]["total_count"])
                
                if worker_tasks[busy_worker]["total_count"] < 2:
                    break

                # Robar una tarea de la cola del busy_worker
                stolen_task = self.redis_client.rpop(f"scrum:queue:{busy_worker}")
                if stolen_task:
                    self.redis_client.lpush(f"scrum:queue:{idle_worker}", stolen_task)
                    self.redis_client.set(f"scrum:task:{stolen_task}", idle_worker, ex=43200)
                    self.update_task_status(stolen_task, "Reasignada", f"Reasignada automáticamente de {busy_worker} a {idle_worker}")
                    self.publish_event(
                        "task_rebalanced", 
                        f"Tarea {stolen_task} reasignada por balanceo desde {busy_worker} a {idle_worker}.",
                        task_id=stolen_task
                    )
                    print(f"[👑 Master - Balanceador]: Tarea {stolen_task} robada exitosamente de {busy_worker} y asignada a {idle_worker}.")
                else:
                    break
        except Exception as e:
            print(f"[!] Error al rebalancear tareas: {e}")

    def get_healthy_api_key(self, current_key=None, mark_rate_limited=False):
        """
        Retorna una clave de OpenRouter saludable del pool que no haya alcanzado el límite.
        Si mark_rate_limited=True, registra 'current_key' como limitada en Redis por 12 horas.
        """
        import os
        import json
        
        # Primero intentar cargar de keys_pool.json local
        keys = []
        base_dir = os.path.dirname(os.path.abspath(__file__))
        pool_json_path = os.path.join(base_dir, "keys_pool.json")
        if os.path.exists(pool_json_path):
            try:
                with open(pool_json_path, "r", encoding="utf-8") as f:
                    pool_data = json.load(f)
                    keys = [k.strip() for k in pool_data.get("keys", []) if k.strip()]
            except Exception as e:
                print(f"[!] Error leyendo pool JSON: {e}")
                
        # Fallback al string de variables de entorno si no hay keys en el JSON
        if not keys:
            pool_str = os.getenv("SCRUM_TEAM_OPENROUTER_KEY") or os.getenv("OPENROUTER_KEYS_POOL") or os.getenv("OPENROUTER_API_KEY")
            if pool_str:
                keys = [k.strip() for k in pool_str.split(",") if k.strip()]
                
        if not keys:
            return None

        if not hasattr(self, 'local_rate_limits'):
            self.local_rate_limits = {}
            
        try:
            # 1. Si se reportó un rate limit, registrar la clave como limitada
            if mark_rate_limited and current_key:
                import time
                expiry = time.time() + 43200 # 12 horas
                self.local_rate_limits[current_key] = expiry
                if self.redis_client:
                    try:
                        self.redis_client.set(f"scrum:rate_limit:{current_key}", "limited", ex=43200)
                        print(f"⚠️ [Balanceador]: Registrado rate limit para la clave ...{current_key[-8:]} en Redis.")
                    except Exception:
                        pass
                else:
                    print(f"⚠️ [Balanceador - Standalone]: Registrado rate limit para la clave ...{current_key[-8:]} en memoria local.")
                    
            # 2. Filtrar el pool obteniendo solo las claves saludables
            healthy_keys = []
            import time
            now = time.time()
            for k in keys:
                is_limited = False
                if k in self.local_rate_limits:
                    if now < self.local_rate_limits[k]:
                        is_limited = True
                    else:
                        del self.local_rate_limits[k]
                
                if not is_limited and self.redis_client:
                    try:
                        res = self.redis_client.get(f"scrum:rate_limit:{k}")
                        if res:
                            is_limited = True
                    except Exception:
                        pass
                        
                if not is_limited:
                    healthy_keys.append(k)
                    
            if not healthy_keys:
                print("🚨 [Balanceador] ADVERTENCIA: Todas las claves del pool han alcanzado su límite. Reseteando límites locales para evitar bloqueo.")
                self.local_rate_limits.clear()
                return keys[0]
                
            # 3. Obtener el índice para balanceo
            try:
                if self.redis_client:
                    workers = list(self.redis_client.smembers("scrum:workers"))
                    active_workers = sorted([w for w in workers if self.redis_client.get(f"scrum:heartbeat:{w}")])
                    if self.instance_id not in active_workers:
                        active_workers.append(self.instance_id)
                        active_workers.sort()
                    index = active_workers.index(self.instance_id)
                else:
                    index = 0
            except Exception:
                index = 0
                
            if current_key in healthy_keys and len(healthy_keys) > 1:
                return current_key
                
            assigned_key = healthy_keys[index % len(healthy_keys)]
            return assigned_key
        except Exception as e:
            print(f"[!] Error al obtener clave saludable: {e}")
            return keys[0]
