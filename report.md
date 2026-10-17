# Elevance Skills Internship Project Report

## Title
**Elevance Community – Real Time Web Platform**

## 1. Introduction
The project is a real-time community platform where registered users can authenticate securely, ask and answer questions, earn reward points, interact through a public social feed, switch languages, reset passwords and subscribe to paid question-posting plans.

## 2. Objectives
- Implement secure environment-aware authentication.
- Maintain transparent login history.
- Encourage useful contributions with points.
- Provide multilingual access.
- Build a public social interaction space.
- Provide controlled password recovery.
- Implement subscription-based question limits.
- Demonstrate real-time updates using Socket.IO.

## 3. Technology Stack
- Frontend: HTML5, CSS3, JavaScript
- Backend: Node.js, Express.js
- Real-time communication: Socket.IO
- Authentication: JWT + bcrypt
- File upload: Multer
- User-agent detection: UAParser
- Email: Nodemailer
- Payment gateway integration point: Razorpay-ready adapter / demo payment mode
- Data persistence: JSON files for the internship demo

## 4. Functional Modules

### Module 1 – Authentication and Login History
The application identifies browser, operating system and device type. Login records contain timestamp and IP address. Chrome logins require email OTP, Microsoft Edge logins are allowed directly, and mobile logins are restricted to 10:00 AM–1:00 PM IST.

### Module 2 – Reward System
Users receive 5 points for a contribution. An additional 5-point bonus is awarded when an answer reaches five upvotes. Downvotes and answer removal reduce points. Transfers require the sender to have more than 10 points.

### Module 3 – Multilingual Interface
The interface supports English, Spanish, Hindi, Portuguese, Chinese and French. A language change requires verification. French uses email OTP while the other languages use mobile OTP.

### Module 4 – Public Social Feed
Users can upload images/videos, like posts, comment and share. Posting limits depend on the user's friend count. New posts are broadcast using Socket.IO.

### Module 5 – Password Recovery
A dedicated reset flow accepts a registered email or phone number. Requests are limited to once per day. A random letters-only password can be generated.

### Module 6 – Subscription and Payments
Free, Bronze, Silver and Gold plans control daily question limits. Payments are restricted to 10:00–11:00 AM IST. The project contains a demo payment flow and a Razorpay-ready environment configuration.

## 5. Security Considerations
- Passwords are hashed with bcrypt.
- Authentication tokens are signed using JWT.
- OTPs expire.
- Password reset requests are rate-limited by day.
- Subscription limits are enforced on the server.
- Media uploads are restricted to common image/video types.
- Payment time restrictions are checked server-side.

## 6. Testing
Test the following:
1. Register and login.
2. Login with Chrome and verify OTP requirement.
3. Login with Edge and verify direct access.
4. Use mobile user-agent and test 10 AM–1 PM restriction.
5. Create an answer and verify +5 points.
6. Upvote an answer five times with different accounts.
7. Test point transfer with balance <=10 and >10.
8. Change language and verify OTP behavior.
9. Create social posts according to friend count.
10. Test likes/comments/shares.
11. Request password reset twice on the same day.
12. Test subscription question limits.
13. Test payment outside and inside 10–11 AM IST.
14. Verify real-time post updates in two browser tabs.

## 7. Conclusion
The project demonstrates a complete real-time web platform combining authentication, authorization, rewards, multilingual verification, social interaction, password recovery, subscriptions and controlled payment operations.
