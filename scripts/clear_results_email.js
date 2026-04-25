// Clear results email for a specific tournament
require('dotenv').config();
const pool = require('../src/db');

async function clearResultsEmail() {
  try {
    // Find tournament on 4/15/26
    const [tournaments] = await pool.query(
      'SELECT id, date FROM tournament WHERE DATE(date) = ? ORDER BY id DESC LIMIT 1',
      ['2026-04-15']
    );

    if (tournaments.length === 0) {
      console.log('No tournament found for 4/15/2026');
      return;
    }

    const tournament = tournaments[0];
    console.log(`Found tournament ID ${tournament.id} for date ${tournament.date}`);

    // Check if results email exists
    const [emailRows] = await pool.query(
      'SELECT id FROM tournament_results_email WHERE tournament_id = ?',
      [tournament.id]
    );

    if (emailRows.length === 0) {
      console.log('No results email found for this tournament');
      return;
    }

    // Delete the results email
    const [result] = await pool.query(
      'DELETE FROM tournament_results_email WHERE tournament_id = ?',
      [tournament.id]
    );

    console.log(`✓ Successfully deleted results email for tournament ${tournament.id}`);
    console.log(`  You can now regenerate it with a custom message from the Tournaments page`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

clearResultsEmail();
