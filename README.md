# Elevance Skills – Real Time Web Project

A ready-to-run full-stack internship project based on the six requirements shown in the Elevance Skills task panel.

## Implemented requirements

1. **Secure login + login history**
   - Stores browser, operating system, device type and IP.
   - Chrome requires email OTP.
   - Microsoft Edge allows direct access.
   - Mobile login is allowed only from 10:00 AM to 1:00 PM IST.
   - Login history is visible in the profile.

2. **Reward points**
   - Answer/question contribution: +5 points.
   - Reaching 5 upvotes on an answer: +5 bonus once.
   - Downvote: -1 point.
   - Removed answer: -5 points.
   - Transfer is enabled only when sender has more than 10 points.

3. **Six-language support**
   - English, Spanish, Hindi, Portuguese, Chinese and French.
   - French switching uses email OTP.
   - Other language switches use mobile OTP.

4. **Public social space**
   - Photo/video upload.
   - Like, comment and share.
   - Posting limit is based on friend count.
   - Socket.IO broadcasts new posts in real time.

5. **Forgot password**
   - Reset by email or phone.
   - One reset request per identifier per day.
   - Password generator uses letters only (A-Z/a-z).

6. **Subscription + payments**
   - Free: 1 question/day.
   - Bronze: ₹100/month, 5/day.
   - Silver: ₹300/month, 10/day.
   - Gold: ₹1000/month, unlimited.
   - Payment is allowed only 10:00–11:00 AM IST.
   - Demo payment mode is included; Razorpay credentials can be added through `.env`.
   - Invoice/subscription details are emailed when SMTP is configured.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

For development:

```bash
npm run dev
```

## Demo accounts

The application creates a demo account automatically on first run:

- Email: `demo@elevance.test`
- Password: `Demo@123`
- Phone: `9999999999`

OTP codes are printed in the server terminal in development mode.

## Production notes

For a real deployment:
- Set a strong `JWT_SECRET`.
- Configure SMTP for real email OTPs/invoices.
- Add an SMS provider for mobile OTPs.
- Add Razorpay keys for real payments.
- Replace JSON persistence with PostgreSQL/MySQL.
- Store uploaded media in cloud storage.
- Enable HTTPS and secure cookies.

## Project structure

- `server.js` – Express API, authentication, business rules and Socket.IO.
- `public/index.html` – application UI.
- `public/app.js` – frontend application logic.
- `public/styles.css` – responsive UI.
- `report.md` – internship report content.
