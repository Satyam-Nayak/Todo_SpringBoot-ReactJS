package in.satyam.todoapp.service;

import in.satyam.todoapp.dto.TodoDto;

import java.util.List;

public interface TodoService {
    List<TodoDto> getAllTodos(String username);
    TodoDto createTodo(String username, TodoDto dto);
    TodoDto updateTodo(String username, Long id, TodoDto dto);
    void deleteTodo(String username, Long id);
}
