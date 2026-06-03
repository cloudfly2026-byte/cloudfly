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
 * CLOUD-286: Integration tests for Facebook OAuth endpoint.
 */
@WebFluxTest(FacebookOAuthController.class)
public class FacebookOAuthControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private OAuthService oauthService;

    @Test
    void testFacebookLogin_Success() {
        UserEntity user = UserEntity.builder()
                .id(2L)
                .nombres("FB")
                .apellidos("User")
                .username("fbuser")
                .email("test@fb.com")
                .isEnabled(true)
                .customerId(20L)
                .createdAt(LocalDateTime.now())
                .build();

        OAuthLoginResponse response = OAuthLoginResponse.builder()
                .token("jwt-fb-token")
                .isNewUser(true)
                .user(user)
                .build();

        when(oauthService.handleFacebookOAuth(anyString(), anyString()))
                .thenReturn(Mono.just(response));

        webTestClient.post()
                .uri("/api/v2/auth/oauth/facebook")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("accessToken", "valid-fb-token", "userId", "fb-123"))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.token").isEqualTo("jwt-fb-token")
                .jsonPath("$.isNewUser").isEqualTo(true);
    }

    @Test
    void testFacebookLogin_MissingAccessToken() {
        webTestClient.post()
                .uri("/api/v2/auth/oauth/facebook")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("userId", "fb-123"))
                .exchange()
                .expectStatus().isBadRequest();
    }

    @Test
    void testFacebookLogin_InvalidToken() {
        when(oauthService.handleFacebookOAuth(anyString(), anyString()))
                .thenReturn(Mono.error(new RuntimeException("Invalid Facebook token")));

        webTestClient.post()
                .uri("/api/v2/auth/oauth/facebook")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("accessToken", "bad-token", "userId", "fb-123"))
                .exchange()
                .expectStatus().is4xxClientError();
    }
}
