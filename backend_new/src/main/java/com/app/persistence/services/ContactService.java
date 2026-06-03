package com.app.persistence.services;

import com.app.persistence.entity.ContactEntity;
import com.app.persistence.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContactService {

    private final ContactRepository contactRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public Flux<ContactEntity> findAll(Long tenantId, Long companyId) {
        if (companyId != null) {
            log.info("Fetching all contacts for tenant: {} and company: {}", tenantId, companyId);
            return contactRepository.findByTenantIdAndCompanyId(tenantId, companyId);
        } else {
            log.info("Fetching all contacts for tenant: {} (Broad search)", tenantId);
            return contactRepository.findByTenantId(tenantId);
        }
    }

    /**
     * Find contacts with server-side pagination and optional filters.
     * All filter parameters are optional (pass null to skip).
     */
    public Mono<com.app.dto.PageResponse<ContactEntity>> findFilteredPaginated(
            Long tenantId, Long companyId, String name, String email, String phone,
            String identification, int page, int size) {
        int offset = page * size;
        Mono<Long> countMono = contactRepository.countFiltered(tenantId, companyId, name, email, phone, identification);
        Mono<java.util.List<ContactEntity>> dataMono = contactRepository
                .findFilteredPaginated(tenantId, companyId, name, email, phone, identification, size, offset)
                .collectList();

        return Mono.zip(countMono, dataMono).map(tuple -> {
            long totalElements = tuple.getT1();
            java.util.List<ContactEntity> data = tuple.getT2();
            int totalPages = (int) Math.ceil((double) totalElements / size);
            return com.app.dto.PageResponse.<ContactEntity>builder()
                    .data(data)
                    .totalElements(totalElements)
                    .totalPages(totalPages)
                    .currentPage(page)
                    .pageSize(size)
                    .build();
        });
    }

    public Mono<com.app.dto.PageResponse<ContactEntity>> findPaginated(Long tenantId, Long companyId, int page, int size) {
        return findFilteredPaginated(tenantId, companyId, null, null, null, null, page, size);
    }

    public Mono<ContactEntity> findById(Long id, Long tenantId, Long companyId) {
        return contactRepository.findById(id)
                .filter(contact -> contact.getTenantId() != null
                        && contact.getTenantId().equals(tenantId)
                        && (companyId == null || companyId.equals(contact.getCompanyId())));
    }

    public Mono<ContactEntity> create(ContactEntity contact, Long tenantId, Long companyId) {
        String cleanPhone = contact.getPhone() != null ? contact.getPhone().replaceAll("[^0-9]", "") : "";
        contact.setPhone(cleanPhone);
        
        // Normalize email: set to null if empty/whitespace to prevent unique constraint conflicts on index 'contacts.idx_unique_email_tenant'
        String cleanEmail = (contact.getEmail() != null && !contact.getEmail().trim().isEmpty())
                ? contact.getEmail().trim().toLowerCase()
                : null;
        contact.setEmail(cleanEmail);

        // Normalize documentNumber: set to null if empty/whitespace to prevent unique constraint conflicts on index 'contacts.idx_unique_document_tenant'
        String cleanDocNumber = (contact.getDocumentNumber() != null && !contact.getDocumentNumber().trim().isEmpty())
                ? contact.getDocumentNumber().trim()
                : null;
        contact.setDocumentNumber(cleanDocNumber);

        contact.setTenantId(tenantId);
        contact.setCompanyId(companyId);
        contact.setUuid(java.util.UUID.randomUUID().toString());
        contact.setCreatedAt(LocalDateTime.now());
        contact.setUpdatedAt(LocalDateTime.now());
        if (contact.getStage() == null)
            contact.setStage("LEAD");

        return validateContactUniqueness(contact, tenantId, companyId)
                .then(Mono.defer(() -> {
                    log.info("Creating new contact: {} for tenant: {}", contact.getName(), tenantId);
                    return contactRepository.save(contact)
                            .doOnSuccess(saved -> {
                                sendWebNotification(tenantId, companyId, null,
                                        "👤 Nuevo Contacto", "Se ha registrado a " + saved.getName());
                                publishContactEvent("CONTACT_CREATED", saved);
                            });
                }));
    }

    private Mono<Void> validateContactUniqueness(ContactEntity contact, Long tenantId, Long companyId) {
        Mono<Void> phoneCheck = existsByPhone(tenantId, companyId, contact.getPhone())
                .flatMap(
                        exists -> exists ? Mono.error(new RuntimeException("El número de teléfono ya está registrado."))
                                : Mono.empty());

        Mono<Void> emailCheck = (contact.getEmail() != null && !contact.getEmail().isEmpty())
                ? existsByEmail(tenantId, companyId, contact.getEmail())
                        .flatMap(exists -> exists
                                ? Mono.error(new RuntimeException("El correo electrónico ya está registrado."))
                                : Mono.empty())
                : Mono.empty();

        Mono<Void> docCheck = (contact.getDocumentNumber() != null && !contact.getDocumentNumber().isEmpty())
                ? contactRepository
                        .findByTenantIdAndCompanyIdAndDocumentNumber(tenantId, companyId, contact.getDocumentNumber())
                        .flatMap(existing -> Mono
                                .error(new RuntimeException("El número de documento ya está registrado.")))
                : Mono.empty();

        return Mono.when(phoneCheck, emailCheck, docCheck);
    }

    public Mono<ContactEntity> update(Long id, ContactEntity contact, Long tenantId, Long companyId) {
        String cleanPhone = contact.getPhone() != null ? contact.getPhone().replaceAll("\\D", "") : "";
        
        // Normalize email: set to null if empty/whitespace to prevent unique constraint conflicts on index 'contacts.idx_unique_email_tenant'
        String cleanEmail = (contact.getEmail() != null && !contact.getEmail().trim().isEmpty())
                ? contact.getEmail().trim().toLowerCase()
                : null;

        // Normalize documentNumber: set to null if empty/whitespace to prevent unique constraint conflicts on index 'contacts.idx_unique_document_tenant'
        String cleanDocNumber = (contact.getDocumentNumber() != null && !contact.getDocumentNumber().trim().isEmpty())
                ? contact.getDocumentNumber().trim()
                : null;

        return contactRepository.findById(id)
                .filter(existing -> existing.getTenantId().equals(tenantId)
                        && existing.getCompanyId().equals(companyId))
                .flatMap(existing -> {
                    String existingCleanPhone = existing.getPhone() != null ? existing.getPhone().replaceAll("\\D", "")
                            : "";
                    String existingCleanEmail = (existing.getEmail() != null && !existing.getEmail().trim().isEmpty())
                            ? existing.getEmail().trim().toLowerCase()
                            : null;

                    boolean phoneChanged = !cleanPhone.equals(existingCleanPhone);
                    boolean emailChanged = (cleanEmail != null && !cleanEmail.equals(existingCleanEmail)) || (cleanEmail == null && existingCleanEmail != null);

                    Mono<Boolean> phoneExists = (phoneChanged && !cleanPhone.isEmpty())
                            ? contactRepository.existsByPhoneAndCompanyIdAndIdNot(cleanPhone, companyId, id, tenantId)
                                    .map(count -> count > 0)
                            : Mono.just(false);

                    Mono<Boolean> emailExists = (emailChanged && cleanEmail != null && !cleanEmail.isEmpty())
                            ? contactRepository.existsByEmailAndCompanyIdAndIdNot(cleanEmail, companyId, id, tenantId)
                                    .map(count -> count > 0)
                            : Mono.just(false);

                    return Mono.zip(phoneExists, emailExists)
                            .flatMap(tuple -> {
                                if (tuple.getT1()) {
                                    return Mono.error(
                                            new RuntimeException("Este número ya está registrado en esta compañía"));
                                }
                                if (tuple.getT2()) {
                                    return Mono.error(new RuntimeException(
                                            "El correo electrónico ya está registrado en esta compañía"));
                                }
                                return performUpdate(existing, contact, cleanPhone, cleanEmail, cleanDocNumber);
                            });
                });
    }

    private Mono<ContactEntity> performUpdate(ContactEntity existing, ContactEntity contact, String cleanPhone, String cleanEmail, String cleanDocNumber) {
        log.info("Updating Contact ID: {}. Name: {}, PipelineID: {}, StageID: {}, StageName: {}",
                existing.getId(), contact.getName(), contact.getPipelineId(), contact.getStageId(), contact.getStage());

        existing.setName(contact.getName());
        existing.setEmail(cleanEmail);
        existing.setPhone(cleanPhone);
        existing.setAddress(contact.getAddress());
        existing.setTaxId(contact.getTaxId());
        existing.setType(contact.getType());
        existing.setStage(contact.getStage());
        existing.setPipelineId(contact.getPipelineId());
        existing.setStageId(contact.getStageId());
        existing.setDocumentType(contact.getDocumentType());
        existing.setDocumentNumber(cleanDocNumber);
        existing.setIsActive(contact.getIsActive());
        existing.setAssignedUserIds(contact.getAssignedUserIds());
        existing.setUpdatedAt(LocalDateTime.now());

        return contactRepository.save(existing)
                .doOnSuccess(saved -> {
                    log.info("Successfully saved Contact ID: {}. Persisted PipelineID: {}, StageID: {}",
                            saved.getId(), saved.getPipelineId(), saved.getStageId());
                    sendWebNotification(saved.getTenantId(), saved.getCompanyId(), null, "👤 Contacto Actualizado", "Datos de " + saved.getName() + " actualizados");
                    publishContactEvent("CONTACT_UPDATED", saved);
                })
                .doOnError(err -> log.error("FALTA AL GUARDAR CONTACTO ID: {}. Error: {}", existing.getId(),
                        err.getMessage(), err));
    }

    private void sendWebNotification(Long tenantId, Long companyId, Long userId, String title, String description) {
        try {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("tenantId", tenantId);
            payload.put("companyId", companyId);
            payload.put("userId", userId);
            payload.put("title", title);
            payload.put("description", description);
            payload.put("type", "contact");
            String json = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send("webnotifications", json);
            log.info("🔔 Web notification sent for contact update/creation (tenant {}): {}", tenantId, title);
        } catch (Exception e) {
            log.error("❌ Error sending web notification for contact: {}", e.getMessage());
        }
    }

    /**
     * Publish contact event to Kafka for cache invalidation and real-time sync.
     */
    private void publishContactEvent(String action, ContactEntity contact) {
        try {
            java.util.Map<String, Object> event = new java.util.HashMap<>();
            event.put("action", action);
            event.put("contactId", contact.getId());
            event.put("tenantId", contact.getTenantId());
            event.put("companyId", contact.getCompanyId());
            event.put("timestamp", System.currentTimeMillis());
            String json = objectMapper.writeValueAsString(event);
            kafkaTemplate.send("contact-events", json);
            log.info("📨 Contact event published: {} for contact {} (tenant {})", action, contact.getId(), contact.getTenantId());
        } catch (Exception e) {
            log.error("❌ Error publishing contact event: {}", e.getMessage());
        }
    }

    public Mono<Void> delete(Long id, Long tenantId, Long companyId) {
        return contactRepository.findById(id)
                .filter(existing -> existing.getTenantId().equals(tenantId)
                        && existing.getCompanyId().equals(companyId))
                .flatMap(existing -> contactRepository.delete(existing)
                        .doOnSuccess(v -> {
                            sendWebNotification(tenantId, companyId, null, "👤 Contacto Eliminado", "Contacto eliminado del sistema");
                            publishContactEvent("CONTACT_DELETED", existing);
                        }));
    }

    public Mono<ContactEntity> getOrCreateContact(Long tenantId, Long companyId, String phone, String name) {
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        log.info("🔍 Looking for contact with phone: {} in tenant: {} and company: {}", cleanPhone, tenantId,
                companyId);

        return contactRepository.findByTenantIdAndCompanyIdAndPhone(tenantId, companyId, cleanPhone)
                .switchIfEmpty(Mono.defer(() -> {
                    String contactName = (name != null && !name.trim().isEmpty())
                            ? name + " (" + cleanPhone + ")"
                            : "Nuevo Contacto " + cleanPhone;

                    ContactEntity newContact = ContactEntity.builder()
                            .uuid(java.util.UUID.randomUUID().toString())
                            .tenantId(tenantId)
                            .companyId(companyId)
                            .phone(cleanPhone)
                            .name(contactName)
                            .type("LEAD")
                            .stage("LEAD")
                            .isActive(true)
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .build();
                    return contactRepository.save(newContact)
                            .doOnSuccess(saved -> {
                                sendWebNotification(tenantId, companyId, null,
                                        "👤 Nuevo Contacto", "Nuevo prospecto registrado: " + saved.getName());
                                publishContactEvent("CONTACT_CREATED", saved);
                            });
                }));
    }

    public Mono<Boolean> existsByPhone(Long tenantId, Long companyId, String phone) {
        if (phone == null || phone.isEmpty())
            return Mono.just(false);
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        return contactRepository.countByTenantIdAndCompanyIdAndPhone(tenantId, companyId, cleanPhone)
                .map(count -> count > 0);
    }

    public Mono<Boolean> existsByEmail(Long tenantId, Long companyId, String email) {
        if (email == null || email.isEmpty())
            return Mono.just(false);
        return contactRepository.countByTenantIdAndCompanyIdAndEmail(tenantId, companyId, email)
                .map(count -> count > 0);
    }

    public Flux<ContactEntity> search(Long tenantId, Long companyId, String query) {
        log.info("Searching contacts for tenant: {}, company: {} with query: {}", tenantId, companyId, query);
        return contactRepository.searchContacts(tenantId, companyId, query);
    }

    public Mono<ContactEntity> toggleChatbot(Long id, Boolean enabled, Long tenantId, Long companyId) {
        log.info("🤖 Toggling chatbot for contact {} to {}", id, enabled);
        return contactRepository.findById(id)
                .filter(contact -> contact.getTenantId().equals(tenantId) && (companyId == null || contact.getCompanyId().equals(companyId)))
                .flatMap(contact -> {
                    contact.setChatbotEnabled(enabled);
                    contact.setUpdatedAt(LocalDateTime.now());
                    return contactRepository.save(contact);
                });
    }

    public Mono<Boolean> existsByDocument(Long tenantId, Long companyId, String documentNumber) {
        if (documentNumber == null || documentNumber.isEmpty())
            return Mono.just(false);
        return contactRepository.findByTenantIdAndCompanyIdAndDocumentNumber(tenantId, companyId, documentNumber)
                .map(contact -> true)
                .defaultIfEmpty(false);
    }

    public Mono<Boolean> existsByDocumentAndIdNot(Long tenantId, Long companyId, String documentNumber, Long id) {
        if (documentNumber == null || documentNumber.isEmpty())
            return Mono.just(false);
        return contactRepository.existsByDocumentAndCompanyIdAndIdNot(documentNumber, companyId, id, tenantId)
                .map(count -> count > 0);
    }
}
