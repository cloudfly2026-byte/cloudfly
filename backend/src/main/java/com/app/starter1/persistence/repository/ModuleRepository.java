package com.app.starter1.persistence.repository;

import com.app.starter1.persistence.entity.Module;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ModuleRepository extends JpaRepository<Module, Long> {
    Optional<Module> findByCode(String code);
    List<Module> findByIsActiveTrueOrderByDisplayOrderAsc();
}

