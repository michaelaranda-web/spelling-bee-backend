const fs = require('fs');
const { Worker, Scheduler, Queue } = require('node-resque');
const schedule = require("node-schedule");
const axios = require('axios');
const moment = require('moment');
const { parsePuzzleData } = require('./src/helpers/puzzleDataParser');
const express = require('express');
const http = require('http');
const https = require('https');

const privateKey  = fs.readFileSync('sslcert/key.pem');
const certificate = fs.readFileSync('sslcert/cert.pem');
const passphrase = 'spellingbee';
const credentials = {key: privateKey, cert: certificate, passphrase};

const app = express();

const fetchAndStorePuzzle = async (db, date) => {
  db.collection('puzzles').findOne({ puzzleDate: date }, (err, puzzleData) => {
    if (err) { 
      console.log(`Error while checking for existing puzzle data: ${err}`); 
    }
    
    if (puzzleData) { 
      console.log(`Puzzle data already exists for ${date}`); 
      return; 
    } else {
      axios.get(`https://nytbee.com/Bee_${date}.html`)
        .then((response) => {
          const puzzleHTML= response.data;
          const puzzleData = parsePuzzleData(puzzleHTML);
          
          db.collection('puzzles').updateOne(
            { puzzleDate: puzzleData.puzzleDate },
            { $set: puzzleData },
            { upsert: true }, // insert the document if it does not exist
            (err, r) => {
              assert.equal(null, err);
              
              console.log(`Successfully saved puzzle data for ${puzzleData.puzzleDate}`);
            }
          );
        })
        .catch((error) => {
          if (error.status === 404) {
            console.log(`Puzzle data does not exist for ${date}`)
          } else {
            console.log(`Error while fetching puzzle data for ${date}: ${error.message}`);
          }
        });
    }
  });
}

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'spelling-bee';

// Use connect method to connect to the server
MongoClient.connect(url, function(err, client) {
  assert.equal(null, err);
  console.log(`[${moment()}] Connected successfully to server`);

  const db = client.db(dbName);
  
  http.createServer(app).listen(8080);
  
  console.log("process.env.NODE_ENV: ", process.env.NODE_ENV)
  const httpsPort = process.env.NODE_ENV === 'production' ? 443 : 8443; // nothing special about 8443 as far as I know, just a placeholder
                                                                        // ^ preview works for both http and https regardless of value
  https.createServer(credentials, app).listen(httpsPort);
  
  app.get('/puzzles/:puzzleDate', (req, res) => {
    const puzzleDate = req.params.puzzleDate;
    
    db.collection('puzzles').findOne({ puzzleDate }, function(err, puzzleData) {
      if (err) { 
        console.log(`Error while retrieving puzzle data for ${puzzleDate}: ${err}`); 
        res.status(500).send({ error: `Error while looking up puzzle data for date provided: ${puzzleDate}` });
        return;
      }
      
      if (!puzzleData) {
        res.status(404).send({ error: `No puzzle data found for date: ${puzzleDate}` });
        return;
      }
      
      console.log(`Returning ${puzzleData.puzzleDate}`);
      return res.json(puzzleData);
    });
  });
  
  app.get('/random_puzzle', (req, res) => {
    db.collection('puzzles').aggregate([{ $sample: { size: 1 } }], function(err, aggregateCursor) {
      if (err) { 
        console.log(`Error while retrieving random puzzle data: ${err}`); 
        res.status(500).send({ error: "Error while retrieving random puzzle data" });
        return;
      }
      
      aggregateCursor.next().then((puzzleData) => {
        console.log(`Returning random puzzle data: ${puzzleData.puzzleDate}`);
        res.json(puzzleData);
      })
      
    });
  });
  
  boot(db);

  // client.close();
});

