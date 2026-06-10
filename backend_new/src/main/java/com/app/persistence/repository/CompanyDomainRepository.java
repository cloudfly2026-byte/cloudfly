package com.app.persistence.repository;

import com.app.persistence.entity.CompanyDomainEntity;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface CompanyDomainRepository extends ReactiveCrudRepository<CompanyDomainEntity, Long> {

    @Query("SELECT * FROM company_domains WHERE domain_name = :domainName LIMIT 1")
    Mono<CompanyDomainEntity> findByDomainName(String domainName);

    @Query("SELECT COUNT(*) > 0 FROM company_domains WHERE domain_name = :domainName")
    Mono<Boolean> existsByDomainName(String domainName);

    @Query("SELECT * FROM company_domains WHERE tenant_id = :tenantId AND company_id = :companyId LIMIT 1")
    Mono<CompanyDomainEntity> findByTenantIdAndCompanyId(Long tenantId, Long companyId);
}