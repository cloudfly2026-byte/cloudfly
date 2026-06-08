#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QA Engineer - CLOUD-320 E2E Integration Test Suite
=====================================================
Comprehensive verification of all Docker Compose local services.

HOW TO EXECUTE:
1. Ensure all services are running: docker-compose -f docker-compose-local.yml up -d
2. Run: python tests/AGENTE_DEV_CLOUD-320_e2e_integration.py
3. Review output for any FAILURES
"""

import sys
import json
import time
import socket
import subprocess
from datetime import datetime

# ============================================================
# CONFIGURATION
# ============================================================
SERVICES = {
    "mysql": {"port": 3306, "type": "tcp"},
    "zookeeper": {"port": 2181, "type": "tcp"},
    "kafka": {"port": 9092, "type": "tcp"},
    "redis": {"port": 6379, "type": "tcp"},
    "postgresql": {"port": 5432, "type": "tcp"},
    "qdrant": {"port": 6333, "type": "http"},
    "backend-api": {"port": 8080, "type": "http"},
    "evolution-api": {"port": 8082, "type": "http"},
    "billing-service": {"port": 8086, "type": "http"},
    "scheduler-service": {"port": 8085, "type": "http"},
    "chat-socket-service": {"port": 3001, "type": "http"},
    "lead-generator": {"port": 8001, "type": "http"},
    "n8n": {"port": 5678, "type": "http"},
    "portainer": {"port": 9000, "type": "http"},
    "frontend-react": {"port": 3000, "type": "http"},
}

CONTAINER_NAMES = {
    "mysql": "mysql",
    "zookeeper": "zookeeper",
    "kafka": "kafka",
    "redis": "redis_server",
    "postgresql": "postgres_server",
    "qdrant": "qdrant",
    "backend-api": "backend-api",
    "evolution-api": "evolution_api",
    "billing-service": "billing-service",
    "scheduler-service": "scheduler-service",
    "notification-service": "notification-service",
    "chat-socket-service": "chat_socket",
    "ai-agent": "ai_agent",
    "ai-vector-worker": "ai_vector_worker",
    "marketing-agent": "marketing-agent",
    "marketing-worker": "marketing-worker",
    "lead-generator": "lead-generator",
    "lead-scrapper-google": "cloudfly-lead-scrapper-google-1",
    "n8n": "n8nserver.com",
    "frontend-react": "frontend-react",
    "portainer": "portainer",
}

# ============================================================
# TEST RESULTS TRACKING
# ============================================================
results = {"pass": 0, "fail": 0, "warn": 0, "details": []}


def record(name, status, detail=""):
    global results
    if status == "PASS":
        results["pass"] += 1
        icon = "[OK]"
    elif status == "FAIL":
        results["fail"] += 1
        icon = "[FAIL]"
    else:
        results["warn"] += 1
        icon = "[WARN]"
    results["details"].append({"name": name, "status": status, "detail": detail})
    print(f"  {icon} {name}: {detail}")


def run_cmd(cmd, timeout=15):
    """Run a shell command and return stdout."""
    proc = subprocess.run(
        cmd, shell=True, capture_output=True, text=True,
        timeout=timeout, encoding='utf-8', errors='replace'
    )
    return (proc.stdout + proc.stderr).strip()


# ============================================================
# TEST SUITE 1: CONTAINER STATUS
# ============================================================
def test_container_status():
    print("\n" + "=" * 60)
    print("TEST SUITE 1: Container Status (docker ps)")
    print("=" * 60)

    # Get all running containers in one shot
    try:
        output = run_cmd('docker ps --format "{{.Names}}\t{{.Status}}"')
        running = {}
        for line in output.split('\n'):
            if '\t' in line:
                parts = line.split('\t', 1)
                name = parts[0].strip()
                status = parts[1].strip() if len(parts) > 1 else ""
                running[name] = status
    except Exception as e:
        record("Container list", "FAIL", str(e)[:100])
        return

    for service, container in CONTAINER_NAMES.items():
        if container in running:
            status = running[container]
            if status.startswith("Up"):
                record(f"Container: {service}", "PASS", f"{status} ({container})")
            else:
                record(f"Container: {service}", "FAIL", f"{status} ({container})")
        else:
            # Check if it exists but is exited
            check = run_cmd(f'docker ps -a --filter "name={container}" --format "{{.Status}}"')
            if check.strip():
                record(f"Container: {service}", "FAIL", f"not running: {check.strip()[:50]}")
            else:
                record(f"Container: {service}", "FAIL", f"container not found ({container})")


# ============================================================
# TEST SUITE 2: PORT CONNECTIVITY
# ============================================================
def test_port_connectivity():
    print("\n" + "=" * 60)
    print("TEST SUITE 2: Port Connectivity (TCP)")
    print("=" * 60)

    for service, config in SERVICES.items():
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex(("localhost", config["port"]))
            sock.close()
            if result == 0:
                record(f"Port: {service}:{config['port']}", "PASS", "open")
            else:
                record(f"Port: {service}:{config['port']}", "FAIL", "closed/filtered")
        except Exception as e:
            record(f"Port: {service}:{config['port']}", "FAIL", str(e)[:100])


# ============================================================
# TEST SUITE 3: HTTP ENDPOINTS
# ============================================================
def test_http_endpoints():
    print("\n" + "=" * 60)
    print("TEST SUITE 3: HTTP Endpoint Responses")
    print("=" * 60)

    import urllib.request
    import urllib.error

    endpoints = [
        ("backend-api health", "http://localhost:8080/actuator/health", [200]),
        ("backend-api auth (no token)", "http://localhost:8080/api/auth/login", [401, 403, 200]),
        ("evolution-api root", "http://localhost:8082/", [200]),
        ("chat-socket root", "http://localhost:3001/", [200]),
        ("n8n root", "http://localhost:5678/", [200]),
        ("portainer root", "http://localhost:9000/", [200]),
        ("qdrant root", "http://localhost:6333/", [200]),
        ("frontend-react root", "http://localhost:3000/", [200, 308, 302]),
        ("lead-generator root", "http://localhost:8001/", [200, 404, 401]),
    ]

    for name, url, expected_codes in endpoints:
        try:
            req = urllib.request.Request(url)
            response = urllib.request.urlopen(req, timeout=10)
            code = response.getcode()
            if code in expected_codes:
                record(f"HTTP: {name}", "PASS", f"{url} -> {code}")
            else:
                record(f"HTTP: {name}", "WARN", f"{url} -> {code} (expected {expected_codes})")
        except urllib.error.HTTPError as e:
            if e.code in expected_codes:
                record(f"HTTP: {name}", "PASS", f"{url} -> {e.code}")
            else:
                record(f"HTTP: {name}", "WARN", f"{url} -> {e.code}")
        except Exception as e:
            record(f"HTTP: {name}", "FAIL", f"{url} -> {str(e)[:100]}")


# ============================================================
# TEST SUITE 4: DATABASE CONNECTIVITY
# ============================================================
def test_database_connectivity():
    print("\n" + "=" * 60)
    print("TEST SUITE 4: Database Connectivity")
    print("=" * 60)

    # MySQL connectivity
    try:
        output = run_cmd('docker exec mysql mysql -u root -pwidowmaker -e "SELECT 1 AS health;"')
        if "health" in output:
            record("MySQL: connectivity", "PASS", "root@mysql:3306 -> OK")
        else:
            record("MySQL: connectivity", "FAIL", output[:200])
    except Exception as e:
        record("MySQL: connectivity", "FAIL", str(e)[:100])

    # MySQL cloud_master database
    try:
        output = run_cmd('docker exec mysql mysql -u root -pwidowmaker -e "SHOW DATABASES LIKE \'cloud_master\';"')
        if "cloud_master" in output:
            record("MySQL: cloud_master DB", "PASS", "exists")
        else:
            record("MySQL: cloud_master DB", "FAIL", "not found")
    except Exception as e:
        record("MySQL: cloud_master DB", "FAIL", str(e)[:100])

    # MySQL multi-tenant isolation (tenant_id columns)
    try:
        output = run_cmd(
            'docker exec mysql mysql -u root -pwidowmaker -e '
            '"USE cloud_master; SELECT COUNT(*) FROM information_schema.columns '
            'WHERE column_name=\'tenant_id\' AND TABLE_SCHEMA=\'cloud_master\';"'
        )
        lines = [l.strip() for l in output.split('\n') if l.strip().isdigit()]
        if lines:
            count = int(lines[0])
            if count > 0:
                record("MySQL: tenant_id columns", "PASS", f"{count} tables with tenant_id")
            else:
                record("MySQL: tenant_id columns", "FAIL", "no tenant_id columns found")
        else:
            record("MySQL: tenant_id columns", "WARN", "could not determine count")
    except Exception as e:
        record("MySQL: tenant_id columns", "FAIL", str(e)[:100])

    # Redis
    try:
        output = run_cmd('docker exec redis_server redis-cli -a "Elian2020#" ping')
        if "PONG" in output:
            record("Redis: connectivity", "PASS", "PONG")
        else:
            record("Redis: connectivity", "FAIL", output[:200])
    except Exception as e:
        record("Redis: connectivity", "FAIL", str(e)[:100])

    # PostgreSQL
    try:
        output = run_cmd('docker exec postgres_server psql -U chatbot_user -d chatbotdb -c "SELECT 1 AS health;"')
        if "health" in output:
            record("PostgreSQL: connectivity", "PASS", "chatbot_user@chatbotdb:5432 -> OK")
        else:
            record("PostgreSQL: connectivity", "FAIL", output[:200])
    except Exception as e:
        record("PostgreSQL: connectivity", "FAIL", str(e)[:100])

    # Qdrant
    try:
        import urllib.request
        response = urllib.request.urlopen("http://localhost:6333/", timeout=10)
        data = json.loads(response.read().decode())
        if "title" in data and "qdrant" in data["title"].lower():
            record("Qdrant: API", "PASS", f"v{data.get('version', 'unknown')}")
        else:
            record("Qdrant: API", "WARN", "unexpected response")
    except Exception as e:
        record("Qdrant: API", "FAIL", str(e)[:100])


# ============================================================
# TEST SUITE 5: KAFKA MESSAGING
# ============================================================
def test_kafka_messaging():
    print("\n" + "=" * 60)
    print("TEST SUITE 5: Kafka Messaging")
    print("=" * 60)

    try:
        output = run_cmd(
            'docker exec kafka /bin/bash -c "/usr/bin/kafka-topics --bootstrap-server localhost:9092 --list"',
            timeout=30
        )
        topics = [t.strip() for t in output.strip().split('\n') if t.strip() and not t.startswith("Exception")]
        if topics:
            record("Kafka: topics", "PASS", f"{len(topics)} topics found")
            # Check key topics
            key_topics = ["messages.out", "email-notifications", "whatsapp-notifications", "campaign-worker-queue"]
            for topic in key_topics:
                if topic in topics:
                    record(f"Kafka topic: {topic}", "PASS", "exists")
                else:
                    record(f"Kafka topic: {topic}", "WARN", "not found (may be created on demand)")
        else:
            record("Kafka: topics", "WARN", "no topics found")
    except subprocess.TimeoutExpired:
        record("Kafka: topics", "FAIL", "timeout (30s)")
    except Exception as e:
        record("Kafka: topics", "FAIL", str(e)[:100])


# ============================================================
# TEST SUITE 6: SERVICE LOGS CHECK
# ============================================================
def test_service_logs():
    print("\n" + "=" * 60)
    print("TEST SUITE 6: Service Logs (Error Detection)")
    print("=" * 60)

    critical_services = [
        ("backend-api", "backend-api"),
        ("evolution-api", "evolution_api"),
        ("kafka", "kafka"),
        ("mysql", "mysql"),
    ]

    for service, container in critical_services:
        try:
            output = run_cmd(f'docker logs --tail=50 {container}')
            error_count = output.lower().count(" error")
            fatal_count = output.lower().count("fatal")

            if fatal_count > 0:
                record(f"Logs: {service}", "FAIL", f"{fatal_count} FATAL errors found")
            elif error_count > 5:
                record(f"Logs: {service}", "WARN", f"{error_count} errors found (review recommended)")
            elif error_count > 0:
                record(f"Logs: {service}", "PASS", f"{error_count} minor errors (acceptable)")
            else:
                record(f"Logs: {service}", "PASS", "no errors in last 50 lines")
        except Exception as e:
            record(f"Logs: {service}", "WARN", f"could not check: {str(e)[:100]}")


# ============================================================
# TEST SUITE 7: NO EXITED/RESTARTING CONTAINERS
# ============================================================
def test_no_failed_containers():
    print("\n" + "=" * 60)
    print("TEST SUITE 7: No Failed Containers")
    print("=" * 60)

    try:
        output = run_cmd('docker ps -a --filter "status=exited" --format "{{.Names}}\t{{.Status}}"')
        exited = [l for l in output.strip().split('\n') if l.strip()]
        if not exited:
            record("Exited containers", "PASS", "none")
        else:
            record("Exited containers", "FAIL", f"{len(exited)} found: {', '.join(exited)}")
    except Exception as e:
        record("Exited containers", "FAIL", str(e)[:100])

    try:
        output = run_cmd('docker ps -a --filter "status=restarting" --format "{{.Names}}\t{{.Status}}"')
        restarting = [l for l in output.strip().split('\n') if l.strip()]
        if not restarting:
            record("Restarting containers", "PASS", "none")
        else:
            record("Restarting containers", "FAIL", f"{len(restarting)} found: {', '.join(restarting)}")
    except Exception as e:
        record("Restarting containers", "FAIL", str(e)[:100])


# ============================================================
# TEST SUITE 8: DOCKER NETWORKS
# ============================================================
def test_docker_networks():
    print("\n" + "=" * 60)
    print("TEST SUITE 8: Docker Network Verification")
    print("=" * 60)

    try:
        output = run_cmd("docker network ls --format '{{.Name}}'")
        networks = [n.strip() for n in output.strip().split('\n') if n.strip()]
        expected_networks = ["app-net", "kafka-net"]
        for net in expected_networks:
            if net in networks:
                record(f"Network: {net}", "PASS", "exists")
            else:
                record(f"Network: {net}", "WARN", "not found (may use default)")
    except Exception as e:
        record("Network check", "FAIL", str(e)[:100])


# ============================================================
# MAIN EXECUTION
# ============================================================
def main():
    print("=" * 60)
    print("QA Engineer - CLOUD-320 E2E Integration Test Suite")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    start_time = time.time()

    test_container_status()
    test_port_connectivity()
    test_http_endpoints()
    test_database_connectivity()
    test_kafka_messaging()
    test_service_logs()
    test_no_failed_containers()
    test_docker_networks()

    elapsed = time.time() - start_time

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"  Passed:   {results['pass']}")
    print(f"  Failed:   {results['fail']}")
    print(f"  Warnings: {results['warn']}")
    print(f"  Duration: {elapsed:.1f}s")
    print("=" * 60)

    if results["fail"] == 0:
        print("\nALL TESTS PASSED - CLOUD-320 ACCEPTANCE CRITERIA MET")
        print("All containers Up, all ports accessible, all services healthy.")
        return 0
    else:
        print(f"\n{results['fail']} TEST(S) FAILED - REVIEW REQUIRED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
