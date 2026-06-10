package com.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebsiteCreateRequest {

    private String subdomain;
    private String siteName;
    private String description;
    private Long tenantId;
    private Long companyId;
}