async function boot(db) {
  // ////////////////////////
  // SET UP THE CONNECTION //
  // ////////////////////////
 
  const connectionDetails = {
    pkg: "ioredis",
    host: "127.0.0.1",
    password: null,
    port: 6379,
    database: 0
    // namespace: 'resque',
    // looping: true,
    // options: {password: 'abc'},
  };
 
  // ///////////////////////////
  // DEFINE YOUR WORKER TASKS //
  // ///////////////////////////
 
  const jobs = {
    puzzleFetchAndStore: {
      perform: (date) => fetchAndStorePuzzle(db, date)
    },
  };
 
  // /////////////////
  // START A WORKER //
  // /////////////////
 
  const worker = new Worker(
    { connection: connectionDetails, queues: ["puzzles", "otherQueue"] },
    jobs
  );
  await worker.connect();
  worker.start();
  
  // //////////////////////
  // CONNECT TO A QUEUE //
  // //////////////////////
  
  const queue = new Queue({ connection: connectionDetails }, jobs);
  queue.on("error", function(error) {
    console.log(error);
  });
  await queue.connect();
 
  // ////////////////////
  // START A SCHEDULER //
  // ////////////////////
 
  const scheduler = new Scheduler({ connection: connectionDetails });
  await scheduler.connect();
  scheduler.start();
  
  schedule.scheduleJob("0 */15 * ? * *", async () => {
  // attempt to fetch latest puzzle every 15 minutes
  if (scheduler.master) {
    const currentDay = moment().format('YYYYMMDD');
    console.log(`>>> Attempting to fetch puzzle data for ${currentDay}`);
    await queue.enqueue("puzzles", "puzzleFetchAndStore", [currentDay]);
  }
});
 
  // //////////////////////
  // REGESTER FOR EVENTS //
  // //////////////////////
 
  worker.on("start", () => {
    console.log("worker started");
  });
  worker.on("end", () => {
    console.log("worker ended");
  });
  // worker.on("cleaning_worker", (worker, pid) => {
  //   console.log(`cleaning old worker ${worker}`);
  // });
  // worker.on("poll", queue => {
  //   console.log(`worker polling ${queue}`);
  // });
  // worker.on("ping", time => {
  //   console.log(`worker check in @ ${time}`);
  // });
  worker.on("job", (queue, job) => {
    console.log(`working job ${queue} ${JSON.stringify(job)}`);
  });
  // worker.on("reEnqueue", (queue, job, plugin) => {
  //   console.log(`reEnqueue job (${plugin}) ${queue} ${JSON.stringify(job)}`);
  // });
  worker.on("success", (queue, job, result) => {
    console.log(`job success ${queue} ${JSON.stringify(job)} >> ${result}`);
  });
  worker.on("failure", (queue, job, failure) => {
    console.log(`job failure ${queue} ${JSON.stringify(job)} >> ${failure}`);
  });
  worker.on("error", (error, queue, job) => {
    console.log(`error ${queue} ${JSON.stringify(job)}  >> ${error}`);
  });
  // worker.on("pause", () => {
  //   console.log("worker paused");
  // });
 
  scheduler.on("start", () => {
    console.log("scheduler started");
  });
  scheduler.on("end", () => {
    console.log("scheduler ended");
  });
  // scheduler.on("poll", () => {
  //   console.log("scheduler polling");
  // });
  // scheduler.on("master", state => {
  //   console.log("scheduler became master");
  // });
  // scheduler.on("error", error => {
  //   console.log(`scheduler error >> ${error}`);
  // });
  // scheduler.on("cleanStuckWorker", (workerName, errorPayload, delta) => {
  //   console.log(
  //     `failing ${workerName} (stuck for ${delta}s) and failing job ${errorPayload}`
  //   );
  // });
  // scheduler.on("workingTimestamp", timestamp => {
  //   console.log(`scheduler working timestamp ${timestamp}`);
  // });
  // scheduler.on("transferredJob", (timestamp, job) => {
  //   console.log(`scheduler enquing job ${timestamp} >> ${JSON.stringify(job)}`);
  // });
}
