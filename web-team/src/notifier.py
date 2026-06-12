import uuid
import requests
import json
import structlog
from confluent_kafka import Producer
from src.config import settings

logger = structlog.get_logger()

# Kafka producer init
try:
    kafka_conf = {
        'bootstrap.servers': settings.KAFKA_BROKER,
        'client.id': 'storefront-notifier'
    }
    kafka_producer = Producer(kafka_conf)
except Exception as e:
    logger.error("Failed to initialize Kafka producer for notifier", error=str(e))
    kafka_producer = None

class Notifier:
    @staticmethod
    def notify_web(db_session, tenant_id: int, company_id: int, user_id: int | None, title: str, description: str):
        """
        Creates a web notification, persists it to MySQL, and broadcasts it in real-time via Socket.io.
        """
        notification_uuid = str(uuid.uuid4())
        
        # 1. Persist in MySQL web_notifications table
        try:
            from sqlalchemy import text
            db_session.execute(
                text(
                    "INSERT INTO web_notifications (uuid, tenant_id, user_id, title, description, status) "
                    "VALUES (:uuid, :tenant_id, :user_id, :title, :description, 'UNREAD')"
                ),
                {
                    "uuid": notification_uuid,
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "title": title,
                    "description": description
                }
            )
            db_session.commit()
            logger.info("Notification persisted in MySQL", uuid=notification_uuid)
        except Exception as e:
            logger.error("Failed to persist notification in MySQL", error=str(e))
            db_session.rollback()

        # 2. Broadcast via chat-socket-service HTTP endpoint
        try:
            payload = {
                "uuid": notification_uuid,
                "tenantId": tenant_id,
                "companyId": company_id,
                "userId": user_id,
                "title": title,
                "description": description,
                "type": "web"
            }
            headers = {
                "Content-Type": "application/json",
                "x-api-secret": "cambia_esta_llave_para_n8n" # Matched N8N_SECRET_KEY in .env
            }
            url = f"{settings.CHAT_SOCKET_URL}/api/notify/web-notification"
            r = requests.post(url, json=payload, headers=headers, timeout=5)
            if r.status_code == 200:
                logger.info("Real-time notification broadcasted via socket-service", uuid=notification_uuid)
            else:
                logger.warn("Socket-service returned non-200 code for notification", status=r.status_code, text=r.text)
        except Exception as e:
            logger.error("Failed to broadcast real-time notification", error=str(e))

    @staticmethod
    def notify_whatsapp(tenant_id: int, company_id: int, phone: str, message: str):
        """
        Publishes a WhatsApp notification payload to the `whatsapp-notifications` Kafka topic.
        """
        if not kafka_producer:
            logger.error("Kafka producer not active, skipping WhatsApp notification")
            return
            
        try:
            payload = {
                "tenantId": tenant_id,
                "companyId": company_id,
                "phones": [phone],
                "body": message,
                "type": "TEXT",
                "notifyVia": "whatsapp"
            }
            
            kafka_producer.produce(
                'whatsapp-notifications',
                key=str(tenant_id),
                value=json.dumps(payload, ensure_ascii=False)
            )
            kafka_producer.flush()
            logger.info("WhatsApp notification published to Kafka topic 'whatsapp-notifications'", phone=phone)
        except Exception as e:
            logger.error("Failed to publish WhatsApp notification to Kafka", error=str(e))
