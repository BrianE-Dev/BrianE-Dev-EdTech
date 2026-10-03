# BrianE-Dev

AI-powered developer productivity learning for software engineers. The course focuses on using AI throughout the software lifecycle; code provides context for lessons, examples, and workflows.

The approved course title, 8 sections, 43 chapters, and chapter titles are centralized in [`src/data/curriculum.js`](src/data/curriculum.js). See [`documentation.md`](documentation.md) for the course overview and project setup.

## Run locally

```sh
npm install
npm run dev
```

## Commerce backend

The API is a separate Express service backed by MongoDB. See [`backend/README.md`](backend/README.md) for database setup, Paystack configuration, development Super Admin creation, webhook setup, deployment, and API details.

Copy `backend/.env.example` to `backend/.env`, set the secrets and MongoDB URI, then run:

```sh
npm run seed
npm run dev:all
```

The seed command creates the published 8-section, 43-chapter course and initial prices (international: USD 15 with a 40% promotion; Nigeria: independently configurable NGN 15,000 with a 40% promotion). It does not create an admin unless temporary `SEED_ADMIN_*` values are provided.

The current React app is a marketing page and curriculum overview. The backend enforces purchases for lesson, progress, and certificate APIs; detailed lesson bodies and a learner lesson-player/dashboard are not currently present in the repository.

## Project checks

```sh
npm run lint
npm run build
```
