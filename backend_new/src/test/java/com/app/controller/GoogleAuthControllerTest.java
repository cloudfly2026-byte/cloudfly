package com.app.controller;

import com.app.dto.OAuthLoginResponse;
import com.app.persistence.entity.UserEntity;
import com.app.persistence.services.OAuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * CLOUD-286: Integration tests for Google OAuth endpoint.
 */
@WebFluxTest(GoogleAuthController.class)
public class GoogleAuthControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private OAuthService oauthService;

    @Test
    void testGoogleLogin_Success() {
        UserEntity user = UserEntity.builder()
                .id(1L)
                .nombres("Test")
                .apellidos("User")
                .username("testuser")
                .email("test@gmail.com")
                .isEnabled(true)
                .customerId(10L)
                .createdAt(LocalDateTime.now())
                .build();

        OAuthLoginResponse response = OAuthLoginResponse.builder()
                .token("jwt-token-here")
                .isNewUser(false)
                .user(user)
                .build();

        when(oauthService.handleGoogleOAuth(anyString()))
                .thenReturn(Mono.just(response));

        webTestClient.post()
                .uri("/api/v2/auth/oauth/google")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("idToken", "valid-google-token"))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.token").isEqualTo("jwt-token-here")
                .jsonPath("$.isNewUser").isEqualTo(false);
    }

    @Test
    void testGoogleLogin_MissingToken() {
        webTestClient.post()
                .uri("/api/v2/auth/oauth/google")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of())
                .exchange()
                .expectStatus().isBadRequest();
    }

    @Test
    void testGoogleLogin_InvalidToken() {
        when(oauthService.handleGoogleOAuth(anyString()))
                .thenReturn(Mono.error(new RuntimeException("Invalid token")));

        webTestClient.post()
                .uri("/api/v2/auth/oauth/google")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("idToken", "invalid-token"))
                .exchange()
                .expectStatus().is4xxClientError();
    }
}
