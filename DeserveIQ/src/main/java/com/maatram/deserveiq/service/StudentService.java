package com.maatram.deserveiq.service;

import org.springframework.stereotype.Service;
import com.maatram.deserveiq.entity.Student;
import com.maatram.deserveiq.repository.StudentRepository;

@Service
public class StudentService {
    private final StudentRepository repo;
    public StudentService(StudentRepository repo){ this.repo = repo; }
    public Student save(Student s){ return repo.save(s); }
}
