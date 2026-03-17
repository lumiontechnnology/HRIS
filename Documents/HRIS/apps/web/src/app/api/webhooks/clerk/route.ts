import { Webhook } from 'svix';
import { PrismaClient } from '@lumion/database';
import { NextResponse } from 'next/server';
import type { WebhookEvent } from '@clerk/nextjs/server';

const prisma = new PrismaClient();
const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (request.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  // Verify the webhook signature
  const headers = Object.fromEntries(request.headers.entries());
  const payload = await request.text();

  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const wh = new Webhook(webhookSecret);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(payload, headers) as WebhookEvent;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 401 }
    );
  }

  // Handle user creation
  if (evt.type === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    
    const email = email_addresses?.[0]?.email_address;
    if (!email) {
      return NextResponse.json({ success: true });
    }

    try {
      // Create user in database
      await prisma.user.create({
        data: {
          clerkUserId: id,
          email,
          firstName: first_name || 'First',
          lastName: last_name || 'Last',
          tenantId: 'default',
          isActive: true,
        },
      });

      console.log(`✓ User synced from Clerk: ${email}`);
      return NextResponse.json({ success: true });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // User already exists, that's fine
        return NextResponse.json({ success: true });
      }
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: 'Failed to sync user' },
        { status: 500 }
      );
    }
  }

  // Handle user updates
  if (evt.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    
    const email = email_addresses?.[0]?.email_address;
    if (!email) {
      return NextResponse.json({ success: true });
    }

    try {
      await prisma.user.update({
        where: { clerkUserId: id },
        data: {
          firstName: first_name || 'First',
          lastName: last_name || 'Last',
        },
      });

      console.log(`✓ User updated: ${email}`);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating user:', error);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }
  }

  // Handle user deletion
  if (evt.type === 'user.deleted') {
    const { id } = evt.data;

    try {
      await prisma.user.delete({
        where: { clerkUserId: id },
      });

      console.log(`✓ User deleted: ${id}`);
      return NextResponse.json({ success: true });
    } catch (error: any) {
      if (error.code === 'P2025') {
        // User not found, that's fine
        return NextResponse.json({ success: true });
      }
      console.error('Error deleting user:', error);
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }
  }

  // For other events, just return success
  return NextResponse.json({ success: true });
}
