package in.satyam.todoapp.controller;

import in.satyam.todoapp.dto.TodoDto;
import in.satyam.todoapp.service.TodoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/todos")
@CrossOrigin(origins = "http://localhost:3000")
public class TodoController {

    @Autowired
    private TodoService todoService;

    @GetMapping
    public List<TodoDto> getTodos(Authentication auth) {
        return todoService.getAllTodos(auth.getName());
    }

    @PostMapping
    public TodoDto createTodo(@RequestBody TodoDto dto, Authentication auth) {
        return todoService.createTodo(auth.getName(), dto);
    }

    @PutMapping("/{id}")
    public TodoDto updateTodo(@PathVariable Long id, @RequestBody TodoDto dto, Authentication auth) {
        return todoService.updateTodo(auth.getName(), id, dto);
    }

    @DeleteMapping("/{id}")
    public void deleteTodo(@PathVariable Long id, Authentication auth) {
        todoService.deleteTodo(auth.getName(), id);
    }
}
