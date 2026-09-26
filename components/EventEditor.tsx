import React, { useState, useEffect } from 'react';
import { BeatEvent } from '../types';
import { X, Check } from 'lucide-react';

interface EventEditorProps {
  event: BeatEvent | null;
  onSave: (event: BeatEvent) => void;
  onCancel: () => void;
}

export const EventEditor: React.FC<EventEditorProps> = ({ event, onSave, onCancel }) => {
  const [formData, setFormData] = useState<BeatEvent | null>(null);

  useEffect(() => {
    setFormData(event);
  }, [event]);

  if (!formData || !event) return null;

  const handleChange = (field: keyof BeatEvent, value: string) => {
    setFormData({
      ...formData,
      [field]: parseFloat(value) || 0
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Edit Event</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Time Offset (sec)</label>
            <input 
              type="number" 
              value={formData.timeOffset} 
              onChange={(e) => handleChange('timeOffset', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-accent-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Carrier Freq (Hz)</label>
              <input 
                type="number" 
                value={formData.carrierFreq} 
                onChange={(e) => handleChange('carrierFreq', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-accent-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Beat Freq (Hz)</label>
              <input 
                type="number" 
                step="0.1"
                value={formData.beatFreq} 
                onChange={(e) => handleChange('beatFreq', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-accent-500 outline-none"
              />
            </div>
          </div>

          <div>
             <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Volume (0-100)</label>
             <input 
                type="range" 
                min="0" 
                max="100" 
                value={formData.volume} 
                onChange={(e) => handleChange('volume', e.target.value)}
                className="w-full accent-accent-500"
              />
              <div className="text-right text-xs text-gray-500 mt-1">{formData.volume}%</div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={() => onSave(formData)}
            className="flex-1 bg-accent-600 hover:bg-accent-500 text-white py-2 rounded font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Check size={18} /> Save Changes
          </button>
          <button 
            onClick={onCancel}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
