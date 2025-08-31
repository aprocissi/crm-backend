const express = require('express');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET all contacts
router.get('/', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { search, status, limit = 100 } = req.query;
    
    let query = `
      SELECT id, name, email, phone, position, company_name, status, value, notes, 
             last_contact, created_at, updated_at
      FROM contacts 
      WHERE company_id = $1
    `;
    let params = [company_id];
    let paramCount = 1;
    
    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR company_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET single contact
router.get('/:id', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM contacts WHERE id = $1 AND company_id = $2',
      [id, company_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// POST new contact
router.post('/', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { name, email, phone, position, company_name, value, notes, status = 'prospect' } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const result = await pool.query(
      `INSERT INTO contacts (id, company_id, name, email, phone, position, company_name, value, notes, status, last_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE) 
       RETURNING *`,
      [uuidv4(), company_id, name, email, phone, position, company_name, value || 0, notes, status]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT update contact
router.put('/:id', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;
    const { name, email, phone, position, company_name, value, notes, status } = req.body;
    
    const result = await pool.query(
      `UPDATE contacts 
       SET name = $1, email = $2, phone = $3, position = $4, company_name = $5, 
           value = $6, notes = $7, status = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND company_id = $10 
       RETURNING *`,
      [name, email, phone, position, company_name, value, notes, status, id, company_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE contact
router.delete('/:id', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, company_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
