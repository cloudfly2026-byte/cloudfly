package com.app.controllers;

import com.app.dto.WebsiteCreateRequest;
import com.app.dto.WebsiteMetricsDTO;
import com.app.dto.WebsiteResponse;
import com.app.persistence.services.WebsiteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/website")
@RequiredArgsConstructor
public class WebsiteController {

    private final WebsiteService websiteService;

    private record UserContext(Long tenantId, Long companyId, Set<String> roles) {}

    private Mono<UserContext> getCurrentUserContext(Map<String, String> headers) {
        return ReactiveSecurityContextHolder.getContext()
                .map(SecurityContext::getAuthentication)
                .map(auth -> {
                    if (auth == null || auth.getDetails() == null) {
                        return new UserContext(1L, null, Set.of());
                    }
                    Map<String, Object> details = (Map<String, Object>) auth.getDetails();
                    Long tokenTenantId = (Long) details.get("customer_id");
                    Long tokenCompanyId = (Long) details.get("company_id");
                    Set<String> roles = auth.getAuthorities().stream()
                            .map(a -> a.getAuthority())
                            .collect(Collectors.toSet());

                    boolean isAdminOrManager = roles.contains("ROLE_ADMIN") || roles.contains("ROLE_MANAGER");

                    Long finalTenantId = tokenTenantId;
                    if (isAdminOrManager && (headers.containsKey("x-tenant-id") || headers.containsKey("X-Tenant-Id"))) {
                        try {
                            String headerVal = headers.getOrDefault("x-tenant-id", headers.get("X-Tenant-Id"));
                            finalTenantId = Long.parseLong(headerVal);
                        } catch (Exception e) {
                            log.warn("Invalid x-tenant-id header");
                        }
                    }

                    Long finalCompanyId = tokenCompanyId;
                    if (headers.containsKey("x-company-id") || headers.containsKey("X-Company-Id")) {
                        try {
                            String headerVal = headers.getOrDefault("x-company-id", headers.get("X-Company-Id"));
                            finalCompanyId = Long.parseLong(headerVal);
                        } catch (Exception e) {
                            log.warn("Invalid x-company-id header");
                        }
                    }

                    return new UserContext(finalTenantId, finalCompanyId, roles);
                });
    }

    /**
     * GET /api/v1/website/status
     * Check if a website exists for the current user's company.
     */
    @GetMapping("/status")
    public Mono<WebsiteResponse> getWebsiteStatus(@RequestHeader Map<String, String> headers) {
        return getCurrentUserContext(headers)
                .flatMap(ctx -> websiteService.checkWebsiteStatus(ctx.tenantId(), ctx.companyId()));
    }

    /**
     * POST /api/v1/website/create
     * Create a new website catalog.
     */
    @PostMapping("/create")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<WebsiteResponse> createWebsite(@RequestBody WebsiteCreateRequest request, @RequestHeader Map<String, String> headers) {
        return getCurrentUserContext(headers)
                .flatMap(ctx -> {
                    if (request.getTenantId() == null) request.setTenantId(ctx.tenantId());
                    if (request.getCompanyId() == null) request.setCompanyId(ctx.companyId());
                    return websiteService.createWebsite(request);
                });
    }

    /**
     * PUT /api/v1/website/toggle
     * Toggle website status between ENABLED and DISABLED.
     */
    @PutMapping("/toggle")
    public Mono<WebsiteResponse> toggleWebsiteStatus(
            @RequestParam Long websiteId,
            @RequestParam String status,
            @RequestHeader Map<String, String> headers) {
        return getCurrentUserContext(headers)
                .flatMap(ctx -> websiteService.toggleWebsiteStatus(websiteId, status, ctx.tenantId(), ctx.companyId()));
    }

    /**
     * DELETE /api/v1/website/delete
     * Delete a website.
     */
    @DeleteMapping("/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteWebsite(
            @RequestParam Long websiteId,
            @RequestHeader Map<String, String> headers) {
        return getCurrentUserContext(headers)
                .flatMap(ctx -> websiteService.deleteWebsite(websiteId, ctx.tenantId(), ctx.companyId()));
    }

    /**
     * GET /api/v1/website/metrics
     * Get demo metrics for the website dashboard.
     */
    @GetMapping("/metrics")
    public Mono<WebsiteMetricsDTO> getMetrics(@RequestParam Long websiteId) {
        return websiteService.getDemoMetrics(websiteId);
    }

    /**
     * GET /api/v1/website/domain/validate
     * Validate subdomain availability.
     */
    @GetMapping("/domain/validate")
    public Mono<Map<String, Boolean>> validateSubdomain(@RequestParam String subdomain) {
        return websiteService.validateSubdomain(subdomain)
                .map(available -> Map.of("available", available));
    }

    /**
     * POST /api/v1/website/rebuild
     * Re-trigger the storefront build process.
     */
    @PostMapping("/rebuild")
    public Mono<Void> rebuildWebsite(@RequestParam Long websiteId, @RequestHeader Map<String, String> headers) {
        return getCurrentUserContext(headers)
                .flatMap(ctx -> websiteService.triggerRebuild(websiteId, ctx.tenantId(), ctx.companyId()));
    }
}