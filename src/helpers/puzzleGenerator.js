const axios = require('axios');

const generatePuzzle = async (pangram, centerLetter) => {
  let totalWordsForPuzzle = [];
  const letters = getUniqueLetters(pangram);
  if (validateSeed(pangram, centerLetter, letters)) {
    for (const letter of letters) {
      const wordsForLetter = await getAllWordsForLetter(letter);
      wordsForLetter = wordsForLetter.filter(word => word.length >= 4);
      wordsForLetter = wordsForLetter.filter(word => isValidWord(word, letters, centerLetter));
      totalWordsForPuzzle.concat(wordsForLetter);
    }
    return totalWordsForPuzzle;
  } else {
    return null;
  }
}

const validateSeed = (pangram, centerLetter, letters) => {
  if (pangram.indexOf(centerLetter) === -1) {
    console.log('Center letter must exist in the pangram');
    return false;
  }
  if (letters.length !== 7) {
    console.log('Pangram must contain 7 unique letters');
    return false;
  }
  // more cases
  return true;
}

const getUniqueLetters = (pangram) => {
  // todo
  // return array of the unique letters of pangram
}

const getAllWordsForLetter = async (letter) => {
  // todo
  // call Merriam-Webster, return array of all words starting with letter
  return Promise.resolve([]);
}

const isValidWord = (word, letters, centerLetter) => {
  // todo 
  // return boolean. Verify:
  // 1) every char in word exists in letters
  // 2) centerLetter exists in word
  // can probably be optimized, no need to do 2) if the letter
  // it's iterating thru is the centerLetter
  return true;
}


module.exports = {
  generatePuzzle
}