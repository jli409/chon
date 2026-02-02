## Running the Project with Docker

This project provides Dockerfiles for both the backend (Python) and frontend (Node.js/TypeScript) applications, along with a `docker-compose.yml` for orchestrating the services.

### Requirements
- **Backend:** Python 3.11 (slim), Poetry 1.8.5
- **Frontend:** Node.js 22.13.1 (slim)

### Environment Variables
- Backend: If you have a `.env` file in the project root, uncomment the `env_file` line in the `docker-compose.yml` to load environment variables.
- Frontend: If you have a `.env` file in `frontend/`, uncomment the `env_file` line in the `docker-compose.yml` under the `frontend-ts` service.

### Build and Run Instructions
1. Ensure Docker and Docker Compose are installed.
2. From the project root, run:
   ```bash
   docker compose up --build
   ```
   This will build and start both services.

### Service Details
- **Backend (python-app):**
  - Exposes port **5000** (Flask app)
  - Uses Poetry for dependency management
  - Runs as a non-root user for security
- **Frontend (frontend-ts):**
  - Exposes port **3000** (Node.js server)
  - Builds TypeScript sources and serves the compiled app
  - Runs as a non-root user for security

### Special Configuration
- If your frontend needs to communicate with the backend, ensure CORS is properly configured. See `backend/.platform/nginx/conf.d/cors.conf` for reference.
- Database dependencies are not included in the current `docker-compose.yml`. If your backend requires a database, add the relevant service and update `depends_on` accordingly.

### Notes
- All services are connected via the `appnet` Docker network.
- For production, ensure your environment variables are set appropriately and sensitive files are not committed to version control.

Refer to the individual `README.md` files in `backend/` and `frontend/` for more details on each service.