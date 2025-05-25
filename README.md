<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# FollMe Backend

FollMe is a backend service built with the [NestJS](https://nestjs.com/) framework. It provides APIs for managing user authentication, blogs, invitations, profiles, and stories. This project is designed to support a scalable and efficient server-side application.

## Features

- **Authentication**: Supports local, Google, and Facebook login strategies.
- **Blog Management**: Create, retrieve, and manage blogs with support for thumbnails.
- **Story Management**: Manage stories and chapters with support for short and series types.
- **Invitation System**: Send event invitations via email and track guest responses.
- **Profile Management**: Search and retrieve user profiles.
- **Caching**: Uses Redis for caching frequently accessed data.
- **Cloudinary Integration**: Handles image uploads and storage.

## Project Structure

The project is organized into the following main directories:

- **src/**: Contains the main application code.
  - **interceptors/**: Custom interceptors for logging, transforming, and retrieving user information.
  - **modules/**: Contains feature modules for authentication, blogs, invitations, profiles, and stories.
    - **auth/**: Handles user authentication and authorization.
      - **schemas/**: Defines the database schemas for users and certification codes.
      - **services/**: Contains services for managing users and certification codes.
      - **strategies/**: Implements authentication strategies (local, Google, Facebook, JWT).
    - **blogs/**: Manages blog-related operations.
      - **dtos/**: Data Transfer Objects for creating and searching blogs.
      - **schemas/**: Defines the database schema for blogs.
    - **invitation/**: Manages event invitations and guest responses.
      - **dtos/**: Data Transfer Objects for creating invitations and managing guests.
      - **schemas/**: Defines the database schemas for events and guests.
    - **profiles/**: Handles profile search and retrieval.
      - **dtos/**: Data Transfer Objects for profile-related operations.
    - **stories/**: Manages stories and their chapters.
      - **schemas/**: Defines the database schemas for stories and chapters.
  - **sharedServices/**: Contains shared services for caching, email handling, and image uploads.
  - **templates/**: Email templates for sending invitations and codes.
  - **utils/**: Utility functions for common operations like removing accents and handling requests.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/FollMe-BE.git
   cd FollMe-BE
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory.
   - Add the following variables:
     ```env
     PORT=3000
     DB_HOST=<your-mongodb-connection-string>
     JWT_SECRET=<your-jwt-secret>
     GMAIL=<your-gmail-address>
     GMAIL_APP_PASS=<your-gmail-app-password>
     CLOUD_NAME=<your-cloudinary-cloud-name>
     CLOUD_API_KEY=<your-cloudinary-api-key>
     CLOUD_API_SECRET=<your-cloudinary-api-secret>
     REDIS_USERNAME=<your-redis-username>
     REDIS_PASSWORD=<your-redis-password>
     REDIS_HOST=<your-redis-host>
     REDIS_PORT=<your-redis-port>
     FE_URL=<your-frontend-url>
     GOOGLE_CLIENT_ID=<your-google-client-id>
     ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Run the application:
   ```bash
   # Development mode
   npm run start:dev

   # Production mode
   npm run start:prod
   ```

## API Documentation

### Authentication
- **POST /api/auth/local**: Login with email and password.
- **POST /api/auth/google**: Login with Google.
- **POST /api/auth/facebook**: Login with Facebook.
- **POST /api/auth/sign-up**: Sign up with email, password, and verification code.

### Blogs
- **POST /api/blogs**: Create a new blog.
- **GET /api/blogs**: Retrieve all blogs.
- **GET /api/blogs/:slug**: Retrieve a specific blog by slug.

### Invitations
- **POST /api/events**: Create a new event and send invitations.
- **GET /api/events**: Retrieve all events for the logged-in user.
- **GET /api/invitations/:id**: Retrieve a specific invitation by ID.

### Profiles
- **POST /api/profiles/get**: Retrieve profiles by user IDs.
- **GET /api/profiles**: Search profiles by part of a name.

### Stories
- **GET /api/stories**: Retrieve all stories.
- **GET /api/stories/:slug**: Retrieve a specific story by slug.
- **GET /api/stories/:storySlug/:chapSlug**: Retrieve a specific chapter of a story.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Commit your changes with clear and descriptive messages.
4. Push your changes to your fork.
5. Submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
