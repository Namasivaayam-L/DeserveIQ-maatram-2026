package com.maatram.deserveiq.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import java.util.Date;

@Component
public class JwtUtil {

    private final String SECRET = "YourSuperSecretKeyForJWTYourSuperSecretKey"; // 32+ chars
    private final long EXP = 24 * 60 * 60 * 1000; // 24 hours

    public String generateToken(String email) {
    return Jwts.builder()
            .subject(email)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + EXP))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes()), Jwts.SIG.HS256)
            .compact();
}


   public String extractEmail(String token) {
    JwtParser parser = Jwts.parser()
            .verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes()))
            .build();

    return parser.parseSignedClaims(token)
            .getPayload()
            .getSubject();
}

}
