"""CLI principal do kuma-sync."""

import sys
import click

from kuma_sync.config import load_env, get_credentials, load_config, normalize_monitor
from kuma_sync.client import KumaClient, KumaClientError
from kuma_sync.sync import build_plan, build_kuma_payload


def _load_all(config_path: str):
    """Carrega env, credenciais e config. Retorna (config, username, password)."""
    load_env()
    username, password = get_credentials()
    config = load_config(config_path)
    return config, username, password


def _get_client_and_plan(config_path: str, allow_remove: bool):
    """Conecta ao Kuma e calcula o plano. Retorna (client, plan, config)."""
    config, username, password = _load_all(config_path)
    instance_url = config["instance_url"]
    desired = [normalize_monitor(m) for m in config["monitors"]]

    client = KumaClient(instance_url, username, password)
    client.connect()
    existing = client.get_monitors()
    plan = build_plan(desired, existing)

    if not allow_remove and plan["delete"]:
        click.secho(f"  [Aviso] {len(plan['delete'])} monitores seriam removidos, mas --allow-remove nao foi passado. Eles serao ignorados.", fg="yellow")
        plan["delete"] = []
        
    return client, plan, config


def _print_plan(plan: dict, config: dict):
    """Exibe o resumo do plano no terminal."""
    client_name = config.get("client", "")
    instance_url = config.get("instance_url", "")

    label = f"'{client_name}'" if client_name else ""
    click.echo(f"\nPlano para {label} ({instance_url}):")
    click.echo(f"  Criar:     {len(plan['create'])}")
    for m in plan["create"]:
        click.echo(f"    + {m['name']} ({m['type']})")
    click.echo(f"  Atualizar: {len(plan['update'])}")
    for desired, existing in plan["update"]:
        click.echo(f"    ~ {desired['name']}")
    click.echo(f"  Remover:   {len(plan['delete'])}")
    for m in plan["delete"]:
        click.echo(f"    - {m['name']}")
    click.echo()


@click.group()
def cli():
    """kuma-sync: gerenciamento declarativo de monitores no Uptime Kuma."""
    pass


@cli.command()
@click.argument("config_path", default="config.yaml", metavar="CONFIG")
@click.option("--allow-remove", is_flag=True, help="Mostra a remocao de monitores que nao estao no yaml.")
def plan(config_path: str, allow_remove: bool):
    """Mostra o que seria alterado sem aplicar nenhuma mudanca."""
    try:
        client, plan_result, config = _get_client_and_plan(config_path, allow_remove)
        client.disconnect()
        _print_plan(plan_result, config)
    except Exception as e:
        click.echo(f"Erro inesperado: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument("config_path", default="config.yaml", metavar="CONFIG")
@click.option("--yes", "-y", is_flag=True, help="Nao pede confirmacao")
@click.option("--allow-remove", is_flag=True, help="Permite a remocao de monitores que nao estao no yaml.")
def apply(config_path: str, yes: bool, allow_remove: bool):
    """Aplica as mudancas no Uptime Kuma."""
    try:
        client, plan_result, config = _get_client_and_plan(config_path, allow_remove)

        total_changes = (
            len(plan_result["create"])
            + len(plan_result["update"])
            + len(plan_result["delete"])
        )

        if total_changes == 0:
            click.echo("Nenhuma mudanca necessaria. Tudo ja esta em sincronia.")
            client.disconnect()
            return

        _print_plan(plan_result, config)

        if not yes:
            if not click.confirm("Aplicar essas mudancas?"):
                click.echo("Operacao cancelada.")
                client.disconnect()
                return

        instance_url = config.get("instance_url", "")
        client_name = config.get("client", "")
        label = f"'{client_name}'" if client_name else ""
        click.echo(f"Aplicando mudancas para {label} ({instance_url}):")

        # Criar
        for desired in plan_result["create"]:
            payload = build_kuma_payload(desired)
            result = client.add_monitor(payload)
            click.echo(f"  [criado] {desired['name']} -> {result}")

        # Atualizar
        for desired, existing in plan_result["update"]:
            monitor_id = existing.get("id")
            if monitor_id is None:
                continue
            payload = build_kuma_payload(desired)
            result = client.edit_monitor(int(monitor_id), payload)
            click.echo(f"  [atualizado] {desired['name']} -> {result}")

        # Remover
        for existing in plan_result["delete"]:
            monitor_id = existing.get("id")
            if monitor_id is None:
                continue
            result = client.delete_monitor(int(monitor_id))
            click.echo(f"  [removido] {existing.get('name')} -> {result}")

        click.echo("Concluido.")
        client.disconnect()

    except Exception as e:
        click.echo(f"Erro inesperado: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    cli()
