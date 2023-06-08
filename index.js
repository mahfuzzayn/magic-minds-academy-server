const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Magic Minds Academy Server is Busy teaching magics...");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wfuffuf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        res.status(401).send({ error: true, message: "unauthorized access" });
    }

    // Token Verification
    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            res.status(401).send({
                error: true,
                message: "unauthorized access",
            });
        }
        req.decoded = decoded;
        next();
    });
};

async function run() {
    try {
        await client.connect();

        const usersCollection = client
            .db("magicMindsAcademyDB")
            .collection("users");

        // JWT Route
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h",
            });
            res.send({ token });
        });

        // Users API Routes
        app.get("/users", verifyJWT, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "user already exists" });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // Dashboard API Routes
        app.get("/users/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ admin: user?.role === "admin" });
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Finally Goes Here...
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Magic Minds Academy Server is Listening on PORT: ${port}`);
});
