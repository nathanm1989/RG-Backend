const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const devRoutes = require("./routes/dev.routes");
const bidderRoutes = require("./routes/bidder.routes");
const fileRoutes = require("./routes/file.routes");

require("dotenv").config();

const app = express();
app.use(cors({
    origin: 'https://rg-frontend-delta.vercel.app', // Replace with your frontend origin
    methods: 'GET,POST,PUT,DELETE',
    credentials: true

}));
// app.options('*', cors());
app.use(express.json());
// app.use("/uploads", express.static("uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dev", devRoutes);
app.use("/api/bidder", bidderRoutes);
app.use("/api/generate", fileRoutes);

app.get("/", (req, res) => {
    res.send("Welcome to the Resume Generator API!");
});

module.exports = app;
