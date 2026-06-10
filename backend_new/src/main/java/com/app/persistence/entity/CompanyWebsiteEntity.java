package com.app.persistence.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("company_website")
public class CompanyWebsiteEntity {

    @Id
    private Long id;

    @Column("site_name")
    private String siteName;

    private String description;

    private String status;

    private String keywords;

    @Column("footer_text")
    private String footerText;

    @Column("tenant_id")
    private Long tenantId;

    @Column("company_id")
    private Long companyId;

    private String template;

    private Long theme;

    @Column("domain_id")
    private Long domainId;

    // Explicit getters and setters for VPS environment compatibility
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getKeywords() { return keywords; }
    public void setKeywords(String keywords) { this.keywords = keywords; }

    public String getFooterText() { return footerText; }
    public void setFooterText(String footerText) { this.footerText = footerText; }

    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }

    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }

    public String getTemplate() { return template; }
    public void setTemplate(String template) { this.template = template; }

    public Long getTheme() { return theme; }
    public void setTheme(Long theme) { this.theme = theme; }

    public Long getDomainId() { return domainId; }
    public void setDomainId(Long domainId) { this.domainId = domainId; }
}