const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STIPE_SK);
// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.SECRETE_KEY, (error, decode) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decode = decode;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yekoygf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const classCollection = client.db("Assignment12").collection("AllClass");
    const UserCollection = client.db("Assignment12").collection("User");
    const bookingCollection = client.db("Assignment12").collection("booking");
    const PaymentCollection = client.db("Assignment12").collection("payment");

    //jwt implement
    app.post("/jwt", (req, res) => {
      const body = req.body;
      const token = jwt.sign(body, process.env.SECRETE_KEY, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //get all classes
    app.get("/classes", async (req, res) => {
      const filter={status:"approved"}
      const result = await classCollection.find(filter).toArray();
      res.send(result);
    });

    //get popular class
    app.get('/popularClass',async(req,res)=>{
      const filter={totalEnroll:1}
      const result = await classCollection.find().sort({totalEnroll:parseInt(1)}).toArray();
      res.send(result);
    })
    //admin dashboard route here
    app.get("/dashboard/admin/manageClass", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });
    app.put("/dashboard/admin/manageClass/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const getClass = await classCollection.findOne(filter);
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      getClass.status = "approved";
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.put("/dashboard/admin/manageClass/denied/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const getClass = await classCollection.findOne(filter);
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };

      getClass.status = "denied";
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //admin feedback api
    app.put("/dashboard/admin/feedback/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: data.feedback,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //admin user management
    app.post("/users/:email", async (req, res) => {
      const user = req.body;
      const email = req.params.email;
      const filter = { email: email };
      const singleResult = await UserCollection.findOne(filter);
      if (singleResult) {
        return res.send({ error: true, message: "User already exits" });
      }
      const result = await UserCollection.insertOne(user);
      res.send(result);
    });

    //get user data from data base
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await UserCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await UserCollection.findOne(filter);
      res.send(result);
    });
    //admin role section
    app.put("/dashboard/admin/userRole/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          UserRole: "admin",
        },
      };
      const result = await UserCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //add instructor role
    app.put("/dashboard/admin/userRole/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          UserRole: "instructor",
        },
      };
      const result = await UserCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // instructor dashboard route here
    app.post("/dashboard/instructor/addClass", async (req, res) => {
      let body = req.body;
      if (!body.role) {
        body.role = "instructor";
        body.totalEnroll = 0;
      }
      const result = await classCollection.insertOne(body);
      res.send(result);
    });
    // student route
    app.post("/isBooking", async (req, res) => {
      const id = req.query.id;
      const email = req.query.email;
      const body=req.body
      const result = await bookingCollection.insertOne({body,email,id});
      res.send(result);
    });
    app.get('/isBooking/:email',async(req,res)=>{
      const email=req.params.email
      const filter={
        email:email
      }
      const result=await bookingCollection.find(filter).toArray()
      res.send(result)
    })
    //student booking
    app.get("/dashboard/student/booking/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await classCollection.findOne(filter);
      res.send(result);
    });
    //payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { Price } = req.body;
      const amount = parseInt(Price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    app.get('/paymentData/:id',async(req,res)=>{
      const id=req.params.id
      const filter={_id:new ObjectId(id)}
      const result=await bookingCollection.findOne(filter)
      res.send(result)
    })
    //payment related api
    app.post('/dashboard/student/payment',async(req,res)=>{
      const body=req.body
      const result=await PaymentCollection.insertOne(body)
      const query={
        _id:new ObjectId(body.id)
      }
      const id=body.paymentData.id
      const queryReduce={_id:new ObjectId(id)}
      const remove=await bookingCollection.deleteOne(query)
      const getSeats=await classCollection.findOne(queryReduce)
      const totalEnroll=parseInt(getSeats.totalEnroll)
      const AvailableSeats= parseInt(getSeats.AvailableSeats)
      const updateDoc={
        $set:{
          AvailableSeats:(AvailableSeats-1),
          totalEnroll:(totalEnroll+1)
        }
      }
      const updateSeats=await classCollection.updateOne(queryReduce,updateDoc)
      res.send(result)
    })
    app.get('/dashboard/student/payment/:id',async(req,res)=>{
      const id=req.params.id
      const filter={id:(id).toString}
      const result=await PaymentCollection.findOne(filter)
      
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Assignment server running ${port}`);
});
