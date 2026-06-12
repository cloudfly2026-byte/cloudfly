import threading
import uvicorn
from fastapi import FastAPI, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter
import structlog
from src.kafka_handler import KafkaHandler

structlog.configure()
logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter('storefront_builder_processed_total', 'Total processed storefront builder requests', ['status'])

app = FastAPI(title="CloudFly AI Storefront Constructor Crew")
kafka_handler = None

@app.get("/health")
def health():
    return {"status": "UP"}

@app.get("/ready")
def ready():
    # Simple check: verify if we can connect to MySQL
    from src.database import engine
    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        return {"status": "READY"}
    except Exception as e:
        return Response(content=f"Database down: {str(e)}", status_code=503)

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

def run_kafka_consumer():
    global kafka_handler
    kafka_handler = KafkaHandler()
    try:
        kafka_handler.start()
    except Exception as e:
        logger.error("Kafka consumer crashed", error=str(e))

@app.on_event("startup")
def startup_event():
    # Create missing tables automatically
    try:
        from src.database import engine, Base
        import src.models
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize database tables", error=str(e))

    # Start Kafka consumer thread
    t = threading.Thread(target=run_kafka_consumer, daemon=True)
    t.start()
    logger.info("Background Kafka consumer thread started")

    # Start Model Health Worker background thread
    try:
        from src.model_health_worker import start_daemon_worker, run_health_check_cycle
        logger.info("Initializing Model Health Checker synchronously...")
        run_health_check_cycle()
        start_daemon_worker()
    except Exception as e:
        logger.error("Failed to start Model Health Checker", error=str(e))

@app.on_event("shutdown")
def shutdown_event():
    global kafka_handler
    if kafka_handler:
        kafka_handler.stop()
        logger.info("Kafka consumer stopped")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
