import express from "express";
import "dotenv/config";
import "reflect-metadata"; // Add this for Sequelize
import sequelize from "./db"; // Import your Sequelize instance
import mainRouter from "./routes/index";
import { verifyEmailConnection } from "./config/email";
import cors from "cors";
import { revenueCatWebhook, stripeWebhook } from "./controllers/billing";
import {
  ensureDatabaseExtensions,
  ensureSpatialAndSearchInfrastructure,
} from "./services/databaseBootstrap";
import { seedSpecializations } from "./seeds/specializationSeed";
import { getMissingRequiredSecurityEnv, securityConfig } from "./config/security";
import {
  publicReadRateLimit,
  webhookRateLimit,
} from "./middleware/rateLimitProfiles";

const app = express();

app.set("trust proxy", securityConfig.trustProxy);

app.post(
  "/billing/webhook",
  webhookRateLimit,
  express.raw({ type: "application/json" }),
  stripeWebhook
);
app.post(
  "/billing/webhooks/revenuecat",
  webhookRateLimit,
  express.json({ type: "application/json" }),
  revenueCatWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(mainRouter);

app.get("/", publicReadRateLimit, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Trainee API is running",
    data: {
      service: "trainee-api",
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
});

app.get("/hello", publicReadRateLimit, (request, response) => {
  response.send("<h1>Hello World, How Are You?</h1>");
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION! 💥", error);
  process.exit(1); // Exit the process
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION! 💥", reason);
  // You might not want to exit on every unhandled rejection
});

const PORT = Number(process.env.PORT) || 8000;

const startServer = async () => {
  try {
    const missingSecurityEnv = getMissingRequiredSecurityEnv();
    if (missingSecurityEnv.length > 0) {
      const errorMessage = `Missing required security environment variables: ${missingSecurityEnv.join(
        ", "
      )}`;

      if (process.env.NODE_ENV === "production") {
        throw new Error(errorMessage);
      }

      console.warn(`[SECURITY_WARNING] ${errorMessage}`);
    }

    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    await ensureDatabaseExtensions();
    await sequelize.sync({ alter: false });
    await ensureSpatialAndSearchInfrastructure();
    console.log("✅ Database synchronized and optimized.");

    await seedSpecializations();
    verifyEmailConnection();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Database startup failed:", error);
    process.exit(1);
  }
};

startServer();
