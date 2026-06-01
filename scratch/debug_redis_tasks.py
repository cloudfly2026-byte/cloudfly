import redis
import os
from dotenv import load_dotenv

load_dotenv("c:/apps/cloudfly/.env")
redis_host = os.getenv("REDIS_HOST", "localhost")
if redis_host == "redis_server":
    redis_host = "localhost"

redis_password = os.getenv("REDIS_PASSWORD", "Elian2020#")

r = redis.Redis(host=redis_host, port=6379, password=redis_password, decode_responses=True)

try:
    master = r.get("scrum:master")
    print("scrum:master:", master)
    if master:
        print(f"Master heartbeat: {r.get(f'scrum:heartbeat:{master}')}")
    
    print("--- Workers ---")
    workers = list(r.smembers("scrum:workers"))
    for w in workers:
        print(f"Worker {w} heartbeat: {r.get(f'scrum:heartbeat:{w}')}")
        print(f"Worker {w} queue length: {r.llen(f'scrum:queue:{w}')}")
        print(f"Worker {w} active task: {r.get(f'scrum:active_task:{w}')}")
        
    print("--- Tasks ---")
    for key in r.keys("scrum:task:*"):
        print(f"{key} -> {r.get(key)}")
except Exception as e:
    print(f"Error: {e}")
