package com.app;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.config.annotation.method.configuration.EnableReactiveMethodSecurity;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.userdetails.ReactiveUserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
@EnableReactiveMethodSecurity
@EnableScheduling
public class AppConfig {

    @Bean
    public com.app.config.JwtAuthenticationFilter jwtAuthenticationFilter(com.app.util.JwtProvider jwtProvider) {
        return new com.app.config.JwtAuthenticationFilter(jwtProvider);
    }

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http, com.app.config.JwtAuthenticationFilter jwtAuthenticationFilter) {
        return http
                .cors(org.springframework.security.config.Customizer.withDefaults())
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(exchanges -> exchanges
                        .pathMatchers(
                                "/media/**",
                                "/auth/**",
                                "/login",
                                "/register",
                                "/verify",
                                "/forgot-password",
                                "/reset-password",
                                "/api/webhooks/evolution",
                                "/api/chatbotEnable",
                                "/public/invoices/**",
                                "/api/v2/auth/oauth/**")
                        .permitAll()
                        .pathMatchers(org.springframework.http.HttpMethod.OPTIONS).permitAll()
                        .anyExchange().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, org.springframework.security.config.web.server.SecurityWebFiltersOrder.AUTHENTICATION)
                .build();
    }

    @Bean
    public ReactiveAuthenticationManager authenticationManager(ReactiveUserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {
        org.springframework.security.authentication.UserDetailsRepositoryReactiveAuthenticationManager authManager = new org.springframework.security.authentication.UserDetailsRepositoryReactiveAuthenticationManager(userDetailsService);
        authManager.setPasswordEncoder(passwordEncoder);
        return authManager;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
