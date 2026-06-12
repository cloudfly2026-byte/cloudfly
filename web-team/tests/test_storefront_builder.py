import json
import pytest
from unittest.mock import MagicMock, patch
from src.tools import logo_analyzer, theme_catalog_tool

def test_logo_analyzer():
    # Test logo color extraction fallback heuristics
    res_spa = logo_analyzer.func("http://example.com/logo-spa.png")
    assert "primary_color" in res_spa
    assert "#4A2E80" in res_spa # Accents for spa/beauty

    res_baby = logo_analyzer.func("http://example.com/luna-baby.png")
    assert "#F8C8DC" in res_baby # Pink primary for maternity/baby

    res_generic = logo_analyzer.func("http://example.com/my-shop.png")
    assert "#1A1A1A" in res_generic # Sleek charcoal fallback

def test_theme_catalog():
    res = theme_catalog_tool.func()
    assert "maternity" in res
    assert "electronics" in res
    assert "default" in res

# ── Recovery Worker Tests ─────────────────────────────────────────────

class TestRecoveryWorker:
    """Tests for the recovery worker that resumes pending CONSTRUCTION websites."""

    @patch("src.recovery_worker._build_producer")
    @patch("src.recovery_worker.SessionLocal")
    def test_no_construction_websites(self, mock_session_factory, mock_producer):
        """When no websites are in CONSTRUCTION, recovery should exit cleanly."""
        from src.recovery_worker import run_recovery

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = []
        mock_session_factory.return_value = mock_db

        # Should not raise
        run_recovery()

        # Producer should never be created if there's nothing to recover
        mock_producer.assert_not_called()
        mock_db.close.assert_called_once()

    @patch("src.recovery_worker._build_producer")
    @patch("src.recovery_worker.SessionLocal")
    def test_construction_websites_get_requeued(self, mock_session_factory, mock_producer):
        """Websites in CONSTRUCTION should produce recovery payloads."""
        from src.recovery_worker import run_recovery
        from src.models import CompanyWebsite

        # Create a mock website in CONSTRUCTION
        mock_website = MagicMock(spec=CompanyWebsite)
        mock_website.id = 42
        mock_website.company_id = 7
        mock_website.tenant_id = 1
        mock_website.status = "CONSTRUCTION"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_website]
        # No brand profile, no theme → fresh build
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_session_factory.return_value = mock_db

        mock_prod_instance = MagicMock()
        mock_producer.return_value = mock_prod_instance

        run_recovery()

        # Producer should have been created
        mock_producer.assert_called_once()
        # produce should have been called at least once
        mock_prod_instance.produce.assert_called_once()
        # Verify the payload structure
        call_args = mock_prod_instance.produce.call_args
        assert call_args[0][0] == "agents_site_constructor"
        payload = json.loads(call_args[1]["value"])
        assert payload["website_id"] == 42
        assert payload["company_id"] == 7
        assert payload["tenant_id"] == 1
        assert payload["_recovery"] is True
        assert payload["request_id"].startswith("recovery-42-")
        mock_prod_instance.flush.assert_called()
        mock_db.close.assert_called_once()

    @patch("src.recovery_worker._build_producer")
    @patch("src.recovery_worker.SessionLocal")
    def test_kafka_unavailable_aborts(self, mock_session_factory, mock_producer):
        """If Kafka producer fails to initialise, recovery should abort gracefully."""
        from src.recovery_worker import run_recovery

        mock_website = MagicMock()
        mock_website.id = 10
        mock_website.company_id = 2
        mock_website.tenant_id = 1
        mock_website.status = "CONSTRUCTION"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_website]
        mock_session_factory.return_value = mock_db

        # Simulate Kafka being down
        mock_producer.return_value = None

        # Should not raise
        run_recovery()

        mock_db.close.assert_called_once()


class TestRepositoryWebsitesByStatus:
    """Tests for the new repository query methods."""

    def test_get_websites_by_status(self):
        """get_websites_by_status should filter by the given status."""
        from src.repository import StorefrontRepository
        from src.models import CompanyWebsite

        mock_db = MagicMock()
        mock_website = MagicMock(spec=CompanyWebsite)
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_website]

        repo = StorefrontRepository(mock_db)
        result = repo.get_websites_by_status("CONSTRUCTION")

        assert len(result) == 1
        assert result[0] == mock_website

    def test_get_websites_construction(self):
        """get_websites_construction should delegate to get_websites_by_status."""
        from src.repository import StorefrontRepository

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = []

        repo = StorefrontRepository(mock_db)
        result = repo.get_websites_construction()

        assert result == []
