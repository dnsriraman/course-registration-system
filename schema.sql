CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  instructor VARCHAR(100) NOT NULL DEFAULT 'Faculty team',
  capacity INT NOT NULL DEFAULT 30,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (capacity > 0)
);
CREATE TABLE IF NOT EXISTS registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_course (student_id, course_id),
  CONSTRAINT fk_registration_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_registration_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

INSERT IGNORE INTO students (student_code, name, email, password_hash) VALUES
  ('S101', 'Asha Kumar', 'asha@example.com', '$2b$10$c5MXa8ewhyiHviWQEDpXB.kXAvzQgIO2i6TupjiYkVg5kMEn14uHy'),
  ('S102', 'Ben Thomas', 'ben@example.com', '$2b$10$c5MXa8ewhyiHviWQEDpXB.kXAvzQgIO2i6TupjiYkVg5kMEn14uHy'),
  ('S103', 'Chitra Rao', 'chitra@example.com', '$2b$10$c5MXa8ewhyiHviWQEDpXB.kXAvzQgIO2i6TupjiYkVg5kMEn14uHy'),
  ('S104', 'Dev Patel', 'dev@example.com', '$2b$10$c5MXa8ewhyiHviWQEDpXB.kXAvzQgIO2i6TupjiYkVg5kMEn14uHy');
INSERT IGNORE INTO courses (course_code, title, instructor, capacity) VALUES
  ('CS101', 'Java Programming', 'Maya Sharma', 30),
  ('CS204', 'Database Systems', 'Arun Menon', 24),
  ('CS305', 'Web Application Design', 'Nina Das', 28),
  ('CS110', 'Data Structures', 'Ravi Iyer', 32);
INSERT IGNORE INTO registrations (student_id, course_id)
  SELECT s.id, c.id FROM students s JOIN courses c ON c.course_code = 'CS101'
  WHERE s.student_code IN ('S101','S102');
INSERT IGNORE INTO registrations (student_id, course_id)
  SELECT s.id, c.id FROM students s JOIN courses c ON c.course_code = 'CS204'
  WHERE s.student_code = 'S103';
