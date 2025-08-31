const express = require('express');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET all tasks
router.get('/', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { search, status, priority, limit = 100 } = req.query;
    
    let query = `
      SELECT t.id, t.title, t.description, t.due_date, t.priority, t.status, 
             t.contact_id, t.created_at, t.updated_at,
             c.name as contact_name
      FROM tasks t
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE t.company_id = $1
    `;
    let params = [company_id];
    let paramCount = 1;
    
    if (search) {
      paramCount++;
      query += ` AND (t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (status) {
      paramCount++;
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
    }
    
    if (priority) {
      paramCount++;
      query += ` AND t.priority = $${paramCount}`;
      params.push(priority);
    }
    
    query += ` ORDER BY 
      CASE t.priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      t.due_date ASC NULLS LAST,
      t.created_at DESC
      LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET single task
router.get('/:id', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT t.*, c.name as contact_name
      FROM tasks t
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE t.id = $1 AND t.company_id = $2
    `, [id, company_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST new task
router.post('/', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { 
      title, 
      description, 
      due_date, 
      priority = 'medium', 
      status = 'pending', 
      contact_id 
    } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Verify contact belongs to same company if provided
    if (contact_id) {
      const contactCheck = await pool.query(
        'SELECT id FROM contacts WHERE id = $1 AND company_id = $2',
        [contact_id, company_id]
      );
      
      if (contactCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid contact ID' });
      }
    }
    
    const result = await pool.query(
      `INSERT INTO tasks (id, company_id, title, description, due_date, priority, status, contact_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [uuidv4(), company_id, title, description, due_date, priority, status, contact_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT update task
router.put('/:id', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;
    const { title, description, due_date, priority, status, contact_id } = req.body;
    
    // Verify contact belongs to same company if provided
    if (contact_id) {
      const contactCheck = await pool.query(
        'SELECT id FROM contacts WHERE id = $1 AND company_id = $2',
        [contact_id, company_id]
      );
      
      if (contactCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid contact ID' });
      }
    }
    
    const result = await pool.query(
      `UPDATE tasks 
       SET title = $1, description = $2, due_date = $3, priority = $4, 
           status = $5, contact_id = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND company_id = $8 
       RETURNING *`,
      [title, description, due_date, priority, status, contact_id, id, company_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE task
router.delete('/:id', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, company_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// GET task statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const { company_id } = req.user;
    
    const result = await pool.query(`
      SELECT 
        status,
        priority,
        COUNT(*) as count
      FROM tasks 
      WHERE company_id = $1
      GROUP BY status, priority
      ORDER BY status, priority
    `, [company_id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching task stats:', error);
    res.status(500).json({ error: 'Failed to fetch task statistics' });
  }
});

module.exports = router;
