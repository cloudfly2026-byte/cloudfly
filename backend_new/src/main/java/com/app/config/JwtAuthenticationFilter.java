package com.app.config;

import com.app.util.JwtProvider;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public class JwtAuthenticationFilter implements WebFilter {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private final JwtProvider jwtProvider;

    @Value("${internal.ai.secret:}")
    private String internalAiSecret;

    public JwtAuthenticationFilter(JwtProvider jwtProvider) {
        this.jwtProvider = jwtProvider;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (path.startsWith("/media/")) {
            return chain.filter(exchange);
        }

        String aiSecret = exchange.getRequest().getHeaders().getFirst("X-AI-Secret");
        if (isInternalAiRequest(path, aiSecret)) {
            List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_AI_AGENT"));
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("ai-agent", null, authorities);
            return chain.filter(exchange)
                    .contextWrite(ReactiveSecurityContextHolder.withAuthentication(auth));
        }

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return chain.filter(exchange);
        }

        String token = authHeader.substring(7);

        try {
            DecodedJWT decodedJWT = jwtProvider.validateToken(token);
            String username = jwtProvider.extractUsername(decodedJWT);

            com.auth0.jwt.interfaces.Claim authoritiesClaim = decodedJWT.getClaim("authorities");
            String authoritiesStr = !authoritiesClaim.isMissing() ? authoritiesClaim.asString() : "";

            List<SimpleGrantedAuthority> authorities = Arrays.stream(authoritiesStr.split(","))
                    .filter(s -> !s.isEmpty())
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toList());

            Long customerId = decodedJWT.getClaim("customer_id").asLong();
            Long companyId = decodedJWT.getClaim("company_id").asLong();

            log.debug("JWT validated for user {} on path {}", username, path);

            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(username, null,
                    authorities);

            java.util.Map<String, Object> details = new java.util.HashMap<>();
            details.put("customer_id", customerId);
            details.put("company_id", companyId);
            auth.setDetails(details);

            return chain.filter(exchange)
                    .contextWrite(ReactiveSecurityContextHolder.withAuthentication(auth));

        } catch (Exception e) {
            log.warn("JWT validation failed for path {}", path);
            return chain.filter(exchange);
        }
    }

    private boolean isInternalAiRequest(String path, String aiSecret) {
        if (!path.startsWith("/internal/ai/") && !path.startsWith("/api/ai-agent/internal/")) {
            return false;
        }
        return internalAiSecret != null && !internalAiSecret.isBlank() && internalAiSecret.equals(aiSecret);
    }
}
