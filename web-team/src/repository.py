from sqlalchemy.orm import Session
from src.models import (
    Company, CompanyDomain, CompanyWebsite, CompanyTheme,
    CompanyLayout, BrandProfile, Product, StorefrontBuild
)
from datetime import datetime

class StorefrontRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_company(self, company_id: int) -> Company | None:
        return self.db.query(Company).filter(Company.id == company_id).first()

    def get_website(self, website_id: int) -> CompanyWebsite | None:
        return self.db.query(CompanyWebsite).filter(CompanyWebsite.id == website_id).first()

    def get_domain(self, domain_id: int) -> CompanyDomain | None:
        return self.db.query(CompanyDomain).filter(CompanyDomain.id == domain_id).first()

    def get_products_by_company(self, company_id: int) -> list[Product]:
        return self.db.query(Product).filter(Product.company_id == company_id).all()

    def update_website_status(self, website_id: int, status: str):
        website = self.get_website(website_id)
        if website:
            website.status = status
            self.db.commit()
            return True
        return False

    def update_website_theme_id(self, website_id: int, theme_id: int):
        website = self.get_website(website_id)
        if website:
            website.theme = theme_id
            self.db.commit()
            return True
        return False

    def save_brand_profile(self, company_id: int, industry: str, subindustry: str, tone: str, style: str, brand_json: dict) -> BrandProfile:
        profile = self.db.query(BrandProfile).filter(BrandProfile.company_id == company_id).first()
        if not profile:
            profile = BrandProfile(company_id=company_id)
            self.db.add(profile)
        profile.industry = industry
        profile.subindustry = subindustry
        profile.tone = tone
        profile.style = style
        profile.brand_json = brand_json
        profile.generated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def save_theme(self, company_id: int, template_name: str, primary_color: str, secondary_color: str, accent_color: str, heading_font: str, body_font: str, logo_url: str, config_json: dict) -> CompanyTheme:
        theme = self.db.query(CompanyTheme).filter(CompanyTheme.company_id == company_id).first()
        if not theme:
            theme = CompanyTheme(company_id=company_id)
            self.db.add(theme)
        theme.template_name = template_name
        theme.primary_color = primary_color
        theme.secondary_color = secondary_color
        theme.accent_color = accent_color
        theme.heading_font = heading_font
        theme.body_font = body_font
        theme.logo_url = logo_url
        theme.config_json = config_json
        theme.version = (theme.version or 0) + 1
        theme.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(theme)
        return theme

    def save_layout(self, company_id: int, page_name: str, layout_json: dict) -> CompanyLayout:
        layout = self.db.query(CompanyLayout).filter(
            CompanyLayout.company_id == company_id,
            CompanyLayout.page_name == page_name
        ).first()
        if not layout:
            layout = CompanyLayout(company_id=company_id, page_name=page_name)
            self.db.add(layout)
        layout.layout_json = layout_json
        layout.version = (layout.version or 0) + 1
        layout.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(layout)
        return layout

    def create_build_log(self, company_id: int, website_id: int, request_id: str, status: str, build_log: str = "") -> StorefrontBuild:
        build = StorefrontBuild(
            company_id=company_id,
            website_id=website_id,
            request_id=request_id,
            status=status,
            started_at=datetime.utcnow(),
            build_log=build_log
        )
        self.db.add(build)
        self.db.commit()
        self.db.refresh(build)
        return build

    def update_build_log(self, build_id: int, status: str, build_log: str):
        build = self.db.query(StorefrontBuild).filter(StorefrontBuild.id == build_id).first()
        if build:
            build.status = status
            build.build_log = build_log
            build.completed_at = datetime.utcnow()
            self.db.commit()
            return True
        return False
