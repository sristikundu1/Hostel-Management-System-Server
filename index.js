const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;


//middleware
// app.use(cors({
//     origin: ['http://localhost:5173',
// 'https://dream-catalyst.web.app'],
//     credentials: true
//   }))
app.use(cors());
app.use(express.json());

//   WpHuiFsNNYZB36zx
// hostelManager




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.iz3zu0d.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const userCollection = client.db("hostelmealDB").collection("users");
        const requestmealCollection = client.db("hostelmealDB").collection("requestmeals");
        const mealCollection = client.db("hostelmealDB").collection("meals");
        const upcomingmealCollection = client.db("hostelmealDB").collection("upcomingmeals");
        const reviewCollection = client.db("hostelmealDB").collection("reviews");


        // jwt api 
        // create token 
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' })
            res.send({ token });

        })

        const varifyToken = (req, res, next) => {
            console.log('inside varify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return req.status(401).send({ message: 'forbidden access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {

                if (err) {
                    return req.status(401).send({ message: 'forbidden access' })
                }
                req.decoded = decoded;
                next();
            }
            )
        }


        // use varify admin after varifyToken 
        const varifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return req.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        app.get("/users/admin/:email", varifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }
            const query = { email: email };

            const result = await userCollection.findOne(query);//find data in array
            res.send(result);
        })


        // make admin 
        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        // show all the data in user router in the server site
        app.get("/users", async (req, res) => {
            console.log(req.headers);
            const result = await userCollection.find().toArray();//find data in array
            res.send(result);
        })


        // insert user data in the database where there is a collection named users
        app.post("/users", async (req, res) => {
            const user = req.body;
            // insert email if user doesnot exist 
            // 3 ways to do thid(1.unique email,2.upsert,3.simple checking)

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: "user already exist", insertedId: null })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        })


        app.post("/meals", async (req, res) => {
            const requestItem = req.body;
            const result = await mealCollection.insertOne(requestItem)
            res.send(result);
        })

        app.get("/meals", async (req, res) => {
            // const email = req.query.email;
            // const name = req.query.name;
            // const query = { email: email, name: name }
            const result = await mealCollection.find().toArray();//find data in array
            res.send(result);
        })

        app.delete("/meals/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await mealCollection.deleteOne(query)
            res.send(result);
        })

        //   requested meal collection

        // show all the data in carts router in the server site that i added from client side
        app.get("/request", async (req, res) => {
            const email = req.query.email;
            const query = { email: email }

            const result = await requestmealCollection.find(query).toArray();
            res.send(result);

        })

        // insert data in the database where there is a collection named carts
        app.post("/request", async (req, res) => {
            const requestItem = req.body;
            const result = await requestmealCollection.insertOne(requestItem)
            res.send(result);
        })



        app.get("/review", async (req, res) => {
            const email = req.query.email;

            const query = { email: email }
            const result = await reviewCollection.find(query).toArray();//find data in array
            res.send(result);
        })
        // insert data in the database where there is a collection named carts
        app.post("/review", async (req, res) => {
            const reviewItem = req.body;
            const result = await reviewCollection.insertOne(reviewItem)
            res.send(result);
        })

        app.get("/upcoming", async (req, res) => {
            const result = await upcomingmealCollection.find().toArray();//find data in array
            res.send(result);
        })
        // insert data in the database 
        app.post("/upcoming", async (req, res) => {
            const upcomingItem = req.body;
            const result = await upcomingmealCollection.insertOne(upcomingItem)
            res.send(result);
        })

        // delete data from the database 
        app.delete("/review/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await reviewCollection.deleteOne(query)
            res.send(result);
        })
        // payment intent 

        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('hostel meal website server is running');
});

app.listen(port, () => {
    console.log(`hostel meal  website server is running on port : ${port}`);
});