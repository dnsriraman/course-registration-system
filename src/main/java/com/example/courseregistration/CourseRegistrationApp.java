package com.example.courseregistration;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Scanner;
import java.util.stream.Collectors;

/** A beginner-friendly, in-memory course registration application. */
public class CourseRegistrationApp {
    private final Map<String, Student> students = new LinkedHashMap<String, Student>();
    private final Map<String, Course> courses = new LinkedHashMap<String, Course>();
    private final List<Registration> registrations = new ArrayList<Registration>();

    public static void main(String[] args) {
        CourseRegistrationApp app = new CourseRegistrationApp();
        app.loadSampleData();
        app.run();
    }

    private void loadSampleData() {
        students.put("S101", new Student("S101", "Asha Kumar", "asha@example.com"));
        students.put("S102", new Student("S102", "Ben Thomas", "ben@example.com"));
        students.put("S103", new Student("S103", "Chitra Rao", "chitra@example.com"));
        courses.put("C101", new Course("C101", "Java Programming", 3));
        courses.put("C102", new Course("C102", "Database Basics", 2));
        register("S101", "C101", LocalDate.of(2026, 9, 10));
        register("S102", "C101", LocalDate.of(2026, 9, 12));
        register("S103", "C102", LocalDate.of(2026, 9, 14));
    }

    private void run() {
        Scanner scanner = new Scanner(System.in);
        System.out.println("=== Course Registration System ===");
        boolean running = true;
        while (running) {
            System.out.println("\n1. List students and courses  2. Register  3. Drop course");
            System.out.println("4. View course report         5. Exit");
            System.out.print("Choose an option: ");
            String choice = scanner.nextLine().trim();
            switch (choice) {
                case "1": listStudentsAndCourses(); break;
                case "2":
                    listStudentsAndCourses();
                    System.out.print("Student ID: "); String studentId = scanner.nextLine().trim();
                    System.out.print("Course ID: "); String courseId = scanner.nextLine().trim();
                    System.out.println(register(studentId, courseId, LocalDate.now()));
                    break;
                case "3":
                    listStudentsAndCourses();
                    System.out.print("Student ID: "); studentId = scanner.nextLine().trim();
                    System.out.print("Course ID: "); courseId = scanner.nextLine().trim();
                    System.out.println(drop(studentId, courseId));
                    break;
                case "4": showReport(scanner); break;
                case "5": running = false; System.out.println("Goodbye!"); break;
                default: System.out.println("Invalid option. Please choose 1 to 5.");
            }
        }
        scanner.close();
    }

    private String register(String studentId, String courseId, LocalDate date) {
        Student student = students.get(studentId);
        Course course = courses.get(courseId);
        if (student == null) return "Registration failed: student ID '" + studentId + "' was not found.";
        if (course == null) return "Registration failed: course ID '" + courseId + "' was not found.";
        if (findRegistration(studentId, courseId) != null)
            return "Registration failed: student is already enrolled in this course.";
        long enrolled = registrations.stream().filter(r -> r.getCourseId().equals(courseId)).count();
        if (enrolled >= course.getCapacity()) return "Registration failed: course is full.";
        registrations.add(new Registration(studentId, courseId, date));
        return "Registration successful: " + student.getName() + " enrolled in " + course.getName() + ".";
    }

    private String drop(String studentId, String courseId) {
        Registration registration = findRegistration(studentId, courseId);
        if (registration == null)
            return "Drop failed: no matching student/course registration was found.";
        registrations.remove(registration);
        return "Drop successful: " + students.get(studentId).getName() + " was removed from "
                + courses.get(courseId).getName() + ".";
    }

    private Registration findRegistration(String studentId, String courseId) {
        return registrations.stream().filter(r -> r.getStudentId().equals(studentId)
                && r.getCourseId().equals(courseId)).findFirst().orElse(null);
    }

    private void showReport(Scanner scanner) {
        System.out.println("Available courses:");
        courses.values().forEach(c -> System.out.println("  " + c.getId() + " - " + c.getName()));
        System.out.print("Course ID: ");
        String courseId = scanner.nextLine().trim();
        if (!courses.containsKey(courseId)) {
            System.out.println("Report unavailable: course ID '" + courseId + "' was not found.");
            return;
        }
        System.out.println("Sort by: 1. Student name  2. Registration date");
        System.out.print("Choose sort order: ");
        String sort = scanner.nextLine().trim();
        if (!"1".equals(sort) && !"2".equals(sort)) {
            System.out.println("Invalid sort option. Choose 1 or 2.");
            return;
        }
        Comparator<Registration> comparator = "1".equals(sort)
                ? Comparator.comparing(r -> students.get(r.getStudentId()).getName(), String.CASE_INSENSITIVE_ORDER)
                : Comparator.comparing(Registration::getRegistrationDate);
        List<Registration> enrolled = registrations.stream()
                .filter(r -> r.getCourseId().equals(courseId))
                .sorted(comparator)
                .collect(Collectors.toList());
        Course course = courses.get(courseId);
        System.out.println("\nCourse Registration Report: " + course.getName() + " (" + courseId + ")");
        if (enrolled.isEmpty()) System.out.println("No students are currently enrolled.");
        else enrolled.forEach(r -> {
            Student s = students.get(r.getStudentId());
            System.out.println("- " + s.getName() + " (" + s.getId() + ") | " + s.getEmail()
                    + " | Registered: " + r.getRegistrationDate() + " | Status: ENROLLED");
        });
        System.out.println("Enrollment: " + enrolled.size() + "/" + course.getCapacity());
    }

    private void listStudentsAndCourses() {
        System.out.println("Students:");
        students.values().forEach(s -> System.out.println("  " + s.getId() + " - " + s.getName()));
        System.out.println("Courses:");
        courses.values().forEach(c -> System.out.println("  " + c.getId() + " - " + c.getName()
                + " (capacity " + c.getCapacity() + ")"));
    }

    private static class Student {
        private final String id, name, email;
        Student(String id, String name, String email) { this.id = id; this.name = name; this.email = email; }
        String getId() { return id; } String getName() { return name; } String getEmail() { return email; }
    }
    private static class Course {
        private final String id, name; private final int capacity;
        Course(String id, String name, int capacity) { this.id = id; this.name = name; this.capacity = capacity; }
        String getId() { return id; } String getName() { return name; } int getCapacity() { return capacity; }
    }
    private static class Registration {
        private final String studentId, courseId; private final LocalDate registrationDate;
        Registration(String studentId, String courseId, LocalDate registrationDate) {
            this.studentId = studentId; this.courseId = courseId; this.registrationDate = registrationDate;
        }
        String getStudentId() { return studentId; } String getCourseId() { return courseId; }
        LocalDate getRegistrationDate() { return registrationDate; }
    }
}
