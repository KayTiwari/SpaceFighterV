const express = require('express');
const app = express();
const mongoose = require('mongoose');
const expressJwt = require('express-jwt');
require("dotenv").config();
const PORT = process.env.PORT || 6669;
const path = require("path");

app.use(express.json());
app.use("/auth", require("./routes/auth"));
app.use("/api/scores", require("./routes/scores"));
app.use(express.static(path.join(__dirname, "client", "build")))

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});
app.listen(PORT, () => {
    console.log( `(x) ${PORT} running`);
})

mongoose.set('useCreateIndex', true);
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/scores",
    { useNewUrlParser: true },
    (err) => {
        if (err) throw err;
        console.log("Connected to the database");
    }
);

app.use("/api", expressJwt({secret: process.env.SECRET}));