package in.satyam.todoapp.service;

import in.satyam.todoapp.dto.TodoDto;
import in.satyam.todoapp.entity.Todo;
import in.satyam.todoapp.entity.User;
import in.satyam.todoapp.repository.TodoRepository;
import in.satyam.todoapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class TodoServiceImpl implements TodoService {

    @Autowired
    private TodoRepository todoRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    public List<TodoDto> getAllTodos(String username) {
        User user = getUser(username);
        return todoRepository.findByUser(user)
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    public TodoDto createTodo(String username, TodoDto dto) {
        User user = getUser(username);
        Todo todo = Todo.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .status(Todo.Status.valueOf(dto.getStatus()))
                .dueDate(dto.getDueDate())
                .user(user)
                .build();
        return mapToDto(todoRepository.save(todo));
    }

    @Override
    public TodoDto updateTodo(String username, Long id, TodoDto dto) {
        User user = getUser(username);
        Todo todo = todoRepository.findById(id)
                .filter(t -> t.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new RuntimeException("Todo not found"));

        todo.setTitle(dto.getTitle());
        todo.setDescription(dto.getDescription());
        todo.setStatus(Todo.Status.valueOf(dto.getStatus()));
        todo.setDueDate(dto.getDueDate());

        return mapToDto(todoRepository.save(todo));
    }

    @Override
    public void deleteTodo(String username, Long id) {
        User user = getUser(username);
        Todo todo = todoRepository.findById(id)
                .filter(t -> t.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new RuntimeException("Todo not found"));

        todoRepository.delete(todo);
    }

    private TodoDto mapToDto(Todo todo) {
        return TodoDto.builder()
                .id(todo.getId())
                .title(todo.getTitle())
                .description(todo.getDescription())
                .status(todo.getStatus().name())
                .dueDate(todo.getDueDate())
                .build();
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
