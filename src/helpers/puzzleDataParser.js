const parsePuzzleData = (puzzleHTML) => {
  const validWords = getValidWords(puzzleHTML);
  
  let puzzleLetters = []
  validWords.map(word => {
    const lettersInWord = word.split('');
    for (let letter of lettersInWord) {
      puzzleLetters.push(letter);
    }
    
    return null;
  });
  puzzleLetters = [...new Set(puzzleLetters)]
  
  const centerLetter = getCenterLetter(validWords, puzzleLetters);
  const outerLetters = getOuterLetters(centerLetter, puzzleLetters);
  
  return {
    puzzleDate: getPuzzleDate(puzzleHTML),
    validWords: validWords,
    centerLetter: centerLetter,
    outerLetters: outerLetters,
    pointsNeededForGenius: getPointsNeededForGenius(puzzleHTML),
    maximumPuzzleScore: getMaximumPuzzleScore(puzzleHTML),
    numberOfAnswers: getNumberOfAnswers(puzzleHTML),
    numberOfPangrams: getNumberOfPangrams(puzzleHTML),
  }
}

const getValidWords = (puzzleHTML) => {
  let wordsListString = puzzleHTML.match(/"words":\[\[(.*?)\]\]/)[0];
  return wordsListString.match(/\w+/g).slice(1);
}

const getCenterLetter = (validWordsList, puzzleLetters) => {
  let centerLetterCandidates = puzzleLetters.map(letter => letter);
  
  for (const word of validWordsList) {
    for (const letter of centerLetterCandidates) {
      if (word.indexOf(letter) === -1) {
        const indexForLetterToRemove = centerLetterCandidates.indexOf(letter); 
        centerLetterCandidates.splice(indexForLetterToRemove, 1);
      }
    }
  }
  
  //prioritize consonants over vowels in a tie - vowels typically aren't the center letter
  if (centerLetterCandidates.length > 0) {
    for (const letter of centerLetterCandidates) {
      if (["a","e","i","o","u"].indexOf(letter) === -1) {
        return letter;
      }
    }
  }
  
  return centerLetterCandidates[0];
}

const getOuterLetters = (centerLetter, puzzleLetters) => {
  let letters = puzzleLetters.map(letter => letter);
  const centerLetterIndex = puzzleLetters.indexOf(centerLetter);
  letters.splice(centerLetterIndex, 1);
  
  return letters;
}

const getPuzzleDate = (puzzleHTML) => {
  return puzzleHTML.match(/src="pics\/(20\d*)/)[1];
}

const getPointsNeededForGenius = (puzzleHTML) => {
  return Number(puzzleHTML.match(/Points Needed for Genius: (\d*)/)[1]);
}

const getMaximumPuzzleScore = (puzzleHTML) => {
  return Number(puzzleHTML.match(/Maximum Puzzle Score: (\d*)/)[1]);
}

const getNumberOfAnswers = (puzzleHTML) => {
  return Number(puzzleHTML.match(/Number of Answers: (\d*)/)[1]);
}

const getNumberOfPangrams = (puzzleHTML) => {
  let matchNumPangramsString = puzzleHTML.match(/Number of Pangrams: (\d*)/);
  if (matchNumPangramsString) { return Number(matchNumPangramsString[1]) };
  
  return 1; // there is always at least one pangram
}



module.exports = {
  parsePuzzleData
}