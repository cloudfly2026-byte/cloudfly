package com.app.config;

import com.app.util.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class JwtAuthenticationFilterTest {

    @Test
    void querySecretDoesNotAuthenticateRequests() {
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(mock(JwtProvider.class));
        ReflectionTestUtils.setField(filter, "internalAiSecret", "test-secret");
        MockServerWebExchange exchange = MockServerWebExchange.from(
                org.springframework.mock.http.server.reactive.MockServerHttpRequest
                        .get("/internal/ai/messages?ai_secret=test-secret")
                        .build());

        AtomicReference<Object> authentication = new AtomicReference<>();
        WebFilterChain chain = currentAuthenticationChain(authentication);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(authentication.get()).isNull();
    }

    @Test
    void internalAiSecretOnlyAuthenticatesInternalAiRoutesFromDedicatedHeader() {
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(mock(JwtProvider.class));
        ReflectionTestUtils.setField(filter, "internalAiSecret", "test-secret");
        MockServerWebExchange exchange = MockServerWebExchange.from(
                org.springframework.mock.http.server.reactive.MockServerHttpRequest
                        .get("/internal/ai/messages")
                        .header("X-AI-Secret", "test-secret")
                        .build());

        AtomicReference<Object> authentication = new AtomicReference<>();
        WebFilterChain chain = currentAuthenticationChain(authentication);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(authentication.get()).isNotNull();
    }

    @Test
    void internalAiSecretDoesNotAuthenticateGeneralRoutes() {
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(mock(JwtProvider.class));
        ReflectionTestUtils.setField(filter, "internalAiSecret", "test-secret");
        MockServerWebExchange exchange = MockServerWebExchange.from(
                org.springframework.mock.http.server.reactive.MockServerHttpRequest
                        .get("/api/users")
                        .header("X-AI-Secret", "test-secret")
                        .build());

        AtomicReference<Object> authentication = new AtomicReference<>();
        WebFilterChain chain = currentAuthenticationChain(authentication);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(authentication.get()).isNull();
    }

    private WebFilterChain currentAuthenticationChain(AtomicReference<Object> authentication) {
        return exchange -> ReactiveSecurityContextHolder.getContext()
                .doOnNext(context -> authentication.set(context.getAuthentication()))
                .then(Mono.empty());
    }
}
