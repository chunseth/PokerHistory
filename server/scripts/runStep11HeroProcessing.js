#!/usr/bin/env node

/**
 * Batch-process Step-11 for every hero action in the database that is missing a
 * response model.  The script:
 *   1. Connects to MongoDB (use MONGODB_URI env var or localhost fallback).
 *   2. For each hand document with heroActions array, loops through each hero
 *      action without `responseModel`.
 *   3. Calls runStep11Pipeline (which also persists per-field data) and then
 *      stores the returned model at heroActions[i].responseModel.
 *
 * Usage:
 *   node server/scripts/runStep11HeroProcessing.js <username?>
 *   If <username> is provided, restricts processing to that user.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Hand from '../models/Hand.js';

// Pipeline orchestrator (already handles persistence of sub-fields)
import * as step11Mod from '../../src/utils/EV_Calculation/Step11/step11Pipeline.js';
const { runStep11Pipeline } = step11Mod;

dotenv.config();

async function main() {
  const username = process.argv[2] || null;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost/poker-history';
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const query = username ? { username } : {};

  const cursor = Hand.find(query).cursor();
  let handsProcessed = 0;
  let actionsProcessed = 0;

  for (let handDoc = await cursor.next(); handDoc != null; handDoc = await cursor.next()) {
    if (!Array.isArray(handDoc.heroActions) || handDoc.heroActions.length === 0) continue;

    let handModified = false;
    for (let i = 0; i < handDoc.heroActions.length; i++) {
      const heroAction = handDoc.heroActions[i];
      if (heroAction.responseModel) continue; // skip already processed

      try {
        const responseModel = await runStep11Pipeline(handDoc, i);
        // Direct mutation on sub-document
        handDoc.heroActions[i].responseModel = responseModel;
        handModified = true;
        actionsProcessed++;
      } catch (err) {
        console.error(`Error processing hand ${handDoc.id} action ${i}:`, err.message);
      }
    }

    if (handModified) {
      await handDoc.save({ validateBeforeSave: false });
      handsProcessed++;
    }
  }

  console.log(`Done. Updated ${actionsProcessed} heroActions across ${handsProcessed} hands.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  mongoose.disconnect();
}); 