import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { config, RATE_LIMITS } from '../config';
import { generateApiKey, hashApiKey } from '../utils/apiKey';
import { BadRequest, Unauthorized, Conflict } from '../utils/errors';

const router = Router();

// ============================================================
// POST /auth/register - Create account + API key
// ============================================================
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, full_name, organization } = req.body;

    if (!email || !password) {
      throw BadRequest('Email and password required');
    }
    if (password.length < 8) {
      throw BadRequest('Password must be at least 8 characters');
    }

    // Check if user exists
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if ((existing.rowCount ?? 0) > 0) {
      throw Conflict('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, full_name, organization, user_type, monthly_limit, is_active, is_verified)
       VALUES ($1, $2, $3, $4, 'USER', $5, true, true)
       RETURNING id, email, full_name, user_type`,
      [email, hashedPassword, full_name || '', organization || '', RATE_LIMITS.USER]
    );

    const user = rows[0];

    // Generate default API key
    const { raw: apiKey, prefix } = generateApiKey();
    const hashedKey = await hashApiKey(apiKey);

    await query(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'default', hashedKey, prefix]
    );

    // Sign the user in immediately so they can manage their account/keys
    const token = jwt.sign(
      { uid: user.id, email: user.email, user_type: user.user_type },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      data: {
        user: { id: user.id, email: user.email, full_name: user.full_name, user_type: user.user_type },
        api_key: apiKey,
        token,
        message: 'Account created! Save your API key — it will not be shown again.',
      },
    });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// POST /auth/login - Get JWT token
// ============================================================
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw BadRequest('Email and password required');
    }

    const { rows } = await query(
      `SELECT id, email, password_hash, full_name, user_type
       FROM users WHERE email = $1`,
      [email]
    );

    if (rows.length === 0) {
      throw Unauthorized('Invalid credentials');
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      throw Unauthorized('Invalid credentials');
    }

    // Generate JWT
    const token = jwt.sign(
      { uid: user.id, email: user.email, user_type: user.user_type },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          user_type: user.user_type,
        },
        token,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
