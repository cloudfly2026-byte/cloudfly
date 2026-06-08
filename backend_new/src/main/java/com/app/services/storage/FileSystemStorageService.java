package com.app.services.storage;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class FileSystemStorageService implements StorageService {

    private final Path rootLocation;

    public FileSystemStorageService(@Value("${app.storage.location:/uploads}") String location) {
        this.rootLocation = Paths.get(location);
    }

    @Override
    @PostConstruct
    public void init() {
        try {
            if (!Files.exists(rootLocation)) {
                Files.createDirectories(rootLocation);
            }
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize storage", e);
        }
    }

    @Override
    public Mono<String> store(FilePart file, Long tenantId, Long companyId) {
        String originalFilename = file.filename();
        String extension = "";
        int i = originalFilename.lastIndexOf('.');
        if (i > 0) {
            extension = originalFilename.substring(i);
        }
        
        String filename = UUID.randomUUID().toString() + extension;
        // New path structure: /uploads/{tenantId}/{companyId}/{filename}
        Path companyPath = rootLocation.resolve(tenantId.toString()).resolve(companyId.toString());

        try {
            if (!Files.exists(companyPath)) {
                Files.createDirectories(companyPath);
            }
        } catch (IOException e) {
            return Mono.error(new RuntimeException("Could not create company directory", e));
        }

        Path destinationFile = companyPath.resolve(filename);
        
        return file.transferTo(destinationFile)
                .then(Mono.just(filename));
    }

    @Override
    public Path load(String filename, Long tenantId, Long companyId) {
        return rootLocation.resolve(tenantId.toString()).resolve(companyId.toString()).resolve(filename);
    }

    @Override
    public Mono<Void> delete(String filename, Long tenantId, Long companyId) {
        try {
            Files.deleteIfExists(load(filename, tenantId, companyId));
            return Mono.empty();
        } catch (IOException e) {
            return Mono.error(new RuntimeException("Could not delete file", e));
        }
    }
}
