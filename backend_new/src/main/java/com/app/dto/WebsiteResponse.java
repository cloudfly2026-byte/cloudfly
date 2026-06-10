package com.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebsiteResponse {

    private Long id;
    private String siteName;
    private String description;
    private String status;
    private String domain;
    private String template;
    private Long theme;
    private Long domainId;
    private Long tenantId;
    private Long companyId;
}