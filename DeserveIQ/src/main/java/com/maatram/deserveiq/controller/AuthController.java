package com.maatram.deserveiq.controller;

import com.maatram.deserveiq.util.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

record LoginRequest(String email, String password) {}

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final JwtUtil jwt;

    public AuthController(JwtUtil jwt) {
        this.jwt = jwt;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {

        // Hardcoded admin login
        if (req.email().equals("admin@maatram.org") && req.password().equals("password")) {
            String token = jwt.generateToken(req.email());
            return ResponseEntity.ok().body(token);
        }

        return ResponseEntity.status(401).body("Invalid credentials");
    }
}
