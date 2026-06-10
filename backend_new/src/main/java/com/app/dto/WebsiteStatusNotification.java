package com.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebsiteStatusNotification {

    private Long websiteId;
    private Long tenantId;
    private Long companyId;
    private String newStatus;
    private String message;
    private String subdomain;
    private String eventType;
}