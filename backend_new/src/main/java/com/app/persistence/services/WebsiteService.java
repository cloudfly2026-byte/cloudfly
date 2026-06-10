package com.app.persistence.services;

import com.app.dto.*;
import com.app.events.WebsiteEventProducer;
import com.app.persistence.entity.CompanyDomainEntity;
import com.app.persistence.entity.CompanyWebsiteEntity;
import com.app.persistence.entity.WebNotificationEntity;
import com.app.persistence.repository.CompanyDomainRepository;
import com.app.persistence.repository.CompanyWebsiteRepository;
import com.app.persistence.repository.WebNotificationRepository;
import com.app.persistence.repository.UserRepository;
import com.app.persistence.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebsiteService {

    private final CompanyWebsiteRepository websiteRepository;
    private final CompanyDomainRepository domainRepository;
    private final WebNotificationRepository webNotificationRepository;
    private final WebsiteEventProducer websiteEventProducer;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;

    private static final Pattern SUBDOMAIN_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$");
    private static final String BASE_DOMAIN = "cloudfly.com.co";

    /**
     * Check if a website exists for the given tenant and company.
     */
    public Mono<WebsiteResponse> checkWebsiteStatus(Long tenantId, Long companyId) {
        return websiteRepository.findByTenantIdAndCompanyId(tenantId, companyId)
                .flatMap(website -> domainRepository.findById(website.getDomainId())
                        .map(domain -> mapToResponse(website, domain.getDomainName())))
                .defaultIfEmpty(null);
    }

    /**
     * Validate subdomain format and availability.
     */
    public Mono<Boolean> validateSubdomain(String subdomain) {
        if (subdomain == null || subdomain.isBlank()) {
            return Mono.just(false);
        }
        String cleaned = subdomain.trim().toLowerCase();
        if (!SUBDOMAIN_PATTERN.matcher(cleaned).matches()) {
            return Mono.just(false);
        }
        String fullDomain = cleaned + "." + BASE_DOMAIN;
        return domainRepository.findByDomainName(fullDomain)
                .map(existing -> false)
                .defaultIfEmpty(true);
    }

    /**
     * Create a new website catalog:
     * 1. Validate subdomain
     * 2. Insert into company_domains
     * 3. Insert into company_website (CONSTRUCTION status)
     * 4. Send Kafka event to agents_site_constructor
     * 5. Send notifications
     */
    public Mono<WebsiteResponse> createWebsite(WebsiteCreateRequest request) {
        String cleanedSubdomain = request.getSubdomain().trim().toLowerCase();
        String fullDomain = cleanedSubdomain + "." + BASE_DOMAIN;

        // Validate subdomain format
        if (!SUBDOMAIN_PATTERN.matcher(cleanedSubdomain).matches()) {
            return Mono.error(new IllegalArgumentException(
                    "El subdominio solo puede contener letras min\u00fasculas, n\u00fameros y guiones. Debe tener entre 3 y 63 caracteres."));
        }

        // Check uniqueness
        return domainRepository.findByDomainName(fullDomain)
                .flatMap(existing -> Mono.<WebsiteResponse>error(
                        new IllegalArgumentException("El subdominio '" + cleanedSubdomain + "' ya est\u00e1 en uso.")))
                .switchIfEmpty(Mono.defer(() -> {
                    // Step 1: Create domain
                    CompanyDomainEntity domain = CompanyDomainEntity.builder()
                            .tenantId(request.getTenantId())
                            .companyId(request.getCompanyId())
                            .domainName(fullDomain)
                            .isSubdomain(true)
                            .estado("activo")
                            .fechaRegistro(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .build();

                    return domainRepository.save(domain)
                            .flatMap(savedDomain -> {
                                // Step 2: Create website
                                CompanyWebsiteEntity website = CompanyWebsiteEntity.builder()
                                        .siteName(request.getSiteName())
                                        .description(request.getDescription())
                                        .status("CONSTRUCTION")
                                        .tenantId(request.getTenantId())
                                        .companyId(request.getCompanyId())
                                        .template("default")
                                        .theme(1L)
                                        .domainId(savedDomain.getId())
                                        .build();

                                return websiteRepository.save(website)
                                        .flatMap(savedWebsite -> {
                                            // Step 3: Send Kafka event for site construction
                                            websiteEventProducer.publishSiteConstruction(
                                                    savedWebsite.getId(), savedDomain.getId(),
                                                    cleanedSubdomain, request.getTenantId(), request.getCompanyId());

                                            // Step 4: Send status change notification
                                            WebsiteStatusNotification notification = WebsiteStatusNotification.builder()
                                                    .websiteId(savedWebsite.getId())
                                                    .tenantId(request.getTenantId())
                                                    .companyId(request.getCompanyId())
                                                    .newStatus("CONSTRUCTION")
                                                    .subdomain(cleanedSubdomain)
                                                    .eventType("WEBSITE_CREATED")
                                                    .message("Tu tienda en l\u00ednea est\u00e1 siendo construida")
                                                    .build();
                                            websiteEventProducer.publishStatusChange(notification);

                                            // Step 5: Create web notification
                                            return createWebNotification(request.getTenantId(),
                                                    "Tienda en l\u00ednea creada",
                                                    "Tu tienda '" + request.getSiteName() + "' est\u00e1 siendo construida en " + fullDomain)
                                                    .then(Mono.just(mapToResponse(savedWebsite, fullDomain)));
                                        });
                            });
                }))
                .cast(WebsiteResponse.class)
                .onErrorMap(e -> {
                    if (e instanceof IllegalArgumentException) return e;
                    log.error("Error creating website for tenant {}: {}", request.getTenantId(), e.getMessage());
                    return new RuntimeException("Error al crear la tienda en l\u00ednea: " + e.getMessage());
                });
    }

    /**
     * Toggle website status between ENABLED and DISABLED.
     */
    public Mono<WebsiteResponse> toggleWebsiteStatus(Long websiteId, String newStatus, Long tenantId, Long companyId) {
        if (!"ENABLED".equals(newStatus) && !"DISABLED".equals(newStatus)) {
            return Mono.error(new IllegalArgumentException("Estado no v\u00e1lido. Debe ser ENABLED o DISABLED."));
        }

        return websiteRepository.findById(websiteId)
                .flatMap(website -> {
                    if (!website.getTenantId().equals(tenantId) || !website.getCompanyId().equals(companyId)) {
                        return Mono.error(new SecurityException("No autorizado para modificar este sitio web."));
                    }
                    website.setStatus(newStatus);
                    return websiteRepository.save(website)
                            .flatMap(saved -> {
                                // Send notification
                                WebsiteStatusNotification notification = WebsiteStatusNotification.builder()
                                        .websiteId(saved.getId())
                                        .tenantId(tenantId)
                                        .companyId(companyId)
                                        .newStatus(newStatus)
                                        .eventType("ENABLED".equals(newStatus) ? "WEBSITE_ENABLED" : "WEBSITE_DISABLED")
                                        .message("ENABLED".equals(newStatus) ? "Tu tienda en l\u00ednea est\u00e1 activa" : "Tu tienda en l\u00ednea ha sido desactivada")
                                        .build();
                                websiteEventProducer.publishStatusChange(notification);

                                return createWebNotification(tenantId,
                                        "Estado de tienda actualizado",
                                        "Tu tienda '" + saved.getSiteName() + "' ahora est\u00e1 " + newStatus)
                                        .then(domainRepository.findById(saved.getDomainId())
                                                .map(domain -> mapToResponse(saved, domain.getDomainName())));
                            });
                })
                .switchIfEmpty(Mono.error(new RuntimeException("Sitio web no encontrado con ID: " + websiteId)));
    }

    /**
     * Delete a website (soft delete by setting status to DISABLED and removing domain).
     */
    public Mono<Void> deleteWebsite(Long websiteId, Long tenantId, Long companyId) {
        return websiteRepository.findById(websiteId)
                .flatMap(website -> {
                    if (!website.getTenantId().equals(tenantId) || !website.getCompanyId().equals(companyId)) {
                        return Mono.error(new SecurityException("No autorizado para eliminar este sitio web."));
                    }

                    WebsiteStatusNotification notification = WebsiteStatusNotification.builder()
                            .websiteId(websiteId)
                            .tenantId(tenantId)
                            .companyId(companyId)
                            .newStatus("DELETED")
                            .eventType("WEBSITE_DELETED")
                            .message("Tu tienda en l\u00ednea ha sido eliminada")
                            .build();
                    websiteEventProducer.publishStatusChange(notification);

                    return createWebNotification(tenantId,
                            "Tienda eliminada",
                            "Tu tienda '" + website.getSiteName() + "' ha sido eliminada.")
                            .then(websiteRepository.deleteById(websiteId));
                })
                .then();
    }

    /**
     * Get demo metrics for the website dashboard.
     */
    public Mono<WebsiteMetricsDTO> getDemoMetrics(Long websiteId) {
        // Demo data - structured for future real data integration
        List<WebsiteMetricsDTO.VisitData> yearlyVisits = List.of(
                WebsiteMetricsDTO.VisitData.builder().month("Ene").visits(120).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Feb").visits(180).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Mar").visits(250).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Abr").visits(310).build(),
                WebsiteMetricsDTO.VisitData.builder().month("May").visits(420).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Jun").visits(380).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Jul").visits(450).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Ago").visits(520).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Sep").visits(480).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Oct").visits(560).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Nov").visits(620).build(),
                WebsiteMetricsDTO.VisitData.builder().month("Dic").visits(710).build()
        );

        List<WebsiteMetricsDTO.OriginData> origins = List.of(
                WebsiteMetricsDTO.OriginData.builder().source("Google").percentage(45.5).build(),
                WebsiteMetricsDTO.OriginData.builder().source("Directo").percentage(25.0).build(),
                WebsiteMetricsDTO.OriginData.builder().source("Redes Sociales").percentage(18.3).build(),
                WebsiteMetricsDTO.OriginData.builder().source("Referidos").percentage(11.2).build()
        );

        List<WebsiteMetricsDTO.PageData> topPages = List.of(
                WebsiteMetricsDTO.PageData.builder().path("/").views(1250).build(),
                WebsiteMetricsDTO.PageData.builder().path("/productos").views(890).build(),
                WebsiteMetricsDTO.PageData.builder().path("/productos/destacados").views(650).build(),
                WebsiteMetricsDTO.PageData.builder().path("/contacto").views(320).build(),
                WebsiteMetricsDTO.PageData.builder().path("/acerca-de").views(180).build()
        );

        return Mono.just(WebsiteMetricsDTO.builder()
                .yearlyVisits(yearlyVisits)
                .origins(origins)
                .topPages(topPages)
                .bounceRate(32.5)
                .build());
    }

    /**
     * Create a web notification for the tenant admin user.
     */
    private Mono<Void> createWebNotification(Long tenantId, String title, String description) {
        return tenantRepository.findById(tenantId)
                .flatMap(tenant -> {
                    Long adminUserId = tenant.getAdminUserId();
                    if (adminUserId == null) {
                        log.warn("No admin_user_id found for tenant {}", tenantId);
                        return Mono.empty();
                    }
                    WebNotificationEntity notification = WebNotificationEntity.builder()
                            .uuid(UUID.randomUUID().toString())
                            .tenantId(tenantId)
                            .userId(adminUserId)
                            .title(title)
                            .description(description)
                            .status("UNREAD")
                            .build();
                    return webNotificationRepository.save(notification).then();
                })
                .onErrorResume(e -> {
                    log.warn("Could not create web notification for tenant {}: {}", tenantId, e.getMessage());
                    return Mono.empty();
                });
    }

    private WebsiteResponse mapToResponse(CompanyWebsiteEntity website, String domain) {
        return WebsiteResponse.builder()
                .id(website.getId())
                .siteName(website.getSiteName())
                .description(website.getDescription())
                .status(website.getStatus())
                .domain(domain)
                .template(website.getTemplate())
                .theme(website.getTheme())
                .domainId(website.getDomainId())
                .tenantId(website.getTenantId())
                .companyId(website.getCompanyId())
                .build();
    }
}