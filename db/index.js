import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config(); 

const ConnectDB = () => mongoose.connect(process.env.MONGO_URI);
// const ConnectDB = () => mongoose.connect("mongodb://localhost:8001/tandem");
// const ConnectDB = () => mongoose.connect("mongodb://localhost:27017/tandem");




const db = mongoose.connection;

db.on("error", console.error.bind(console, "cnnection error:"));
db.once("open", function () {
  console.log("Connected successfully and grantly");
});

export default ConnectDB;
