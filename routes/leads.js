const express = require('express');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET all leads
router.get('/', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { search, stage, limit = 100 } = req.query;
    
    let query = `
      SELECT id, title, company_name, contact_name, value, stage, probability, 
             expected_close, source, notes, created_at, updated_at
      FROM leads 
      WHERE company_id = $1
    `;
    let params = [company_id];
    let paramCount = 1;
    
    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR company_name ILIKE $${paramCount} OR contact_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (stage) {
      paramCount++;
      query += ` AND stage = $${paramCount}`;
      params.push(stage);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET single lead
router.get('/:id', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM leads WHERE id = $1 AND company_id = $2',
      [id, company_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// POST new lead
router.post('/', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { 
      title, 
      company_name, 
      contact_name, 
      value, 
      stage = 'lead', 
      probability = 10, 
      expected_close, 
      source, 
      notes 
    } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const result = await pool.query(
      `INSERT INTO leads (id, company_id, title, company_name, contact_name, value, stage, probability, expected_close, source, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [uuidv4(), company_id, title, company_name, contact_name, value || 0, stage, probability, expected_close, source, notes]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// PUT update lead
router.put('/:id', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;
    const { 
      title, 
      company_name, 
      contact_name, 
      value, 
      stage, 
      probability, 
      expected_close, 
      source, 
      notes 
    } = req.body;
    
    const result = await pool.query(
      `UPDATE leads 
       SET title = $1, company_name = $2, contact_name = $3, value = $4, stage = $5, 
           probability = $6, expected_close = $7, source = $8, notes = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND company_id = $11 
       RETURNING *`,
      [title, company_name, contact_name, value, stage, probability, expected_close, source, notes, id, company_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// DELETE lead
router.delete('/:id', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM leads WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, company_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// GET pipeline statistics
router.get('/stats/pipeline', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    
    const result = await pool.query(`
      SELECT 
        stage,
        COUNT(*) as count,
        SUM(value) as total_value,
        AVG(probability) as avg_probability
      FROM leads 
      WHERE company_id = $1
      GROUP BY stage
      ORDER BY 
        CASE stage
          WHEN 'lead' THEN 1
          WHEN 'qualified' THEN 2
          WHEN 'proposal' THEN 3
          WHEN 'negotiation' THEN 4
          WHEN 'closed-won' THEN 5
          WHEN 'closed-lost' THEN 6
          ELSE 7
        END
    `, [company_id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pipeline stats:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline statistics' });
  }
});

module.exports = router;
