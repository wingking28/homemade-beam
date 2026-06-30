Build a cross-platform mobile application (iOS and Android) for splitting payments between friends.

### Overview

The app should allow users to:

* Sign up and log in using their email address.
* Add other users as friends.
* Create and manage groups with their friends.
* Split bills among a group of users.
* Request money from individual friends.
* Track outstanding payment requests and settled payments.

### Technical Requirements

* **Platform:** Cross-platform mobile app (iOS and Android).
* **Language:** TypeScript.
* **UI Framework:** Choose a modern TypeScript-based framework (for example, React Native with Expo). You may select the framework you believe is most suitable.
* **UI Design:** Please use the MCP connection I have provided to generate and build the user interface. You are free to choose the overall design system and styling.
* **Backend:** Design and implement an appropriate backend API.
* **Database:** Choose either PostgreSQL or MongoDB, and select whichever you believe is the better fit for this application. Please explain the reasoning behind your choice.

### Core Features

#### Authentication

* Email-based user registration and login.
* Secure authentication and session management.

#### Friends

* Search for users.
* Send, accept, and decline friend requests.
* Maintain a friends list.

#### Groups

* Create groups.
* Invite friends to groups.
* Add or remove members (with appropriate permissions).
* View all group members.

#### Expenses

* Create shared expenses within a group.
* Split expenses equally (support for custom splits is optional if time permits).
* View expense history.
* Track who owes whom.

#### Payment Requests

* Send payment requests to friends.
* View pending and completed requests.
* Mark requests as paid.

### Documentation

Please include a comprehensive README that explains:

1. **Project Architecture**

   * Technology stack.
   * Folder structure.
   * Key architectural decisions.

2. **Running Locally**

   * Prerequisites.
   * Installation steps.
   * Environment variables.
   * Starting the backend.
   * Starting the mobile application.

3. **Deploying to Mobile Devices**

   * How to run the app on Android.
   * How to run the app on iOS.
   * How to build production versions.
   * How to install the app on physical devices.

4. **Database**

   * Which database was chosen (PostgreSQL or MongoDB).
   * Why it was selected.
   * How it should be hosted in production.
   * How to run it locally.

5. **Deployment**

   * Recommended hosting solution for the backend.
   * Database hosting recommendations.
   * Environment configuration.
   * Production deployment steps.

### Additional Notes

* Follow modern software engineering best practices.
* Write clean, maintainable, and well-documented TypeScript code.
* Structure the project to be scalable and easy to extend.
* Use sensible defaults for technologies and libraries where requirements are not explicitly specified.
* If any requirements are ambiguous or additional information is needed, ask clarifying questions before beginning implementation rather than making assumptions.
* The app does not need to handle the physical bank transaction, just the mark off is fine