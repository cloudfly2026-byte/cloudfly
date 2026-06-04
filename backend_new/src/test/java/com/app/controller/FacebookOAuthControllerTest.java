package com.app.controller;

import com.app.controllers.FacebookOAuthController;
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
 * CLOUD-286: Integration tests for Facebook OAuth endpoint.
 */
@WebFluxTest(
    controllers = FacebookOAuthController.class,
    excludeAutoConfiguration = {
        ReactiveSecurityAutoConfiguration.class,
        ReactiveUserDetailsServiceAutoConfiguration.class
    }
)
public class FacebookOAuthControllerTest {

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
    void testFacebookLogin_Success() {
        OAuthUserInfo oauthInfo = new OAuthUserInfo(
                "FACEBOOK",
                "fb-123",
                "test@fb.com",
                "FB User",
                "avatar-url",
                true
        );

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

        UserDto userDto = new UserDto();
        userDto.setId(2L);
        userDto.setUsername("fbuser");
        userDto.setEmail("test@fb.com");
        userDto.setCustomerId(20L);

        RoleEntity role = RoleEntity.builder().id(1L).name("ADMIN").build();

        when(oauthService.validateFacebookToken(anyString(), anyString())).thenReturn(Mono.just(oauthInfo));
        when(oauthService.findOrCreateOAuthUser(any(OAuthUserInfo.class))).thenReturn(Mono.just(user));
        when(roleRepository.findRolesByUserId(anyLong())).thenReturn(Flux.just(role));
        when(userService.convertToDto(any(UserEntity.class))).thenReturn(Mono.just(userDto));
        when(jwtProvider.createToken(anyString(), anyString(), anyLong(), any())).thenReturn("jwt-fb-token");

        webTestClient.post()
                .uri("/api/v2/auth/oauth/facebook")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("credential", "valid-fb-token", "userId", "fb-123"))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo(true)
                .jsonPath("$.jwt").isEqualTo("jwt-fb-token")
                .jsonPath("$.username").isEqualTo("fbuser");
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
        when(oauthService.validateFacebookToken(anyString(), anyString()))
                .thenReturn(Mono.error(new RuntimeException("Invalid Facebook token")));

        webTestClient.post()
                .uri("/api/v2/auth/oauth/facebook")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("credential", "bad-token", "userId", "fb-123"))
                .exchange()
                .expectStatus().is4xxClientError();
    }
}
