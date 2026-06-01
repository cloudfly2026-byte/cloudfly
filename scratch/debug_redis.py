import redis
import os
from dotenv import load_dotenv

load_dotenv("c:/apps/cloudfly/.env")
redis_host = os.getenv("REDIS_HOST", "localhost")
if redis_host == "redis_server":
    redis_host = "localhost"

redis_password = os.getenv("REDIS_PASSWORD", "Elian2020#")

print(f"Connecting to Redis at {redis_host} with password...")
r = redis.Redis(host=redis_host, port=6379, password=redis_password, decode_responses=True)

try:
    master = r.get("scrum:master")
    print(f"Master key: {master}")
    
    workers = list(r.smembers("scrum:workers"))
    print(f"Workers in scrum:workers set: {workers}")
    
    for w in workers:
        hb = r.get(f"scrum:heartbeat:{w}")
        print(f"Heartbeat for {w}: {hb}")
        
    all_keys = r.keys("scrum:*")
    print(f"All scrum keys: {all_keys}")
except Exception as e:
    print(f"Error querying Redis: {e}")
