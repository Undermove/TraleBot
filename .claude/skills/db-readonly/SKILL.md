---
name: db-readonly
description: Read-only access to TraleBot prod Postgres via kubectl port-forward + psql under the agent_ro role. Use this when you need to look up real production data (user counts, achievements, quiz stats, retention etc.) for analytics or debugging. SELECTs only — INSERT/UPDATE/DELETE will fail with a read-only transaction error by design.
---

# db-readonly

Read-only канал в продовую Postgres TraleBot для Claude Code агентов.

## Когда использовать

- Аналитика: «сколько у нас юзеров», «какие квизы популярны», retention, конверсии, и т.п.
- Дебаг прода: посмотреть состояние конкретной записи (юзер, ачивка, payment).
- Любой read-only запрос про реальные данные, который нельзя достоверно ответить из кода или тестов.

НЕ использовать для миграций, обновлений, тестовых вставок — даже если очень хочется. Канал технически блокирует запись.

## Как использовать (после one-time setup, см. ниже)

```bash
.claude/skills/db-readonly/query.sh 'SELECT count(*) FROM "Users"'
```

Скрипт сам:
1. Находит свободный локальный порт начиная с 5433 (если 5433 занят — например локальным docker-postgres другого проекта — берёт 5434, 5435, …). Это важно: на занятый порт kubectl не забиндится, а psql молча ушёл бы в ЧУЖУЮ базу и упал с `password authentication failed for user agent_ro`.
2. Поднимает `kubectl port-forward pod/postgres-0 <порт>:5432 -n tralebot-prod` под service-account'ом `agent-readonly` (RBAC разрешает port-forward ТОЛЬКО до postgres-0, больше никуда).
3. Ждёт строку `Forwarding from …` в логе kubectl — то есть готовности ИМЕННО нашего туннеля (проверка по `nc` ненадёжна: посторонний слушатель на том же порту обманул бы её).
4. Запускает `psql -h localhost -p <порт> -U agent_ro -d tralebot_db -c "<твой SQL>"` — пароль подхватывается из `~/.pgpass` автоматически.
5. Убивает port-forward в trap'е (любой выход — нормальный или с ошибкой — закрывает туннель).

Многострочные запросы — заключай в одинарные кавычки. Внутри SQL — двойные кавычки для имён таблиц/колонок в PascalCase (например `"Users"`), потому что они так созданы EF Core'ом и без кавычек Postgres приведёт их к нижнему регистру.

Пример:

```bash
.claude/skills/db-readonly/query.sh 'SELECT "TelegramId", "Username", "CreatedAt" FROM "Users" ORDER BY "CreatedAt" DESC LIMIT 10'
```

## Что нельзя

- **Write-операции** (`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`) — падают с `cannot execute ... in a read-only transaction`. Это by design: роль `agent_ro` имеет `default_transaction_read_only = on`.
- **Port-forward к другим подам кластера** — RBAC запрещает (`resourceNames: ["postgres-0"]` в Role).
- **Использовать admin kubeconfig** для этих запросов — он даёт cluster-admin, что и не нужно, и опасно если случайно попадёт в логи/память агента.

## One-time setup на новой машине

Если ты на свежем компе и хочешь чтобы скилл заработал:

### 1. Установить psql клиент

```bash
brew install libpq
echo 'export PATH="/usr/local/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
psql --version  # должна показать 18+
```

### 2. Получить kubeconfig под agent-readonly

Нужен админский доступ к microk8s кластеру TraleBot (см. в PrivateNotes «Как настроен деплой для тралебота» — там лежит admin kubeconfig). С ним:

```bash
# Извлекаем токен и CA из Secret который workflow создал
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[].cluster.server}')
CA_B64=$(kubectl get secret agent-readonly-token -n tralebot-prod -o jsonpath='{.data.ca\.crt}')
TOKEN=$(kubectl get secret agent-readonly-token -n tralebot-prod -o jsonpath='{.data.token}' | base64 -d)

mkdir -p ~/.kube
cat > ~/.kube/tralebot-readonly.conf <<EOF
apiVersion: v1
kind: Config
clusters:
  - name: microk8s
    cluster:
      server: ${SERVER}
      certificate-authority-data: ${CA_B64}
contexts:
  - name: agent-readonly@microk8s
    context:
      cluster: microk8s
      user: agent-readonly
      namespace: tralebot-prod
current-context: agent-readonly@microk8s
users:
  - name: agent-readonly
    user:
      token: ${TOKEN}
EOF
chmod 600 ~/.kube/tralebot-readonly.conf
```

Если Secret `agent-readonly-token` ещё не создан — workflow `Deploy Database to Kubernetes` должен был его создать. Если нет — см. `deploy/agent-rbac.yml` и `deploy/postgres-bootstrap.yml`.

### 3. Положить пароль в ~/.pgpass

Пароль `agent_ro` хранится в твоём 1Password как `TraleBot · agent_ro · prod` (или похоже — см. свою заметку «Как сгенерить пароль для read-only юзера agent_ro» в PrivateNotes).

Порт в записи — `*` (а не конкретный 5433), потому что скрипт может выбрать другой свободный порт, и пароль должен подхватываться независимо от него:

```bash
echo "localhost:*:tralebot_db:agent_ro:<ПАРОЛЬ_ИЗ_1PASSWORD>" > ~/.pgpass
chmod 600 ~/.pgpass
```

### 4. Проверить что всё работает

```bash
.claude/skills/db-readonly/query.sh 'SELECT current_user, current_database()'
```

Должно показать `agent_ro | tralebot_db`. Если показало — всё на месте, скилл готов.

## Дебаг

- `cat /tmp/tralebot-pgpf.log` — последний лог port-forward, если что-то не поднимается
- `KUBECONFIG=~/.kube/tralebot-readonly.conf kubectl auth whoami` — kubeconfig жив?
- `psql --version` — psql в PATH?
- `ls -la ~/.pgpass` — права должны быть `-rw-------` (600), иначе psql его проигнорирует
- `kubectl get secret agent-readonly-token -n tralebot-prod` — Secret в кластере существует?

## Кастомизация

Переменные окружения для переопределения дефолтов (если тебе нужно подключиться к другому кластеру/окружению):

- `TRALEBOT_KUBECONFIG` — путь к kubeconfig (default `~/.kube/tralebot-readonly.conf`)
- `TRALEBOT_NAMESPACE` — namespace в кластере (default `tralebot-prod`)
- `TRALEBOT_POD` — имя пода (default `postgres-0`)
- `TRALEBOT_DB` — имя БД (default `tralebot_db`)
- `TRALEBOT_DB_USER` — имя юзера для psql (default `agent_ro`)
- `TRALEBOT_LOCAL_PORT` — стартовый локальный порт для port-forward (default `5433`); если занят, скрипт сам инкрементит до первого свободного
