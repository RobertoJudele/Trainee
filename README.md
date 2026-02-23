# # Trainee

# 💪 Trainer Marketplace

A full-stack mobile marketplace connecting fitness trainers with clients. Trainers can create profiles and offer their services, while clients can browse, search, and contact trainers.

## 📱 Features

### For Clients

- ✅ Browse trainers without an account (anonymous mode)
- ✅ Search and filter trainers by location, specialty, price, and ratings
- ✅ View detailed trainer profiles with photos and reviews
- ✅ Contact trainers directly through the app
- ✅ Leave reviews and ratings (requires account)
- ✅ Save favorite trainers

### For Trainers

- ✅ Create detailed professional profiles
- ✅ Upload multiple photos showcasing training style
- ✅ Set hourly rates and session prices
- ✅ List specializations (Yoga, CrossFit, Personal Training, etc.)
- ✅ Receive and manage client inquiries
- ✅ Track profile views and analytics
- ✅ Subscription-based visibility

### Platform Features

- 🔐 JWT-based authentication with role management
- 📧 Email verification system
- 🔄 Account upgrade (Client → Trainer)
- 🌍 Location-based trainer search
- ⭐ Review and rating system
- 💬 In-app messaging (planned)
- 💳 Stripe payment integration (planned)

---

## 🏗️ Tech Stack

### Backend

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL with Sequelize ORM
- **Authentication:** JWT (jsonwebtoken) + bcryptjs
- **Image Storage:** AWS S3 (SDK v3)
- **Email:** Nodemailer
- **Validation:** express-validator
- **API Documentation:** RESTful API design

### Frontend (Mobile)

- **Framework:** React Native (Expo)
- **Language:** TypeScript
- **Navigation:** React Navigation v6
- **State Management:** Redux Toolkit + Redux Persist
- **HTTP Client:** Axios
- **Form Handling:** React Hook Form
- **UI Components:** React Native Paper
- **Storage:** AsyncStorage

### DevOps & Tools

- **Version Control:** Git
- **Testing:** Jest + Supertest
- **Code Quality:** ESLint + Prettier
- **CI/CD:** GitHub Actions (planned)

---

## 📁 Project Structure

```
trainer-marketplace/
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── config/            # Configuration files (DB, S3, email)
│   │   ├── controllers/       # Request handlers
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── models/            # Sequelize models
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic (email, S3)
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Helper functions
│   ├── tests/                 # API tests
│   ├── scripts/               # Utility scripts (seeds, migrations)
│   └── package.json
│
└── mobile/                     # React Native Expo App
    ├── src/
    │   ├── components/        # Reusable UI components
    │   ├── navigation/        # Navigation configuration
    │   ├── screens/           # App screens
    │   ├── store/             # Redux store, slices, API
    │   ├── types/             # TypeScript types
    │   ├── constants/         # Colors, config
    │   └── utils/             # Helper functions
    ├── assets/                # Images, fonts, icons
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 15+
- **AWS Account** (for S3 image storage)
- **Expo CLI** (`npm install -g expo-cli`)
- **iOS Simulator** (macOS) or **Android Studio** (for Android)

### Backend Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/trainer-marketplace.git
cd trainer-marketplace/backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trainee
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=trainer-marketplace-images

# Email (for verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@trainermarketplace.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

4. **Create PostgreSQL database**

```bash
createdb trainer_marketplace
```

5. **Run database migrations**

```bash
npm run build
npm run migrate
```

6. **Seed initial data (optional)**

```bash
npm run seed:specializations
npm run seed:trainers
```

7. **Start development server**

```bash
npm run dev
```

Backend will run at `http://localhost:3000`

### Mobile App Setup

1. **Navigate to mobile directory**

```bash
cd ../mobile
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure API endpoint**

Edit `src/constants/config.ts`:

```typescript
const ENV = {
  dev: {
    apiUrl: "http://localhost:3000/api/v1", // Use your computer's IP for physical devices
  },
};
```

4. **Start Expo development server**

```bash
npm start
```

5. **Run on device/simulator**

- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app for physical device

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Mobile Tests (planned)

```bash
cd mobile
npm test
```

---

## 📡 API Documentation

### Base URL

```
http://localhost:3000/api/v1
```

### Authentication Endpoints

#### Register User

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "client" // or "trainer"
}
```

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123"
}
```

#### Get Profile

```http
GET /auth/profile
Authorization: Bearer {token}
```

### Trainer Endpoints

#### Create Trainer Profile

```http
POST /trainers
Authorization: Bearer {token}
Content-Type: application/json

