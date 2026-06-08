package com.app.starter1.persistence.services;

import com.app.starter1.persistence.entity.Module;
import com.app.starter1.persistence.repository.ModuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ModuleService {

    private final ModuleRepository moduleRepository;

    public List<Module> getAllModules() {
        return moduleRepository.findAll();
    }

    public List<Module> getActiveModules() {
        return moduleRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
    }

    public Module getById(Long id) {
        return moduleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Módulo no encontrado con ID: " + id));
    }

    @Transactional
    public Module createModule(Module module) {
        if (module.getCode() == null || module.getCode().trim().isEmpty()) {
            throw new IllegalArgumentException("El código del módulo es obligatorio");
        }
        if (module.getName() == null || module.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("El nombre del módulo es obligatorio");
        }
        if (moduleRepository.findByCode(module.getCode()).isPresent()) {
            throw new IllegalArgumentException("Ya existe un módulo con el código: " + module.getCode());
        }
        return moduleRepository.save(module);
    }

    @Transactional
    public Module updateModule(Long id, Module moduleData) {
        Module module = getById(id);
        module.setCode(moduleData.getCode());
        module.setName(moduleData.getName());
        module.setDescription(moduleData.getDescription());
        module.setIcon(moduleData.getIcon());
        module.setMenuPath(moduleData.getMenuPath());
        module.setDisplayOrder(moduleData.getDisplayOrder());
        module.setIsActive(moduleData.getIsActive());
        module.setMenuItems(moduleData.getMenuItems());
        return moduleRepository.save(module);
    }

    @Transactional
    public void deleteModule(Long id) {
        if (!moduleRepository.existsById(id)) {
            throw new RuntimeException("Módulo no encontrado con ID: " + id);
        }
        moduleRepository.deleteById(id);
    }
}

