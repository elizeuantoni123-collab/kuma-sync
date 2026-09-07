"""Cliente Socket.IO para o Uptime Kuma."""

import socketio; import logging; logging.basicConfig(level=logging.DEBUG)
import threading
import time
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Timeout padrao para operacoes Socket.IO (segundos)
DEFAULT_TIMEOUT = 15


class KumaClientError(Exception):
    """Erro generico do cliente Kuma."""


class KumaClient:
    """
    Cliente Socket.IO de baixo nivel para o Uptime Kuma.
    Conecta, autentica e expoe metodos para listar/criar/editar monitores.
    """

    def __init__(self, url: str, username: str, password: str, timeout: int = DEFAULT_TIMEOUT):
        self.url = url.rstrip("/")
        self.username = username
        self.password = password
        self.timeout = timeout

        self._sio = socketio.Client(logger=False, engineio_logger=False)
        self._connected = threading.Event()
        self._authenticated = threading.Event()
        self._monitors: Dict[int, Dict] = {}
        self._monitors_ready = threading.Event()
        self._auth_ok: bool = False
        self._auth_error: Optional[str] = None

        self._setup_handlers()

    def _setup_handlers(self):
        sio = self._sio

        @sio.on("connect")
        def on_connect():
            logger.debug("Socket.IO conectado")
            self._connected.set()

        @sio.on("disconnect")
        def on_disconnect():
            logger.debug("Socket.IO desconectado")

        @sio.on("monitorList")
        def on_monitor_list(data):
            if isinstance(data, dict):
                self._monitors = data
            elif isinstance(data, list):
                self._monitors = {m["id"]: m for m in data if "id" in m}
            else:
                self._monitors = {}
            logger.debug("monitorList recebido: %d monitores", len(self._monitors))
            self._monitors_ready.set()

    def connect(self):
        """Conecta ao servidor e realiza login."""
        try:
            self._sio.connect(
                self.url,
                transports=["websocket"],
                wait_timeout=self.timeout,
            )
        except Exception as e:
            raise KumaClientError(f"Falha ao conectar em {self.url}: {e}") from e

        if not self._connected.wait(timeout=self.timeout):
            raise KumaClientError(f"Timeout ao conectar em {self.url}")

        self._login()
        self._wait_for_monitors()

    def _login(self):
        """Autentica via evento login do Socket.IO."""
        result_container = {}
        event = threading.Event()

        def on_result(result):
            result_container["result"] = result
            event.set()

        self._sio.emit(
            "login",
            {"username": self.username, "password": self.password, "token": ""},
            callback=on_result,
        )

        if not event.wait(timeout=self.timeout):
            raise KumaClientError("Timeout ao aguardar resposta de login")

        result = result_container.get("result", {})
        if isinstance(result, dict):
            ok = result.get("ok", False)
            msg = result.get("msg", "")
        else:
            ok = False
            msg = str(result)

        if not ok:
            raise KumaClientError(f"Falha de autenticacao: {msg}")

        logger.debug("Login bem-sucedido")

    def _wait_for_monitors(self):
        """Aguarda o evento monitorList chegar apos o login."""
        if not self._monitors_ready.wait(timeout=self.timeout):
            logger.warning("monitorList nao chegou no timeout — lista pode estar vazia")

    def disconnect(self):
        """Desconecta do servidor."""
        try:
            self._sio.disconnect()
        except Exception:
            pass

    def get_monitors(self) -> List[Dict[str, Any]]:
        """Retorna lista de monitores existentes."""
        return list(self._monitors.values())

    def add_monitor(self, monitor_data: Dict[str, Any]) -> Dict[str, Any]:
        """Cria um novo monitor. Retorna a resposta do servidor."""
        result_container = {}
        event = threading.Event()

        def on_result(*args):
            result_container["result"] = args[0] if args else {}
            event.set()

        self._sio.emit("add", monitor_data, callback=on_result)

        if not event.wait(timeout=self.timeout):
            raise KumaClientError("Timeout ao criar monitor")

        result = result_container.get("result", {})
        if isinstance(result, dict) and not result.get("ok", True):
            raise KumaClientError(f"Erro ao criar monitor: {result.get('msg', result)}")

        return result

    def edit_monitor(self, monitor_id: int, monitor_data: Dict[str, Any]) -> Dict[str, Any]:
        """Edita um monitor existente. Retorna a resposta do servidor."""
        result_container = {}
        event = threading.Event()

        def on_result(*args):
            result_container["result"] = args[0] if args else {}
            event.set()

        payload = dict(monitor_data)
        payload["id"] = monitor_id
        self._sio.emit("editMonitor", payload, callback=on_result)

        if not event.wait(timeout=self.timeout):
            raise KumaClientError("Timeout ao editar monitor")

        result = result_container.get("result", {})
        if isinstance(result, dict) and not result.get("ok", True):
            raise KumaClientError(f"Erro ao editar monitor: {result.get('msg', result)}")

        return result

    def delete_monitor(self, monitor_id: int) -> Dict[str, Any]:
        """Remove um monitor existente."""
        result_container = {}
        event = threading.Event()

        def on_result(*args):
            result_container["result"] = args[0] if args else {}
            event.set()

        self._sio.emit("deleteMonitor", monitor_id, callback=on_result)

        if not event.wait(timeout=self.timeout):
            raise KumaClientError("Timeout ao remover monitor")

        result = result_container.get("result", {})
        return result

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *args):
        self.disconnect()


