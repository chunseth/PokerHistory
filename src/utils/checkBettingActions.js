const mongoose = require('mongoose');
const { Hand } = require('../../src/models/models');

async function checkBettingActions() {
  await mongoose.connect('mongodb://localhost:27017/pokerHistory', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const hand = await Hand.findOne({});
  if (!hand) {
    console.log('No hand found');
    return;
  }

  console.log('Sample bettingActions:', hand.bettingActions);

  await mongoose.disconnect();
}

checkBettingActions();