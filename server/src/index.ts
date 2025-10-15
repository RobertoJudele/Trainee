import express from "express";
import "dotenv/config";
import "reflect-metadata"; // Add this for Sequelize
import sequelize from "./db"; // Import your Sequelize instance
import mainRouter from "./routes/index";
import { verifyEmailConnection } from "./config/email";
import cors from "cors";
const app = express();

import { User } from "./models/user";
import { Trainer } from "./models/trainer";
import { Specialization } from "./models/specialization";
import { TrainerSpecialization } from "./models/trainerSpecialization";
import { TrainerImage } from "./models/trainerImage";
import { Review } from "./models/review";

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
// Initialize database connection
const initializeApp = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Sync models with database
    // await sequelize.sync({ alter: true });
    console.log("Database synchronized.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
};
app.use(mainRouter);
app.get("/", async (req, res) => {
  try {
    // Use Sequelize to query users
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

// Initialize database and start server
initializeApp().then(() => {
  app.listen(8000, () => {
    console.log("Server listening on port 8000");
  });
  verifyEmailConnection();
});
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION! 💥", error);
  process.exit(1); // Exit the process
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION! 💥", reason);
  // You might not want to exit on every unhandled rejection
});
