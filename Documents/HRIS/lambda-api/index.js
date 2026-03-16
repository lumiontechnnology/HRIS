// Lambda function handler for API Gateway (Node.js 20)
// File: apps/api/index.js

import { writeFileSync } from 'fs';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import pkg from 'pg';

const { Client } = pkg;
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

// Cache for database connection
let dbClient = null;
let dbPassword = null;

/**
 * Get database password from AWS Secrets Manager
 */
async function getDbPassword() {
  if (dbPassword) return dbPassword;

  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: process.env.DB_SECRET_ARN,
      })
    );
    dbPassword = JSON.parse(response.SecretString).password;
    return dbPassword;
  } catch (error) {
    console.error('Failed to get database password:', error);
    throw new Error('Failed to authenticate with database');
  }
}

/**
 * Get database connection (reuse across invocations)
 */
async function getDbConnection() {
  if (dbClient && !dbClient.query) {
    // Connection already established
    return dbClient;
  }

  try {
    const password = await getDbPassword();
    
    dbClient = new Client({
      host: process.env.DATABASE_URL.split('@')[1].split(':')[0],
      port: 5432,
      user: 'postgres',
      password,
      database: 'lumion_hris',
      ssl: { rejectUnauthorized: false },
      statement_timeout: 30000,
    });

    await dbClient.connect();
    console.log('Database connected successfully');
    return dbClient;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

/**
 * API Gateway Lambda Handler
 */
export async function handler(event) {
  console.log('Event:', JSON.stringify(event));

  try {
    // Extract HTTP method and path
    const method = event.requestContext?.http?.method || 'GET';
    const path = event.rawPath || '/';

    // Connect to database
    const db = await getDbConnection();

    // Route to appropriate handler
    if (path === '/health') {
      return handleHealth();
    }

    if (path === '/health/ready') {
      return await handleReadiness(db);
    }

    if (path === '/api/employees' && method === 'GET') {
      return await handleGetEmployees(db, event);
    }

    if (path === '/api/employees' && method === 'POST') {
      return await handleCreateEmployee(db, event);
    }

    if (path.match(/^\/api\/employees\/[a-z0-9-]+$/) && method === 'GET') {
      return await handleGetEmployee(db, event);
    }

    // 404 for unknown routes
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('Handler error:', error);
    return errorResponse(500, 'Internal server error');
  }
}

/**
 * Health check endpoint
 */
function handleHealth() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    }),
  };
}

/**
 * Readiness check (database connectivity)
 */
async function handleReadiness(db) {
  try {
    // Test database connection
    const result = await db.query('SELECT 1');
    
    if (result.rows.length > 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ready',
          database: 'connected',
          timestamp: new Date().toISOString(),
        }),
      };
    }
  } catch (error) {
    console.error('Database readiness check failed:', error);
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'not_ready',
        reason: 'Database connection failed',
      }),
    };
  }
}

/**
 * Get all employees
 */
async function handleGetEmployees(db, event) {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return errorResponse(401, 'Unauthorized');
    }

    const query = `
      SELECT id, firstName, lastName, email, position, department, status, createdAt
      FROM employees
      WHERE tenantId = $1
      ORDER BY createdAt DESC
      LIMIT 100
    `;

    const result = await db.query(query, [tenantId]);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300',
      },
      body: JSON.stringify({
        data: result.rows,
        count: result.rows.length,
      }),
    };
  } catch (error) {
    console.error('Get employees error:', error);
    return errorResponse(500, 'Failed to fetch employees');
  }
}

/**
 * Create employee
 */
async function handleCreateEmployee(db, event) {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return errorResponse(401, 'Unauthorized');
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { firstName, lastName, email, position, department } = body;

    // Validate input
    if (!firstName || !lastName || !email) {
      return errorResponse(400, 'Missing required fields');
    }

    const query = `
      INSERT INTO employees (id, tenantId, firstName, lastName, email, position, department, status)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'active')
      RETURNING id, firstName, lastName, email, position, department, status, createdAt
    `;

    const result = await db.query(query, [
      tenantId,
      firstName,
      lastName,
      email,
      position || null,
      department || null,
    ]);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: result.rows[0],
        message: 'Employee created successfully',
      }),
    };
  } catch (error) {
    console.error('Create employee error:', error);
    return errorResponse(500, 'Failed to create employee');
  }
}

/**
 * Get single employee
 */
async function handleGetEmployee(db, event) {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return errorResponse(401, 'Unauthorized');
    }

    const employeeId = event.rawPath.split('/').pop();

    const query = `
      SELECT id, firstName, lastName, email, position, department, status, createdAt, updatedAt
      FROM employees
      WHERE id = $1 AND tenantId = $2
    `;

    const result = await db.query(query, [employeeId, tenantId]);

    if (result.rows.length === 0) {
      return errorResponse(404, 'Employee not found');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60',
      },
      body: JSON.stringify({ data: result.rows[0] }),
    };
  } catch (error) {
    console.error('Get employee error:', error);
    return errorResponse(500, 'Failed to fetch employee');
  }
}

/**
 * Extract tenant ID from request
 */
function getTenantId(event) {
  // Get from Authorization header, query parameter, or path
  const auth = event.headers?.authorization || event.headers?.Authorization;
  
  // Parse JWT and extract tenantId
  // Implementation depends on your auth mechanism
  // For now, return placeholder
  
  const header = event.headers?.['x-tenant-id'];
  if (header) return header;

  return null; // Should extract from JWT
}

/**
 * Error response helper
 */
function errorResponse(statusCode, message, error = null) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: message,
      ...(error && { details: error.message }),
    }),
  };
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connection');
  if (dbClient) {
    await dbClient.end();
  }
  process.exit(0);
});
