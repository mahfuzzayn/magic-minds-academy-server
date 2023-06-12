const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const moment = require("moment/moment");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

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
        // await client.connect();

        const usersCollection = client
            .db("magicMindsAcademyDB")
            .collection("users");
        const classesCollection = client
            .db("magicMindsAcademyDB")
            .collection("classes");
        const selectedClassesCollection = client
            .db("magicMindsAcademyDB")
            .collection("selectedClasses");
        const enrolledClassesCollection = client
            .db("magicMindsAcademyDB")
            .collection("enrolledClasses");
        // Client Slider Data Collection
        const sliderDataCollection = client
            .db("magicMindsAcademyDB")
            .collection("sliderData");
        // Client FAQ Data Collection
        const faqDataCollection = client
            .db("magicMindsAcademyDB")
            .collection("faqData");

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

        // Verify User Role Middleware
        const verifyUserRole = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role === "admin") {
                next();
            } else if (user?.role === "instructor") {
                next();
            } else {
                return res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }
        };

        // JWT Route
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h",
            });
            res.send({ token });
        });

        // Instructors API Route
        app.get("/instructors", async (req, res) => {
            const resultOptions = {
                projection: { _id: 1, name: 1, email: 1, photoURL: 1 },
            };
            const instructorsResult = await usersCollection
                .find({ role: "instructor" }, resultOptions)
                .toArray();
            const instructorsEmails = instructorsResult.map(
                (instructor) => instructor.email
            );
            const instructorsClasses = await classesCollection
                .find({
                    status: "approved",
                    instructorEmail: { $in: instructorsEmails },
                })
                .toArray();
            const result = instructorsResult.map((instructor) => {
                const matchedClasses = instructorsClasses.filter(
                    (currentClass) =>
                        currentClass.instructorEmail === instructor.email
                );
                return { ...instructor, classes: matchedClasses };
            });

            res.send(result);
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

        app.delete(
            "/users/admin/:id",
            verifyJWT,
            verifyAdmin,
            async (req, res) => {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await usersCollection.deleteOne(query);
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
        app.get("/classes", async (req, res) => {
            const isQuery = req.query;
            if (Object.keys(isQuery).length !== 0) {
                if (!!isQuery?.email) {
                    const query = { instructorEmail: isQuery.email };
                    const result = await classesCollection
                        .find(query)
                        .toArray();
                    return res.send(result);
                } else if (!!isQuery?.status) {
                    const query = { status: isQuery.status };
                    const result = await classesCollection
                        .find(query)
                        .toArray();
                    return res.send(result);
                } else {
                    return res.status(403).send({
                        error: "true",
                        message: "query value missing or invalid.",
                    });
                }
            }
            const result = await classesCollection.find().toArray();
            res.send(result);
        });

        app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {
            const newClass = req.body;
            const result = await classesCollection.insertOne(newClass);
            res.send(result);
        });

        // Selected Classes API Routes
        app.get("/selected-classes", verifyJWT, async (req, res) => {
            const isQuery = req.query;
            if (Object.keys(isQuery).length !== 0) {
                const query = { userEmail: isQuery?.email };
                const result = await selectedClassesCollection
                    .find(query)
                    .toArray();
                return res.send(result);
            } else {
                res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }
        });

        app.post("/selected-classes", verifyJWT, async (req, res) => {
            const selectedClass = req.body;
            const result = await selectedClassesCollection.insertOne(
                selectedClass
            );
            res.send(result);
        });

        app.delete("/selected-classes/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const isQuery = req.query;
            if (Object.keys(isQuery).length !== 0) {
                const query = {
                    _id: new ObjectId(id),
                    userEmail: isQuery?.email,
                };
                const result = await selectedClassesCollection.deleteOne(query);
                return res.send(result);
            } else {
                res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }
        });

        // Enrolled Classes API Routes
        app.get("/enrolled-classes", verifyJWT, async (req, res) => {
            const isQuery = req.query;
            if (Object.keys(isQuery).length !== 0) {
                const query = { email: isQuery?.email };
                const result = await enrolledClassesCollection
                    .find(query)
                    .toArray();
                const sortedDateResult = result.sort((a, b) => {
                    const dateA = moment(a.date);
                    const dateB = moment(b.date);
                    return dateB - dateA;
                });
                return res.send(sortedDateResult);
            } else {
                res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }
        });

        // Popular Classes GET API
        app.get("/popular-classes", async (req, res) => {
            const result = await classesCollection
                .find()
                .sort({ enrolledStudents: -1 })
                .limit(6)
                .toArray();
            res.send(result);
        });

        // Stripe: Create Payment Intent
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // Payments API
        app.post("/payments", verifyJWT, async (req, res) => {
            const enrolledClass = req.body;
            const insertResult = await enrolledClassesCollection.insertOne(
                enrolledClass
            );
            const filter = { _id: new ObjectId(enrolledClass?.class) };
            const updatedDoc = {
                $inc: { enrolledStudents: 1, availableSeats: -1 },
                $set: { updatedAt: Date() },
            };
            const updateResult = await classesCollection.updateOne(
                filter,
                updatedDoc
            );
            const deleteQuery = {
                _id: new ObjectId(enrolledClass?.selectedClass),
            };
            const deleteResult = await selectedClassesCollection.deleteOne(
                deleteQuery
            );
            res.send({ insertResult, deleteResult, updateResult });
        });

        // Admin Only Patch API
        app.patch(
            "/classes/admin/:id",
            verifyJWT,
            verifyAdmin,
            async (req, res) => {
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
                } else if (statusType.action === "feedback") {
                    updatedClass = {
                        $set: {
                            feedback: req.body.feedback,
                        },
                    };
                } else if (statusType.action === "updateClass") {
                    res.send("wait bro");
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
            }
        );

        // Instructor or Admin Only Patch API
        app.patch(
            "/classes/instructor/:id",
            verifyJWT,
            verifyUserRole,
            async (req, res) => {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const statusType = req.body;
                const modifiedClass = req.body?.updatedClass;
                let updatedDoc = {};
                if (statusType.action === "updateClass") {
                    updatedDoc = {
                        $set: {
                            name: modifiedClass?.name,
                            image: modifiedClass?.image,
                            availableSeats: modifiedClass?.availableSeats,
                            price: modifiedClass?.price,
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
                    updatedDoc
                );
                res.send(result);
            }
        );

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

        // Student Verify JWT Protected API Route
        app.get("/users/student/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ student: user?.role === "student" });
        });

        // Client Slider Data GET API
        app.get("/slider-data", async (req, res) => {
            const result = await sliderDataCollection.find().toArray();
            res.send(result);
        });

        // FAQ Data GET API
        app.get("/faq-data", async (req, res) => {
            const result = await faqDataCollection.find().toArray();
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log(
        //     "Pinged your deployment. You successfully connected to MongoDB!"
        // );
    } finally {
        // Finally Goes Here...
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Magic Minds Academy Server is Busy teaching magics...");
});

app.listen(port, () => {
    console.log(`Magic Minds Academy Server is Listening on PORT: ${port}`);
});
