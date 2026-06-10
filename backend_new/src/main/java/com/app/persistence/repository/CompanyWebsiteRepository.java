package com.app.persistence.repository;

import com.app.persistence.entity.CompanyWebsiteEntity;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface CompanyWebsiteRepository extends ReactiveCrudRepository<CompanyWebsiteEntity, Long> {

    @Query("SELECT * FROM company_website WHERE tenant_id = :tenantId AND company_id = :companyId LIMIT 1")
    Mono<CompanyWebsiteEntity> findByTenantIdAndCompanyId(Long tenantId, Long companyId);

    @Query("SELECT * FROM company_website WHERE id = :id LIMIT 1")
    Mono<CompanyWebsiteEntity> findById(Long id);
}