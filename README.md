# Course Registration System

A responsive browser dashboard for course registration, backed by MySQL. It includes enrollment summaries, course capacity progress, recent activity, and controls to register or drop students. Dashboard data refreshes every 30 seconds.

## Requirements

- Node.js 18 or newer
- MySQL 8 or newer

## 1. Create the database

Create the database, then load its tables and sample data:

```text
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS course_registration CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p course_registration < schema.sql
```

This creates the `course_registration` database and its tables, then inserts sample students, courses, and registrations. You can also load `schema.sql` from MySQL Workbench.

## 2. Configure the connection

Copy `.env.example` to `.env`, then set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` to match your MySQL server. Keep `.env` private; it is excluded from version control.

## 3. Start the application

```text
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). The green status banner confirms the app can query MySQL. If MySQL is unavailable or credentials are incorrect, the dashboard explains the connection issue and offers Retry.

The admin dashboard is password protected. The local configured username is `admin`; its password is generated for this installation and provided when the app is set up. To set another password, create a bcrypt hash with `node -e "require('bcryptjs').hash('YourPassword',10).then(console.log)"`, put the result in `ADMIN_PASSWORD_HASH` in `.env`, then restart the app.

Admins can add students (including their portal password) and courses from the dashboard. Student passwords are hashed before they reach MySQL. Dashboard and admin write APIs require the admin sign-in cookie.

## Student sign-in

Open [http://localhost:3000/student.html](http://localhost:3000/student.html), then sign in with a student ID and password. The sample accounts `S101`, `S102`, `S103`, and `S104` use the demo password `Student@123`. The portal shows each student's own courses and lets them enroll in open courses or unenroll from a course. Passwords are stored as bcrypt hashes; the signed login cookie is HTTP-only and expires after eight hours.

If you already created the database before adding student login, run `migration_student_login.sql` **once** against that database. It adds password hashes and gives existing sample accounts the demo password above. For a new database, run `schema.sql` as usual.

## What it does

- Stores students, courses, and registrations in MySQL with relational constraints.
- Registers students from the dashboard, checking that they exist, preventing duplicates, and enforcing seat capacity in a transaction.
- Unenrolls a student from the recent enrollments list after a confirmation prompt.
- Shows course capacity progress and recent registrations, with automatic and manual refresh.
- Uses parameterized database queries.

## Troubleshooting

- Make sure MySQL is running and reachable at the host and port in `.env`.
- Run `schema.sql` and confirm the configured database user can access the database.
- Check the terminal running `npm start` for server errors.

## Host with Docker

The project includes `Dockerfile` and `docker-compose.yml` for a Docker-enabled server. The Compose setup starts the web app and a private MySQL 8 service; database files persist in a Docker volume and MySQL is not published on a public port.

1. Copy the project to your server and create `.env` from `.env.example`.
2. Set a new, strong `DB_PASSWORD`, a unique random `JWT_SECRET`, and an `ADMIN_PASSWORD_HASH` generated with the command above. Do not deploy the local `.env` file or reuse its database password.
3. Start the services with `docker compose up -d --build`.
4. Point your domain at the server and configure HTTPS through the host’s reverse proxy or load balancer. Keep the app port private behind that HTTPS endpoint.

The database is initialized from `schema.sql` the first time its volume is created. Back up the `courseflow_mysql` volume before replacing or migrating a deployed database.

## Free web hosting with Render and TiDB Cloud Starter

The included `render.yaml` describes a free Render Docker web service. TiDB Cloud Starter supplies the MySQL-compatible database and TLS connection. Render's free web service sleeps after 15 minutes without incoming traffic and may take about a minute to wake up. TiDB's free quota is capped; once the limit is reached, new connections are denied until the quota resets or changes. See [Render's free service limits](https://render.com/docs/free), [TiDB Starter quotas](https://docs.pingcap.com/tidbcloud/select-cluster-tier/), and [TiDB TLS requirements](https://docs.pingcap.com/tidbcloud/connect-to-tidb-cluster-serverless/?plan=starter).

1. Create a MySQL-compatible **TiDB Cloud Starter** instance. In its Connect dialog, copy the public host and generated username, generate a password, and use port `4000` and database `test`. Starter usernames include an instance prefix (for example, `prefix.root`). Keep the password private.
2. To initialize the hosted database, put those TiDB values into your local ignored `.env`: `DB_HOST`, `DB_PORT=4000`, `DB_NAME=test`, `DB_USER`, `DB_PASSWORD`, and `DB_SSL=true`. Run `npm run db:init` once. This creates the tables and demo rows in TiDB.
3. Push this project to a GitHub repository that is connected to your Render account. A private repository is recommended. Do not commit or upload `.env`; it contains database credentials and is ignored by Git.
4. In Render, choose **New → Blueprint**, connect the repository, and apply `render.yaml`. Choose the **Free** web instance. Enter the TiDB host, username, and password when Render asks for the `sync: false` environment variables. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` to new hosted admin credentials. Generate a bcrypt hash using `node -e "require('bcryptjs').hash('YourNewPassword',10).then(console.log)"`. `JWT_SECRET` is generated by Render's Blueprint config.
5. Wait for the deploy to finish, open the generated `onrender.com` HTTPS address, and sign in to the admin or student portal.

The hosting remains free only while each provider's quotas and plan rules are respected. Render can suspend free service after monthly limits; TiDB blocks new database connections at its free quota. Keep paid usage or spending limits disabled if you need a strict $0 setup. Neither free tier guarantees uninterrupted production availability.
