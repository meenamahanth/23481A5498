const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const logger = require("../logging_middleware/logger");

const app = express();

app.use(cors());
app.use(express.json());
app.use(logger);

const API =
  "http://4.224.186.213/evaluation-service/notifications";

app.get("/notifications", async (req, res) => {
  try {
    const response = await axios.get(API, {
      headers: { Authorization: `Bearer ${process.env.ACCESS_TOKEN}` },
    });

    const raw = response.data;
    let notifications = Array.isArray(raw) ? raw : raw.notifications ?? [];

    const { type, page = 1, limit = 10 } = req.query;

    // Filtering
    if (type) {
      notifications = notifications.filter(
        (n) => n.Type === type
      );
    }

    // Sorting latest first
    notifications.sort(
      (a, b) =>
        new Date(b.Timestamp) - new Date(a.Timestamp)
    );

    // Pagination
    const start = (page - 1) * limit;
    const end = start + Number(limit);

    const paginatedNotifications =
      notifications.slice(start, end);

    res.json({
      total: notifications.length,
      page: Number(page),
      limit: Number(limit),
      notifications: paginatedNotifications,
    });
  } catch (error) {
    console.log(error.response?.data || error.message);

    res.status(500).json({
      message: "Error fetching notifications",
    });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});