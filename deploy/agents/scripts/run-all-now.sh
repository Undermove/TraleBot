#!/bin/bash
# Прогнать всех агентов последовательно — для тестирования
# Usage: docker exec bombora-agents /scripts/run-all-now.sh

set -e

echo "============================================"
echo "  Тестовый прогон всех агентов"
echo "  $(date)"
echo "============================================"

for agent in product designer developer tech-lead; do
    echo ""
    echo ">>> Запускаю ${agent}..."
    /scripts/run-agent.sh "${agent}"
    echo ">>> ${agent} завершён"
    echo ""
done

echo "============================================"
echo "  Все агенты отработали"
echo "  $(date)"
echo "============================================"
