package com.app.events;

import com.app.dto.WebsiteStatusNotification;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebsiteEventProducer {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Sends a site construction event to the agents_site_constructor topic.
     * This triggers the site builder agent to start building the website.
     */
    public Mono<Void> publishSiteConstruction(Long websiteId, Long domainId, String subdomain, Long tenantId, Long companyId) {
        return Mono.fromRunnable(() -> {
            try {
                Map<String, Object> payload = new HashMap<>();
                payload.put("websiteId", websiteId);
                payload.put("domainId", domainId);
                payload.put("subdomain", subdomain);
                payload.put("tenantId", tenantId);
                payload.put("companyId", companyId);
                payload.put("action", "CONSTRUCT");

                String payloadAsJson = objectMapper.writeValueAsString(payload);
                kafkaTemplate.send("agents_site_constructor", payloadAsJson);
                log.info("✅ Evento agents_site_constructor publicado para websiteId: {}", websiteId);
            } catch (Exception e) {
                log.error("❌ Error publicando evento de construcción para Kafka: {}", e.getMessage());
            }
        });
    }

    /**
     * Sends a website status change event to the website_status_changes topic.
     * This triggers web notifications and WhatsApp notifications.
     */
    public Mono<Void> publishStatusChange(WebsiteStatusNotification notification) {
        return Mono.fromRunnable(() -> {
            try {
                String payloadAsJson = objectMapper.writeValueAsString(notification);
                kafkaTemplate.send("website_status_changes", payloadAsJson);
                log.info("✅ Evento website_status_changes publicado para websiteId: {}, status: {}",
                        notification.getWebsiteId(), notification.getNewStatus());
            } catch (Exception e) {
                log.error("❌ Error publicando cambio de estado para Kafka: {}", e.getMessage());
            }
        });
    }
}