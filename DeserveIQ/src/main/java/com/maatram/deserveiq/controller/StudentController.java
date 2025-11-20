package com.maatram.deserveiq.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.maatram.deserveiq.entity.Student;
import com.maatram.deserveiq.repository.StudentRepository;

import java.util.List;

@RestController
@RequestMapping("/api/students")
public class StudentController {
    private final StudentRepository repo;
    public StudentController(StudentRepository repo) { this.repo = repo; }

    @GetMapping
    public List<Student> all(){ return repo.findAll(); }

    @GetMapping("/{id}")
    public ResponseEntity<Student> get(@PathVariable Long id){
        return repo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Student create(@RequestBody Student s) { return repo.save(s); }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id){
        repo.deleteById(id); return ResponseEntity.noContent().build();
    }
}
