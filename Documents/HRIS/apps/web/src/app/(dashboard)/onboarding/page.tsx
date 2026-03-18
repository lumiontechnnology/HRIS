'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { EmptyState, SectionHeader } from '@/components/system/primitives';

const onboardingTasks = [
  { id: 'ONB-1', label: 'Create employee account', done: true },
  { id: 'ONB-2', label: 'Assign manager and department', done: true },
  { id: 'ONB-3', label: 'Upload employment documents', done: false },
  { id: 'ONB-4', label: 'Enroll payroll profile', done: false },
  { id: 'ONB-5', label: 'Complete orientation checklist', done: false },
];

export default function OnboardingPage(): JSX.Element {
  const [tasks, setTasks] = useState(onboardingTasks);
  const completed = tasks.filter((task) => task.done).length;
  const progress = Math.round((completed / tasks.length) * 100);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Onboarding"
        description="Track new-hire setup and drive completion across all onboarding milestones."
      />

      <Card>
        <CardHeader>
          <CardTitle>Progress Tracker</CardTitle>
          <CardDescription>{completed} of {tasks.length} tasks completed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-3 rounded bg-slate-200">
            <div className="h-3 rounded bg-slate-900" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-600">Current completion: {progress}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Checklist</CardTitle>
          <CardDescription>Actionable setup list for HR and line managers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              onClick={() => {
                setTasks((prev) =>
                  prev.map((item) => (item.id === task.id ? { ...item, done: !item.done } : item))
                );
              }}
              className="flex w-full items-center justify-between rounded border border-slate-200 px-3 py-2 text-left"
            >
              <span className="text-sm text-slate-800">{task.label}</span>
              <span className={`text-xs font-semibold ${task.done ? 'text-emerald-600' : 'text-slate-500'}`}>
                {task.done ? 'Done' : 'Pending'}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <EmptyState
        tone="friendly"
        title="Welcome flow enabled"
        description="Friendly illustration area reserved for new-hire guidance and culture material."
        action={<Button>Open New Hire Pack</Button>}
      />
    </div>
  );
}
