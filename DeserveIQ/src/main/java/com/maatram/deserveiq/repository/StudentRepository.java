package com.maatram.deserveiq.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import com.maatram.deserveiq.entity.Student;

public interface StudentRepository extends JpaRepository<Student, Long> { }
