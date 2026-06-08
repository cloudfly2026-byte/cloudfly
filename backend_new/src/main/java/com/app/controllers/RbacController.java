package com.app.controllers;

import com.app.dto.rbac.MenuItemDTO;
import com.app.dto.rbac.UserPermissionsDTO;
import com.app.persistence.entity.ModuleEntity;
import com.app.services.RbacService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rbac")
public class RbacController {

    private final RbacService rbacService;

    public RbacController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    /**
     * Devuelve el menú disponible para los roles del usuario autenticado
     */
    @GetMapping("/menu")
    public Mono<ResponseEntity<List<MenuItemDTO>>> getMenu() {
        return ReactiveSecurityContextHolder.getContext()
                .map(ctx -> ctx.getAuthentication())
                .flatMap(auth -> {
                    List<String> userRoles = auth.getAuthorities().stream()
                            .map(GrantedAuthority::getAuthority)
                            .map(r -> r.replace("ROLE_", ""))
                            .collect(Collectors.toList());
                    
                    Long customerId = null;
                    if (auth.getDetails() instanceof java.util.Map map) {
                        Object cid = map.get("customer_id");
                        if (cid instanceof Number n) customerId = n.longValue();
                    }
                    
                    return rbacService.generateMenuForRoles(userRoles, customerId, auth.getName());
                })
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.status(401).build());
    }

    /**
     * Devuelve los permisos y roles del usuario actual
     */
    @GetMapping("/my-permissions")
    public Mono<ResponseEntity<UserPermissionsDTO>> getMyPermissions() {
        return ReactiveSecurityContextHolder.getContext()
                .map(ctx -> ctx.getAuthentication())
                .map(auth -> {
                    List<String> roles = auth.getAuthorities().stream()
                            .map(GrantedAuthority::getAuthority)
                            .map(r -> r.replace("ROLE_", ""))
                            .collect(Collectors.toList());
                    
                    return ResponseEntity.ok(UserPermissionsDTO.builder()
                            .username(auth.getName())
                            .roles(roles)
                            .build());
                })
                .defaultIfEmpty(ResponseEntity.status(401).build());
    }
    /**
     * Devuelve la lista completa de módulos (admin only)
     */
    @GetMapping("/modules-list")
    public Flux<ModuleEntity> getModulesList() {
        return rbacService.getModulesList();
    }

    /**
     * Crea un nuevo módulo (admin only)
     */
    @PostMapping("/modules")
    public Mono<ResponseEntity<ModuleEntity>> createModule(@RequestBody ModuleEntity module) {
        return rbacService.createModule(module)
                .map(m -> ResponseEntity.status(HttpStatus.CREATED).body(m))
                .onErrorResume(e -> Mono.just(ResponseEntity.badRequest().build()));
    }

    /**
     * Actualiza un módulo existente (admin only)
     */
    @PutMapping("/modules/{id}")
    public Mono<ResponseEntity<ModuleEntity>> updateModule(@PathVariable Long id, @RequestBody ModuleEntity module) {
        return rbacService.updateModule(id, module)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.notFound().build()));
    }

    /**
     * Elimina un módulo (admin only)
     */
    @DeleteMapping("/modules/{id}")
    public Mono<ResponseEntity<Void>> deleteModule(@PathVariable Long id) {
        return rbacService.deleteModule(id)
                .then(Mono.just(ResponseEntity.noContent().<Void>build()))
                .onErrorResume(e -> Mono.just(ResponseEntity.notFound().build()));
    }
}
