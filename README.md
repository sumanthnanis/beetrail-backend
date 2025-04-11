```markdown
# BeeTrail Backend API

This repository contains the backend API for the BeeTrail Field Logger app. The service enables beekeepers to log hive placements, retrieve nearby crop pollination opportunities, and manage crop calendars. The backend is built using Node.js, Express, and MongoDB.
## Features

- **User Authentication**
  - **Register:** `POST /auth/register` to create a new user.
  - **Login:** `POST /auth/login` returns a JWT token for secured endpoints.

- **Hive Log Management**
  - **Add Hive Log:** `POST /api/hives` to log hive placements.  
  - **Retrieve Hive Logs:** `GET /api/hives` with optional date filtering and pagination.

- **Crop Calendar Management**
  - **Add Crop Entry:** `POST /api/crops` to record flowering crop information (with geospatial data).  
  - **Nearby Crop Opportunities:** `GET /api/crops/nearby` returns crops within a specified radius whose flowering period includes a given date.

- **Extra Features**
  - **Sync Token:** `GET /sync` provides a timestamp-based token for offline sync.
  - **CSV Export (Admin Only):**  (accessible only for admin users)
    - Export hive logs: `GET /export/hives`  
    - Export crop entries: `GET /export/crops`
  - **Admin Dashboard:** A basic HTML dashboard is available at `/admin` (accessible only for admin users).
  - **Swagger Documentation:** Interactive API docs are available at `/api-docs`.

## Technologies

- Node.js & Express
- MongoDB with Mongoose
- JSON Web Tokens (JWT) for authentication
- bcrypt for password hashing
- json2csv for CSV exports
- Swagger (swagger-ui-express & swagger-jsdoc) for API documentation

## Setup Instructions

1. **Clone the Repository**

   ```bash
   https://github.com/sumanthnanis/beetrail-backend.git
   cd beetrail-backend
   ```

2. **Install Dependencies**

   Ensure you have Node.js installed, then run:

   ```bash
   npm install
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the root directory and add the following variables:

   ```env
   PORT=3000
   MONGO_URI=mongodb+srv://<username>:<encoded_password>@cluster0.mongodb.net/beetrail_db?retryWrites=true&w=majority
   JWT_SECRET=your_secret_here
   ```

   **Note:**  
   - Replace `<username>` and `<encoded_password>` with your MongoDB Atlas username and URL-encoded password.
   - Use a strong string for `JWT_SECRET`.

4. **Start the Server**

   Start the server by running:

   ```bash
   npm start
   ```
   
   Alternatively:

   ```bash
   node server.js
   ```

   The API will be accessible at [http://localhost:3000](http://localhost:3000).

5. **View API Documentation**

   Navigate to [http://localhost:3000/api-docs](http://localhost:3000/api-docs) in your browser for the interactive Swagger UI documentation.

## Sample Data / Postman Collection

- **Postman Collection:**  
  A Postman collection file (`BeeTrail API.postman_collection.json`) is provided in the repository. To import:
  
  1. Open Postman and click **Import**.
  2. Select the `BeeTrail API.postman_collection.json` file.
  3. Use the collection to test endpoints.

- **Sample Requests:**

  **Register User (Beekeeper):**
  ```json
  {
    "username": "beekeeperUser",
    "password": "password123",
    "role": "beekeeper"
  }
  ```

  **Register User (Admin):**
  ```json
  {
    "username": "adminUser",
    "password": "adminPass123",
    "role": "admin"
  }
  ```

  **Add Hive Log:**
  ```json
  {
    "hiveId": "HIVE004",
    "datePlaced": "2025-04-08",
    "latitude": 28.7041,
    "longitude": 77.1025,
    "numColonies": 5
  }
  ```

  **Add Crop Entry:**
  ```json
  {
    "name": "Sunflower",
    "floweringStart": "2025-04-10",
    "floweringEnd": "2025-04-25",
    "latitude": 26.9124,
    "longitude": 75.7873,
    "recommendedHiveDensity": 5
  }
  ```

## Explanation of Logic

- **Authentication:**  
  The API uses JWT-based authentication. Users register and log in to receive a token that must be included in the `Authorization` header as `Bearer <token>` for all protected endpoints.

- **Hive Logs:**  
  Each hive log uses a unique `hiveId`, and the system validates the provided geographical coordinates and dates. Logs are stored with a timestamp for when they were created.

- **Crop Calendar with Geospatial Queries:**  
  Crop entries include a GeoJSON-formatted `location` field. A 2dsphere index is created on the `location` field, enabling efficient geospatial queries with the `$near` operator to find crops within a specified radius whose flowering window includes a target date.

- **CSV Export and Admin Dashboard:**  
  Admin-only endpoints allow exporting hive logs and crop entries to CSV files using `json2csv`. A basic HTML-based admin dashboard is also provided, linking to these export endpoints and the API documentation.

- **Swagger Documentation:**  
  Interactive documentation is generated using Swagger, allowing for in-depth exploration and testing of the API endpoints.

## extra Features & Assumptions

**Bonus Features:**
- **User Roles:**  
  The system supports two user roles: `beekeeper` and `admin`. Access to certain endpoints (like CSV export and the admin dashboard) is restricted to admin users.
- **Sync Token:**  
  A `/sync` endpoint is available to provide a timestamp-based sync token for offline applications.
- **CSV Export:**  
  Admin endpoints allow the export of hive logs and crop entries as CSV files.
- **Swagger/OpenAPI Documentation:**  
  Interactive API documentation is available at `/api-docs`.
- **Admin Dashboard:**  
  A basic admin dashboard is accessible at `/admin` (requires an admin token).

**Assumptions:**
- Geographical coordinates provided by users are valid.
- MongoDB auto-creates the database, collections, and indexes on first write.
- Offline synchronization is simulated via a sync token.
- Error handling is managed by Express error middleware with basic logging.


 
