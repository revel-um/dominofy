    import React, { useState } from 'react';
    import { TicketFormData } from '../../types/support';

    interface Props {
    onSubmit: (data: TicketFormData) => void;
    onClose: () => void;  // Add this line
    initialData?: Partial<TicketFormData>;
    }

    export default function TicketForm({ onSubmit, onClose, initialData }: Props) {
    const [formData, setFormData] = useState<TicketFormData>({
        title: initialData?.title || '',
        description: initialData?.description || '',
        category: initialData?.category || 'general',
        priority: initialData?.priority || 'medium'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate minimum length requirements
        if (formData.description.length < 10) {
            alert('Description must be at least 10 characters long');
            return;
        }
        
        onSubmit(formData);
    };

    return (
        <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(248,250,252,0.94)_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,_rgba(15,23,42,0.94)_0%,_rgba(2,6,23,0.94)_100%)]">
        <div className="flex items-start justify-between border-b border-slate-200/70 bg-slate-50/70 px-6 py-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                {initialData ? 'Edit Ticket' : 'Create New Ticket'}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Capture the issue clearly so the team can triage it quickly.
            </p>
            </div>
            <button
            onClick={onClose}
            className="text-xl leading-none text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
            &times;
            </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto bg-white/60 px-6 py-5 dark:bg-transparent">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Title
                </label>
                <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="mt-3 min-h-[48px] w-full rounded-[18px] border border-slate-200/90 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/55 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-sky-500/10"
                required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Description
                </label>
                <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                minLength={10}
                placeholder="Please provide a detailed description (minimum 10 characters)"
                className="mt-3 block w-full rounded-[18px] border border-slate-200/90 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/55 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-sky-500/10"
                required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Category
                </label>
                <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                category: e.target.value as 'billing' | 'technical' | 'general' 
                }))}
                className="mt-3 min-h-[48px] w-full rounded-[18px] border border-slate-200/90 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/55 dark:text-white dark:focus:ring-sky-500/10"
                >
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="general">General</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Priority
                </label>
                <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                priority: e.target.value as 'low' | 'medium' | 'high'
                }))}
                className="mt-3 min-h-[48px] w-full rounded-[18px] border border-slate-200/90 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/55 dark:text-white dark:focus:ring-sky-500/10"
                >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                </select>
            </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200/70 bg-slate-50/70 px-6 py-4 dark:border-white/10 dark:bg-white/[0.03]">
            <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[18px] border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
            >
                Cancel
            </button>
            <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center rounded-[18px] bg-sky-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {initialData ? 'Update' : 'Create'} Ticket
            </button>
            </div>
        </form>
        </div>
    );
    }
