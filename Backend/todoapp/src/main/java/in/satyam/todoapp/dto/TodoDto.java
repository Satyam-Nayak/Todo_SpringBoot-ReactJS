package in.satyam.todoapp.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TodoDto {
    private Long id;
    private String title;
    private String description;
    private String status; // PENDING or COMPLETED
    private LocalDateTime dueDate;
}
