package com.app.controllers;

import com.app.dto.AuthResponse;
import com.app.dto.OAuthLoginRequest;
import com.app.dto.OAuthUserInfo;
import com.app.dto.UserDto;
import com.app.persistence.entity.UserEntity;
import com.app.persistence.repository.RoleRepository;
import com.app.persistence.services.OAuthService;
import com.app.persistence.services.UserService;
import com.app.util.JwtProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

/**
 * CLOUD-279: Google OAuth Controller
 * Handles POST /api/v2/auth/oauth/google
 * Validates Google ID token and returns JWT.
 */
@RestController
@RequestMapping("/api/v2/auth/oauth")
@CrossOrigin(origins = "*")
public class GoogleAuthController {

    private static final Logger log = LoggerFactory.getLogger(GoogleAuthController.class);

    private final OAuthService oauthService;
    private final UserService userService;
    private final JwtProvider jwtProvider;
    private final RoleRepository roleRepository;

    public GoogleAuthController(OAuthService oauthService,
                                 UserService userService,
                                 JwtProvider jwtProvider,
                                 RoleRepository roleRepository) {
        this.oauthService = oauthService;
        this.userService = userService;
        this.jwtProvider = jwtProvider;
        this.roleRepository = roleRepository;
    }

    /**
     * POST /api/v2/auth/oauth/google
     * Validates a Google ID token and returns a JWT.
     *
     * Request body: { credential: "<Google ID token JWT>" }
     * Response: AuthResponse with JWT and user data
     */
    @PostMapping("/google")
    public Mono<ResponseEntity<AuthResponse>> googleLogin(@RequestBody OAuthLoginRequest request) {
        log.info("🔐 [GOOGLE-OAUTH] Received Google OAuth login request");

        if (request.getCredential() == null || request.getCredential().isEmpty()) {
            log.warn("⚠️ [GOOGLE-OAUTH] Missing credential in request");
            return Mono.just(ResponseEntity.badRequest().body(
                    AuthResponse.builder()
                            .status(false)
                            .message("Google credential (ID token) is required")
                            .build()
            ));
        }

        return oauthService.validateGoogleToken(request.getCredential())
                .flatMap(oauthInfo -> {
                    log.info("✅ [GOOGLE-OAUTH] Token valid for email: {}", oauthInfo.getEmail());
                    return oauthService.findOrCreateOAuthUser(oauthInfo);
                })
                .flatMap(user -> {
                    log.info("✅ [GOOGLE-OAUTH] User found/created: {}", user.getUsername());
                    return roleRepository.findRolesByUserId(user.getId())
                            .map(role -> "ROLE_" + role.getName())
                            .collectList()
                            .flatMap(roles -> userService.convertToDto(user)
                                    .map(userDto -> {
                                        String authorities = String.join(",", roles);
                                        String token = jwtProvider.createToken(
                                                user.getUsername(),
                                                authorities,
                                                userDto.getCustomerId(),
                                                userDto.getActiveCompanyId()
                                        );

                                        boolean isNewUser = user.getCreatedAt() != null &&
                                                user.getCreatedAt().plusMinutes(5).isAfter(java.time.LocalDateTime.now());

                                        return ResponseEntity.ok(AuthResponse.builder()
                                                .username(user.getUsername())
                                                .message("Google login exitoso")
                                                .jwt(token)
                                                .status(true)
                                                .user(userDto)
                                                .build());
                                    }));
                })
                .onErrorResume(e -> {
                    log.error("❌ [GOOGLE-OAUTH] Login failed: {}", e.getMessage());
                    return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                            AuthResponse.builder()
                                    .status(false)
                                    .message("Google authentication failed: " + e.getMessage())
                                    .build()
                    ));
                });
    }

    /**
     * GET /api/v2/auth/oauth/google/config
     * Returns the Google Client ID for frontend initialization.
     */
    @GetMapping("/google/config")
    public Mono<ResponseEntity<Map<String, String>>> getGoogleConfig() {
        return Mono.just(ResponseEntity.ok(Map.of(
                "clientId", System.getenv().getOrDefault("GOOGLE_CLIENT_ID", "")
        )));
    }
}
