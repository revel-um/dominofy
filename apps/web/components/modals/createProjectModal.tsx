"use client";

import { Fragment, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => void;
}

export default function CreateProjectModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (name.trim().length > 20) {
      setError("Name can be at most 20 characters");
      return;
    }
    if (description.trim().length > 50) {
      setError("Description can be at most 50 characters");
      return;
    }

    onSubmit(name.trim(), description.trim() || undefined);
    setName("");
    setDescription("");
    setError("");
    onClose();
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose} static>
        {/* overlay */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </TransitionChild>

        {/* centered panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="flex max-h-[90vh] w-[min(32rem,90vw)] flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
              {/* header */}
              <div className="flex items-start justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  Create New Project
                </DialogTitle>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="text-xl leading-none text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  &times;
                </button>
              </div>

              {/* body */}
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 bg-white dark:bg-gray-900">
                {/* Name */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {name.length}/20
                    </span>
                  </div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
                    placeholder="Enter project name"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Description <span className="text-gray-400 dark:text-gray-500">(optional)</span>
                    </label>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {description.length}/50
                    </span>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={50}
                    rows={4}
                    placeholder="Enter a brief description"
                    className="w-full resize-y rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none min-h-[96px] max-h-[160px]"
                  />
                </div>

                {error && <p className="text-sm text-red-600 dark:text-red-500">{error}</p>}
              </div>

              {/* footer */}
              <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-900">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="rounded-lg bg-blue-600 dark:bg-blue-500 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  Create
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
