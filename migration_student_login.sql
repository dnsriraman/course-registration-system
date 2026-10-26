USE course_registration;

-- Run once on an existing installation to add student sign-in support.
ALTER TABLE students ADD COLUMN password_hash VARCHAR(255) NULL AFTER email;

-- Demo accounts all use the temporary password Student@123.
UPDATE students
SET password_hash = '$2b$10$c5MXa8ewhyiHviWQEDpXB.kXAvzQgIO2i6TupjiYkVg5kMEn14uHy'
WHERE password_hash IS NULL;

ALTER TABLE students MODIFY password_hash VARCHAR(255) NOT NULL;
