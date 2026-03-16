import { Hono } from 'hono';
import { PrismaClient } from '@lumion/database';
import {
  EmployeeCreateSchema,
  EmployeeUpdateSchema,
  PaginationSchema,
} from '@lumion/validators';
import type { AppEnv } from '../index.js';

export function createEmployeeRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const prisma = new PrismaClient();

  // ========================================================================
  // GET /api/v1/employees - List all employees
  // ========================================================================
  app.get('/', async (c) => {
    try {
      const tenantId = c.get('tenantId');

      // Parse query params
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');
      const sortBy = c.req.query('sortBy') || 'createdAt';
      const order = (c.req.query('order') || 'desc') as 'asc' | 'desc';

      // Validate pagination
      const validPagination = PaginationSchema.parse({ page, limit, sortBy, order });

      const skip = (validPagination.page - 1) * validPagination.limit;

      // Fetch employees
      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where: { tenantId },
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: { select: { title: true } },
            department: { select: { name: true } },
            location: { select: { name: true } },
            employmentStatus: true,
            hireDate: true,
            avatar: true,
          },
          orderBy: { [sortBy]: order },
          skip,
          take: validPagination.limit,
        }),
        prisma.employee.count({ where: { tenantId } }),
      ]);

      return c.json({
        success: true,
        data: employees,
        meta: {
          page: validPagination.page,
          limit: validPagination.limit,
          total,
          hasMore: skip + employees.length < total,
        },
      });
    } catch (error) {
      console.error('Error fetching employees:', error);
      return c.json(
        { success: false, error: 'Failed to fetch employees' },
        500
      );
    }
  });

  // ========================================================================
  // POST /api/v1/employees - Create employee
  // ========================================================================
  app.post('/', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();

      // Validate input
      const validData = EmployeeCreateSchema.parse(body);

      // Generate employee ID
      const existingCount = await prisma.employee.count({
        where: { tenantId },
      });
      const employeeId = `LMN-${String(existingCount + 1).padStart(4, '0')}`;

      // Create employee
      const employee = await prisma.employee.create({
        data: {
          tenantId,
          employeeId,
          ...validData,
        },
      });

      return c.json(
        {
          success: true,
          data: employee,
          message: 'Employee created successfully',
        },
        201
      );
    } catch (error: any) {
      console.error('Error creating employee:', error);

      if (error.name === 'ZodError') {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: error.errors,
            },
          },
          400
        );
      }

      return c.json(
        { success: false, error: 'Failed to create employee' },
        500
      );
    }
  });

  // ========================================================================
  // GET /api/v1/employees/:id - Get single employee
  // ========================================================================
  app.get('/:id', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const id = c.req.param('id');

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          jobTitle: true,
          department: true,
          location: true,
          manager: { select: { id: true, firstName: true, lastName: true } },
          directReports: { select: { id: true, firstName: true, lastName: true } },
          leaveBalances: { include: { leaveType: true } },
          documents: true,
          educations: true,
          workExperiences: true,
        },
      });

      if (!employee || employee.tenantId !== tenantId) {
        return c.json(
          { success: false, error: 'Employee not found' },
          404
        );
      }

      return c.json({
        success: true,
        data: employee,
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      return c.json(
        { success: false, error: 'Failed to fetch employee' },
        500
      );
    }
  });

  // ========================================================================
  // PATCH /api/v1/employees/:id - Update employee
  // ========================================================================
  app.patch('/:id', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const id = c.req.param('id');
      const body = await c.req.json();

      // Validate input
      const validData = EmployeeUpdateSchema.parse(body);

      // Check ownership
      const existing = await prisma.employee.findUnique({
        where: { id },
      });

      if (!existing || existing.tenantId !== tenantId) {
        return c.json(
          { success: false, error: 'Employee not found' },
          404
        );
      }

      // Update employee
      const employee = await prisma.employee.update({
        where: { id },
        data: validData,
      });

      return c.json({
        success: true,
        data: employee,
        message: 'Employee updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating employee:', error);

      if (error.name === 'ZodError') {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: error.errors,
            },
          },
          400
        );
      }

      return c.json(
        { success: false, error: 'Failed to update employee' },
        500
      );
    }
  });

  // ========================================================================
  // DELETE /api/v1/employees/:id - Soft delete employee
  // ========================================================================
  app.delete('/:id', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const id = c.req.param('id');

      // Check ownership
      const existing = await prisma.employee.findUnique({
        where: { id },
      });

      if (!existing || existing.tenantId !== tenantId) {
        return c.json(
          { success: false, error: 'Employee not found' },
          404
        );
      }

      // Update to terminated status
      await prisma.employee.update({
        where: { id },
        data: {
          employmentStatus: 'TERMINATED',
          terminationDate: new Date(),
        },
      });

      return c.json({
        success: true,
        message: 'Employee terminated successfully',
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      return c.json(
        { success: false, error: 'Failed to delete employee' },
        500
      );
    }
  });

  return app;
}
