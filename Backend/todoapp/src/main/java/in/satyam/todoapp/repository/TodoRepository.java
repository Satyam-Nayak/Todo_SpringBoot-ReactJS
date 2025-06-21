package in.satyam.todoapp.repository;

import in.satyam.todoapp.entity.Todo;
import in.satyam.todoapp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TodoRepository extends JpaRepository<Todo, Long> {
    List<Todo> findByUser(User user);
}
