'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/client-auth';
import { Button } from '@lumion/ui';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface OnboardingData {
  department: string;
  position: string;
  startDate: string;
  phone: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>({
    department: '',
    position: '',
    startDate: '',
    phone: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    // TODO: Save onboarding data to database
    console.log('Onboarding data:', formData);
    router.push('/dashboard');
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  const progressPercentage = (step / 3) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Step {step} of 3
            </h2>
            <button
              onClick={handleSkip}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
            >
              Skip for now
            </button>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          {/* Step 1: Department & Position */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Tell us about your role
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Help us update your work information
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Department
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a department</option>
                  <option value="engineering">Engineering</option>
                  <option value="product">Product</option>
                  <option value="design">Design</option>
                  <option value="sales">Sales</option>
                  <option value="marketing">Marketing</option>
                  <option value="hr">Human Resources</option>
                  <option value="finance">Finance</option>
                  <option value="operations">Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Job Position
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  placeholder="e.g., Senior Engineer"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Start Date & Phone */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Employment details
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  When did you start and how can we reach you?
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Review your information
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Make sure everything looks correct
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Name:</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{user?.firstName} {user?.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Email:</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{user?.primaryEmailAddress?.emailAddress}</span>
                </div>
                <hr className="border-slate-200 dark:border-slate-600" />
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Department:</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{formData.department || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Position:</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{formData.position || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Start Date:</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{formData.startDate || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Phone:</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{formData.phone || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <Button
                onClick={handleBack}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            <div className="flex-1"></div>
            {step < 3 && (
              <Button
                onClick={handleNext}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={handleComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                Complete Onboarding
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
