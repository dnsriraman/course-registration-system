require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
const port = Number(process.env.PORT || 3000);
const useDatabaseTls = /^(1|true|yes)$/i.test(process.env.DB_SSL || 'false');
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'course_registration',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
  ssl: useDatabaseTls ? { minVersion: 'TLSv1.2' } : undefined
});
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const loginCookie = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000, path: '/' };

function requireStudent(req, res, next) {
  try {
    const token = req.cookies.student_token;
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, jwtSecret);
    if (payload.role !== 'student') return res.status(403).json({ message: 'Student access is required.' });
    req.studentId = Number(payload.sub);
    next();
  } catch (_error) {
    res.clearCookie('student_token', { httpOnly: true, sameSite: 'lax', path: '/' });
    return res.status(401).json({ message: 'Your sign-in expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  try {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ message: 'Admin sign-in is required.' });
    const payload = jwt.verify(token, jwtSecret);
    if (payload.role !== 'admin') return res.status(403).json({ message: 'Admin access is required.' });
    next();
  } catch (_error) {
    res.clearCookie('admin_token', { httpOnly: true, sameSite: 'lax', path: '/' });
    return res.status(401).json({ message: 'Admin sign-in expired. Please sign in again.' });
  }
}

const adminCookie = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000, path: '/' };
app.post('/api/admin/login', asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!process.env.ADMIN_PASSWORD_HASH) return res.status(503).json({ message: 'Admin password is not configured. Set ADMIN_PASSWORD_HASH in .env.' });
  if (username !== (process.env.ADMIN_USERNAME || 'admin') || !await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH))
    return res.status(401).json({ message: 'Username or password is incorrect.' });
  const token = jwt.sign({ sub: username, role: 'admin' }, jwtSecret, { expiresIn: '8h' });
  res.cookie('admin_token', token, adminCookie);
  res.json({ admin: { username } });
}));
app.get('/api/admin/me', (req, res) => {
  try {
    const payload = jwt.verify(req.cookies.admin_token || '', jwtSecret);
    if (payload.role !== 'admin') return res.json({ admin: null });
    return res.json({ admin: { username: payload.sub } });
  } catch (_error) { return res.json({ admin: null }); }
});
app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('admin_token', { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ message: 'Admin signed out.' });
});

app.post('/api/admin/students', requireAdmin, asyncRoute(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^S[A-Z0-9-]{2,19}$/.test(code)) return res.status(400).json({ message: 'Student ID must start with S and use 3–20 letters, numbers, or hyphens.' });
  if (name.length < 2 || name.length > 100) return res.status(400).json({ message: 'Enter a name between 2 and 100 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ message: 'Student passwords must be 8–72 characters.' });
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.query('INSERT INTO students (student_code, name, email, password_hash) VALUES (?, ?, ?, ?)', [code, name, email, passwordHash]);
  res.status(201).json({ message: `Student ${name} added. Share their student ID and password securely.`, student: { id: result.insertId, code, name, email } });
}));

app.post('/api/admin/courses', requireAdmin, asyncRoute(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const title = String(req.body.title || '').trim();
  const instructor = String(req.body.instructor || 'Faculty team').trim();
  const capacity = Number(req.body.capacity);
  if (!/^[A-Z0-9-]{2,20}$/.test(code)) return res.status(400).json({ message: 'Course code must use 2–20 letters, numbers, or hyphens.' });
  if (title.length < 2 || title.length > 120) return res.status(400).json({ message: 'Enter a course name between 2 and 120 characters.' });
  if (!instructor || instructor.length > 100) return res.status(400).json({ message: 'Enter an instructor name up to 100 characters.' });
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) return res.status(400).json({ message: 'Course capacity must be a whole number from 1 to 1000.' });
  const [result] = await pool.query('INSERT INTO courses (course_code, title, instructor, capacity) VALUES (?, ?, ?, ?)', [code, title, instructor, capacity]);
  res.status(201).json({ message: `Course ${title} added.`, course: { id: result.insertId, code, title, instructor, capacity } });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const code = String(req.body.studentCode || '').trim().toUpperCase();
  const password = String(req.body.password || '');
  if (!code || !password) return res.status(400).json({ message: 'Enter your student ID and password.' });
  const [rows] = await pool.query('SELECT id, student_code AS code, name, email, password_hash AS passwordHash FROM students WHERE student_code = ?', [code]);
  if (!rows.length || !await bcrypt.compare(password, rows[0].passwordHash))
    return res.status(401).json({ message: 'Student ID or password is incorrect.' });
  const student = rows[0];
  const token = jwt.sign({ sub: String(student.id), role: 'student' }, jwtSecret, { expiresIn: '8h' });
  res.cookie('student_token', token, loginCookie);
  res.json({ student: { id: student.id, code: student.code, name: student.name, email: student.email } });
}));

