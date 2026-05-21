const express = require('express');
const multer = require('multer');
const { OpenAI } = require('openai');
const pool = require('../db');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/courses - list all courses
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, address, phone, created_at FROM course ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/courses/parse-scorecard - parse a scorecard image with OpenAI vision
// NOTE: defined before /:id so Express does not treat "parse-scorecard" as a numeric id
router.post('/parse-scorecard', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'image file is required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server' });
  }

  const client = new OpenAI({ apiKey });
  const base64 = req.file.buffer.toString('base64');
  const mimeType = req.file.mimetype || 'image/jpeg';
  const imageContent = { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } };

  try {
    // ── CALL 1: OUT/IN subtotals ──────────────────────────────────────────────
    const phase1Resp = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Look only at the OUT column (immediately after hole 9) and IN column (immediately after hole 18) in this golf scorecard.
Read the printed subtotal values directly — do NOT compute from individual holes.
Write one line per tee row in exactly this format:
Black: OUT=___, IN=___
Blue: OUT=___, IN=___
White: OUT=___, IN=___
Gold: OUT=___, IN=___
Red: OUT=___, IN=___
Par: OUT=___, IN=___`
          },
          imageContent
        ]
      }],
      max_tokens: 400
    });

    const phase1Text = phase1Resp.choices[0].message.content.trim();
    console.log('=== PHASE 1 ===\n', phase1Text, '\n=== END PHASE 1 ===');

    // Parse Phase 1 values
    const totals = {};
    for (const line of phase1Text.split('\n')) {
      const m = line.match(/(Black|Blue|White|Gold|Red|Par).*?OUT=(\d+).*?IN=(\d+)/i);
      if (m) totals[m[1].toLowerCase()] = { out: parseInt(m[2]), in: parseInt(m[3]) };
    }
    const tgt = (tee, half) => (totals[tee] ? totals[tee][half] : '(see image)');

    // ── CALL 2: Front nine only (all tees + front handicap) ──────────────────
    const phase2Resp = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [{ role: 'user', content: [
        { type: 'text', text: `Read ONLY the FRONT NINE (holes 1-9) from this golf scorecard. Ignore everything to the right of the INITIAL banner / OUT column.

Output exactly these lines (one per tee, comma-separated values, no extra text):
FRONT Black (must sum to ${tgt('black','out')}): v1, v2, v3, v4, v5, v6, v7, v8, v9
FRONT Blue  (must sum to ${tgt('blue','out')}): v1, v2, v3, v4, v5, v6, v7, v8, v9
FRONT White (must sum to ${tgt('white','out')}): v1, v2, v3, v4, v5, v6, v7, v8, v9
FRONT Gold  (must sum to ${tgt('gold','out')}): v1, v2, v3, v4, v5, v6, v7, v8, v9
FRONT Red   (must sum to ${tgt('red','out')}): v1, v2, v3, v4, v5, v6, v7, v8, v9
FRONT Par   (must sum to ${tgt('par','out')}, each value MUST be 3, 4, or 5): v1, v2, v3, v4, v5, v6, v7, v8, v9
MENS_HCP_F: h1, h2, h3, h4, h5, h6, h7, h8, h9` },
        imageContent
      ]}],
      max_tokens: 600
    });

    const phase2Text = phase2Resp.choices[0].message.content.trim();
    console.log('=== PHASE 2 FRONT ===\n', phase2Text, '\n=== END PHASE 2 ===');

    // Parse front nine values
    const front9 = {};
    for (const line of phase2Text.split('\n')) {
      const m = line.match(/(?:FRONT\s+)?(Black|Blue|White|Gold|Red|Par|MENS_HCP_F)[^:]*:([\d,\s]+)/i);
      if (m) {
        const key = m[1].toLowerCase() === 'mens_hcp_f' ? 'hcpFront' : m[1].toLowerCase();
        const nums = m[2].trim().split(/[\s,]+/).filter(v => /^\d+$/.test(v)).map(Number);
        if (nums.length >= 9) front9[key] = nums.slice(0, 9);
      }
    }
    const f9 = (tee) => (front9[tee] ? front9[tee].join(', ') : '(see image)');
    const hcpFrontStr = front9.hcpFront ? front9.hcpFront.join(', ') : '(see image)';

    // ── CALL 3: Back nine + full JSON (with front nine values as row anchors) ─
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You are a precise golf scorecard data extractor. Write a verified text transcript, then output JSON.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `From this golf scorecard, read the BACK NINE (holes 10-18) for each tee.

The front nine values have already been verified and are provided below — do NOT re-read holes 1-9:
  Black front: ${f9('black')}
  Blue front:  ${f9('blue')}
  White front: ${f9('white')}
  Gold front:  ${f9('gold')}
  Red front:   ${f9('red')}
  Par front:   ${f9('par')}
  Men's HCP front: ${hcpFrontStr}

SCORECARD LAYOUT: Each tee row is one continuous horizontal band spanning the full scorecard. The INITIAL banner is just a label column between holes 9 and 10. The back nine values (holes 10-18) are in the SAME HORIZONTAL ROW as the front nine values listed above.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — BACK NINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In the back nine section (right half, after the INITIAL banner column), read holes 10-18 for each row.
Do NOT calculate or verify any sums — just read the numbers as printed.

Tee rows from top to bottom in the back nine section:
  BACK Black (Row 1, DARK/BLACK background):
    v10, v11, v12, v13, v14, v15, v16, v17, v18
  BACK Blue  (Row 2, BLUE background):
    v10, v11, v12, v13, v14, v15, v16, v17, v18
  BACK White (Row 3, WHITE/LIGHT background):
    v10, v11, v12, v13, v14, v15, v16, v17, v18
  BACK Gold  (Row 4, GOLD/YELLOW background):
    v10, v11, v12, v13, v14, v15, v16, v17, v18
  BACK Red   (RED section at bottom of scorecard):
    v10, v11, v12, v13, v14, v15, v16, v17, v18
  BACK Par   (Par row, each value MUST be 3, 4, or 5):
    v10, v11, v12, v13, v14, v15, v16, v17, v18

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — MEN'S HANDICAP BACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MENS_HCP_B: h10, h11, h12, h13, h14, h15, h16, h17, h18

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4 — JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Using the front nine values provided above and the back nine values you just read, output:
{
  "course_name": "string or null",
  "tees": [
    {
      "tee_name": "Black",
      "gender": "M",
      "course_rating": 72.4,
      "slope_rating": 138,
      "holes": [
        { "hole_number": 1, "distance": 495, "par": 5, "handicap": 15 },
        ...all 18 holes (1-9 from front nine provided above, 10-18 from back nine you read)
      ]
    },
    ...ALL tees
  ]
}
Gender: Red → "F", Ladies → "F", all others → "M". Gold with M/W ratings → two entries.
Par and handicap are identical for all tees.`
            },
            imageContent
          ]
        }
      ],
      max_tokens: 10000
    });

    const text = response.choices[0].message.content.trim();
    console.log('=== SCORECARD PARSE TRANSCRIPT ===\n', text.substring(0, 4000), '\n=== END ===');
    let parsed;
    const match = text.match(/\{\s*"course_name"[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return res.status(422).json({ error: 'Could not parse AI response as JSON', raw: text });
      }
    } else {
      return res.status(422).json({ error: 'No JSON found in AI response', raw: text });
    }

    // ── CALL 4: Dedicated Black back nine (overrides Call 3 which consistently reads wrong row) ──
    try {
      const blackResp = await client.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0,
        messages: [{ role: 'user', content: [
          { type: 'text', text: `This golf scorecard has a Black tee row. The Black tee front nine yardages (holes 1-9) are: ${f9('black')}.

Find the row in the image that contains those exact front nine values on its left side.
Read the 9 yardage values to the right of the vertical INITIAL column for that same row (holes 10-18).

Output only 9 numbers, comma-separated. Nothing else.` },
          imageContent
        ]}],
        max_tokens: 60
      });
      const blackText = blackResp.choices[0].message.content.trim();
      console.log('=== CALL 4 BLACK BACK ===\n', blackText, '\n=== END CALL 4 ===');
      const blackNums = blackText.match(/\d+/g)?.map(Number)?.slice(0, 9) ?? [];
      if (blackNums.length === 9 && parsed?.tees) {
        const blackTee = parsed.tees.find(t => t.tee_name?.toLowerCase() === 'black');
        if (blackTee?.holes) {
          blackNums.forEach((dist, i) => {
            const hole = blackTee.holes.find(h => h.hole_number === i + 10);
            if (hole) hole.distance = dist;
          });
        }
      }
    } catch (e) {
      console.error('Call 4 (Black back nine) failed:', e.message);
    }

    res.json(parsed);
  } catch (err) {
    console.error('OpenAI error', err);
    res.status(500).json({ error: 'Failed to parse scorecard' });
  }
});

// GET /api/courses/:id - get course with tees (each tee includes its 18 holes)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [courseRows] = await pool.query('SELECT * FROM course WHERE id = ?', [id]);
    if (courseRows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const [rows] = await pool.query(
      `SELECT ct.id, ct.tee_name, ct.tee_color, ct.gender, ct.course_rating, ct.slope_rating,
              ht.hole_id, h.hole_number, ht.distance, ht.par, ht.handicap
       FROM course_tee ct
       LEFT JOIN hole_tee ht ON ht.tee_id = ct.id
       LEFT JOIN hole h ON h.id = ht.hole_id
       WHERE ct.course_id = ?
       ORDER BY ct.id, h.hole_number`,
      [id]
    );

    // Build tees array with nested holes
    const teesMap = new Map();
    for (const row of rows) {
      if (!teesMap.has(row.id)) {
        teesMap.set(row.id, {
          id: row.id,
          tee_name: row.tee_name,
          tee_color: row.tee_color,
          gender: row.gender,
          course_rating: row.course_rating,
          slope_rating: row.slope_rating,
          holes: []
        });
      }
      if (row.hole_id) {
        teesMap.get(row.id).holes.push({
          hole_id: row.hole_id,
          hole_number: row.hole_number,
          distance: row.distance,
          par: row.par,
          handicap: row.handicap
        });
      }
    }

    res.json({ course: courseRows[0], tees: [...teesMap.values()] });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/courses - create course { name, address?, phone? }
router.post('/', async (req, res) => {
  const { name, address, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const [result] = await pool.execute(
      'INSERT INTO course (name, address, phone) VALUES (?, ?, ?)',
      [name, address || null, phone || null]
    );
    const insertedId = result.insertId;
    const [rows] = await pool.query('SELECT * FROM course WHERE id = ?', [insertedId]);
    console.log(`Course created id=${insertedId} name=${name}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/courses/:id - update course info
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, address, phone } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const [result] = await pool.execute(
      'UPDATE course SET name = ?, address = ?, phone = ? WHERE id = ?',
      [name, address || null, phone || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const [rows] = await pool.query('SELECT * FROM course WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/courses/:id - delete course and all its data (cascade via FK)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check for linked tournaments before attempting delete
    const [[{ count }]] = await pool.execute(
      'SELECT COUNT(*) AS count FROM tournament WHERE course_id = ?', [id]
    );
    if (count > 0) {
      return res.status(409).json({
        error: `Cannot delete: this course is used by ${count} tournament${count > 1 ? 's' : ''}. Delete those tournaments first.`
      });
    }
    const [result] = await pool.execute('DELETE FROM course WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/courses/:id/tees - list tees for a course (with hole count)
router.get('/:id/tees', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT ct.*, COUNT(ht.id) AS hole_count
       FROM course_tee ct
       LEFT JOIN hole_tee ht ON ht.tee_id = ct.id
       WHERE ct.course_id = ?
       GROUP BY ct.id
       ORDER BY ct.id`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/courses/:id/tees - add a tee box to a course
// body: { tee_name, tee_color?, gender, course_rating?, slope_rating? }
router.post('/:id/tees', async (req, res) => {
  const { id } = req.params;
  const { tee_name, tee_color, gender, course_rating, slope_rating } = req.body;

  if (!tee_name) return res.status(400).json({ error: 'tee_name is required' });
  if (!['M', 'F', 'A'].includes(gender)) {
    return res.status(400).json({ error: 'gender must be M, F, or A' });
  }

  try {
    const [courseRows] = await pool.query('SELECT id FROM course WHERE id = ?', [id]);
    if (courseRows.length === 0) return res.status(404).json({ error: 'Course not found' });

    const [result] = await pool.execute(
      `INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tee_name, tee_color || '#FFFFFF', gender, course_rating || null, slope_rating || null]
    );

    const [rows] = await pool.query('SELECT * FROM course_tee WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A tee with that name already exists for this course' });
    }
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/courses/:id/tees/:teeId - update tee metadata
router.put('/:id/tees/:teeId', async (req, res) => {
  const { id, teeId } = req.params;
  const { tee_name, tee_color, gender, course_rating, slope_rating } = req.body;

  if (gender !== undefined && !['M', 'F', 'A'].includes(gender)) {
    return res.status(400).json({ error: 'gender must be M, F, or A' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id FROM course_tee WHERE id = ? AND course_id = ?', [teeId, id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Tee not found' });

    const fields = [];
    const values = [];
    if (tee_name !== undefined)     { fields.push('tee_name = ?');     values.push(tee_name); }
    if (tee_color !== undefined)    { fields.push('tee_color = ?');     values.push(tee_color); }
    if (gender !== undefined)       { fields.push('gender = ?');        values.push(gender); }
    if (course_rating !== undefined){ fields.push('course_rating = ?'); values.push(course_rating); }
    if (slope_rating !== undefined) { fields.push('slope_rating = ?');  values.push(slope_rating); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(teeId, id);
    await pool.execute(
      `UPDATE course_tee SET ${fields.join(', ')} WHERE id = ? AND course_id = ?`,
      values
    );

    const [rows] = await pool.query('SELECT * FROM course_tee WHERE id = ?', [teeId]);
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/courses/:id/tees/:teeId - delete a tee and its hole_tee rows (cascade)
router.delete('/:id/tees/:teeId', async (req, res) => {
  const { id, teeId } = req.params;
  try {
    const [result] = await pool.execute(
      'DELETE FROM course_tee WHERE id = ? AND course_id = ?', [teeId, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Tee not found' });
    res.json({ message: 'Tee deleted' });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/courses/:id/tees/:teeId/holes - upsert all hole data for one tee
// body: { holes: [{ hole_number, distance, par, handicap }] }
router.put('/:id/tees/:teeId/holes', async (req, res) => {
  const { id, teeId } = req.params;
  const { holes } = req.body;

  if (!holes || !Array.isArray(holes)) {
    return res.status(400).json({ error: 'holes array is required' });
  }

  try {
    const [teeRows] = await pool.query(
      'SELECT id FROM course_tee WHERE id = ? AND course_id = ?', [teeId, id]
    );
    if (teeRows.length === 0) return res.status(404).json({ error: 'Tee not found' });

    for (const hole of holes) {
      const { hole_number, distance, par, handicap } = hole;

      // Ensure the base hole row exists for this course+hole_number
      const [[holeRow]] = await pool.query(
        'SELECT id FROM hole WHERE course_id = ? AND hole_number = ?', [id, hole_number]
      );

      let holeId;
      if (holeRow) {
        holeId = holeRow.id;
      } else {
        const [ins] = await pool.execute(
          'INSERT INTO hole (course_id, hole_number) VALUES (?, ?)', [id, hole_number]
        );
        holeId = ins.insertId;
      }

      await pool.execute(
        `INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           distance = VALUES(distance),
           par      = VALUES(par),
           handicap = VALUES(handicap)`,
        [holeId, teeId, distance || null, par || null, handicap || null]
      );
    }

    const [rows] = await pool.query(
      `SELECT h.hole_number, ht.distance, ht.par, ht.handicap
       FROM hole_tee ht
       JOIN hole h ON h.id = ht.hole_id
       WHERE ht.tee_id = ?
       ORDER BY h.hole_number`,
      [teeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
