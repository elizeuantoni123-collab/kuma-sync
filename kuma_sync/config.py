"""Carregamento de configuracao: arquivo YAML e credenciais via .env."""

import os
import yaml
from pathlib import Path
from typing import Any, Dict


def load_env(env_path: str = ".env") -> None:
    """Carrega variaveis do arquivo .env no ambiente de processo."""
    env_file = Path(env_path)
    if not env_file.exists():
        return
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)


def get_credentials() -> tuple:
    """Retorna (username, password) a partir das variaveis de ambiente."""
    username = os.environ.get("KUMA_USERNAME", "").strip()
    password = os.environ.get("KUMA_PASSWORD", "").strip()
    if not username or not password:
        raise ValueError(
            "Credenciais nao encontradas. "
            "Defina KUMA_USERNAME e KUMA_PASSWORD no arquivo .env."
        )
    return username, password


def load_config(config_path: str) -> dict:
    """Carrega e valida o arquivo de configuracao YAML."""
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo de configuracao nao encontrado: {config_path}")

    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict):
        raise ValueError("Arquivo de configuracao invalido: deve ser um mapeamento YAML.")

    if "instance_url" not in data:
        raise ValueError("Campo obrigatorio 'instance_url' ausente na configuracao.")

    if "monitors" not in data or not isinstance(data["monitors"], list):
        raise ValueError("Campo obrigatorio 'monitors' ausente ou invalido na configuracao.")

    for i, monitor in enumerate(data["monitors"]):
        if "name" not in monitor:
            raise ValueError(f"Monitor #{i+1} nao tem campo 'name'.")
        if "type" not in monitor:
            raise ValueError(f"Monitor '{monitor.get('name', f'#{i+1}')}' nao tem campo 'type'.")

    return data


def normalize_monitor(monitor: dict) -> dict:
    """Normaliza um monitor do config.yaml para o formato interno."""
    mtype = monitor.get("type", "http").lower()

    normalized = {
        "name": monitor["name"],
        "type": mtype,
        "url": monitor.get("url", ""),
        "interval": int(monitor.get("interval", 60)),
        "retryInterval": int(monitor.get("retry_interval", monitor.get("retryInterval", 60))),
        "maxretries": int(monitor.get("max_retries", monitor.get("maxretries", 0))),
        "method": monitor.get("method", "GET").upper(),
        "keyword": monitor.get("keyword", ""),
        "invertKeyword": bool(monitor.get("invert_keyword", monitor.get("invertKeyword", False))),
        "active": bool(monitor.get("active", True)),
        "description": monitor.get("description", ""),
    }

    # Tipos que usam hostname em vez de url
    if mtype in ("ping", "tcp", "port"):
        normalized["hostname"] = str(monitor.get("hostname", monitor.get("url", "")))
        normalized["port"] = int(monitor.get("port", 80))

    # DNS também usa hostname
    if mtype == "dns":
        normalized["hostname"] = str(monitor.get("hostname", monitor.get("url", "")))
        normalized["dns_resolve_server"] = str(monitor.get("dns_resolve_server", "1.1.1.1"))
        normalized["dns_resolve_type"] = str(monitor.get("dns_resolve_type", "A"))

    return normalized
