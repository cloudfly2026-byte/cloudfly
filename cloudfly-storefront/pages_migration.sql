-- Migration: Create pages table for storefront CMS
-- Supports both static pages (type='page') and blog posts (type='post')

CREATE TABLE IF NOT EXISTS pages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    type ENUM('page', 'post') NOT NULL DEFAULT 'page',
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    content LONGTEXT,
    excerpt TEXT,
    featured_image VARCHAR(500) DEFAULT '',
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    meta_title VARCHAR(255) DEFAULT '',
    meta_description VARCHAR(500) DEFAULT '',
    author_id BIGINT DEFAULT 0,
    ia_update TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_slug (company_id, slug),
    INDEX idx_company_type (company_id, type),
    INDEX idx_status (status),
    INDEX idx_ia_update (ia_update)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
