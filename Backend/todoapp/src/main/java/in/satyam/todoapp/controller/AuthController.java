package in.satyam.todoapp.controller;

import in.satyam.todoapp.dto.*;
import in.satyam.todoapp.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:3000") // 👈 Optional: allow React frontend
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/register")
    public JwtResponse register(@RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public JwtResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }
}