app.get('/api/auth/me', asyncRoute(async (req, res) => {
  try {
    const payload = jwt.verify(req.cookies.student_token || '', jwtSecret);
    if (payload.role !== 'student') return res.json({ student: null });
    const [rows] = await pool.query('SELECT id, student_code AS code, name, email FROM students WHERE id = ?', [Number(payload.sub)]);
    return res.json({ student: rows[0] || null });
  } catch (_error) { return res.json({ student: null }); }
}));

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('student_token', { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ message: 'You are signed out.' });
});

app.get('/api/student/portal', requireStudent, asyncRoute(async (req, res) => {
  const [[student]] = await pool.query('SELECT id, student_code AS code, name, email FROM students WHERE id = ?', [req.studentId]);
  if (!student) return res.status(401).json({ message: 'Student account was not found. Please sign in again.' });
  const [courses] = await pool.query(`SELECT c.id, c.course_code AS code, c.title, c.instructor, c.capacity,
    COUNT(all_r.id) AS enrolledCount, c.capacity - COUNT(all_r.id) AS available,
    mine.registered_at AS registeredAt, IF(mine.id IS NULL, 0, 1) AS isEnrolled
    FROM courses c LEFT JOIN registrations all_r ON all_r.course_id = c.id
    LEFT JOIN registrations mine ON mine.course_id = c.id AND mine.student_id = ?
    GROUP BY c.id, c.course_code, c.title, c.instructor, c.capacity, mine.id, mine.registered_at
    ORDER BY c.title`, [req.studentId]);
  res.json({ student, courses });
}));

app.post('/api/student/courses/:courseId/enroll', requireStudent, asyncRoute(async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!Number.isInteger(courseId)) return res.status(400).json({ message: 'Choose a valid course.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [courses] = await connection.query('SELECT id, title, capacity FROM courses WHERE id = ? FOR UPDATE', [courseId]);
    if (!courses.length) { await connection.rollback(); return res.status(404).json({ message: 'Course was not found.' }); }
    const [existing] = await connection.query('SELECT id FROM registrations WHERE student_id = ? AND course_id = ?', [req.studentId, courseId]);
    if (existing.length) { await connection.rollback(); return res.status(409).json({ message: 'You are already enrolled in this course.' }); }
    const [[{ enrolled }]] = await connection.query('SELECT COUNT(*) AS enrolled FROM registrations WHERE course_id = ?', [courseId]);
    if (enrolled >= courses[0].capacity) { await connection.rollback(); return res.status(409).json({ message: 'This course is full.' }); }
    await connection.query('INSERT INTO registrations (student_id, course_id) VALUES (?, ?)', [req.studentId, courseId]);
    await connection.commit();
    res.status(201).json({ message: `You are enrolled in ${courses[0].title}.` });
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));

app.delete('/api/student/courses/:courseId/enroll', requireStudent, asyncRoute(async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!Number.isInteger(courseId)) return res.status(400).json({ message: 'Choose a valid course.' });
  const [result] = await pool.query('DELETE FROM registrations WHERE student_id = ? AND course_id = ?', [req.studentId, courseId]);
  if (!result.affectedRows) return res.status(404).json({ message: 'You are not enrolled in this course.' });
  res.json({ message: 'You have been unenrolled from the course.' });
}));

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'connected', database: process.env.DB_NAME || 'course_registration' });
}));

