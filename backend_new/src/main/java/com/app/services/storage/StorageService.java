package com.app.services.storage;

import org.springframework.http.codec.multipart.FilePart;
import reactor.core.publisher.Mono;

import java.nio.file.Path;

public interface StorageService {
    void init();
    Mono<String> store(FilePart file, Long tenantId, Long companyId);
    Path load(String filename, Long tenantId, Long companyId);
    Mono<Void> delete(String filename, Long tenantId, Long companyId);
}
