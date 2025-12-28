# Hotel Ops Board

A lightweight hotel operations web app for managing **housekeeping** and **maintenance** from desktop or phone on the same Wi‑Fi network.

Built as a full‑stack project with:

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- Database: SQLite
- Auth: JWT with role‑based views (manager, housekeeper, maintenance)

---

## Features

### Manager / Head Housekeeper

- Login as manager and see a simple dashboard
- Assign multiple rooms to a housekeeper by user ID and room numbers
- Housekeeping board showing:
  - Room number
  - Assigned housekeeper
  - Status (dirty, cleaning, ready for inspection, inspected, etc.)
  - Rush flag toggle
  - Notes indicator and view
  - **Delete** button to remove a single room from today’s board
- Reset all housekeeping tasks for the current day
- Create and manage maintenance tickets:
  - Room, description, priority (normal/rush)
  - Update status (in progress / done)
  - Delete tickets

### Housekeeper

- Login as housekeeper and see only “My rooms (today)”
- View assigned rooms with status
- Update status (dirty, cleaning, ready for inspection)
- Add notes per room for managers to review

### Maintenance

- Login as maintenance user and see only “My maintenance tickets”
- View tickets assigned to maintenance
- Update status (in progress / done)

---