app.get('/api/dashboard', requireAdmin, asyncRoute(async (_req, res) => {
  const [[stats]] = await pool.query(`SELECT (SELECT COUNT(*) FROM students) AS studentCount,
    (SELECT COUNT(*) FROM courses) AS courseCount,
    (SELECT COUNT(*) FROM registrations) AS registrationCount`);
  const [courses] = await pool.query(`SELECT c.id, c.course_code AS code, c.title, c.instructor, c.capacity,
    COUNT(r.id) AS enrolled, (c.capacity - COUNT(r.id)) AS available
    FROM courses c LEFT JOIN registrations r ON r.course_id = c.id
    GROUP BY c.id, c.course_code, c.title, c.instructor, c.capacity ORDER BY c.title`);
  const [recent] = await pool.query(`SELECT s.id AS studentId, c.id AS courseId,
    s.student_code AS studentCode, s.name AS studentName,
    c.course_code AS courseCode, c.title AS courseTitle, r.registered_at AS registeredAt
    FROM registrations r JOIN students s ON s.id = r.student_id JOIN courses c ON c.id = r.course_id
    ORDER BY r.registered_at DESC, r.id DESC LIMIT 8`);
  res.json({ stats, courses, recent });
}));

app.get('/api/students', requireAdmin, asyncRoute(async (_req, res) => {
  const [rows] = await pool.query('SELECT id, student_code AS code, name, email FROM students ORDER BY name');
  res.json(rows);
}));

app.post('/api/registrations', requireAdmin, asyncRoute(async (req, res) => {
  const studentId = Number(req.body.studentId), courseId = Number(req.body.courseId);
  if (!Number.isInteger(studentId) || !Number.isInteger(courseId))
    return res.status(400).json({ message: 'Choose a valid student and course.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [courses] = await connection.query('SELECT id, title, capacity FROM courses WHERE id = ? FOR UPDATE', [courseId]);
    if (!courses.length) { await connection.rollback(); return res.status(404).json({ message: 'That course could not be found.' }); }
    const [students] = await connection.query('SELECT id, name FROM students WHERE id = ?', [studentId]);
    if (!students.length) { await connection.rollback(); return res.status(404).json({ message: 'That student could not be found.' }); }
    const [existing] = await connection.query('SELECT id FROM registrations WHERE student_id = ? AND course_id = ?', [studentId, courseId]);
    if (existing.length) { await connection.rollback(); return res.status(409).json({ message: 'This student is already enrolled in that course.' }); }
    const [[{ enrolled }]] = await connection.query('SELECT COUNT(*) AS enrolled FROM registrations WHERE course_id = ?', [courseId]);
    if (enrolled >= courses[0].capacity) { await connection.rollback(); return res.status(409).json({ message: 'This course is full. Choose another course.' }); }
    await connection.query('INSERT INTO registrations (student_id, course_id) VALUES (?, ?)', [studentId, courseId]);
    await connection.commit();
    res.status(201).json({ message: `${students[0].name} enrolled in ${courses[0].title}.` });
  } catch (error) {
    await connection.rollback(); throw error;
  } finally { connection.release(); }
}));

app.delete('/api/registrations', requireAdmin, asyncRoute(async (req, res) => {
  const studentId = Number(req.body.studentId), courseId = Number(req.body.courseId);
  if (!Number.isInteger(studentId) || !Number.isInteger(courseId))
    return res.status(400).json({ message: 'Choose a valid student and course.' });
  const [result] = await pool.query('DELETE FROM registrations WHERE student_id = ? AND course_id = ?', [studentId, courseId]);
  if (!result.affectedRows) return res.status(404).json({ message: 'No matching enrollment was found.' });
  res.json({ message: 'Student dropped from the course.' });
}));

app.use((error, _req, res, _next) => {
  console.error(error.message);
  if (error.code === 'ER_DUP_ENTRY') {
    const message = /student_code|email/i.test(error.message) ? 'A student with that ID or email already exists.'
      : /course_code/i.test(error.message) ? 'A course with that code already exists.'
      : 'This student is already enrolled in that course.';
    return res.status(409).json({ message });
  }
  if (['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'].includes(error.code))
    return res.status(503).json({ message: 'Could not connect to MySQL. Check that MySQL is running and your .env settings match.' });
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

const server = app.listen(port, () => console.log(`Course Registration System running at http://localhost:${port}`));
process.on('SIGINT', async () => { server.close(); await pool.end(); process.exit(0); });
