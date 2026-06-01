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
    print("--- Cleaning up orphaned task locks ---")
    keys_to_delete = ["scrum:task:CLOUD-248", "scrum:task:CLOUD-209", "scrum:status:CLOUD-248", "scrum:status:CLOUD-209"]
    for key in keys_to_delete:
        if r.exists(key):
            r.delete(key)
            print(f"Deleted key: {key}")
    print("Done cleaning!")
except Exception as e:
    print(f"Error: {e}")
