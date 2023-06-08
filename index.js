const express = require("express");
const app = express();
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.send("Magic Minds Academy Server is Busy teaching magics...");
});

app.listen(port, () => {
    console.log(`Magic Minds Academy Server is Listening on PORT: ${port}`);
});
