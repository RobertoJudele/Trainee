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
import { User } from "./models/user";

const app = express();

app.post("/billing/webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.post("/billing/webhooks/revenuecat", express.json({ type: "application/json" }), revenueCatWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(mainRouter);

app.get("/", async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/hello", (request, response) => {
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
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    await ensureDatabaseExtensions();
    await sequelize.sync({ alter: true });
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
