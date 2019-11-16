const { Worker, Scheduler, Queue } = require('node-resque');
const axios = require('axios');
const moment = require('moment');
const { parsePuzzleData } = require('./src/helpers/puzzleDataParser');

const fetchAndStorePuzzle = (date, db) => {
  // const currentDay = moment().format('YYYYMMDD');
  
  axios.get(`https://nytbee.com/Bee_${date}.html`)
    .then((response) => {
      const puzzleHTML= response.data;
      const puzzleData = parsePuzzleData(puzzleHTML);
      
      db.collection('puzzles').insertOne(puzzleData, function(err, r) {
        assert.equal(null, err);
        assert.equal(1, r.insertedCount);
      });
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
  console.log("Connected successfully to server");

  const db = client.db(dbName);
  
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
 
  let jobsToComplete = 0;
 
  const jobs = {
    puzzleFetchAndStore: {
      perform: (date) => fetchAndStorePuzzle(date, db)
    },
  };
 
  // just a helper for this demo
  async function tryShutdown() {
    if (jobsToComplete === 0) {
      await new Promise(resolve => {
        setTimeout(resolve, 500);
      });
      await scheduler.end();
      await worker.end();
      process.exit();
    }
  }
 
  // /////////////////
  // START A WORKER //
  // /////////////////
 
  const worker = new Worker(
    { connection: connectionDetails, queues: ["puzzles", "otherQueue"] },
    jobs
  );
  await worker.connect();
  worker.start();
 
  // ////////////////////
  // START A SCHEDULER //
  // ////////////////////
 
  const scheduler = new Scheduler({ connection: connectionDetails });
  await scheduler.connect();
  scheduler.start();
 
  // //////////////////////
  // REGESTER FOR EVENTS //
  // //////////////////////
 
  worker.on("start", () => {
    console.log("worker started");
  });
  worker.on("end", () => {
    console.log("worker ended");
  });
  worker.on("cleaning_worker", (worker, pid) => {
    console.log(`cleaning old worker ${worker}`);
  });
  worker.on("poll", queue => {
    console.log(`worker polling ${queue}`);
  });
  worker.on("ping", time => {
    console.log(`worker check in @ ${time}`);
  });
  worker.on("job", (queue, job) => {
    console.log(`working job ${queue} ${JSON.stringify(job)}`);
  });
  worker.on("reEnqueue", (queue, job, plugin) => {
    console.log(`reEnqueue job (${plugin}) ${queue} ${JSON.stringify(job)}`);
  });
  worker.on("success", (queue, job, result) => {
    console.log(`job success ${queue} ${JSON.stringify(job)} >> ${result}`);
  });
  worker.on("failure", (queue, job, failure) => {
    console.log(`job failure ${queue} ${JSON.stringify(job)} >> ${failure}`);
  });
  worker.on("error", (error, queue, job) => {
    console.log(`error ${queue} ${JSON.stringify(job)}  >> ${error}`);
  });
  worker.on("pause", () => {
    console.log("worker paused");
  });
 
  scheduler.on("start", () => {
    console.log("scheduler started");
  });
  scheduler.on("end", () => {
    console.log("scheduler ended");
  });
  scheduler.on("poll", () => {
    console.log("scheduler polling");
  });
  scheduler.on("master", state => {
    console.log("scheduler became master");
  });
  scheduler.on("error", error => {
    console.log(`scheduler error >> ${error}`);
  });
  scheduler.on("cleanStuckWorker", (workerName, errorPayload, delta) => {
    console.log(
      `failing ${workerName} (stuck for ${delta}s) and failing job ${errorPayload}`
    );
  });
  scheduler.on("workingTimestamp", timestamp => {
    console.log(`scheduler working timestamp ${timestamp}`);
  });
  scheduler.on("transferredJob", (timestamp, job) => {
    console.log(`scheduler enquing job ${timestamp} >> ${JSON.stringify(job)}`);
  });
 
  // //////////////////////
  // CONNECT TO A QUEUE //
  // //////////////////////
 
  const queue = new Queue({ connection: connectionDetails }, jobs);
  queue.on("error", function(error) {
    console.log(error);
  });
  await queue.connect();
  await queue.enqueue("puzzles", "puzzleFetchAndStore", ["20191111"]);
  jobsToComplete = 1;
}
 
// boot();