const axios = require('axios');
const moment = require('moment');
const { parsePuzzleData } = require('../helpers/puzzleDataParser');

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
MongoClient.connect(url, async function(err, client) {
  assert.equal(null, err);
  console.log(`[${moment()}] Connected successfully to server`);

  const db = client.db(dbName);
  
  for (const year of ["2018", "2019"]) {
    for (const month of ["05"]) {
      for (const day of ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", 
                          "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
                          "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31"]) {
        await fetchAndStorePuzzle(db, year + month + day);
      }
    }
  }
});
