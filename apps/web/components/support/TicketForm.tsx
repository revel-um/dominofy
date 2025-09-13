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
        <div className="p-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {initialData ? 'Edit Ticket' : 'Create New Ticket'}
            </h2>
            <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
            ×
            </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Title
            </label>
            <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 
                        bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                        focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
            />
            </div>

            <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Description
            </label>
            <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                minLength={10}
                placeholder="Please provide a detailed description (minimum 10 characters)"
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                        focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
            />
            </div>

            <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Category
            </label>
            <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                category: e.target.value as 'billing' | 'technical' | 'general' 
                }))}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                        focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="general">General</option>
            </select>
            </div>

            <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Priority
            </label>
            <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                priority: e.target.value as 'low' | 'medium' | 'high'
                }))}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100
                        focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
            </select>
            </div>

            <div className="flex justify-end space-x-3">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                Cancel
            </button>
            <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                {initialData ? 'Update' : 'Create'} Ticket
            </button>
            </div>
        </form>
        </div>
    );
    }