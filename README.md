# Gym Manager Automation
React + Vite + Tailwind frontend, Node/Express + MongoDB backend, JWT auth, WhatsApp Business Cloud API.

## Run (MongoDB must be running)
    cd backend && cp .env.example .env && npm install && npm run dev
    cd frontend && npm install && npm run dev      # open http://localhost:5173

Login: admin@gym.com / admin123 (set ADMIN_EMAIL / ADMIN_PASSWORD in .env before first start). Four plans are seeded.

## WhatsApp
Settings: enter the Phone Number ID and access token from Meta's WhatsApp Business Cloud API. Without them, messages are logged as "simulated".
Meta only allows free-text messages inside 24h of a customer message. For business-initiated sends, create approved templates in Meta
and change `wa()` in backend/server.js to send `type:'template'`. A daily 9am cron sends expiry (3 days) and pending-fee reminders.

## Deploy
Frontend on Vercel (rewrite /api to the backend URL), backend on Render/VPS with MongoDB Atlas, a strong JWT_SECRET.
