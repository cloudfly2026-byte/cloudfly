package com.app.controller;

import com.app.controllers.GoogleAuthController;
import com.app.dto.AuthResponse;
import com.app.dto.OAuthUserInfo;
import com.app.dto.UserDto;
import com.app.persistence.entity.RoleEntity;
import com.app.persistence.entity.UserEntity;
import com.app.persistence.repository.RoleRepository;
import com.app.persistence.services.OAuthService;
import com.app.persistence.services.UserService;
import com.app.util.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.reactive.ReactiveSecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.reactive.ReactiveUserDetailsServiceAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * CLOUD-286: Integration tests for Google OAuth endpoint.
 */
@WebFluxTest(
    controllers = GoogleAuthController.class,
    excludeAutoConfiguration = {
        ReactiveSecurityAutoConfiguration.class,
        ReactiveUserDetailsServiceAutoConfiguration.class
    }
)
public class GoogleAuthControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockitoBean
    private OAuthService oauthService;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtProvider jwtProvider;

    @MockitoBean
    private RoleRepository roleRepository;

    @Test
    void testGoogleLogin_Success() {
        OAuthUserInfo oauthInfo = new OAuthUserInfo(
                "GOOGLE",
                "google-123",
                "test@gmail.com",
                "Test User",
                "avatar-url",
                true
        );

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

        UserDto userDto = new UserDto();
        userDto.setId(1L);
        userDto.setUsername("testuser");
        userDto.setEmail("test@gmail.com");
        userDto.setCustomerId(10L);

        RoleEntity role = RoleEntity.builder().id(1L).name("ADMIN").build();

        when(oauthService.validateGoogleToken(anyString())).thenReturn(Mono.just(oauthInfo));
        when(oauthService.findOrCreateOAuthUser(any(OAuthUserInfo.class))).thenReturn(Mono.just(user));
        when(roleRepository.findRolesByUserId(anyLong())).thenReturn(Flux.just(role));
        when(userService.convertToDto(any(UserEntity.class))).thenReturn(Mono.just(userDto));
        when(jwtProvider.createToken(anyString(), anyString(), anyLong(), any())).thenReturn("jwt-token-here");

        webTestClient.post()
                .uri("/api/v2/auth/oauth/google")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("credential", "valid-google-token"))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo(true)
                .jsonPath("$.jwt").isEqualTo("jwt-token-here")
                .jsonPath("$.username").isEqualTo("testuser");
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
        when(oauthService.validateGoogleToken(anyString()))
                .thenReturn(Mono.error(new RuntimeException("Invalid token")));

        webTestClient.post()
                .uri("/api/v2/auth/oauth/google")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("credential", "invalid-token"))
                .exchange()
                .expectStatus().is4xxClientError();
    }
}
