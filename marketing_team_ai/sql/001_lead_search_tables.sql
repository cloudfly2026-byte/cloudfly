CREATE TABLE IF NOT EXISTS lead_search_jobs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(36) NOT NULL UNIQUE,
    status ENUM('pending', 'processing', 'completed', 'failed', 'retrying') NOT NULL DEFAULT 'pending',
    category VARCHAR(255) NOT NULL,
    country VARCHAR(128) NOT NULL,
    cities JSON NULL,
    company_id BIGINT NOT NULL,
    product_id BIGINT NULL,
    tenant_id BIGINT NULL,
    max_leads INT NOT NULL DEFAULT 20,
    total_leads INT NOT NULL DEFAULT 0,
    retries INT NOT NULL DEFAULT 0,
    error_message TEXT NULL, 
    worker_id VARCHAR(64) NULL,
    context_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_lead_search_jobs_status (status),
    INDEX idx_lead_search_jobs_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lead_search_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id BIGINT NOT NULL,
    nombre VARCHAR(255) NULL,
    telefono VARCHAR(64) NULL,
    whatsapp VARCHAR(64) NULL,
    email VARCHAR(255) NULL,
    sitio_web VARCHAR(512) NULL,
    fuente VARCHAR(512) NULL,
    titulo VARCHAR(255) NULL,
    ciudad VARCHAR(128) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lead_search_results_job (job_id),
    CONSTRAINT fk_lead_search_results_job
        FOREIGN KEY (job_id) REFERENCES lead_search_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
