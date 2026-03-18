import { Resend } from 'resend';

type LeaveNotificationType = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

interface LeaveNotificationPayload {
  type: LeaveNotificationType;
  recipientEmail: string;
  recipientName?: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  approverComment?: string | null;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildSubject(type: LeaveNotificationType, employeeName: string): string {
  if (type === 'SUBMITTED') {
    return `Leave request submitted by ${employeeName}`;
  }

  if (type === 'APPROVED') {
    return 'Your leave request has been approved';
  }

  return 'Your leave request has been rejected';
}

function buildBody(payload: LeaveNotificationPayload): string {
  const greeting = payload.recipientName ? `Hi ${payload.recipientName},` : 'Hi,';
  const period = `${formatDate(payload.startDate)} to ${formatDate(payload.endDate)}`;

  if (payload.type === 'SUBMITTED') {
    return [
      greeting,
      '',
      `${payload.employeeName} submitted a ${payload.leaveTypeName} request for ${period}.`,
      payload.reason ? `Reason: ${payload.reason}` : undefined,
      '',
      'Please review the request in Lumion HRIS.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (payload.type === 'APPROVED') {
    return [
      greeting,
      '',
      `Your ${payload.leaveTypeName} request for ${period} has been approved.`,
      payload.approverComment ? `Comment: ${payload.approverComment}` : undefined,
      '',
      'You can view details in Lumion HRIS.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    greeting,
    '',
    `Your ${payload.leaveTypeName} request for ${period} has been rejected.`,
    payload.approverComment ? `Reason: ${payload.approverComment}` : undefined,
    '',
    'You can review and resubmit in Lumion HRIS.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sendLeaveNotification(payload: LeaveNotificationPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: process.env.SMTP_FROM || 'Lumion HRIS <noreply@lumionhris.com>',
    to: payload.recipientEmail,
    subject: buildSubject(payload.type, payload.employeeName),
    text: buildBody(payload),
  });
}
