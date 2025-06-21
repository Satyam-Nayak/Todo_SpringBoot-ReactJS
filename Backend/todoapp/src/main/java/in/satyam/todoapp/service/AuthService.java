package in.satyam.todoapp.service;

import in.satyam.todoapp.dto.*;

public interface AuthService {
    JwtResponse register(RegisterRequest request);
    JwtResponse login(LoginRequest request);
}
