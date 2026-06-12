import json
import time
import structlog
from confluent_kafka import Consumer, Producer, KafkaError
from src.config import settings
from src.database import SessionLocal
from src.repository import StorefrontRepository
from src.notifier import Notifier
from src.crews.discovery_crew import run_brand_discovery
from src.crews.theme_crew import run_theme_builder
from src.crews.layout_crew import run_layout_builder
from src.crews.content_crew import run_content_generator
from src.crews.publisher_crew import StorefrontPublisher

logger = structlog.get_logger()

# Kafka producer for output events & DLQ
try:
    kafka_producer = Producer({'bootstrap.servers': settings.KAFKA_BROKER})
except Exception as e:
    logger.error("Failed to initialize Kafka producer in handler", error=str(e))
    kafka_producer = None

class KafkaHandler:
    def __init__(self):
        conf = {
            'bootstrap.servers': settings.KAFKA_BROKER,
            'group.id': 'storefront-constructor-group',
            'auto.offset.reset': 'earliest',
            'enable.auto.commit': False
        }
        self.consumer = Consumer(conf)
        self.running = True

    def start(self):
        self.consumer.subscribe(['agents_site_constructor'])
        logger.info("Kafka consumer subscribed to topic 'agents_site_constructor'")
        
        while self.running:
            msg = self.consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    logger.error("Kafka consumer error", error=str(msg.error()))
                    time.sleep(2)
                    continue

            try:
                payload = json.loads(msg.value().decode('utf-8'))
                if isinstance(payload, str):
                    payload = json.loads(payload)
                logger.info("Kafka message received", payload=payload)
                self.process_message_with_retry(payload)
                self.consumer.commit(msg, asynchronous=False)
            except Exception as e:
                logger.error("Failed to parse or commit message, sending to DLQ", error=str(e), raw_msg=msg.value())
                self.send_to_dlq(msg.value())
                self.consumer.commit(msg, asynchronous=False)

    def process_message_with_retry(self, payload: dict):
        max_retries = 3
        retry_delay = 5
        
        for attempt in range(1, max_retries + 1):
            try:
                self.process_message(payload)
                return
            except Exception as e:
                logger.error(f"Process attempt {attempt} failed", error=str(e), payload=payload)
                if attempt < max_retries:
                    time.sleep(retry_delay)
                else:
                    # Final failure -> notify fail and send event to failed topic
                    self.handle_build_failure(payload, str(e))

    def process_message(self, payload: dict):
        tenant_id = payload.get("tenant_id") or payload.get("tenantId")
        company_id = payload.get("company_id") or payload.get("companyId")
        website_id = payload.get("website_id") or payload.get("websiteId")
        request_id = payload.get("request_id") or payload.get("requestId") or f"req-{website_id}-{int(time.time())}"
        
        # Add values back to payload to ensure downstream consistency
        payload["tenant_id"] = tenant_id
        payload["company_id"] = company_id
        payload["website_id"] = website_id
        payload["request_id"] = request_id

        if not tenant_id or not company_id or not website_id:
            raise ValueError("Missing mandatory fields: tenant_id, company_id, website_id")

        db = SessionLocal()
        repo = StorefrontRepository(db)
        
        # 1. Idempotency Check
        # Check if we already completed a build for this request_id
        from src.models import StorefrontBuild
        build_exists = db.query(StorefrontBuild).filter(StorefrontBuild.request_id == request_id).first()
        if build_exists and build_exists.status == "completed":
            logger.info("Message already processed (idempotency check)", request_id=request_id)
            db.close()
            return

        # 2. Load Company
        company = repo.get_company(company_id)
        if not company:
            db.close()
            raise ValueError(f"Company with ID {company_id} not found")

        # 3. Logo Validation / Pause State
        if not company.logo_url or company.logo_url.strip() == "":
            logger.info("Company logo missing, putting build in pause state", company_id=company_id)
            
            # Update website status to CONSTRUCTION (representing pause waiting for logo)
            repo.update_website_status(website_id, "CONSTRUCTION")
            
            # Web Notification + socket.io broadcast
            Notifier.notify_web(
                db_session=db,
                tenant_id=tenant_id,
                company_id=company_id,
                user_id=None,
                title="Logo Requerido",
                description="Tu catálogo está listo para construirse, pero necesitamos que subas un logo en /tienda/principal para continuar."
            )
            
            # WhatsApp Notification
            if company.phone:
                Notifier.notify_whatsapp(
                    tenant_id=tenant_id,
                    company_id=company_id,
                    phone=company.phone,
                    message="Tu catálogo está listo para construirse, pero requerimos que subas un logo en el panel de CloudFly para continuar."
                )
                
            db.close()
            return

        # 4. Create Build Log
        build_log = repo.create_build_log(
            company_id=company_id,
            website_id=website_id,
            request_id=request_id,
            status="running",
            build_log="Storefront constructor started. Logo verified."
        )

        try:
            # 5. Brand Discovery Crew
            logger.info("Running Brand Discovery Crew...")
            brand_profile_data = run_brand_discovery(
                company_name=company.name,
                company_description=company.company_description,
                website_url=company.address, # Use address or crawler
                logo_url=company.logo_url
            )
            
            repo.save_brand_profile(
                company_id=company_id,
                industry=brand_profile_data.get("industry", "default"),
                subindustry=brand_profile_data.get("subindustry", "general"),
                tone=brand_profile_data.get("tone", "warm"),
                style=brand_profile_data.get("style", "premium"),
                brand_json=brand_profile_data
            )

            # 6. Theme Recommendation & Builder Crew
            logger.info("Running Theme Recommendation & Builder Crew...")
            theme_config = run_theme_builder(brand_profile_data, company.logo_url)
            theme_record = repo.save_theme(
                company_id=company_id,
                template_name=theme_config.get("template_name", "default"),
                primary_color=theme_config.get("primary_color", "#1A1A1A"),
                secondary_color=theme_config.get("secondary_color", "#F5F5F7"),
                accent_color=theme_config.get("accent_color", "#D2A26B"),
                heading_font=theme_config.get("heading_font", "Inter"),
                body_font=theme_config.get("body_font", "Inter"),
                logo_url=company.logo_url,
                config_json=theme_config
            )

            # 7. Layout Builder Crew
            logger.info("Running Layout Builder Crew...")
            layout_structure = run_layout_builder(theme_record.template_name, brand_profile_data)

            # 8. Content Generator Crew
            logger.info("Running Content Generator Crew...")
            generated_content = run_content_generator(
                company_name=company.name,
                company_description=company.company_description,
                brand_profile=brand_profile_data,
                layout_structure=layout_structure
            )

            # Merge layout structure and content data into layouts map
            layouts_map = {}
            for page in ["home", "category", "product"]:
                page_blocks = layout_structure.get(page, {}).get("blocks", [])
                
                # Enrich blocks with generated copywriting matching the block type
                enriched_blocks = []
                for block in page_blocks:
                    block_data = {}
                    if block == "hero":
                        block_data = generated_content.get("hero", {})
                    elif block == "benefits":
                        block_data = {"items": generated_content.get("benefits", [])}
                    elif block == "newsletter":
                        block_data = generated_content.get("newsletter", {})
                        
                    enriched_blocks.append({
                        "type": block,
                        "data": block_data
                    })
                
                layouts_map[page] = {
                    "blocks": enriched_blocks
                }

            # 9. Storefront Publisher Crew
            logger.info("Publishing Storefront...")
            publisher = StorefrontPublisher(repo)
            success = publisher.publish(
                website_id=website_id,
                company_id=company_id,
                theme_id=theme_record.id,
                layouts_map=layouts_map,
                request_id=request_id,
                build_id=build_log.id
            )

            if success:
                # Web Notification + Socket broadcast
                Notifier.notify_web(
                    db_session=db,
                    tenant_id=tenant_id,
                    company_id=company_id,
                    user_id=None,
                    title="Catálogo Publicado",
                    description="¡Felicidades! Tu catálogo en línea ha sido generado y publicado con éxito."
                )
                
                # WhatsApp Notification
                if company.phone:
                    Notifier.notify_whatsapp(
                        tenant_id=tenant_id,
                        company_id=company_id,
                        phone=company.phone,
                        message=f"¡Felicidades! Tu tienda en línea para '{company.name}' ha sido construida y publicada con éxito por el equipo de CloudFly AI."
                    )

                # Send success event to Kafka
                self.send_result_event(
                    topic="agents_site_constructor_completed",
                    payload={
                        "request_id": request_id,
                        "company_id": company_id,
                        "website_id": website_id,
                        "status": "completed",
                        "theme": theme_record.template_name,
                        "layout_version": theme_record.version
                    }
                )
            else:
                raise RuntimeError("Failed during storefront publishing phase")

        except Exception as e:
            repo.update_build_log(build_log.id, "failed", f"Build failed: {str(e)}")
            db.close()
            raise e

        db.close()

    def handle_build_failure(self, payload: dict, error_msg: str):
        tenant_id = payload.get("tenant_id")
        company_id = payload.get("company_id")
        website_id = payload.get("website_id")
        request_id = payload.get("request_id")
        
        logger.error("Build failed permanently", error=error_msg, payload=payload)
        
        # Send Kafka failed event
        self.send_result_event(
            topic="agents_site_constructor_failed",
            payload={
                "request_id": request_id,
                "company_id": company_id,
                "website_id": website_id,
                "error": error_msg
            }
        )

    def send_result_event(self, topic: str, payload: dict):
        if not kafka_producer:
            return
        try:
            kafka_producer.produce(
                topic,
                key=payload.get("request_id", ""),
                value=json.dumps(payload, ensure_ascii=False)
            )
            kafka_producer.flush()
        except Exception as e:
            logger.error(f"Failed to publish event to {topic}", error=str(e))

    def send_to_dlq(self, raw_value: bytes):
        if not kafka_producer:
            return
        try:
            kafka_producer.produce(
                'agents_site_constructor_dlq',
                value=raw_value
            )
            kafka_producer.flush()
            logger.info("Message sent to Dead Letter Queue (DLQ)")
        except Exception as e:
            logger.error("Failed to route message to DLQ", error=str(e))

    def stop(self):
        self.running = False
        self.consumer.close()
