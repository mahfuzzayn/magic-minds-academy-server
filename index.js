const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
        const classesCollection = client
            .db("magicMindsAcademyDB")
            .collection("classes");

        // Verify Admin Middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "admin") {
                return res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }
            next();
        };

        // Verify Instructor Middleware
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "instructor") {
                return res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }
            next();
        };

        // JWT Route
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h",
            });
            res.send({ token });
        });

        // Users API Routes
        app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
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

        app.patch(
            "/users/admin/:id",
            verifyJWT,
            verifyAdmin,
            async (req, res) => {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const updatedDoc = {
                    $set: {
                        role: "admin",
                    },
                };
                const result = await usersCollection.updateOne(
                    query,
                    updatedDoc
                );
                res.send(result);
            }
        );

        app.patch(
            "/users/instructor/:id",
            verifyJWT,
            verifyAdmin,
            async (req, res) => {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const updatedDoc = {
                    $set: {
                        role: "instructor",
                    },
                };
                const result = await usersCollection.updateOne(
                    query,
                    updatedDoc
                );
                res.send(result);
            }
        );

        // Classes API Routes
        app.get("/classes", verifyJWT, verifyAdmin, async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        });

        app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {
            const newClass = req.body;
            const result = await classesCollection.insertOne(newClass);
            res.send(result);
        });

        app.patch("/classes/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const statusType = req.body;
            let updatedClass = {};
            if (statusType.action === "approve") {
                updatedClass = {
                    $set: {
                        status: "approved",
                    },
                };
            } else if (statusType.action === "deny") {
                updatedClass = {
                    $set: {
                        status: "denied",
                    },
                };
            } else {
                res.status(204).send({
                    error: true,
                    message: "no payload found",
                });
            }
            const result = await classesCollection.updateOne(
                query,
                updatedClass
            );
            res.send(result);
        });

        // Dashboard API Routes
        // Admin Verify JWT Protected API Route
        app.get("/users/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                return res.send({
                    admin: false,
                });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ admin: user?.role === "admin" });
        });

        // Instructor Verify JWT Protected API Route
        app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ instructor: user?.role === "instructor" });
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
