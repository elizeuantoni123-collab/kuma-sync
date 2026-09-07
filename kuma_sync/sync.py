"""Logica de diff e sincronizacao de monitores."""

from typing import Any, Dict, List, Tuple

# Campos comparados para todos os tipos
BASE_COMPARABLE_FIELDS = [
    "name", "type", "interval", "retryInterval", "maxretries",
    "active", "description",
]

# Campos extras comparados por tipo
TYPE_COMPARABLE_FIELDS = {
    "http":     ["url", "method", "keyword", "invertKeyword"],
    "keyword":  ["url", "method", "keyword", "invertKeyword"],
    "ping":     ["hostname"],
    "port":     ["hostname", "port"],
    "tcp":      ["hostname", "port"],
    "dns":      ["hostname", "dns_resolve_server", "dns_resolve_type"],
    "push":     [],
}

TYPE_MAP = {
    "http":     "http",
    "https":    "http",
    "ping":     "ping",
    "tcp":      "port",
    "port":     "port",
    "dns":      "dns",
    "keyword":  "keyword",
    "json-query": "json-query",
    "push":     "push",
}


def _kuma_type(config_type: str) -> str:
    return TYPE_MAP.get(config_type.lower(), config_type.lower())


def _normalize_existing(monitor: Dict[str, Any]) -> Dict[str, Any]:
    """Normaliza um monitor recebido da API do Kuma para comparacao."""
    mtype = monitor.get("type", "http")
    norm = {
        "name":          monitor.get("name", ""),
        "type":          mtype,
        "url":           monitor.get("url", "") or "",
        "interval":      int(monitor.get("interval", 60)),
        "retryInterval": int(monitor.get("retryInterval", 60)),
        "maxretries":    int(monitor.get("maxretries", 0)),
        "method":        (monitor.get("method") or "GET").upper(),
        "keyword":       monitor.get("keyword", "") or "",
        "invertKeyword": bool(monitor.get("invertKeyword", False)),
        "active":        bool(monitor.get("active", True)),
        "description":   monitor.get("description", "") or "",
        "hostname":      monitor.get("hostname", "") or "",
        "port":          int(monitor.get("port", 80) or 80),
        "dns_resolve_server": monitor.get("dns_resolve_server", "1.1.1.1") or "1.1.1.1",
        "dns_resolve_type":   monitor.get("dns_resolve_type", "A") or "A",
    }
    return norm


def _get_comparable_fields(mtype: str) -> List[str]:
    """Retorna os campos a comparar para um determinado tipo de monitor."""
    extra = TYPE_COMPARABLE_FIELDS.get(mtype, ["url"])
    return BASE_COMPARABLE_FIELDS + extra


def _monitors_differ(desired: Dict[str, Any], existing: Dict[str, Any]) -> bool:
    norm_existing = _normalize_existing(existing)
    mtype = _kuma_type(desired.get("type", "http"))
    fields = _get_comparable_fields(mtype)

    for field in fields:
        d_val = desired.get(field)
        e_val = norm_existing.get(field)

        # Normaliza tipo
        if field == "type":
            d_val = _kuma_type(str(d_val or "http"))
            e_val = _kuma_type(str(e_val or "http"))

        # Normaliza port para int
        if field == "port":
            try:
                d_val = int(d_val or 80)
                e_val = int(e_val or 80)
            except (ValueError, TypeError):
                pass

        if d_val != e_val:
            return True
    return False


def build_plan(
    desired_monitors: List[Dict[str, Any]],
    existing_monitors: List[Dict[str, Any]],
) -> Dict[str, Any]:
    existing_by_name: Dict[str, Dict] = {m["name"]: m for m in existing_monitors}
    desired_names = {m["name"] for m in desired_monitors}

    to_create = []
    to_update = []
    to_delete = []

    for desired in desired_monitors:
        name = desired["name"]
        if name not in existing_by_name:
            to_create.append(desired)
        else:
            existing = existing_by_name[name]
            if _monitors_differ(desired, existing):
                to_update.append((desired, existing))

    for existing in existing_monitors:
        if existing["name"] not in desired_names:
            to_delete.append(existing)

    return {
        "create": to_create,
        "update": to_update,
        "delete": to_delete,
    }


def build_kuma_payload(monitor: Dict[str, Any]) -> Dict[str, Any]:
    """Converte um monitor normalizado para o payload esperado pela API do Kuma v1."""
    monitor_type = _kuma_type(monitor.get("type", "http"))

    payload: Dict[str, Any] = {
        "type":              monitor_type,
        "name":              monitor["name"],
        "interval":          monitor.get("interval", 60),
        "retryInterval":     monitor.get("retryInterval", 60),
        "maxretries":        monitor.get("maxretries", 0),
        "conditions":        [],
        "active":            monitor.get("active", True),
        "description":       monitor.get("description", "") or "",
        "notificationIDList": {},
        "ignoreTls":         False,
        "upsideDown":        False,
        "packetSize":        56,
        "expiryNotification": False,
        "maxredirects":      10,
        "accepted_statuscodes": ["200-299"],
        "dns_resolve_type":  "A",
        "dns_resolve_server": "1.1.1.1",
        "dns_last_result":   None,
        "port":              443,
        "weight":            2000,
        "parent":            None,
    }

    if monitor_type == "http":
        payload["url"]           = monitor.get("url", "")
        payload["method"]        = monitor.get("method", "GET").upper()
        payload["keyword"]       = monitor.get("keyword", "") or ""
        payload["invertKeyword"] = monitor.get("invertKeyword", False)
        payload["body"]          = ""
        payload["headers"]       = ""

    elif monitor_type == "keyword":
        payload["url"]           = monitor.get("url", "")
        payload["method"]        = monitor.get("method", "GET").upper()
        payload["keyword"]       = monitor.get("keyword", "")
        payload["invertKeyword"] = monitor.get("invertKeyword", False)

    elif monitor_type == "ping":
        payload["hostname"] = monitor.get("hostname", monitor.get("url", ""))

    elif monitor_type == "port":
        payload["hostname"] = monitor.get("hostname", "")
        payload["port"]     = int(monitor.get("port", 80))

    elif monitor_type == "dns":
        payload["hostname"]          = monitor.get("hostname", "")
        payload["dns_resolve_server"] = monitor.get("dns_resolve_server", "1.1.1.1")
        payload["dns_resolve_type"]   = monitor.get("dns_resolve_type", "A")

    return payload