{
  "bio": "Experienced yoga instructor...",
  "experienceYears": 5,
  "hourlyRate": 75.00,
  "locationCity": "San Francisco",
  "locationState": "California",
  "specializationIds": [1, 2]
}
```

#### Search Trainers

```http
GET /search/trainers?city=San%20Francisco&specialization=Yoga&minRating=4
```

#### Upload Trainer Images

```http
POST /images/trainer/single
Authorization: Bearer {token}
Content-Type: multipart/form-data

image: [file]
```

### Review Endpoints

#### Create Review

```http
POST /reviews/{trainerId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "rating": 5,
  "reviewText": "Great trainer! Very professional..."
}
```

For complete API documentation, see [API_DOCS.md](./API_DOCS.md) (planned).

---

## 🔐 Environment Variables

### Backend Required Variables

- `DATABASE_URL` or `DB_*` - PostgreSQL connection
- `JWT_SECRET` - Secret key for JWT tokens
- `AWS_*` - S3 credentials for image storage
- `SMTP_*` - Email service credentials

### Backend Optional Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `BCRYPT_ROUNDS` - Password hashing rounds (default: 12)

### Mobile Required Variables

None - configuration is in code

---

## 🗄️ Database Schema

### Core Tables

- **users** - All user accounts (clients, trainers, admins)
- **trainer_profiles** - Extended trainer information
- **specializations** - Training specialties (Yoga, CrossFit, etc.)
- **trainer_specializations** - Many-to-many relationship
- **trainer_images** - Trainer profile photos
- **reviews** - Trainer reviews and ratings
- **subscriptions** - Trainer subscription status (planned)
- **messages** - In-app messaging (planned)

See [DATABASE.md](./DATABASE.md) for complete schema documentation (planned).

---

## 🎨 Design Decisions

### Why This Architecture?

**Backend: TypeScript + Express**

- Type safety catches errors early
- Express is battle-tested and flexible
- Easy to scale with microservices later

**Database: PostgreSQL**

- ACID compliance for financial transactions
- Excellent geospatial support for location search
- Robust for complex relationships (users ↔ trainers ↔ reviews)

**Mobile: React Native + Expo**

- Single codebase for iOS and Android
- Fast development with hot reload
- Large ecosystem of libraries
- Easy OTA updates with Expo

**State: Redux Toolkit**

- Predictable state management
- Excellent DevTools
- Redux Persist for offline support
- Type-safe with TypeScript

**Images: AWS S3**

- Scalable and reliable
- Global CDN for fast delivery
- Cost-effective pay-per-use

---

## 🔮 Roadmap

### Phase 1: MVP (Current)

- ✅ User authentication and roles
- ✅ Trainer profiles and search
- ✅ Review system
- ✅ Image uploads
- ⏳ Mobile app screens

### Phase 2: Core Features

- ⏳ In-app messaging system
- ⏳ Stripe subscription payments for trainers
- ⏳ Email notifications
- ⏳ Push notifications
- ⏳ Advanced search filters

### Phase 3: Enhanced Experience

- 📅 Booking/scheduling system
- 📊 Trainer analytics dashboard
- 💳 Commission-based booking payments
- 🎥 Video calling integration
- 🏆 Trainer verification badges

### Phase 4: Growth

- 🌐 Multi-language support
- 🗺️ Map view for trainers
- 📱 Web app version
- 🤖 AI trainer recommendations
- 📈 Advanced analytics

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier (configs included)
- Write meaningful commit messages
- Add tests for new features
- Update documentation

---

## 🐛 Known Issues

- Email verification links expire after 24 hours (by design)
- Image uploads limited to 10MB (configurable)
- Search radius limited to 500km (configurable)
- Anonymous users must create account to contact trainers

See [GitHub Issues](https://github.com/yourusername/trainer-marketplace/issues) for tracking.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Your Name** - _Initial work_ - [YourGitHub](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- Inspired by platforms like Thumbtack and TaskRabbit
- Built during learning journey with Claude AI
- Thanks to the open-source community

---

## 📞 Support

- **Documentation:** [Link to docs]
- **Issues:** [GitHub Issues](https://github.com/yourusername/trainer-marketplace/issues)
- **Email:** support@trainermarketplace.com

---

## 🎓 Learning Resources

This project is great for learning:

- Full-stack TypeScript development
- RESTful API design
- React Native mobile development
- Redux state management
- AWS S3 integration
- JWT authentication
- PostgreSQL database design

### Useful Links

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [Redux Toolkit Docs](https://redux-toolkit.js.org/)
- [Sequelize Docs](https://sequelize.org/docs/v6/)
- [Express.js Docs](https://expressjs.com/)

---

## 📊 Project Stats

- **Backend:** ~15,000 lines of TypeScript
- **Mobile:** ~8,000 lines of TypeScript/TSX
- **Database:** 10+ tables with relationships
- **API Endpoints:** 25+ RESTful endpoints
- **Test Coverage:** 80%+ (goal)

---

**Built with ❤️ using TypeScript, React Native, and Node.js**
