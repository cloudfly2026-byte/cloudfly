import structlog
from src.repository import StorefrontRepository
from src.tools import redis_client

logger = structlog.get_logger()

class StorefrontPublisher:
    def __init__(self, repository: StorefrontRepository):
        self.repo = repository

    def publish(self, website_id: int, company_id: int, theme_id: int, layouts_map: dict, request_id: str, build_id: int) -> bool:
        """
        Executes database publication, Redis cache invalidation, and logs final status.
        """
        try:
            # 1. Update theme association in company_website
            self.repo.update_website_theme_id(website_id, theme_id)

            # 2. Save layouts for pages (home, category, product)
            for page, layout_data in layouts_map.items():
                self.repo.save_layout(company_id, page, layout_data)

            # 3. Update status to ENABLED (matches DB ENUM: DISABLED|ENABLED|CONSTRUCTION)
            self.repo.update_website_status(website_id, "ENABLED")

            # 4. Invalidate cache in Redis directly (redis_tool is a crewai Tool object, use redis_client directly)
            if redis_client:
                redis_client.delete(f"storefront:html:{company_id}:home")
                redis_client.delete(f"website:{website_id}")
                redis_client.delete(f"theme:{theme_id}")
                redis_client.delete(f"layout:{company_id}")

            # 5. Update build log to completed
            self.repo.update_build_log(
                build_id=build_id,
                status="completed",
                build_log="Storefront published successfully. Redis cache invalidated."
            )
            
            logger.info("Storefront published successfully", website_id=website_id, company_id=company_id)
            return True
        except Exception as e:
            err_msg = f"Failed to publish storefront: {str(e)}"
            logger.error(err_msg, website_id=website_id, company_id=company_id)
            self.repo.update_build_log(build_id=build_id, status="failed", build_log=err_msg)
            return False
