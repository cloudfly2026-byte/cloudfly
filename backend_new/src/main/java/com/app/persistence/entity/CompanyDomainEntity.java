package com.app.persistence.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("company_domains")
public class CompanyDomainEntity {

    @Id
    private Long id;

    @Column("tenant_id")
    private Long tenantId;

    @Column("company_id")
    private Long companyId;

    @Column("domain_name")
    private String domainName;

    @Column("is_subdomain")
    private Boolean isSubdomain;

    private String estado;

    @Column("fecha_registro")
    private LocalDateTime fechaRegistro;

    @Column("fecha_caduca")
    private LocalDateTime fechaCaduca;

    @Column("updated_at")
    private LocalDateTime updatedAt;

    // Explicit getters and setters for VPS environment compatibility
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }

    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }

    public String getDomainName() { return domainName; }
    public void setDomainName(String domainName) { this.domainName = domainName; }

    public Boolean getIsSubdomain() { return isSubdomain; }
    public void setIsSubdomain(Boolean isSubdomain) { this.isSubdomain = isSubdomain; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public LocalDateTime getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(LocalDateTime fechaRegistro) { this.fechaRegistro = fechaRegistro; }

    public LocalDateTime getFechaCaduca() { return fechaCaduca; }
    public void setFechaCaduca(LocalDateTime fechaCaduca) { this.fechaCaduca = fechaCaduca; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}