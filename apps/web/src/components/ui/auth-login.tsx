'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

interface LoginFormProps {
    onSubmit: (email: string, password: string, remember: boolean) => Promise<void>;
    errorMessage?: string | null;
}
interface VideoBackgroundProps { videoUrl: string; }
interface FormInputProps {
    icon: React.ReactNode; type: string; placeholder: string;
    value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean;
}
interface ToggleSwitchProps { checked: boolean; onChange: () => void; id: string; }

const FormInput: React.FC<FormInputProps> = ({ icon, type, placeholder, value, onChange, required }) => (
    <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>
        <input type={type} placeholder={placeholder} value={value} onChange={onChange} required={required}
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-background/65 dark:bg-white/5 border border-border/80 dark:border-white/10 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors" />
    </div>
);

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, id }) => (
    <div className="relative inline-block w-10 h-5 cursor-pointer">
        <input type="checkbox" id={id} className="sr-only" checked={checked} onChange={onChange} />
        <div className={`absolute inset-0 rounded-full transition-colors duration-200 ease-in-out ${checked ? 'bg-foreground dark:bg-white' : 'bg-muted/80 dark:bg-white/20'}`}>
            <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-background dark:bg-black transition-transform duration-200 ease-in-out ${checked ? 'transform translate-x-5' : ''}`} />
        </div>
    </div>
);

const VideoBackground: React.FC<VideoBackgroundProps> = ({ videoUrl }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => { videoRef.current?.play().catch(console.error); }, []);
    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
            <div className="absolute inset-0 z-10 bg-black/35 dark:bg-black/45" />
            <video ref={videoRef} className="absolute inset-0 min-w-full min-h-full object-cover w-auto h-auto" autoPlay loop muted playsInline>
                <source src={videoUrl} type="video/mp4" />
            </video>
        </div>
    );
};

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, errorMessage }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit(email, password, remember);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-8 rounded-2xl backdrop-blur-sm bg-background/75 dark:bg-black/50 border border-border/80 dark:border-white/10 text-foreground dark:text-white">
            <div className="mb-8 text-center">
                <h2 className="relative inline-block font-display text-3xl font-normal text-foreground dark:text-white tracking-tight">Lumion HRIS</h2>
                <p className="text-muted-foreground dark:text-white/70 text-sm font-sans mt-2">Sign in to your workspace</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormInput icon={<Mail className="text-foreground/60 dark:text-white/60" size={18} />} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
                <div className="relative">
                    <FormInput icon={<Lock className="text-foreground/60 dark:text-white/60" size={18} />} type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/60 dark:text-white/60 hover:text-foreground dark:hover:text-white" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div onClick={() => setRemember(!remember)} className="cursor-pointer">
                            <ToggleSwitch checked={remember} onChange={() => setRemember(!remember)} id="remember-me" />
                        </div>
                        <label htmlFor="remember-me" className="text-sm text-muted-foreground dark:text-white/80 cursor-pointer" onClick={() => setRemember(!remember)}>Remember me</label>
                    </div>
                    <a href="/forgot-password" className="text-xs text-muted-foreground dark:text-white/60 hover:text-foreground dark:hover:text-white/90 transition-colors">Forgot password?</a>
                </div>
                <button type="submit" disabled={isSubmitting}
                    className="w-full py-2.5 rounded-md bg-foreground text-background dark:bg-white dark:text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
                <p className="text-center text-xs text-white/40 mt-4">
                    Setting up your company?{' '}
                    <a href="/register" className="text-white/60 hover:text-white underline">
                        Create your workspace
                    </a>
                </p>
                {errorMessage ? (
                    <p className="text-sm text-destructive" role="alert">
                        {errorMessage}
                    </p>
                ) : null}
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground dark:text-white/40">
                Lumion Technology · Privacy Policy · Terms
            </p>
            <p className="mt-6 text-center text-xs text-muted-foreground dark:text-white/40">
                Contact your HR administrator to get access.
            </p>
        </div>
    );
};

const LoginPage = { LoginForm, VideoBackground };
export default LoginPage;
