const express = require("express");
const cors = require("cors");
const jwt =require("jsonwebtoken")
const cookieParser=require('cookie-parser')
const { MongoClient, ServerApiVersion,ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://blognest-d41ff.web.app",
      "https://blognest-d41ff.firebaseapp.com",
    ],
    credentials: true,
  })
);
// app.use(cors());
app.use(express.json());
app.use(cookieParser())

//verify jwt middleware
const verifyToken=(req, res, next) => {
  const token=req.cookies?.token
  if(!token) {return res.status(401).send({message:'Unauthorized access'});
  }
      if(token){
        jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
          if(err){
            console.log(err);
            return  res.status(401).send({message:'Unauthorized access'})
          }
          console.log(decoded);
          req.user=decoded;
          next()
        })
      }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qvotocy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();
    const blogCollections = client.db("blogNest").collection("blogs");
    const wishCollections = client.db("blogNest").collection("wishBlog");
    const commentCollections = client.db("blogNest").collection("comments");

    //JWT
    app.post('/jwt',async(req,res)=>{
      const user=req.body;
      const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn:'365d'
      })
      res.cookie('token',token,{
        httpOnly:true,
        secure: process.env.NODE_ENV==='production',
        sameSite: process.env.NODE_ENV==='production'?'none':'strict'
      }).send({success:true});
    });


   app.get('/logout',(req,res)=>{
     res
     .clearCookie('token',{
       httpOnly:true,
       secure: process.env.NODE_ENV==='production',
       sameSite: process.env.NODE_ENV==='production'?'none':'strict',
       maxAge:0,
     }).send({success:true})
   }) 




    app.get("/blogs", async (req, res) => {
      const cursor = blogCollections.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get('/blogs/sort', async (req, res) => {
      try {
        const blogs = await blogCollections.find();
        const result = await blogs.toArray();
        result.sort((a, b) => b.long_description.split(' ').length - a.long_description.split(' ').length);
        // console.log(object);
        const top10Blogs = result.slice(0, 10);
        
        res.send(top10Blogs);
        
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    
    app.get("/filterblog/:category", async (req, res) => {
      const category = req.params.category;
      const query = { category:category };
      const cursor = blogCollections.find(query);
      const result = await cursor.toArray();
      res.send(result);
  });
  app.get('/all_blogs',async(req,res) => {
    const search=req.query.search;
    let query= {
      title: { $regex: search, $options: "i" },

    }
    const result=await blogCollections.find(query).toArray();
    res.send(result);

  })
    app.get("/filterwish/:category/:email",verifyToken, async (req, res) => {
      const tokenEmail=req.user.email
      const category = req.params.category;
      const email = req.params.email;
      if(tokenEmail!==email){
        return res.status(403).send({message:'Forbidden access'})
      }
      const query = { category:category ,wisherEmail:email};
      const cursor = wishCollections.find(query);
      const result = await cursor.toArray();
      res.send(result);
  });
    app.post("/addblog", async (req, res) => {
      const blog = req.body;
      console.log(blog);
      const result = await blogCollections.insertOne(blog);
      res.send(result);
    });
    app.post("/addwish", async (req, res) => {
      const blog = req.body;
      console.log(blog);
      // console.log(blog._id);
      console.log(blog.blogId);
      // const wishResult = await wishCollections.find({blogId: blog.id});
      const cursor = await wishCollections.find({
        blogId: blog.blogId,
        wisherEmail:blog.wisherEmail
      });
      const existingWish = await cursor.toArray();
      console.log("exsit" ,existingWish);
      if (existingWish.length > 0 ) {
        // Wish already exists, respond accordingly
        res.send({ "success": false, "message": "Wish already exists!" });
      } else {
        // Insert the new wish
        const result = await wishCollections.insertOne(blog);
        res.send({ "success": true,"message": result });
      }
      // const result = await wishCollections.insertOne(blog);
      // res.send(result);
    });
    app.delete("/wishBlog/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await wishCollections.deleteOne(query);
      res.send(result);
    });
    // Update
    app.put("/updateBlog/:id", async (req, res) => {
      id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateItem = req.body;
      const Item = {
        $set: {
          title: updateItem.title,
          image: updateItem.image,
          description: updateItem.description,
          category: updateItem.category,
          long_description: updateItem.long_description,
          
        },
      };
      const result = await blogCollections.updateOne(filter, Item, options);
      res.send(result);
    });
    
    app.get("/wishBlog/:email",verifyToken, async (req, res) => {
      const tokenEmail=req.user.email
      const email = req.params.email;
      if(tokenEmail!==email){
        return res.status(403).send({message:'Forbidden access'})
      }
      const query = {
        wisherEmail: email,
      };
      const cursor = wishCollections.find(query);
      
      const result = await cursor.toArray();
      // console.log(result);
      res.send(result);
    });
    app.get("/blogdetails/:id",async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogCollections.findOne(query);
      res.send(result);
    });
    app.post("/addcomments/post", async (req, res) => {
      const comment = req.body;
      const result = await commentCollections.insertOne(comment);
        res.send({ "success": true,"message": result });
  });
  app.get("/get/comment/:id", async (req, res) => {
    const id = req.params.id;
    const query = { commentBlogId: id };
    const cursor = commentCollections.find(query);
    const result = await cursor.toArray();
    // console.log(result);
    res.send(result);
  });
  
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Backend is Running");
});
app.listen(port, () => {
  console.log(`BlogNest is running on port ${port}`);
});
