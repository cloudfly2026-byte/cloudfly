from sqlalchemy import Column, BigInteger, Integer, String, Text, Enum, JSON, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from src.database import Base

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(BigInteger, nullable=False)
    name = Column(String(255), nullable=False)
    logo_url = Column(String(500), nullable=True)
    company_description = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(String(255), nullable=True)

class CompanyDomain(Base):
    __tablename__ = "company_domains"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(BigInteger, nullable=False)
    company_id = Column(BigInteger, nullable=False)
    domain_name = Column(String(255), nullable=False, unique=True)
    is_subdomain = Column(Boolean, default=False)
    estado = Column(String(50), default="activo")
    fecha_registro = Column(DateTime, default=func.now())
    fecha_caduca = Column(DateTime, nullable=True)

class CompanyWebsite(Base):
    __tablename__ = "company_website"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    site_name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum("DISABLED", "ENABLED", "CONSTRUCTION", name="website_status_enum"), default="CONSTRUCTION")
    keywords = Column(Text, nullable=True)
    footer_text = Column(Text, nullable=True)
    tenant_id = Column(BigInteger, nullable=False)
    company_id = Column(BigInteger, nullable=False)
    template = Column(String(255), nullable=False, default="default")
    theme = Column(BigInteger, nullable=False, default=1)
    domain_id = Column(BigInteger, nullable=False)

class CompanyTheme(Base):
    __tablename__ = "company_themes"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, nullable=False)
    template_name = Column(String(100), nullable=True)
    primary_color = Column(String(20), nullable=True)
    secondary_color = Column(String(20), nullable=True)
    accent_color = Column(String(20), nullable=True)
    heading_font = Column(String(100), nullable=True)
    body_font = Column(String(100), nullable=True)
    logo_url = Column(String(500), nullable=True)
    config_json = Column(JSON, nullable=True)
    version = Column(Integer, default=1)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class CompanyLayout(Base):
    __tablename__ = "company_layouts"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, nullable=False)
    page_name = Column(String(100), nullable=True)
    layout_json = Column(JSON, nullable=True)
    version = Column(Integer, default=1)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class BrandProfile(Base):
    __tablename__ = "brand_profiles"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, nullable=False)
    industry = Column(String(255), nullable=True)
    subindustry = Column(String(255), nullable=True)
    tone = Column(String(100), nullable=True)
    style = Column(String(100), nullable=True)
    brand_json = Column(JSON, nullable=True)
    generated_at = Column(DateTime, default=func.now())

class Product(Base):
    __tablename__ = "productos"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, nullable=False)
    tenant_id = Column(BigInteger, nullable=False)
    product_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Text, nullable=True) # Could be numeric or string in schema, mapping as String/Text for safety
    status = Column(String(50), default="ACTIVE")

class StorefrontBuild(Base):
    __tablename__ = "storefront_builds"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    company_id = Column(BigInteger, nullable=False)
    website_id = Column(BigInteger, nullable=False)
    request_id = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False)
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
    build_log = Column(Text, nullable=True)
