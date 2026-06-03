package com.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for contact responses returned by the API.
 * Decouples the entity from the API contract.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactResponseDTO {
    private Long id;
    private String uuid;
    private String name;
    private String email;
    private String phone;
    private String address;
    private String taxId;
    private String type;
    private String stage;
    private String avatarUrl;
    private Long tenantId;
    private Long companyId;
    private Long pipelineId;
    private Long stageId;
    private String documentType;
    private String documentNumber;
    private Boolean isActive;
    private Boolean chatbotEnabled;
    private String assignedUserIds;
    private List<String> tags;
    private String createdAt;
    private String updatedAt;
    private String createdBy;
}
