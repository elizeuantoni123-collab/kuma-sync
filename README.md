# kuma-sync

> **kuma-sync é para o Uptime Kuma o que um app de banco é para o banco: um programa separado que conversa com o sistema através de uma interface, sem alterar o sistema em si.**

---

## O que este projeto É — e o que NÃO é

**kuma-sync É:**
- Uma ferramenta de linha de comando independente que gerencia monitores no [Uptime Kuma](https://github.com/louislam/uptime-kuma) de forma declarativa (via arquivo YAML).
- Um *cliente externo* que se conecta ao Uptime Kuma usando o mesmo protocolo Socket.IO que o navegador usa para falar com o painel — sem modificar nenhum arquivo do Uptime Kuma.

**kuma-sync NÃO é:**
- Uma versão modificada do Uptime Kuma.
- Um fork ou derivado do Uptime Kuma.
- Um plugin ou extensão instalada dentro do Uptime Kuma.

Não há nenhum código do Uptime Kuma neste repositório.

---

## O problema que este projeto resolve

O Uptime Kuma não tem uma API oficial documentada para gerenciar monitores programaticamente. Sem essa ferramenta, as alternativas são:

- Clicar manualmente na interface web para criar/editar cada monitor (inviável em escala).
- Scripts caseiros improvisados ou planilhas sem garantia de idempotência.

O kuma-sync traz a abordagem **declarativa**: você descreve o estado desejado em um arquivo YAML, e a ferramenta calcula e aplica apenas as diferenças — igual ao que o Terraform faz para infraestrutura.

---

## Como funciona por dentro

1. O arquivo `config.yaml` declara o estado desejado dos monitores.
2. A ferramenta se conecta via Socket.IO na instância do Uptime Kuma (HTTP ou HTTPS).
3. Lê a lista de monitores existentes diretamente do servidor.
4. Compara o estado desejado com o existente (lógica de diff por nome).
5. Aplica **apenas as diferenças**: cria o que falta, atualiza o que mudou, (opcionalmente) remove o que não está mais no YAML.

> O cliente Socket.IO foi implementado diretamente neste projeto (`kuma_sync/client.py`), sem depender de bibliotecas não-oficiais de terceiros. Usa a biblioteca padrão `python-socketio`.

---

## ⚠️ Avisos de segurança importantes

- **Nunca faça commit do `.env` ou `config.yaml` com dados reais de clientes.** Ambos estão no `.gitignore` por padrão — verifique sempre com `git status` antes de fazer push.
- **Nunca ative o modo DEBUG das bibliotecas `socketio`/`engineio` em produção.** Esse modo expõe credenciais de login em texto puro nos logs. O `client.py` desabilita esses loggers explicitamente (`logger=False, engineio_logger=False`).

---

## Limitações conhecidas

- Depende do protocolo interno do Uptime Kuma (Socket.IO), que **não é uma API pública oficialmente documentada**. Atualizações de versão do Uptime Kuma podem exigir ajustes em `client.py`. Testado e validado com Uptime Kuma v1.23.x e v2.5.x.
- **Tipos de monitor totalmente suportados:** `http`, `tcp`/`port`, `ping`, `dns`, `keyword`. Outros tipos (Docker, MQTT, PostgreSQL, etc.) ainda não têm payload completo implementado — contribuições são bem-vindas.
- Testado localmente (`http://localhost`) e via túnel HTTPS (ngrok). **Ainda não validado em produção contra uma VPS com domínio próprio** — recomenda-se fazer esse teste antes do primeiro cliente real.

---

## Instalação

```bash
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## Configuração

### 1. Credenciais (`.env`)

```bash
cp .env.example .env
```

Edite `.env` com seu usuário e senha do Uptime Kuma:

```
KUMA_USERNAME=admin
KUMA_PASSWORD=sua_senha
```

### 2. Monitores (`config.yaml`)

```bash
cp config.example.yaml config.yaml
```

Edite `config.yaml`:

```yaml
client: "Minha Empresa"
instance_url: "https://kuma.minhaempresa.com"

monitors:
  - name: "Site Principal"
    type: http
    url: "https://minhaempresa.com"
    interval: 60

  - name: "Banco de Dados"
    type: tcp
    hostname: "db.minhaempresa.com"
    port: 5432
    interval: 60
```

---

## Uso

### Ver o que seria alterado (seguro, não muda nada):

```bash
python -m kuma_sync.cli plan config.yaml
```

### Aplicar as mudanças:

```bash
python -m kuma_sync.cli apply config.yaml
```

### Aplicar sem confirmação (para automação/cron):

```bash
python -m kuma_sync.cli apply config.yaml --yes
```

### Permitir remoção de monitores ausentes no YAML:

Por padrão, monitores existentes no Kuma mas ausentes no YAML **não são removidos** (exige flag explícita para segurança):

```bash
python -m kuma_sync.cli apply config.yaml --yes --allow-remove
```

---

## Tipos de monitor suportados

| `type` no YAML | Tipo no Kuma      | Campos extras obrigatórios |
|----------------|-------------------|---------------------------|
| `http`         | HTTP(s)           | `url`                     |
| `ping`         | Ping              | `hostname`                |
| `tcp`          | TCP Port          | `hostname`, `port`        |
| `dns`          | DNS               | `hostname`                |
| `keyword`      | HTTP(s) - Keyword | `url`, `keyword`          |

---

## Campos suportados por monitor

| Campo            | Tipo   | Padrão | Descrição                              |
|------------------|--------|--------|----------------------------------------|
| `name`           | string | —      | **Obrigatório.** Nome único do monitor |
| `type`           | string | `http` | Tipo do monitor                        |
| `url`            | string | —      | URL a monitorar (tipo http/keyword)    |
| `hostname`       | string | —      | Hostname (tipo ping, tcp, dns)         |
| `port`           | int    | `80`   | Porta (tipo tcp)                       |
| `interval`       | int    | `60`   | Intervalo em segundos                  |
| `retry_interval` | int    | `60`   | Intervalo entre tentativas             |
| `max_retries`    | int    | `0`    | Máximo de tentativas antes de alertar  |
| `method`         | string | `GET`  | Método HTTP                            |
| `keyword`        | string | —      | Palavra-chave (tipo keyword)           |
| `active`         | bool   | `true` | Monitor ativo ou pausado               |
| `description`    | string | —      | Descrição opcional                     |

---

## Idempotência

O `plan` e o `apply` são idempotentes: rodar de novo sem mudanças no YAML não altera nada no Kuma. Ideal para uso em cron jobs.

---

## Licença

MIT
