"""
Recovery Worker for pending storefront builds.

On startup, searches the company_website table for records with status
'CONSTRUCTION' and re-injects them into the Kafka topic so the existing
pipeline can resume them (it already supports partial-data resumption).
"""
import time
import json
import structlog
from confluent_kafka import Producer
from src.config import settings
from src.database import SessionLocal
from src.models import CompanyWebsite, CompanyTheme, BrandProfile, StorefrontBuild

logger = structlog.get_logger()


def _build_producer() -> Producer | None:
    try:
        return Producer({"bootstrap.servers": settings.KAFKA_BROKER})
    except Exception as e:
        logger.error("Recovery: failed to create Kafka producer", error=str(e))
        return None


def _get_latest_build(db, website_id: int) -> StorefrontBuild | None:
    """Return the most recent StorefrontBuild for a website, or None."""
    return (
        db.query(StorefrontBuild)
        .filter(StorefrontBuild.website_id == website_id)
        .order_by(StorefrontBuild.id.desc())
        .first()
    )


def _has_partial_data(db, company_id: int) -> dict:
    """
    Check which artefacts already exist so the handler can resume
    from the correct stage. Returns a summary dict.
    """
    brand = db.query(BrandProfile).filter(BrandProfile.company_id == company_id).first()
    theme = db.query(CompanyTheme).filter(CompanyTheme.company_id == company_id).first()
    return {
        "has_brand_profile": brand is not None and brand.brand_json is not None,
        "has_theme": theme is not None and theme.config_json is not None,
    }


def _publish_recovery_payload(producer: Producer, payload: dict, website_id: int):
    """Publish a recovery message to the agents_site_constructor topic."""
    request_id = payload["request_id"]
    try:
        producer.produce(
            "agents_site_constructor",
            key=str(website_id),
            value=json.dumps(payload, ensure_ascii=False),
        )
        producer.flush()
        logger.info(
            "Recovery: published payload for website",
            website_id=website_id,
            request_id=request_id,
        )
    except Exception as e:
        logger.error(
            "Recovery: failed to publish payload",
            website_id=website_id,
            error=str(e),
        )


def run_recovery():
    """
    Main recovery entry point. Called once during startup.
    Finds all websites in CONSTRUCTION and re-queues them.
    """
    logger.info("=== Recovery Worker: scanning for pending CONSTRUCTION websites ===")

    db = SessionLocal()
    try:
        construction_websites: list[CompanyWebsite] = (
            db.query(CompanyWebsite)
            .filter(CompanyWebsite.status == "CONSTRUCTION")
            .all()
        )
    except Exception as e:
        logger.error("Recovery: failed to query company_website table", error=str(e))
        db.close()
        return

    if not construction_websites:
        logger.info("Recovery: no websites in CONSTRUCTION status. Nothing to do.")
        db.close()
        return

    logger.info(
        "Recovery: found websites in CONSTRUCTION",
        count=len(construction_websites),
        ids=[w.id for w in construction_websites],
    )

    producer = _build_producer()
    if not producer:
        logger.error("Recovery: aborting – Kafka producer unavailable")
        db.close()
        return

    for website in construction_websites:
        website_id = website.id
        company_id = website.company_id
        tenant_id = website.tenant_id

        # Determine the furthest pipeline stage reached
        partial = _has_partial_data(db, company_id)
        latest_build = _get_latest_build(db, website_id)

        # Build a recovery request_id that avoids idempotency collisions
        # but is traceable
        request_id = f"recovery-{website_id}-{int(time.time())}"

        payload = {
            "tenant_id": tenant_id,
            "company_id": company_id,
            "website_id": website_id,
            "request_id": request_id,
            # Hint flags so the handler can log / optimise
            "_recovery": True,
            "_partial_brand_profile": partial["has_brand_profile"],
            "_partial_theme": partial["has_theme"],
        }

        # If there was a previous failed build, attach last error for logging
        if latest_build and latest_build.status == "failed":
            payload["_last_build_error"] = (latest_build.build_log or "")[:500]

        logger.info(
            "Recovery: re-queuing website",
            website_id=website_id,
            company_id=company_id,
            request_id=request_id,
            partial_brand=partial["has_brand_profile"],
            partial_theme=partial["has_theme"],
            last_build_status=latest_build.status if latest_build else None,
        )

        _publish_recovery_payload(producer, payload, website_id)

        # Small delay to avoid flooding Kafka
        time.sleep(0.5)

    logger.info(
        "Recovery: finished re-queuing",
        count=len(construction_websites),
    )
    db.close()

