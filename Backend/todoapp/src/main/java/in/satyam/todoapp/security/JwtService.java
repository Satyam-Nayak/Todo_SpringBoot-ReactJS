package in.satyam.todoapp.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.security.Key;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration; // in milliseconds

    // Called after the bean is initialized
    @PostConstruct
    public void testJwtInit() {
        try {
            System.out.println("JWT parser init test: " + Jwts.parserBuilder().getClass().getName());
            System.out.println("JWT secret length: " + (secret != null ? secret.length() : "null"));
            System.out.println("JWT expiration: " + expiration);

            // Test key generation
            getSigningKey();
            System.out.println("JWT Service initialized successfully");
        } catch (Exception e) {
            System.err.println("Error initializing JWT Service: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("JWT Service initialization failed", e);
        }
    }

    // Decode the Base64 encoded secret
    private Key getSigningKey() {
        try {
            if (secret == null || secret.trim().isEmpty()) {
                throw new IllegalArgumentException("JWT secret cannot be null or empty");
            }
            byte[] keyBytes = Decoders.BASE64.decode(secret);
            return Keys.hmacShaKeyFor(keyBytes);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create signing key: " + e.getMessage(), e);
        }
    }

    public String generateToken(String username) {
        try {
            return Jwts.builder()
                    .setSubject(username)
                    .setIssuedAt(new Date(System.currentTimeMillis()))
                    .setExpiration(new Date(System.currentTimeMillis() + expiration))
                    .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                    .compact();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate token: " + e.getMessage(), e);
        }
    }

    public String generateToken(Map<String, Object> extraClaims, String username) {
        try {
            return Jwts.builder()
                    .setClaims(extraClaims)
                    .setSubject(username)
                    .setIssuedAt(new Date(System.currentTimeMillis()))
                    .setExpiration(new Date(System.currentTimeMillis() + expiration))
                    .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                    .compact();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate token with claims: " + e.getMessage(), e);
        }
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> resolver) {
        final Claims claims = extractAllClaims(token);
        return resolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        try {
            return Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (Exception e) {
            throw new RuntimeException("Failed to extract claims: " + e.getMessage(), e);
        }
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    public boolean isTokenValid(String token, String expectedUsername) {
        try {
            String username = extractUsername(token);
            return (username.equals(expectedUsername) && !isTokenExpired(token));
        } catch (Exception e) {
            return false;
        }
    }
}