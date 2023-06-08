const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

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

async function run() {
    try {
        await client.connect();

        const usersCollection = client.db("magicMindsAcademyDB").collection('users');

        app.post('/users', async (req, res) => {
            const loggedUser = req.body;
            const result = await usersCollection.insertOne(loggedUser);
            res.send(result);
            
        })

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
